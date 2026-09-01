import { supabase } from "@/integrations/supabase/client";

type Kinds = { seller?: boolean; architect?: boolean; tech?: boolean; referral?: boolean };

/** Percentuais padrão (editáveis por comissão na tela de Comissões). */
export const DEFAULT_PCT = { architect: 5, referral: 2, sellerLow: 2, sellerHigh: 3, sellerThreshold: 100000 };

/**
 * Gera/ressincroniza as comissões de um pedido a partir dos dados já existentes
 * (vendedor, arquiteto, indicação/revendedor). Idempotente: não duplica escopos.
 */
export async function generateCommissionsForOrder(
  orderId: string,
  kinds: Kinds = { seller: true, architect: true, tech: true, referral: true },
) {
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (!order) return;
  const data: Record<string, unknown> = (order.data as Record<string, unknown>) || {};
  const row = order as unknown as { commission_locked?: boolean | null; approved_total?: number | null };
  // A base da comissão é SEMPRE o valor aprovado no fechamento do pedido.
  const approved = row.approved_total;
  const total = approved != null && Number.isFinite(Number(approved)) ? Number(approved) : Number(order.total || 0);
  // Após o fechamento, a comissão fica bloqueada: alterações técnicas não recalculam nada.
  const locked = row.commission_locked !== false;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;

  const { data: existing } = await supabase
    .from("commissions")
    .select("id, scope, status, percent, base_value, amount")
    .eq("order_id", orderId);
  const haveScope = new Set((existing ?? []).map((r) => r.scope));

  // Pedido cancelado/excluído -> remove comissões ainda não pagas.
  if (String(order.status) === "cancelado") {
    const ids = (existing ?? []).filter((c) => c.status !== "pago").map((c) => c.id);
    if (ids.length) await supabase.from("commissions").delete().in("id", ids);
    return;
  }

  // Ressincroniza comissões PENDENTES apenas quando a comissão NÃO está bloqueada
  // (exige autorização administrativa após o fechamento do pedido).
  if (!locked) {
    for (const c of existing ?? []) {
      if (c.status !== "pendente") continue;
      const pct = Number(c.percent || 0);
      const newAmount = Number((total * pct / 100).toFixed(2));
      if (Number(c.base_value) !== total || Number(c.amount) !== newAmount) {
        await supabase.from("commissions").update({ base_value: total, amount: newAmount }).eq("id", c.id);
      }
    }
  }

  const payload: Record<string, unknown>[] = [];

  // 1) Vendedor
  if (kinds.seller && data.seller_id && !haveScope.has("seller") && !haveScope.has("external")) {
    const { data: seller } = await supabase.from("sellers").select("name, kind").eq("id", data.seller_id as string).single();
    const scope = (seller?.kind === "externo" ? "external" : "seller") as "seller" | "external";
    let pct = DEFAULT_PCT.referral;
    if (scope === "seller") {
      // Acumulado do vendedor no MÊS do pedido (antes deste pedido).
      const ref = new Date(order.created_at as string);
      const from = new Date(ref.getFullYear(), ref.getMonth(), 1).toISOString();
      const to = new Date(ref.getFullYear(), ref.getMonth() + 1, 1).toISOString();
      const { data: prev } = await supabase
        .from("orders")
        .select("id, total, data")
        .eq("user_id", u.user.id)
        .gte("created_at", from)
        .lt("created_at", to);
      const accumulated = (prev ?? [])
        .filter((o) => ((o.data as Record<string, unknown>)?.seller_id as string) === (data.seller_id as string))
        .filter((o) => o.id !== order.id)
        .reduce((s, o) => s + Number(o.total || 0), 0);
      pct = accumulated >= DEFAULT_PCT.sellerThreshold ? DEFAULT_PCT.sellerHigh : DEFAULT_PCT.sellerLow;
    }
    payload.push({
      user_id: u.user.id, order_id: order.id, seller_id: data.seller_id,
      beneficiary_name: seller?.name ?? (data.salesperson as string) ?? "", scope,
      base_value: total, percent: pct, amount: Number((total * pct / 100).toFixed(2)), status: "pendente",
    });
  }

  // 2) Arquiteto — 5%
  if (kinds.architect && typeof data.architect === "string" && data.architect.trim() && !haveScope.has("architect")) {
    const pct = DEFAULT_PCT.architect;
    payload.push({
      user_id: u.user.id, order_id: order.id, seller_id: null,
      beneficiary_name: data.architect, scope: "architect",
      base_value: total, percent: pct, amount: Number((total * pct / 100).toFixed(2)), status: "pendente",
    });
  }

  // 3) Indicação / Revendedor — 2%
  const referral = typeof data.external_salesperson === "string" ? data.external_salesperson.trim() : "";
  if (kinds.referral !== false && referral && !haveScope.has("referral")) {
    const pct = DEFAULT_PCT.referral;
    payload.push({
      user_id: u.user.id, order_id: order.id, seller_id: null,
      beneficiary_name: referral, scope: "referral",
      base_value: total, percent: pct, amount: Number((total * pct / 100).toFixed(2)), status: "pendente",
    });
  }

  // 4) Técnico (mantido)
  if (kinds.tech && data.tech_measurer_id && !haveScope.has("tecnico")) {
    const { data: tech } = await supabase.from("tech_measurers")
      .select("name, commission_pct").eq("id", data.tech_measurer_id as string).single();
    const pct = Number(tech?.commission_pct || 0);
    if (tech && pct > 0) {
      payload.push({
        user_id: u.user.id, order_id: order.id, seller_id: null,
        beneficiary_name: tech.name, scope: "tecnico",
        base_value: total, percent: pct, amount: Number((total * pct / 100).toFixed(2)), status: "pendente",
      });
    }
  }

  if (payload.length === 0) return;
  await supabase.from("commissions").insert(payload as never);
}
