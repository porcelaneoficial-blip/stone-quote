import type { QuoteData } from "@/lib/types";
import { brl, fmtDate } from "@/lib/format";
import { orderPendingCount, orderPieceCount } from "@/lib/order-view";
import { orderBalance } from "@/lib/order-money";

/**
 * Cabeçalho único e compacto da Central do Pedido.
 * Aparece UMA vez por tela (acima das abas de conteúdo).
 * Recebido vem SEMPRE de receivables (ver src/lib/order-money.ts).
 */
export function OrderHubHeader(p: {
  number: number;
  createdAt: string;
  status: string;
  data: QuoteData;
  total: number;
  /** Soma de receivables.paid_amount — nunca orders.received. */
  received?: number | null;
  sellerName?: string;
  canSeeMoney?: boolean;
}) {
  const envs = p.data.environments ?? [];
  const released = envs.filter((e) => e.released_for_cut_at).length;
  const done = envs.filter((e) => e.production_status === "concluido").length;
  const received = Number(p.received ?? 0);
  const pending = orderBalance(p.total, received);
  const pendencias = orderPendingCount(p.data);

  const cells: { label: string; value: string }[] = [
    { label: "Data", value: fmtDate(p.createdAt) },
    { label: "Responsável", value: p.sellerName || p.data.salesperson || "—" },
    { label: "Ambientes", value: `${envs.length} · ${orderPieceCount(p.data)} peças` },
    { label: "Liberação", value: `${released}/${envs.length} liberados` },
    { label: "Produção", value: `${done}/${envs.length} concluídos` },
  ];
  if (p.canSeeMoney) {
    cells.push({ label: "Valor total", value: brl(p.total) });
    cells.push({ label: "Financeiro", value: pending > 0 ? `${brl(received)} recebido` : "Quitado" });
  }

  return (
    <header className="bg-white border border-stone-200">
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <span className="label-eyebrow text-accent">Pedido</span>
          <h2 className="font-display text-2xl leading-tight truncate">
            PED-{String(p.number).padStart(6, "0")}
            <span className="text-stone-400 font-sans text-base"> · {p.data.client_name || "Sem cliente"}</span>
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="kanban-badge kanban-badge-andamento">{(p.status || "—").replace(/_/g, " ")}</span>
          <span className={"kanban-badge " + (pendencias ? "kanban-badge-atencao" : "kanban-badge-positivo")}>
            {pendencias ? `${pendencias} pendência${pendencias > 1 ? "s" : ""}` : "Sem pendências"}
          </span>
        </div>
      </div>
      <div className="border-t border-stone-100 px-5 py-3 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7">
        {cells.map((c) => (
          <div key={c.label} className="min-w-0">
            <div className="label-eyebrow">{c.label}</div>
            <div className="text-sm font-medium truncate mt-0.5" title={c.value}>{c.value}</div>
          </div>
        ))}
      </div>
    </header>
  );
}
