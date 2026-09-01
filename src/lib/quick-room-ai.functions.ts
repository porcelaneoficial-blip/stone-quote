import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `Você é uma arquiteta e projetista sênior especializada em marmoraria (pedras naturais, quartzo e porcelanato).
Você atua junto ao time de produção da Porcelane, ajudando na LIBERAÇÃO TÉCNICA de projetos.
Responda sempre em português brasileiro, de forma objetiva, técnica e prática.
Foque em:
- Sugestões de layout e disposição de peças (balcões, testeiras, respaldos, cubas, cooktop, churrasqueira).
- Escolha de acabamento de borda (reto, boleado, meia esquadria/45°, chanfrado) conforme uso e estilo.
- Espessura da pedra recomendada (20 mm, 30 mm, dupla espessura).
- Posicionamento ideal de cuba, cooktop, torre de tomadas, churrasqueira.
- Alertas de risco (peça longa sem apoio, emenda mal posicionada, cuba muito próxima da borda etc.).
- Aproveitamento de chapa e direção de veio quando relevante.
Seja breve — no máximo 8 linhas por resposta, use listas quando ajudar. Não invente medidas: se faltar dado, pergunte.`;

async function callGateway(messages: Array<{ role: string; content: string }>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
  });
  if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em alguns minutos.");
  if (res.status === 402) throw new Error("Créditos de IA esgotados.");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha na IA (${res.status}): ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

export const quickRoomChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    context: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    message: string;
  }) => {
    if (!input?.message?.trim()) throw new Error("message obrigatória");
    return input;
  })
  .handler(async ({ data }) => {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `Contexto do ambiente atual:\n${data.context}` },
      ...data.history.slice(-8),
      { role: "user", content: data.message },
    ];
    const content = await callGateway(messages);
    return { reply: content };
  });
