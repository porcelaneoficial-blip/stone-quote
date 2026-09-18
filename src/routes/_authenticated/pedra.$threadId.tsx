import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { UIMessage } from "ai";
import { PedraChat } from "@/components/pedra-chat";
import { PedraRegras } from "@/components/pedra-regras";
import {
  carregarMensagens,
  criarConversa,
  excluirConversa,
  listarConversas,
  renomearConversa,
  type PedraThread,
} from "@/lib/pedra-threads";
import { MessagesSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pedra/$threadId")({
  head: () => ({
    meta: [
      { title: "Conversa com a Pedra · Petra" },
      {
        name: "description",
        content:
          "Converse com a Pedra Assistente sobre pedidos, orçamentos, medições e financeiro, com histórico guardado por usuário.",
      },
      { property: "og:title", content: "Conversa com a Pedra · Petra" },
      {
        property: "og:description",
        content: "Histórico de conversas da Pedra Assistente dentro do Petra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConversaPage,
});

const SUGESTOES_PEDIDOS = [
  "Quais pedidos estão em produção hoje?",
  "Mostre o resumo do pedido 12",
  "Quais pedidos estão aguardando medição?",
  "Quanto tenho a receber este mês?",
];

function ConversaPage() {
  const { threadId } = useParams({ from: "/_authenticated/pedra/$threadId" });
  const navigate = useNavigate();
  const [conversas, setConversas] = useState<PedraThread[]>([]);
  const [mensagens, setMensagens] = useState<UIMessage[] | null>(null);

  const recarregarLista = useCallback(async () => {
    try {
      setConversas(await listarConversas());
    } catch {
      /* lista indisponível não impede a conversa */
    }
  }, []);

  useEffect(() => {
    void recarregarLista();
  }, [recarregarLista]);

  useEffect(() => {
    let vivo = true;
    setMensagens(null);
    (async () => {
      try {
        const m = await carregarMensagens(threadId);
        if (vivo) setMensagens(m);
      } catch {
        if (vivo) setMensagens([]);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [threadId]);

  const nova = async () => {
    try {
      const t = await criarConversa();
      await recarregarLista();
      navigate({ to: "/pedra/$threadId", params: { threadId: t.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui abrir uma nova conversa.");
    }
  };

  const apagar = async (id: string) => {
    try {
      await excluirConversa(id);
      const restantes = conversas.filter((c) => c.id !== id);
      setConversas(restantes);
      if (id === threadId) {
        if (restantes[0]) navigate({ to: "/pedra/$threadId", params: { threadId: restantes[0].id } });
        else void nova();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui excluir a conversa.");
    }
  };

  const aoTitular = useCallback(
    (titulo: string) => {
      void renomearConversa(threadId, titulo).then(recarregarLista);
    },
    [threadId, recarregarLista],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
      <aside className="space-y-3">
        <button
          onClick={nova}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-neutral-800"
        >
          <Plus className="size-3" /> Nova conversa
        </button>
        <div className="rounded-2xl border border-neutral-200 bg-white p-2">
          <p className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-neutral-500">
            Histórico
          </p>
          {conversas.length === 0 && (
            <p className="px-2 py-3 text-sm text-neutral-400">Nenhuma conversa ainda.</p>
          )}
          <ul className="space-y-1">
            {conversas.map((c) => (
              <li
                key={c.id}
                className={`flex items-center gap-1 rounded-xl px-1 ${
                  c.id === threadId ? "bg-neutral-100" : "hover:bg-neutral-50"
                }`}
              >
                <button
                  onClick={() => navigate({ to: "/pedra/$threadId", params: { threadId: c.id } })}
                  className="flex-1 truncate px-2 py-2 text-left text-sm text-black"
                  title={c.title}
                >
                  <MessagesSquare className="mr-1 inline size-3 text-neutral-400" />
                  {c.title}
                </button>
                <button
                  onClick={() => apagar(c.id)}
                  className="p-2 text-neutral-400 hover:text-red-600"
                  aria-label="Excluir conversa"
                >
                  <Trash2 className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="rounded-2xl border border-neutral-200 bg-white">
        {mensagens === null ? (
          <p className="p-6 text-sm text-neutral-400">Carregando conversa…</p>
        ) : (
          <PedraChat
            key={threadId}
            threadId={threadId}
            initialMessages={mensagens}
            sugestoes={SUGESTOES_PEDIDOS}
            onTitulo={aoTitular}
            contexto="Pedra Assistente (tela dedicada, com histórico)"
          />
        )}
      </section>

      <aside>
        <PedraRegras />
      </aside>
    </div>
  );
}
