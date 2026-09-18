import { createFileRoute } from "@tanstack/react-router";
import { PedraChat } from "@/components/pedra-chat";

export const Route = createFileRoute("/_authenticated/pedra")({
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
          "Assistente interna do Petra para consultar e operar orçamentos, pedidos, medições e financeiro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PedraPage,
});

function PedraPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-black">Pedra Assistente</h1>
        <p className="text-sm text-neutral-600">
          Sua assistente interna do Petra — consulta os módulos e executa ações com confirmação.
        </p>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white">
        <PedraChat contexto="Pedra Assistente (tela dedicada)" />
      </div>
    </div>
  );
}
