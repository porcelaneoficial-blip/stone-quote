import { Fragment, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, fmtDate , todayISO } from "@/lib/format";
import { useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw, Zap, ChevronDown, ChevronRight, QrCode, Clock, Receipt, Pencil } from "lucide-react";
import { ReceiptUpload } from "@/components/receipt-upload";
import { PixModal } from "@/components/pix-modal";
import { novoTxid } from "@/lib/pix";
import { printPaymentReceipt } from "@/lib/payment-receipt";



export const Route = createFileRoute("/_authenticated/financeiro/receber")({
  component: ContasReceber,
});

type Row = {
  id: string; order_id: string | null; client_name: string; description: string;
  installment_no: number; installment_total: number; due_date: string;
  amount: number; paid_amount: number; paid_at: string | null; method: string | null; status: string;
  receipt_path: string | null; pix_txid: string | null;
};


type OrderInfo = { id: string; number: number; client_name: string | null; total: number };

const METHODS = ["PIX", "Dinheiro", "Transferência", "Cartão de crédito", "Boleto", "À combinar"];

function ContasReceber() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendente" | "pago" | "atrasado">("todos");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const today = todayISO();

  const { data: rows } = useQuery({
    queryKey: ["receivables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("receivables").select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: ordersMap } = useQuery({
    queryKey: ["orders-map-recv"],
    queryFn: async () => {
      const { data } = await supabase.from("orders")
        .select("id, number, client_name, total")
        .order("number", { ascending: false }).limit(500);
      const map = new Map<string, OrderInfo>();
      for (const o of (data ?? []) as OrderInfo[]) map.set(o.id, o);
      return map;
    },
  });

  const { data: company } = useQuery({
    queryKey: ["company-pix"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("company_settings")
        .select("company_name, pix_key, pix_beneficiary_name, pix_city")
        .eq("user_id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const [pixRow, setPixRow] = useState<Row | null>(null);
  const [editRow, setEditRow] = useState<Partial<Row> | null>(null);


  // Realtime: qualquer alteração em receivables (inclusive baixa automática do webhook PIX)
  // atualiza a tela sem refresh.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      channel = supabase.channel(`receivables:${u.user.id}`);
      channel
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "receivables", filter: `user_id=eq.${u.user.id}` },
          () => qc.invalidateQueries({ queryKey: ["receivables"] }),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);


  // Abre o modal PIX garantindo que a parcela tem um txid persistido —
  // sem isso o webhook não consegue casar o pagamento com esta parcela.
  async function openPix(r: Row) {
    if (r.pix_txid) { setPixRow(r); return; }
    const txid = novoTxid();
    const { error } = await supabase.from("receivables")
      .update({ pix_txid: txid }).eq("id", r.id);
    if (error) { alert(error.message); return; }
    setPixRow({ ...r, pix_txid: txid });
    qc.invalidateQueries({ queryKey: ["receivables"] });
  }


  const ordersWithoutReceivables = useMemo(() => {
    if (!ordersMap || !rows) return [];
    const has = new Set(rows.map((r) => r.order_id).filter(Boolean));
    return Array.from(ordersMap.values()).filter((o) => !has.has(o.id));
  }, [ordersMap, rows]);

  // Group rows by order_id (avulsos go to a special "avulso" key per row)
  type Group = {
    key: string;
    order?: OrderInfo;
    client_name: string;
    items: Row[];
    total: number;
    pago: number;
    pend: number;
    nextDue: string | null;
    anyOverdue: boolean;
    allPaid: boolean;
  };

  const groups = useMemo<Group[]>(() => {
    const r = rows ?? [];
    const byKey = new Map<string, Row[]>();
    for (const x of r) {
      const k = x.order_id ?? `avulso:${x.id}`;
      const arr = byKey.get(k) ?? [];
      arr.push(x);
      byKey.set(k, arr);
    }
    const out: Group[] = [];
    for (const [key, items] of byKey) {
      const order = key.startsWith("avulso:") ? undefined : ordersMap?.get(key);
      const total = items.reduce((s, x) => s + Number(x.amount || 0), 0);
      const pago = items.reduce((s, x) => s + Number(x.paid_amount || 0), 0);
      const pend = total - pago;
      const pendItems = items.filter((x) => x.status !== "pago");
      const nextDue = pendItems.length
        ? pendItems.slice().sort((a, b) => a.due_date.localeCompare(b.due_date))[0].due_date
        : null;
      const anyOverdue = pendItems.some((x) => x.due_date < today);
      const allPaid = items.every((x) => x.status === "pago");
      out.push({
        key, order, client_name: order?.client_name ?? items[0].client_name,
        items, total, pago, pend, nextDue, anyOverdue, allPaid,
      });
    }
    return out.sort((a, b) => {
      // overdue first, then by next due, then paid
      if (a.allPaid !== b.allPaid) return a.allPaid ? 1 : -1;
      if (a.anyOverdue !== b.anyOverdue) return a.anyOverdue ? -1 : 1;
      return (a.nextDue ?? "9999").localeCompare(b.nextDue ?? "9999");
    });
  }, [rows, ordersMap, today]);

  const filteredGroups = useMemo(() => {
    let g = groups;
    if (statusFilter === "pago") g = g.filter((x) => x.allPaid);
    else if (statusFilter === "pendente") g = g.filter((x) => !x.allPaid && !x.anyOverdue);
    else if (statusFilter === "atrasado") g = g.filter((x) => x.anyOverdue);
    if (search.trim()) {
      const s = search.toLowerCase();
      g = g.filter((x) =>
        x.client_name.toLowerCase().includes(s) ||
        (x.order ? `#${x.order.number}`.includes(s) : false) ||
        x.items.some((it) => it.description.toLowerCase().includes(s)),
      );
    }
    return g;
  }, [groups, statusFilter, search]);

  const totals = useMemo(() => {
    const t = filteredGroups.reduce((s, g) => s + g.total, 0);
    const p = filteredGroups.reduce((s, g) => s + g.pago, 0);
    return { total: t, pago: p, pend: t - p };
  }, [filteredGroups]);

  /** Gera/atualiza as parcelas seguindo exatamente a forma de pagamento do pedido. */
  async function generateForOrder(orderId: string) {
    const { syncReceivablesForOrder } = await import("@/lib/generate-receivables");
    try {
      const r = await syncReceivablesForOrder(orderId);
      if (r?.skipped === "paid") alert("Há parcelas já baixadas — o financeiro não foi regerado.");
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      return;
    }
    setExpanded((s) => new Set(s).add(orderId));
    qc.invalidateQueries({ queryKey: ["receivables"] });
  }


  async function markPaid(r: Row, method: string) {
    await supabase.from("receivables").update({
      paid_amount: Number(r.amount), paid_at: new Date().toISOString(), method, status: "pago",
    }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["receivables"] });
  }
  async function markAllPaid(g: Group, method: string) {
    const ids = g.items.filter((x) => x.status !== "pago").map((x) => x.id);
    if (ids.length === 0) return;
    await supabase.from("receivables").update({
      paid_amount: 0, paid_at: new Date().toISOString(), method, status: "pago",
    } as never).in("id", ids);
    // set paid_amount per row
    for (const r of g.items.filter((x) => x.status !== "pago")) {
      await supabase.from("receivables").update({
        paid_amount: Number(r.amount), paid_at: new Date().toISOString(), method, status: "pago",
      }).eq("id", r.id);
    }
    qc.invalidateQueries({ queryKey: ["receivables"] });
  }
  async function reopen(r: Row) {
    await supabase.from("receivables").update({
      paid_amount: 0, paid_at: null, status: "pendente",
    }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["receivables"] });
  }
  async function remove(r: Row) {
    if (!confirm("Excluir esta parcela?")) return;
    await supabase.from("receivables").delete().eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["receivables"] });
  }
  async function addAvulso() {
    const desc = prompt("Descrição:");
    if (!desc) return;
    const client = prompt("Cliente:") ?? "";
    const amount = Number(prompt("Valor (R$):") ?? "0");
    const due = prompt("Vencimento (AAAA-MM-DD):", today) ?? today;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("receivables").insert({
      user_id: u.user.id, client_name: client, description: desc,
      due_date: due, amount, installment_no: 1, installment_total: 1, status: "pendente",
    });
    qc.invalidateQueries({ queryKey: ["receivables"] });
  }
  /** Salva uma parcela editada manualmente (cria se for nova). */
  async function saveEdit(v: Partial<Row>) {
    const amount = Number(v.amount || 0);
    const paid = Number(v.paid_amount || 0);
    const status = paid <= 0 ? "pendente" : paid + 0.005 < amount ? "parcial" : "pago";
    const payload = {
      client_name: v.client_name ?? "",
      description: v.description ?? "",
      due_date: v.due_date || today,
      amount,
      paid_amount: paid,
      method: v.method || null,
      installment_no: Number(v.installment_no || 1),
      installment_total: Number(v.installment_total || 1),
      status,
      paid_at: paid > 0 ? (v.paid_at ?? new Date().toISOString()) : null,
    };
    if (v.id) {
      const { error } = await supabase.from("receivables").update(payload).eq("id", v.id);
      if (error) { alert(error.message); return; }
    } else {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { error } = await supabase.from("receivables")
        .insert({ ...payload, user_id: u.user.id, order_id: v.order_id ?? null });
      if (error) { alert(error.message); return; }
    }
    setEditRow(null);
    qc.invalidateQueries({ queryKey: ["receivables"] });
  }

  function novaParcela(g: Group) {
    setEditRow({
      order_id: g.order?.id ?? null,
      client_name: g.client_name,
      description: g.order ? `Parcela manual — PED. ${g.order.number}` : "Lançamento",
      due_date: today,
      amount: 0,
      paid_amount: 0,
      installment_no: g.items.length + 1,
      installment_total: g.items.length + 1,
    });
  }


  function toggle(key: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  const orderRef = (g: Group) =>
    g.order ? `PED. ${String(g.order.number).padStart(3, "0")}` : null;

  /** Recibo de uma parcela paga. */
  function reciboParcela(g: Group, r: Row) {
    printPaymentReceipt({
      numero: r.id.slice(0, 8).toUpperCase(),
      clientName: g.client_name,
      orderRef: orderRef(g),
      orderTotal: g.order ? Number(g.order.total) : g.total,
      amount: Number(r.paid_amount || r.amount),
      paidAt: r.paid_at,
      method: r.method,
      description: `${r.description}${r.installment_total > 1 ? ` (${r.installment_no}/${r.installment_total})` : ""}`,
      totalPago: g.pago,
      saldo: g.pend,
    });
  }

  /** Recibo consolidado de tudo que já foi pago no pedido. */
  function reciboPedido(g: Group) {
    const pagas = g.items.filter((x) => Number(x.paid_amount || 0) > 0);
    if (pagas.length === 0) { alert("Nenhum pagamento recebido neste pedido."); return; }
    printPaymentReceipt({
      numero: g.key.slice(0, 8).toUpperCase(),
      clientName: g.client_name,
      orderRef: orderRef(g),
      orderTotal: g.order ? Number(g.order.total) : g.total,
      amount: g.pago,
      paidAt: pagas.map((x) => x.paid_at).filter(Boolean).sort().slice(-1)[0] ?? null,
      method: pagas[pagas.length - 1]?.method,
      description: g.order ? "pagamentos do pedido" : "pagamentos recebidos",
      items: pagas.map((x) => ({
        label: `${x.description}${x.installment_total > 1 ? ` (${x.installment_no}/${x.installment_total})` : ""} — ${fmtDate(x.paid_at ?? x.due_date)}`,
        value: Number(x.paid_amount || 0),
      })),
      totalPago: g.pago,
      saldo: g.pend,
    });
  }



  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-blue-900">
        <strong>Sincronizado com o pedido:</strong> ao sincronizar, as parcelas seguem a forma de pagamento do pedido. Você também pode editar qualquer parcela manualmente (valor, vencimento, forma e valor recebido) pelo ícone de lápis.
      </div>

      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          {(["todos", "pendente", "pago", "atrasado"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={"px-3 py-1.5 text-xs font-bold uppercase tracking-wider border " +
                (statusFilter === s ? "bg-stone-950 text-white border-stone-950" : "border-stone-300 text-stone-600")}>
              {s}
            </button>
          ))}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pedido ou cliente..."
            className="border border-stone-300 px-3 py-1.5 text-sm" />
        </div>
        <button onClick={addAvulso} className="bg-stone-950 text-white px-4 py-2 text-sm flex items-center gap-2">
          <Plus className="size-4" /> Lançamento avulso
        </button>
      </div>

      {ordersWithoutReceivables.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
            <Zap className="size-4" /> Pedidos sem parcelas geradas ({ordersWithoutReceivables.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {ordersWithoutReceivables.slice(0, 20).map((o) => (
              <button key={o.id} onClick={() => generateForOrder(o.id)}
                className="bg-white border border-amber-300 text-xs px-3 py-1.5 hover:bg-amber-100">
                #{o.number} {o.client_name} — {brl(Number(o.total))}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={brl(totals.total)} />
        <Stat label="Recebido" value={brl(totals.pago)} tone="ok" />
        <Stat label="A receber" value={brl(totals.pend)} tone={totals.pend > 0 ? "danger" : "ok"} />
      </div>

      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100">
              <th className="w-8 p-3"></th>
              <th className="text-left p-3 font-bold">Pedido</th>
              <th className="text-left p-3 font-bold">Cliente</th>
              <th className="text-left p-3 font-bold">Próximo vencimento</th>
              <th className="text-right p-3 font-bold">Total</th>
              <th className="text-right p-3 font-bold">A receber</th>
              <th className="text-left p-3 font-bold">Status</th>
              <th className="text-right p-3 font-bold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-stone-400">Nenhum pedido</td></tr>
            )}
            {filteredGroups.map((g) => {
              const isOpen = expanded.has(g.key);
              const paidCount = g.items.filter((x) => x.status === "pago").length;
              return (
                <Fragment key={g.key}>
                  <tr key={g.key} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                    onClick={() => toggle(g.key)}>
                    <td className="p-3 text-stone-400">
                      {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </td>
                    <td className="p-3 font-bold">
                      {g.order ? `#${g.order.number}` : <span className="text-stone-500">Avulso</span>}
                    </td>
                    <td className="p-3">{g.client_name}</td>
                    <td className="p-3 whitespace-nowrap text-stone-600">
                      {g.nextDue ? fmtDate(g.nextDue) : "—"}
                    </td>
                    <td className="p-3 text-right">{brl(g.total)}</td>
                    <td className="p-3 text-right font-bold">{brl(g.pend)}</td>
                    <td className="p-3">
                      {g.allPaid ? (
                        <span className="text-xs font-bold uppercase text-emerald-700">Pago</span>
                      ) : g.anyOverdue ? (
                        <span className="text-xs font-bold uppercase text-red-700">Atrasado</span>
                      ) : (
                        <span className="text-xs font-bold uppercase text-stone-500">
                          {paidCount}/{g.items.length} pagas
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {!g.allPaid && (
                        <select onChange={(e) => e.target.value && markAllPaid(g, e.target.value)} defaultValue=""
                          className="text-xs border border-stone-300 px-2 py-1">
                          <option value="">Baixar tudo…</option>
                          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      )}
                      {g.order && !g.allPaid && g.pago === 0 && (
                        <button onClick={() => generateForOrder(g.order!.id)}
                          title="Sincronizar parcelas e formas de pagamento com o pedido"
                          className="ml-2 text-xs border border-stone-300 px-2 py-1 hover:bg-stone-100">
                          Sincronizar
                        </button>
                      )}
                      <button onClick={() => novaParcela(g)} title="Adicionar parcela manual"
                        className="ml-2 text-xs border border-stone-300 px-2 py-1 hover:bg-stone-100">
                        + Parcela
                      </button>

                      {g.pago > 0 && (
                        <button onClick={() => reciboPedido(g)} title="Recibo de pagamento do pedido"
                          className="ml-2 text-stone-500 hover:text-stone-950">
                          <Receipt className="size-4 inline" />
                        </button>
                      )}

                    </td>

                  </tr>
                  {isOpen && (
                    <tr className="bg-stone-50/60">
                      <td></td>
                      <td colSpan={7} className="p-0">
                        <table className="w-full text-sm">
                          <tbody>
                            {g.items.slice().sort((a, b) => a.due_date.localeCompare(b.due_date)).map((r) => {
                              const atraso = r.status !== "pago" && r.due_date < today;
                              return (
                                <tr key={r.id} className="border-t border-stone-200">
                                  <td className="p-3 whitespace-nowrap text-stone-600">{fmtDate(r.due_date)}</td>
                                  <td className="p-3 text-stone-600">{r.description}</td>
                                  <td className="p-3 text-right">{brl(Number(r.amount))}</td>
                                  <td className="p-3">
                                    {r.status === "pago" ? (
                                      <span className="text-xs font-bold uppercase text-emerald-700">
                                        Pago{r.method === "PIX" ? " · PIX" : ""}
                                      </span>
                                    ) : atraso ? (
                                      <span className="text-xs font-bold uppercase text-red-700">Atrasado</span>
                                    ) : r.pix_txid ? (
                                      <span className="text-xs font-bold uppercase text-amber-700 inline-flex items-center gap-1">
                                        <Clock className="size-3" /> Aguardando PIX
                                      </span>
                                    ) : (
                                      <span className="text-xs font-bold uppercase text-stone-500">Pendente</span>
                                    )}
                                    {r.paid_at && <div className="text-xs text-stone-500">{r.method} • {fmtDate(r.paid_at)}</div>}
                                    {r.pix_txid && r.status !== "pago" && (
                                      <div className="text-[10px] text-stone-400 font-mono mt-0.5">ref {r.pix_txid}</div>
                                    )}
                                  </td>

                                  <td className="p-3 text-right whitespace-nowrap">
                                    <ReceiptUpload
                                      receiptPath={r.receipt_path}
                                      scope="receivables"
                                      entityId={r.id}
                                      onChange={async (path) => {
                                        await supabase.from("receivables").update({ receipt_path: path }).eq("id", r.id);
                                        qc.invalidateQueries({ queryKey: ["receivables"] });
                                      }}
                                    />
                                    {r.status !== "pago" ? (
                                      <>
                                        {company?.pix_key && (
                                          <button
                                            onClick={() => openPix(r)}
                                            title="Gerar PIX desta parcela"
                                            className="text-stone-400 hover:text-stone-950 mx-1"
                                          >
                                            <QrCode className="size-4 inline" />
                                          </button>
                                        )}

                                        <select onChange={(e) => e.target.value && markPaid(r, e.target.value)} defaultValue=""
                                          className="text-xs border border-stone-300 px-2 py-1 mx-2">
                                          <option value="">Dar baixa…</option>
                                          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                      </>
                                    ) : (
                                      <>
                                        <button onClick={() => reciboParcela(g, r)} title="Recibo de pagamento"
                                          className="text-stone-500 hover:text-stone-950 mx-1">
                                          <Receipt className="size-4 inline" />
                                        </button>
                                        <button onClick={() => reopen(r)} title="Reabrir" className="text-stone-400 hover:text-stone-950 mx-2">
                                          <RotateCcw className="size-4 inline" />
                                        </button>
                                      </>
                                    )}

                                    <button onClick={() => setEditRow(r)} title="Editar manualmente"
                                      className="text-stone-400 hover:text-stone-950 mx-1">
                                      <Pencil className="size-4 inline" />
                                    </button>
                                    <button onClick={() => remove(r)} title="Excluir" className="text-stone-400 hover:text-red-600">
                                      <Trash2 className="size-4 inline" />
                                    </button>

                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {pixRow && company?.pix_key && (
        <PixModal
          open={!!pixRow}
          onClose={() => setPixRow(null)}
          chavePix={company.pix_key}
          beneficiario={company.pix_beneficiary_name || company.company_name || ""}
          cidade={company.pix_city || ""}
          valor={Number(pixRow.amount)}
          descricao={`${pixRow.description} ${pixRow.installment_no}/${pixRow.installment_total}`.trim()}
          nomeCliente={pixRow.client_name}
          txid={pixRow.pix_txid || undefined}
          onPagamentoConfirmado={async () => {
            await markPaid(pixRow, "PIX");
          }}
        />
      )}
      {editRow && (
        <EditDialog
          value={editRow}
          onCancel={() => setEditRow(null)}
          onSave={saveEdit}
        />
      )}

    </div>
  );
}

function EditDialog({ value, onCancel, onSave }: {
  value: Partial<Row>;
  onCancel: () => void;
  onSave: (v: Partial<Row>) => void | Promise<void>;
}) {
  const [v, setV] = useState<Partial<Row>>(value);
  const set = (patch: Partial<Row>) => setV((s) => ({ ...s, ...patch }));
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white border border-stone-200 w-full max-w-lg p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg">{v.id ? "Editar parcela" : "Nova parcela"}</h3>
        <Field label="Cliente">
          <input className="inp" value={v.client_name ?? ""} onChange={(e) => set({ client_name: e.target.value })} />
        </Field>
        <Field label="Descrição">
          <input className="inp" value={v.description ?? ""} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vencimento">
            <input type="date" className="inp" value={v.due_date ?? ""} onChange={(e) => set({ due_date: e.target.value })} />
          </Field>
          <Field label="Valor (R$)">
            <input type="number" step="0.01" className="inp" value={Number(v.amount ?? 0)}
              onChange={(e) => set({ amount: Number(e.target.value) })} />
          </Field>
          <Field label="Valor recebido (R$)">
            <input type="number" step="0.01" className="inp" value={Number(v.paid_amount ?? 0)}
              onChange={(e) => set({ paid_amount: Number(e.target.value) })} />
          </Field>
          <Field label="Forma de pagamento">
            <select className="inp" value={v.method ?? ""} onChange={(e) => set({ method: e.target.value || null })}>
              <option value="">—</option>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Parcela nº">
            <input type="number" className="inp" value={Number(v.installment_no ?? 1)}
              onChange={(e) => set({ installment_no: Number(e.target.value) })} />
          </Field>
          <Field label="Total de parcelas">
            <input type="number" className="inp" value={Number(v.installment_total ?? 1)}
              onChange={(e) => set({ installment_total: Number(e.target.value) })} />
          </Field>
        </div>
        <p className="text-xs text-stone-500">
          O status é calculado pelo valor recebido: 0 = pendente, parcial ou pago.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-stone-300">Cancelar</button>
          <button onClick={() => onSave(v)} className="px-4 py-2 text-sm bg-stone-950 text-white">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">{label}</span>
      <div className="mt-1 [&_.inp]:w-full [&_.inp]:border [&_.inp]:border-stone-300 [&_.inp]:px-3 [&_.inp]:py-2 [&_.inp]:text-sm">
        {children}
      </div>
    </label>
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
