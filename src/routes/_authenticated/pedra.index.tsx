import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { criarConversa, listarConversas } from "@/lib/pedra-threads";

export const Route = createFileRoute("/_authenticated/pedra/")({
  head: () => ({
    meta: [
      { title: "Pedra Assistente · Petra" },
      {
        name: "description",
        content:
          "A Pedra Assistente consulta orçamentos, pedidos, medições, produção e financeiro da Porcelane e executa ações com confirmação.",
      },
      { property: "og:title", content: "Pedra Assistente · Petra" },
      {
        property: "og:description",
        content:
          "Assistente interna do Petra para consultar e operar pedidos, medições e financeiro, com histórico de conversas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PedraEntrada,
});

function PedraEntrada() {
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const conversas = await listarConversas();
        const alvo = conversas[0] ?? (await criarConversa());
        if (vivo) {
          navigate({ to: "/pedra/$threadId", params: { threadId: alvo.id }, replace: true });
        }
      } catch (e: any) {
        if (vivo) setErro(e?.message ?? "Não consegui abrir a Pedra agora.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [navigate]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-black">Pedra Assistente</h1>
      <p className="mt-2 text-sm text-neutral-600">
        {erro ? `🔴 ${erro}` : "Abrindo sua conversa…"}
      </p>
    </div>
  );
}
