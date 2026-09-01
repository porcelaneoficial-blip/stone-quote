import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, fmtDate } from "@/lib/format";
import { useMyRoles } from "@/lib/roles";
import { printPaymentReceipt } from "@/lib/payment-receipt";
import { RefreshCw, ExternalLink, Receipt } from "lucide-react";
import { Link } from "@tanstack/react-router";


/**
 * Painel financeiro do Pedido — LEITURA da fonte oficial.
 * Não duplica dados: consulta em tempo real receivables / commissions /
 * productivity_entries / value_change_log vinculados ao pedido.
 */

type Receivable = {
  id: string; description: string; installment_no: number; installment_total: number;
  due_date: string; amount: number; paid_amount: number; paid_at: string | null;
  method: string | null; status: string;
};
type Commission = {
  id: string; beneficiary_name: string; scope: string; base_value: number;
  percent: number; amount: number; status: string; paid_at: string | null;
};
type Prod = { id: string; commission_value: number | null; payout_status: string };
type LogRow = {
  id: string; field_label: string | null; field_path: string; old_value: number | null;
  new_value: number | null; changed_by_name: string | null; reason: string | null; created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", parcial: "Parcial", recebido: "Recebido", pago: "Pago",
  atrasado: "Atrasado", cancelado: "Cancelado",
};

