import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_METHOD_LABEL, type PaymentMethodCode } from "@/lib/types";

type MethodLine = {
  id?: string;
  method?: PaymentMethodCode;
  amount_type?: "percent" | "value" | "remaining";
  amount?: number;
  installments?: number;
  notes?: string;
};

type PayShape = {
  entry_type?: string;
  entry_value?: number;
  installments?: number;
  terms_to_agree?: boolean;
  entry?: {
    enabled?: boolean;
    type?: string;
    value?: number;
    method?: PaymentMethodCode;
    installments?: number;
  };
  methods?: MethodLine[];
};

type OrderLite = {
  id: string;
  client_name: string | null;
  total: number | null;
  data: Record<string, unknown> | null;
  created_at: string;
};

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const methodLabel = (m?: PaymentMethodCode | null) => (m ? PAYMENT_METHOD_LABEL[m] ?? m : null);

/** Monta as linhas de recebíveis previstas para um pedido (sem user_id). */
export function buildReceivableRows(order: OrderLite): Record<string, unknown>[] {
  const orderData: Record<string, unknown> = order.data || {};
  const pay = (orderData.payment as PayShape) || { entry_type: "percent", entry_value: 0, installments: 1 };
  const total = Number(order.total || 0);
  if (total <= 0) return [];

  const base = new Date(order.created_at);

  // Prazo e valor a combinar: uma única linha, sem parcelamento.
  if (pay.terms_to_agree) {
    return [{
      order_id: order.id,
      client_name: order.client_name,
      description: "Prazo e valor a combinar — Pedido",
      installment_no: 1,
      installment_total: 1,
      due_date: fmt(base),
      amount: total,
      status: "pendente",
      method: "a_combinar",
    }];
  }

  const ne = pay.entry;
  const entryEnabled = ne ? ne.enabled !== false : true;
  const entryType = ne?.type ?? pay.entry_type;
  const entryRaw = ne ? Number(ne.value || 0) : Number(pay.entry_value || 0);
  // A entrada pode ser até 100% do valor do pedido.
  const entry = Math.min(
    total,
    entryEnabled ? (entryType === "percent" ? total * (entryRaw / 100) : entryRaw) : 0,
  );
  const balance = Math.max(0, total - entry);
  const entryN = Math.max(1, Number(ne?.installments || 1));

  const lines = balance <= 0.005
    ? []
    : (pay.methods ?? []).filter((m) => m && (m.amount_type === "remaining" || Number(m.amount || 0) > 0));


  // Quantas parcelas o saldo terá no total (para "x/y" das descrições)
  const balanceN = lines.length
    ? lines.reduce((s, m) => s + Math.max(1, Number(m.installments || 1)), 0)
    : Math.max(1, Number(pay.installments || 1));

  const rows: Record<string, unknown>[] = [];
  const entryMethod = methodLabel(ne?.method);
  if (entry > 0) {
    const entryVal = entry / entryN;
    for (let i = 1; i <= entryN; i++) {
      const d = new Date(base);
      if (i > 1) d.setMonth(d.getMonth() + (i - 1));
      rows.push({
        order_id: order.id,
        client_name: order.client_name,
        description: `${entryN > 1 ? `Entrada ${i}/${entryN}` : "Entrada"} — Pedido${entryMethod ? ` (${entryMethod})` : ""}`,
        installment_no: 0,
        installment_total: balanceN + entryN,
        due_date: fmt(d),
        amount: entryVal,
        status: "pendente",
        ...(entryMethod ? { method: entryMethod } : {}),
      });
    }
  }

  // Saldo — segue exatamente as formas de pagamento configuradas no pedido.
  if (lines.length) {
    const fixed = lines.map((m) =>
      m.amount_type === "percent" ? balance * (Number(m.amount || 0) / 100)
        : m.amount_type === "value" ? Number(m.amount || 0)
          : 0);
    const remainingIdx = lines.map((m, i) => (m.amount_type === "remaining" ? i : -1)).filter((i) => i >= 0);
    const used = fixed.reduce((s, v) => s + v, 0);
    const left = Math.max(0, balance - used);
    remainingIdx.forEach((i) => { fixed[i] = left / remainingIdx.length; });

    let seq = 0;
    lines.forEach((m, li) => {
      const n = Math.max(1, Number(m.installments || 1));
      const val = fixed[li] / n;
      if (fixed[li] <= 0) return;
      const label = methodLabel(m.method);
      for (let i = 1; i <= n; i++) {
        seq += 1;
        const d = new Date(base);
        d.setMonth(d.getMonth() + seq);
        rows.push({
          order_id: order.id,
          client_name: order.client_name,
          description: `Parcela ${seq}/${balanceN} — Pedido${label ? ` (${label})` : ""}`,
          installment_no: seq,
          installment_total: balanceN,
          due_date: fmt(d),
          amount: val,
          status: "pendente",
          ...(label ? { method: label } : {}),
        });
      }
    });
    return rows;
  }

  // Entrada cobrindo 100% do pedido: não há saldo a parcelar.
  if (balance <= 0.005) return rows;

  const n = balanceN;
  const parcVal = balance / n;
  for (let i = 1; i <= n; i++) {

    const d = new Date(base);
    d.setMonth(d.getMonth() + i);
    rows.push({
      order_id: order.id,
      client_name: order.client_name,
      description: `Parcela ${i}/${n} — Pedido`,
      installment_no: i,
      installment_total: n,
      due_date: fmt(d),
      amount: parcVal,
      status: "pendente",
    });
  }
  return rows;
}


