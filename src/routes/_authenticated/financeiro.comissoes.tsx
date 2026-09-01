import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, fmtDate } from "@/lib/format";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2, RotateCcw, Printer } from "lucide-react";
import { ReceiptUpload } from "@/components/receipt-upload";

export const Route = createFileRoute("/_authenticated/financeiro/comissoes")({
  component: Comissoes,
});

type Row = {
  id: string; order_id: string | null; seller_id: string | null;
  beneficiary_name: string; scope: string; base_value: number; percent: number;
  amount: number; status: string; paid_at: string | null; paid_method: string | null;
  created_at: string; receipt_path: string | null;
};

const METHODS = ["PIX", "Dinheiro", "Transferência", "Cartão de crédito", "Boleto"];

const TABS = [
  { key: "vendedores", label: "Vendedores", scopes: ["seller", "external"] },
  { key: "arquitetos", label: "Arquitetos", scopes: ["architect"] },
  { key: "indicacoes", label: "Indicações", scopes: ["referral"] },
  { key: "outros", label: "Técnicos", scopes: ["tecnico"] },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const scopeLabel = (s: string) =>
  s === "seller" ? "Vendedor interno" : s === "external" ? "Vendedor externo"
  : s === "architect" ? "Arquiteto (RT)" : s === "referral" ? "Indicação / Revendedor"
  : s === "tecnico" ? "Técnico" : s;

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function Comissoes() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("vendedores");
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendente" | "pago">("todos");
  const [nameFilter, setNameFilter] = useState("");
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: rows } = useQuery({
    queryKey: ["commissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commissions").select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["orders-for-com"],
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("id, number, client_name, total, status, data, created_at")
        .order("number", { ascending: false }).limit(500);
      return data ?? [];
    },
  });

  // Alimenta automaticamente as comissões a partir dos pedidos existentes (idempotente).
  const autoRan = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!rows || !orders) return;
    const byOrder = new Map<string, Row[]>();
    for (const r of rows) if (r.order_id) byOrder.set(r.order_id, [...(byOrder.get(r.order_id) ?? []), r]);
    const todo = (orders ?? []).filter((o) => {
      if (autoRan.current.has(o.id)) return false;
      const list = byOrder.get(o.id) ?? [];
      const d = (o.data ?? {}) as Record<string, unknown>;
      const scopes = new Set(list.map((r) => r.scope));
      const needSeller = !!d.seller_id && !scopes.has("seller") && !scopes.has("external");
      const needArch = typeof d.architect === "string" && d.architect.trim() !== "" && !scopes.has("architect");
      const needRef = typeof d.external_salesperson === "string" && d.external_salesperson.trim() !== "" && !scopes.has("referral");
      const staleTotal = list.some((r) => r.status === "pendente" && Number(r.base_value) !== Number(o.total || 0));
      return needSeller || needArch || needRef || staleTotal;
    });
    if (todo.length === 0) return;
    (async () => {
      const { generateCommissionsForOrder } = await import("@/lib/generate-commissions");
      for (const o of todo) {
        autoRan.current.add(o.id);
        await generateCommissionsForOrder(o.id);
      }
      qc.invalidateQueries({ queryKey: ["commissions"] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, orders]);

  async function markPaid(r: Row, method: string) {
    await supabase.from("commissions").update({
      status: "pago", paid_at: new Date().toISOString(), paid_method: method,
    }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["commissions"] });
  }
  async function reopen(r: Row) {
    await supabase.from("commissions").update({ status: "pendente", paid_at: null, paid_method: null }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["commissions"] });
  }
  async function remove(r: Row) {
    if (!confirm("Excluir esta comissão?")) return;
    await supabase.from("commissions").delete().eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["commissions"] });
  }
  async function updatePercent(r: Row, pct: number) {
    if (!Number.isFinite(pct) || pct < 0) return;
    await supabase.from("commissions")
      .update({ percent: pct, amount: Number((Number(r.base_value) * pct / 100).toFixed(2)) })
      .eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["commissions"] });
  }

  const ordersMap = useMemo(() => {
    const m = new Map<string, { number: number; client_name: string; total: number }>();
    (orders ?? []).forEach((o) =>
      m.set(o.id, { number: o.number, client_name: o.client_name ?? "", total: Number(o.total || 0) }));
    return m;
  }, [orders]);

  const tabScopes = useMemo(() => new Set(TABS.find((t) => t.key === tab)!.scopes as readonly string[]), [tab]);

  const filtered = useMemo(() => {
    let r = (rows ?? []).filter((x) => tabScopes.has(x.scope));
    if (statusFilter !== "todos") r = r.filter((x) => x.status === statusFilter);
    if (nameFilter) r = r.filter((x) => x.beneficiary_name.toLowerCase().includes(nameFilter.toLowerCase()));
    if (from) r = r.filter((x) => x.created_at.slice(0, 10) >= from);
    if (to) r = r.filter((x) => x.created_at.slice(0, 10) <= to);
    return r;
  }, [rows, tabScopes, statusFilter, nameFilter, from, to]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; name: string; rows: Row[]; total: number; pend: number }>();
    for (const r of filtered) {
      const key = r.beneficiary_name || "—";
      const g = map.get(key) ?? { key, name: key, rows: [], total: 0, pend: 0 };
      g.rows.push(r);
      g.total += Number(r.amount || 0);
      if (r.status !== "pago") g.pend += Number(r.amount || 0);
      map.set(key, g);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const totals = useMemo(() => {
    const t = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
    const pago = filtered.filter((r) => r.status === "pago").reduce((s, r) => s + Number(r.amount || 0), 0);
    return { total: t, pago, pend: t - pago };
  }, [filtered]);

  const history = useMemo(
    () => filtered.filter((r) => r.status === "pago" && r.paid_at)
      .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? "")),
    [filtered],
  );

  function printTab(only?: typeof groups) {
    const gs = only ?? groups;
    if (gs.length === 0) { alert("Nada para imprimir."); return; }
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const title = TABS.find((t) => t.key === tab)!.label;
    const grand = gs.reduce((s, g) => s + g.total, 0);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Comissões — ${title}</title>
<style>
body{font-family:Inter,system-ui,sans-serif;color:#1A1A1A;padding:24px;background:#fff}
h1{font-family:'Playfair Display',serif;font-size:22px;margin:0 0 4px}
h2{font-family:'Playfair Display',serif;font-size:16px;margin:22px 0 6px;border-bottom:1px solid #D9D9D9;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}
th{background:#F2F2F2;text-transform:uppercase;font-size:10px;letter-spacing:.05em}
.r{text-align:right}.tot{font-weight:700;background:#FAFAFA}
.meta{color:#4A4A4A;font-size:11px;margin-bottom:12px}
.grand{margin-top:20px;font-size:14px;font-weight:700;text-align:right;border-top:2px solid #1A1A1A;padding-top:8px}
@media print{@page{size:A4;margin:0}body{padding:14mm}}
</style></head><body>
<h1>Comissões — ${title}</h1>
<div class="meta">Período ${fmtDate(from)} a ${fmtDate(to)} • Emitido em ${new Date().toLocaleString("pt-BR")}</div>
${gs.map((g) => `
  <h2>${g.name}</h2>
  <table><thead><tr>
    <th>Data</th><th>Pedido</th><th>Cliente</th><th class="r">Valor Pedido</th>
    <th class="r">%</th><th class="r">Comissão</th><th>Status</th>
  </tr></thead><tbody>
  ${g.rows.map((r) => {
    const o = r.order_id ? ordersMap.get(r.order_id) : null;
    return `<tr>
      <td>${fmtDate(r.created_at)}</td>
      <td>${o ? "PED." + String(o.number).padStart(3, "0") : "—"}</td>
      <td>${o?.client_name ?? "—"}</td>
      <td class="r">${brl(Number(r.base_value))}</td>
      <td class="r">${Number(r.percent).toFixed(2)}%</td>
      <td class="r">${brl(Number(r.amount))}</td>
      <td>${r.status === "pago" ? "Pago em " + fmtDate(r.paid_at!) : "Pendente"}</td>
    </tr>`;
  }).join("")}
  <tr class="tot"><td colspan="5" class="r">Total a receber — ${g.name}</td>
    <td class="r">${brl(g.total)}</td><td></td></tr>
  </tbody></table>
`).join("")}
<div class="grand">Total geral: ${brl(grand)}</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;
    w.document.write(html); w.document.close();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-stone-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={"px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors " +
              (tab === t.key ? "border-stone-950 text-stone-950" : "border-transparent text-stone-500 hover:text-stone-950")}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["todos", "pendente", "pago"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={"px-3 py-1.5 text-xs font-bold uppercase tracking-wider border " +
                (statusFilter === s ? "bg-stone-950 text-white border-stone-950" : "border-stone-300 text-stone-600")}>
              {s}
            </button>
          ))}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-stone-300 px-2 py-1.5 text-sm" />
          <span className="text-stone-400 text-sm">até</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-stone-300 px-2 py-1.5 text-sm" />
          <input value={nameFilter} onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Filtrar nome..." className="border border-stone-300 px-3 py-1.5 text-sm" />
        </div>
        <button onClick={() => printTab()}
          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-stone-950 text-white hover:bg-stone-800 flex items-center gap-2">
          <Printer className="size-3.5" /> Imprimir / PDF desta aba
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total da aba" value={brl(totals.total)} />
        <Stat label="Pago" value={brl(totals.pago)} tone="ok" />
        <Stat label="A receber" value={brl(totals.pend)} tone={totals.pend > 0 ? "danger" : "ok"} />
      </div>

      {groups.length === 0 && (
        <div className="bg-white border border-stone-200 p-10 text-center text-stone-400 text-sm">
          Nenhuma comissão no período.
        </div>
      )}

      {groups.map((g) => (
        <div key={g.key} className="bg-white border border-stone-200">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-3">
            <div>
              <div className="font-display text-lg">{g.name}</div>
              <div className="text-xs text-stone-500 uppercase tracking-wider">{g.rows.length} pedido(s)</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[10px] uppercase text-stone-400">Total a receber</div>
                <div className="font-display text-lg">{brl(g.pend)}</div>
              </div>
              <button onClick={() => printTab([g])}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider border border-stone-300 hover:bg-stone-50">
                PDF
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100">
                  <th className="text-left p-3 font-bold">Data</th>
                  <th className="text-left p-3 font-bold">Pedido</th>
                  <th className="text-left p-3 font-bold">Cliente</th>
                  <th className="text-left p-3 font-bold">Tipo</th>
                  <th className="text-right p-3 font-bold">Valor pedido</th>
                  <th className="text-right p-3 font-bold">%</th>
                  <th className="text-right p-3 font-bold">Comissão</th>
                  <th className="text-left p-3 font-bold">Status</th>
                  <th className="text-right p-3 font-bold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => {
                  const o = r.order_id ? ordersMap.get(r.order_id) : null;
                  return (
                    <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="p-3 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="p-3 whitespace-nowrap text-stone-600">
                        {o ? "PED." + String(o.number).padStart(3, "0") : "—"}
                      </td>
                      <td className="p-3">{o?.client_name ?? "—"}</td>
                      <td className="p-3 text-stone-600 text-xs uppercase">{scopeLabel(r.scope)}</td>
                      <td className="p-3 text-right">{brl(Number(r.base_value))}</td>
                      <td className="p-3 text-right">
                        {r.status === "pago" ? (
                          Number(r.percent).toFixed(2) + "%"
                        ) : (
                          <input
                            type="number" step="0.01" defaultValue={Number(r.percent)}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (v !== Number(r.percent)) updatePercent(r, v);
                            }}
                            className="w-16 border border-stone-300 px-1 py-0.5 text-right text-sm"
                          />
                        )}
                      </td>
                      <td className="p-3 text-right font-bold">{brl(Number(r.amount))}</td>
                      <td className="p-3">
                        {r.status === "pago" ? (
                          <span className="text-xs font-bold uppercase text-emerald-700">Pago</span>
                        ) : (
                          <span className="text-xs font-bold uppercase text-stone-500">Pendente</span>
                        )}
                        {r.paid_at && <div className="text-xs text-stone-500">{fmtDate(r.paid_at)} • {r.paid_method}</div>}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <ReceiptUpload
                          receiptPath={r.receipt_path}
                          scope="commissions"
                          entityId={r.id}
                          onChange={async (path) => {
                            await supabase.from("commissions").update({ receipt_path: path }).eq("id", r.id);
                            qc.invalidateQueries({ queryKey: ["commissions"] });
                          }}
                        />
                        {r.status !== "pago" ? (
                          <select onChange={(e) => e.target.value && markPaid(r, e.target.value)} defaultValue=""
                            className="text-xs border border-stone-300 px-2 py-1 mx-2">
                            <option value="">Marcar paga…</option>
                            {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                        ) : (
                          <button onClick={() => reopen(r)} className="text-stone-400 hover:text-stone-950 mx-2" title="Reabrir">
                            <RotateCcw className="size-4 inline" />
                          </button>
                        )}
                        <button onClick={() => remove(r)} className="text-stone-400 hover:text-red-600" title="Excluir">
                          <Trash2 className="size-4 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-stone-50">
                  <td colSpan={6} className="p-3 text-right text-xs font-bold uppercase tracking-wider text-stone-500">
                    Subtotal {g.name}
                  </td>
                  <td className="p-3 text-right font-display">{brl(g.total)}</td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="bg-white border border-stone-200">
        <div className="px-4 py-3 border-b border-stone-100">
          <h2 className="font-display text-lg">Histórico de pagamentos</h2>
        </div>
        {history.length === 0 ? (
          <div className="p-6 text-center text-stone-400 text-sm">Nenhum pagamento registrado no período.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {history.map((r) => {
                const o = r.order_id ? ordersMap.get(r.order_id) : null;
                return (
                  <tr key={r.id} className="border-b border-stone-100">
                    <td className="p-3 whitespace-nowrap">{fmtDate(r.paid_at!)}</td>
                    <td className="p-3">{r.beneficiary_name}</td>
                    <td className="p-3 text-stone-600">{o ? "PED." + String(o.number).padStart(3, "0") : "—"}</td>
                    <td className="p-3 text-stone-600">{r.paid_method ?? "—"}</td>
                    <td className="p-3 text-right font-bold">{brl(Number(r.amount))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <div className="bg-white border border-stone-200 p-4">
      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">{label}</div>
      <div className={"font-display text-xl mt-1 " + (tone === "danger" ? "text-red-700" : tone === "ok" ? "text-emerald-700" : "")}>{value}</div>
    </div>
  );
}
