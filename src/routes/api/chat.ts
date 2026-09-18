import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { buildPedraTools } from "@/lib/pedra-tools.server";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";

type ChatBody = {
  messages?: unknown;
  contexto?: string | null;
  modulos?: string[] | null;
  papel?: string | null;
  usuario?: string | null;
};

const SYSTEM = `Você é a **Pedra Assistente**, a inteligência interna do sistema Petra, que opera a marmoraria Porcelane V1.

Como você fala:
- Português do Brasil, direto, cordial e objetivo. Nada de jargão técnico de programação.
- Use **negrito** para destacar valores, datas e números de pedido. Use emojis de status: ✅ concluído, 🔄 em andamento, ⏳ aguardando, 🔴 atrasado.
- Respostas curtas e organizadas em tópicos ou cartões de texto. Sempre em reais (R$) e datas no formato dia/mês/ano.

Regras do negócio que você nunca quebra:
- Nunca exiba o preço interno do m² ao falar de documentos comerciais.
- Nada é apagado: alterações preservam histórico.
- Pedido aprovado ou comercialmente bloqueado só muda por revisão/aditivo — avise o usuário em vez de alterar direto.
- Instalação e medição somente em horário comercial (08:00 às 18:00).
- Fluxo oficial: Orçamento → Aprovação → Pedido → Medição → Liberação Técnica → Produção → Acabamento → Carregamento → Instalação → Finalização → Pós-venda.

Como você trabalha:
- Consulte os dados com as ferramentas antes de responder; nunca invente números.
- Toda ação que grava dados pede confirmação do usuário — explique claramente o que será feito antes.
- Se faltar informação, pergunte de forma curta.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        const messages = body.messages;
        if (!Array.isArray(messages)) {
          return new Response("Mensagens inválidas", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const SUPABASE_URL = process.env["SUPABASE_URL"];
        const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Backend indisponível", { status: 500 });
        }

        const authHeader = request.headers.get("authorization") ?? "";
        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: authHeader ? { Authorization: authHeader } : {} },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const modulos = Array.isArray(body.modulos) ? body.modulos : [];
        const papel = body.papel ?? "admin";
        const can = (m: string) =>
          papel === "admin" || papel === "supervisor" || modulos.length === 0 || modulos.includes(m);

        const initialRunId = getLovableAiGatewayRunId(request);
        const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: key,
          headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });

        const contexto = body.contexto
          ? `\n\nO usuário está agora na tela: ${body.contexto}. Considere isso ao responder.`
          : "";
        const hoje = new Date().toISOString().slice(0, 10);

        const result = streamText({
          model: lovable.responses("openai/gpt-6-astra"),
          system: `${SYSTEM}\n\nData de hoje: ${hoje}.${contexto}`,
          messages: await convertToModelMessages(messages as UIMessage[]),
          tools: buildPedraTools(supabase, can),
          stopWhen: stepCountIs(50),
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return withLovableAiGatewayRunIdHeader(
          result.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
            sendReasoning: true,
            headers: getLovableAiGatewayResponseHeaders(undefined, {
              ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
            }),
          }),
          runIdFetch,
        );
      },
    },
  },
});