async function fetchOrder(orderId: string): Promise<OrderLite | null> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, client_name, total, data, created_at")
    .eq("id", orderId)
    .single();
  return (order as unknown as OrderLite) ?? null;
}

/**
 * Idempotently generate installment rows (entry + N parcelas) in `receivables`.
 * Skips if the order already has any receivable rows.
 */
export async function generateReceivablesForOrder(orderId: string): Promise<{ created: number } | null> {
  const order = await fetchOrder(orderId);
  if (!order) return null;

  const { data: existing } = await supabase
    .from("receivables")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);
  if ((existing ?? []).length > 0) return { created: 0 };

  const rows = buildReceivableRows(order);
  if (!rows.length) return { created: 0 };

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { error } = await supabase.from("receivables").insert(rows.map((r) => ({ ...r, user_id: u.user!.id })) as never);
  if (error) throw error;
  return { created: rows.length };
}

/**
 * Re-sincroniza as parcelas do pedido com a forma de pagamento atual
 * (entrada + parcelas ou linha única "à combinar").
 * Preserva parcelas já pagas/baixadas — nesse caso não altera nada.
 */
export async function syncReceivablesForOrder(
  orderId: string,
): Promise<{ created: number; removed: number; skipped?: "paid" | "unchanged" } | null> {
  const order = await fetchOrder(orderId);
  if (!order) return null;

  const { data: existing } = await supabase
    .from("receivables")
    .select("id, description, amount, due_date, installment_no, installment_total, method, status, paid_amount")
    .eq("order_id", orderId);
  const rowsExisting = (existing ?? []) as Array<Record<string, unknown>>;

  const hasPaid = rowsExisting.some(
    (r) => Number(r.paid_amount || 0) > 0 || String(r.status) === "pago" || String(r.status) === "parcial",
  );
  if (hasPaid) return { created: 0, removed: 0, skipped: "paid" };

  const desired = buildReceivableRows(order);

  const sig = (r: Record<string, unknown>) =>
    [r.description, Number(r.amount || 0).toFixed(2), r.due_date, r.installment_no, r.method ?? ""].join("|");
  const same =
    rowsExisting.length === desired.length &&
    [...rowsExisting].map(sig).sort().join("#") === [...desired].map(sig).sort().join("#");
  if (same) return { created: 0, removed: 0, skipped: "unchanged" };

  if (rowsExisting.length) {
    const { error: delErr } = await supabase.from("receivables").delete().eq("order_id", orderId);
    if (delErr) throw delErr;
  }
  if (!desired.length) return { created: 0, removed: rowsExisting.length };

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { error } = await supabase.from("receivables").insert(desired.map((r) => ({ ...r, user_id: u.user!.id })) as never);
  if (error) throw error;
  return { created: desired.length, removed: rowsExisting.length };
}
