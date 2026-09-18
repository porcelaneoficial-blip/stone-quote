import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { useAccessGate } from "@/lib/access-gate";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";

const SUGESTOES = [
  "Quais pedidos estão em produção?",
  "Quanto tenho a receber este mês?",
  "Quais medições estão agendadas para esta semana?",
  "Mostre o resumo do pedido 12",
];

export function PedraChat({
  contexto,
  compact = false,
}: {
  contexto?: string;
  compact?: boolean;
}) {
  const { session } = useAccessGate();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, body }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: {
              ...body,
              messages,
              contexto: contexto ?? null,
              modulos: session?.modules ?? [],
              papel: session?.role ?? "admin",
              usuario: session?.name ?? null,
            },
          };
        },
      }),
    [contexto, session?.modules, session?.role, session?.name],
  );

  const { messages, sendMessage, status, error, addToolApprovalResponse, stop } = useChat({
    id: "pedra-assistente",
    transport,
  });

  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status]);

  const carregando = status === "submitted" || status === "streaming";

  const enviar = (texto: string) => {
    const t = texto.trim();
    if (!t || carregando) return;
    void sendMessage({ text: t });
  };

  return (
    <div className={`flex flex-col ${compact ? "h-full" : "h-[calc(100vh-11rem)]"} bg-white`}>
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 && (
            <ConversationEmptyState
              title="Pedra Assistente"
              description="Pergunte sobre orçamentos, pedidos, medições, produção ou financeiro. Ações que gravam dados sempre pedem sua confirmação."
            >
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => enviar(s)}
                    className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left text-sm text-black transition hover:border-neutral-400"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          )}

          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={
                  message.role === "assistant"
                    ? "bg-transparent text-black"
                    : "bg-primary text-primary-foreground"
                }
              >
                {message.parts.map((part, i) => {
                  if (part.type === "text") {
                    return message.role === "assistant" ? (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    ) : (
                      <span key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </span>
                    );
                  }

                  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
                    const p = part as any;
                    const nome = String(part.type).replace("tool-", "").replaceAll("_", " ");

                    if (p.state === "approval-requested") {
                      return (
                        <div
                          key={i}
                          className="my-2 rounded-2xl border border-neutral-300 bg-white p-4"
                        >
                          <p className="text-sm font-bold text-black">
                            ⚠️ Confirmação necessária — {nome}
                          </p>
                          <pre className="mt-2 overflow-x-auto rounded-xl bg-neutral-50 p-3 text-xs text-black">
                            {JSON.stringify(p.input, null, 2)}
                          </pre>
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                addToolApprovalResponse({
                                  id: p.approval?.id ?? p.approvalId,
                                  approved: true,
                                })
                              }
                            >
                              Confirmar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                addToolApprovalResponse({
                                  id: p.approval?.id ?? p.approvalId,
                                  approved: false,
                                })
                              }
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <Tool key={i} defaultOpen={false}>
                        <ToolHeader type={nome as any} state={p.state} />
                        <ToolContent>
                          <ToolInput input={p.input} />
                          <ToolOutput output={p.output} errorText={p.errorText} />
                        </ToolContent>
                      </Tool>
                    );
                  }

                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && <Shimmer>Consultando o sistema…</Shimmer>}
          {error && (
            <p className="rounded-2xl border border-red-200 bg-white p-3 text-sm text-red-700">
              🔴 Não consegui responder agora: {error.message}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-2 pb-3">
        <PromptInput
          onSubmit={(msg, e) => {
            e.preventDefault();
            const texto = (msg as any)?.text ?? "";
            enviar(texto);
            (e.currentTarget as HTMLFormElement).reset();
          }}
        >
          <PromptInputTextarea ref={textareaRef} placeholder="Pergunte à Pedra…" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
