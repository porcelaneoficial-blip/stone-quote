import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroLayout,
});

const tabs = [
  { to: "/financeiro", label: "Resumo", exact: true },
  { to: "/financeiro/receber", label: "Contas a Receber" },
  { to: "/financeiro/pagar", label: "Contas a Pagar" },
  { to: "/financeiro/comissoes", label: "Comissões" },
];

function FinanceiroLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="label-eyebrow">Gestão</p>
        <h1 className="font-display text-4xl mt-1">Financeiro</h1>
      </div>
      <div className="border-b border-stone-200 mb-6 flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = t.exact ? path === t.to : path.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap " +
                (active
                  ? "border-stone-950 text-stone-950"
                  : "border-transparent text-stone-500 hover:text-stone-950")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