export function OrderFinancialPanel({
  orderId, contracted, approvedTotal, paymentSummary, quoteId, clientName, orderNumber,
}: {
  orderId: string;
  contracted: number;
  approvedTotal?: number | null;
  paymentSummary: string;
  quoteId?: string | null;
  clientName?: string | null;
  orderNumber?: number | null;
}) {
  const perms = useMyRoles();
  const [recs, setRecs] = useState<Receivable[]>([]);
  const [comms, setComms] = useState<Commission[]>([]);
  const [prods, setProds] = useState<Prod[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viaRecibo, setViaRecibo] = useState<"cliente" | "empresa" | "ambas">("ambas");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: r }, { data: c }, { data: p }, { data: l }] = await Promise.all([
      supabase.from("receivables")
        .select("id, description, installment_no, installment_total, due_date, amount, paid_amount, paid_at, method, status")
        .eq("order_id", orderId).order("due_date"),
      supabase.from("commissions")
        .select("id, beneficiary_name, scope, base_value, percent, amount, status, paid_at")
        .eq("order_id", orderId).order("created_at"),
      supabase.from("productivity_entries")
        .select("id, commission_value, payout_status").eq("order_id", orderId),
      supabase.from("value_change_log")
        .select("id, field_label, field_path, old_value, new_value, changed_by_name, reason, created_at")
        .eq("entity_type", "order").eq("entity_id", orderId).order("created_at", { ascending: false }).limit(30),
    ]);
    setRecs((r ?? []) as Receivable[]);
    setComms((c ?? []) as Commission[]);
    setProds((p ?? []) as Prod[]);
    setLogs((l ?? []) as LogRow[]);
    setLoading(false);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  // Mantém o recibo/parcelas em sincronia com o financeiro em tempo real.
  useEffect(() => {
    const ch = supabase
      .channel(`order-fin-${orderId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "receivables", filter: `order_id=eq.${orderId}` },
        () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orderId, load]);


  const received = recs.reduce((s, x) => s + Number(x.paid_amount || 0), 0);
  const foreseen = recs.reduce((s, x) => s + Number(x.amount || 0), 0);
  const pending = Math.max(0, foreseen - received);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = recs
    .filter((x) => x.due_date < today && Number(x.paid_amount || 0) < Number(x.amount || 0))
    .reduce((s, x) => s + (Number(x.amount || 0) - Number(x.paid_amount || 0)), 0);

  const commissionsTotal = comms.reduce((s, x) => s + Number(x.amount || 0), 0);
  const productionTotal = prods.reduce((s, x) => s + Number(x.commission_value || 0), 0);
  const costs = commissionsTotal + productionTotal;
  const margin = contracted - costs;

  const orderRef = orderNumber != null ? `PED. ${String(orderNumber).padStart(3, "0")}` : null;
  const paidRows = recs.filter((r) => Number(r.paid_amount || 0) > 0);

  function reciboParcela(r: Receivable) {
    const valor = Number(r.paid_amount || 0);
    printPaymentReceipt({
      copies: viaRecibo,
      numero: r.id.slice(0, 8).toUpperCase(),
      clientName: clientName || "—",
      orderRef,
      orderTotal: contracted,
      amount: valor,
      paidAt: r.paid_at,
      method: r.method,
      description: r.description,
      items: [{ label: r.description, value: valor, paidAt: r.paid_at, method: r.method }],
      totalPago: received,
      saldo: Math.max(0, contracted - received),
    });
  }

  function reciboConsolidado() {
    printPaymentReceipt({
      copies: viaRecibo,
      numero: orderRef ? orderRef.replace(/\D/g, "") : undefined,
      clientName: clientName || "—",
      orderRef,
      orderTotal: contracted,
      amount: received,
      paidAt: paidRows[paidRows.length - 1]?.paid_at ?? null,
      method: paidRows.map((r) => r.method).filter(Boolean).join(", ") || null,
      description: "pagamentos recebidos do pedido",
      items: paidRows.map((r) => ({
        label: r.description,
        value: Number(r.paid_amount || 0),
        paidAt: r.paid_at,
        method: r.method,
      })),
      totalPago: received,
      saldo: Math.max(0, contracted - received),
    });
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl">Financeiro do pedido</h2>
          <p className="text-xs text-stone-500">
            Dados consultados diretamente da fonte oficial (contas a receber, comissões e produção). Nenhuma cópia é mantida aqui.
          </p>
        </div>
        <button onClick={load} className="text-xs uppercase tracking-widest font-bold border border-stone-300 px-3 py-2 flex items-center gap-2 hover:bg-stone-100">
          <RefreshCw className={"size-3 " + (loading ? "animate-spin" : "")} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Valor contratado" value={brl(contracted)} />
        <Card label="Recebido" value={brl(received)} tone="ok" />
        <Card label="Pendente" value={brl(pending)} tone={pending > 0 ? "warn" : undefined} />
        <Card label="Em atraso" value={brl(overdue)} tone={overdue > 0 ? "bad" : undefined} />
      </div>

      <div className="bg-white border border-stone-200 p-4 space-y-1">
        <div className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">Condições de pagamento (fonte: pedido)</div>
        <div className="text-sm">{paymentSummary || "—"}</div>
        {approvedTotal != null && Number(approvedTotal) !== Number(contracted) && (
          <div className="text-xs text-amber-700">
            Snapshot aprovado (histórico): {brl(Number(approvedTotal))} — valor vigente: {brl(contracted)}
          </div>
        )}
        {quoteId && (
          <Link to="/orcamentos/$id" params={{ id: quoteId }} className="text-xs text-gold-high inline-flex items-center gap-1 hover:underline">
            Orçamento vigente <ExternalLink className="size-3" />
          </Link>
        )}
      </div>

      <Section title="Parcelas e vencimentos">
        {recs.length === 0 ? (
          <Empty text="Nenhuma parcela gerada para este pedido." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-stone-500 border-b border-stone-200">
                <th className="text-left py-2">Descrição</th>
                <th className="text-left">Vencimento</th>
                <th className="text-right">Valor</th>
                <th className="text-right">Recebido</th>
                <th className="text-left pl-3">Situação</th>
                <th className="text-right">Recibo</th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r) => {
                const late = r.due_date < today && Number(r.paid_amount || 0) < Number(r.amount || 0);
                const paid = Number(r.paid_amount || 0) > 0;
                return (
                  <tr key={r.id} className="border-b border-stone-100">
                    <td className="py-2">{r.description}</td>
                    <td className={late ? "text-red-600" : ""}>{fmtDate(r.due_date)}</td>
                    <td className="text-right font-mono">{brl(Number(r.amount || 0))}</td>
                    <td className="text-right font-mono">{brl(Number(r.paid_amount || 0))}</td>
                    <td className="pl-3">{STATUS_LABEL[r.status] ?? r.status}</td>
                    <td className="text-right">
                      {paid && (
                        <button onClick={() => reciboParcela(r)} title="Recibo desta parcela"
                          className="text-stone-500 hover:text-stone-950">
                          <Receipt className="size-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
          <Link to="/financeiro/receber" className="text-xs text-gold-high inline-flex items-center gap-1 hover:underline">
            Abrir Contas a receber <ExternalLink className="size-3" />
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">Vias do recibo</label>
            <select
              value={viaRecibo}
              onChange={(e) => setViaRecibo(e.target.value as "cliente" | "empresa" | "ambas")}
              className="text-xs border border-stone-300 px-2 py-2 bg-white">
              <option value="cliente">Somente cliente</option>
              <option value="empresa">Somente empresa</option>
              <option value="ambas">Ambas as vias</option>
            </select>
            {paidRows.length > 0 && (
              <button onClick={reciboConsolidado}
                className="text-xs uppercase tracking-widest font-bold border border-stone-300 px-3 py-2 flex items-center gap-2 hover:bg-stone-100">
                <Receipt className="size-3" /> Recibo do cliente ({brl(received)})
              </button>
            )}
          </div>
        </div>
      </Section>


      {perms.canSeeFinancials && (
        <Section title="Custos relacionados">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <Card label="Comissões" value={brl(commissionsTotal)} />
            <Card label="Produção (corte/acabamento)" value={brl(productionTotal)} />
            <Card label="Margem estimada" value={brl(margin)} tone={margin < 0 ? "bad" : "ok"} />
          </div>
          {comms.length === 0 ? (
            <Empty text="Nenhuma comissão registrada." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-stone-500 border-b border-stone-200">
                  <th className="text-left py-2">Beneficiário</th>
                  <th className="text-left">Tipo</th>
                  <th className="text-right">Base</th>
                  <th className="text-right">%</th>
                  <th className="text-right">Valor</th>
                  <th className="text-left pl-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {comms.map((c) => (
                  <tr key={c.id} className="border-b border-stone-100">
                    <td className="py-2">{c.beneficiary_name}</td>
                    <td className="capitalize">{c.scope}</td>
                    <td className="text-right font-mono">{brl(Number(c.base_value || 0))}</td>
                    <td className="text-right font-mono">{Number(c.percent || 0).toFixed(2)}%</td>
                    <td className="text-right font-mono">{brl(Number(c.amount || 0))}</td>
                    <td className="pl-3">{STATUS_LABEL[c.status] ?? c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link to="/financeiro/comissoes" className="text-xs text-gold-high inline-flex items-center gap-1 hover:underline mt-2">
            Abrir Comissões <ExternalLink className="size-3" />
          </Link>
        </Section>
      )}

      <Section title="Histórico financeiro (alterações de valores)">
        {logs.length === 0 ? (
          <Empty text="Nenhuma alteração de valor registrada." />
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => (
              <li key={l.id} className="text-sm border-b border-stone-100 pb-2">
                <span className="font-medium">{l.field_label || l.field_path}</span>{" "}
                <span className="font-mono text-stone-500">
                  {brl(Number(l.old_value || 0))} → {brl(Number(l.new_value || 0))}
                </span>
                <div className="text-xs text-stone-500">
                  {fmtDate(l.created_at)} · {l.changed_by_name || "—"}{l.reason ? ` · ${l.reason}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-600" : "text-stone-950";
  return (
    <div className="bg-white border border-stone-200 p-4">
      <div className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">{label}</div>
      <div className={"text-lg font-mono " + color}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-stone-200 p-4">
      <h3 className="text-xs uppercase tracking-widest font-bold text-stone-500 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-stone-400">{text}</p>;
}
