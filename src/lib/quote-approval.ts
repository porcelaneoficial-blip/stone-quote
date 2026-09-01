import { supabase } from "@/integrations/supabase/client";
import type { QuoteData } from "./types";
import { calcTotals } from "./quote-calc";

export type ApproveResult = {
  orderId: string;
  created: boolean;
  trello: "ok" | "skipped" | "error";
};

/**
 * Converte um orçamento em pedido de forma idempotente:
 * - se já existir pedido vinculado, apenas reaproveita (não duplica);
 * - o status "aprovado" só é gravado DEPOIS que o pedido existe;
 * - comissões, contas a receber e Trello nunca bloqueiam a conversão.
 */
export async function createOrderFromQuote(quoteId: string): Promise<ApproveResult> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada. Faça login novamente.");

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("id, user_id, number, type, status, client_name, total, data")
    .eq("id", quoteId)
    .maybeSingle();
  if (qErr) throw new Error(qErr.message);
  if (!quote) throw new Error("Orçamento não encontrado");

  // Já existe pedido para este orçamento? Não cria outro.
  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("quote_id", quoteId)
    .limit(1);
  if (existing && existing.length > 0) {
    if (quote.status !== "aprovado") {
      await supabase.from("quotes").update({ status: "aprovado" }).eq("id", quoteId);
    }
    return { orderId: existing[0].id, created: false, trello: "skipped" };
  }

  const data = (quote.data ?? {}) as QuoteData;
  const total = Number(quote.total ?? 0) || calcTotals(data).total;
  const clientName = (quote.client_name || data.client_name || "").toUpperCase();

  const orderData = {
    ...data,
    client_name: clientName,
    original_environments: (data.environments ?? []).map((e) => ({
      ...e,
      items: (e.items ?? []).map((i) => ({ ...i })),
    })),
  };

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      user_id: quote.user_id ?? u.user.id,
      number: 0,
      quote_id: quoteId,
      status: "aguardando_projeto",
      client_name: clientName,
      total,
      data: orderData as never,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Só marca como aprovado depois que o pedido existe de fato.
  await supabase.from("quotes").update({ status: "aprovado", client_name: clientName }).eq("id", quoteId);

  try {
    const { generateCommissionsForOrder } = await import("./generate-commissions");
    await generateCommissionsForOrder(order.id, { seller: true, architect: true });
  } catch (e) { console.error(e); }

  try {
    const { generateReceivablesForOrder } = await import("./generate-receivables");
    await generateReceivablesForOrder(order.id);
  } catch (e) { console.error(e); }

  let trello: ApproveResult["trello"] = "skipped";
  try {
    const { syncOrderToTrelloOnClose } = await import("./trello-sync");
    const r = await syncOrderToTrelloOnClose(order.id, { triggeredByName: data.salesperson ?? "Sistema" });
    trello = r.ok ? (r.skipped ? "skipped" : "ok") : "error";
  } catch { trello = "error"; }

  return { orderId: order.id, created: true, trello };
}

/** Orçamentos marcados como aprovados que ficaram sem pedido gerado. */
export async function listApprovedWithoutOrder() {
  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, number, client_name, total, created_at")
    .eq("status", "aprovado")
    .order("number", { ascending: false });
  if (error) throw error;
  const ids = (quotes ?? []).map((q) => q.id);
  if (!ids.length) return [];
  const { data: orders } = await supabase.from("orders").select("quote_id").in("quote_id", ids);
  const withOrder = new Set((orders ?? []).map((o) => o.quote_id));
  return (quotes ?? []).filter((q) => !withOrder.has(q.id));
}
