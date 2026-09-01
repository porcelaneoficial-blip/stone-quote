/**
 * FONTE DE VERDADE FINANCEIRA DO PEDIDO
 * ------------------------------------------------------------------
 * - Valor contratado (o que vale hoje)  -> calcTotals(order.data).total
 * - Valor aprovado (snapshot histórico) -> orders.approved_total / approved_snapshot
 * - Cache de listagem                   -> orders.total (não recalcular a partir dele)
 * - RECEBIDO                            -> soma de receivables.paid_amount
 *
 * A coluna `orders.received` é LEGADA: continua existindo no banco (nenhum dado
 * é apagado), mas NÃO deve ser lida como recebido — em produção ela está zerada
 * em 100% dos pedidos. Use `fetchOrderReceived` / `useOrderReceived`.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OrderMoney = {
  /** Soma de receivables.paid_amount (fonte de verdade do recebido). */
  received: number;
  /** Soma dos valores das parcelas geradas para o pedido. */
  billed: number;
  /** Parcelas vencidas e ainda não quitadas. */
  overdue: number;
};

export async function fetchOrderReceived(orderId: string): Promise<OrderMoney> {
  const { data } = await supabase
    .from("receivables")
    .select("amount, paid_amount, due_date, status")
    .eq("order_id", orderId);
  const rows = data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  return rows.reduce<OrderMoney>(
    (acc, r) => {
      const amount = Number(r.amount ?? 0);
      const paid = Number(r.paid_amount ?? 0);
      acc.billed += amount;
      acc.received += paid;
      if (r.status !== "pago" && paid < amount && String(r.due_date) < today) {
        acc.overdue += amount - paid;
      }
      return acc;
    },
    { received: 0, billed: 0, overdue: 0 },
  );
}

/** Saldo em aberto do pedido, sempre a partir do contratado atual. */
export const orderBalance = (contracted: number, received: number) =>
  Math.max(0, Number(contracted || 0) - Number(received || 0));

/** Hook de leitura do recebido (atualiza junto com o financeiro). */
export function useOrderReceived(orderId: string | null | undefined) {
  const [money, setMoney] = useState<OrderMoney>({ received: 0, billed: 0, overdue: 0 });

  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    const load = () => {
      fetchOrderReceived(orderId)
        .then((m) => { if (alive) setMoney(m); })
        .catch(() => {});
    };
    load();
    const ch = supabase
      .channel(`order-money-${orderId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "receivables", filter: `order_id=eq.${orderId}` }, load)
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [orderId]);

  return money;
}
