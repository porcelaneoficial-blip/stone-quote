import { supabase } from "@/integrations/supabase/client";
import type { Environment, QuoteData } from "@/lib/types";
import { calcTotals, envTotal } from "@/lib/quote-calc";

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type EnvAllocation = {
  env_id: string;
  name: string;
  /** Valor bruto do ambiente (produtos + serviços + insumos + aditivo). */
  gross: number;
  /** Participação percentual do ambiente no bruto total. */
  share_pct: number;
  alloc: {
    quote_supplies: number;
    freight: number;
    mfc_pickup: number;
    installation: number;
    baseboard: number;
    discount: number;
  };
  /** Valor líquido real do ambiente após rateio. */
  net: number;
  /** Líquido efetivo (considera edição manual). */
  effective_net: number;
  manual: boolean;
};

/**
 * Rateio proporcional de custos/acréscimos/descontos do pedido entre ambientes.
 * Não altera o pedido — apenas calcula a base líquida por ambiente.
 */
export function allocateEnvironments(data: QuoteData): EnvAllocation[] {
  const t = calcTotals(data);
  const envs = data.environments ?? [];
  const grosses = envs.map((e) => r2(envTotal(e)));
  const sum = grosses.reduce((s, v) => s + v, 0);

  const orderExtras = {
    quote_supplies: t.quoteSuppliesTotal ?? 0,
    freight: t.freight ?? 0,
    mfc_pickup: t.mfcPickup ?? 0,
    installation: t.installation ?? 0,
    baseboard: (t.baseboardInstall ?? 0) + (t.baseboardFreight ?? 0),
    discount: t.discountValue ?? 0,
  };

  return envs.map((e, i) => {
    const gross = grosses[i];
    const share = sum > 0 ? gross / sum : envs.length ? 1 / envs.length : 0;
    const alloc = {
      quote_supplies: r2(orderExtras.quote_supplies * share),
      freight: r2(orderExtras.freight * share),
      mfc_pickup: r2(orderExtras.mfc_pickup * share),
      installation: r2(orderExtras.installation * share),
      baseboard: r2(orderExtras.baseboard * share),
      discount: r2(orderExtras.discount * share),
    };
    const net = r2(
      gross + alloc.quote_supplies + alloc.freight + alloc.mfc_pickup +
      alloc.installation + alloc.baseboard - alloc.discount,
    );
    const override = e.tech_net_override;
    const manual = typeof override === "number" && override > 0;
    return {
      env_id: e.id,
      name: e.name,
      gross,
      share_pct: r2(share * 100),
      alloc,
      net,
      effective_net: manual ? r2(override as number) : net,
      manual,
    };
  });
}

export const TECH_COMMISSION_PCT = 2;

export const envCommissionPct = (env: Environment) =>
  typeof env.tech_commission_pct === "number" ? env.tech_commission_pct : TECH_COMMISSION_PCT;

/** Logística sugerida a partir das informações já existentes no pedido. */
export function suggestedLogistics(data: QuoteData): "retirada" | "entrega" | "instalacao" {
  const mode = data.delivery?.mode;
  if (mode === "instalacao") return "instalacao";
  if (mode === "entrega") return "entrega";
  return "retirada";
}

export const LOGISTICS_LABEL: Record<string, string> = {
  retirada: "Retirada na loja",
  entrega: "Entrega",
  instalacao: "Instalação (gera Ordem de Instalação)",
};

async function currentUser() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  let name = u.user.email ?? "";
  try {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
    if (p?.full_name) name = p.full_name;
  } catch { /* ignore */ }
  return { id: u.user.id, name };
}

export async function currentUserName(): Promise<string> {
  const u = await currentUser();
  return u?.name ?? "";
}

/** Log de alteração manual da liberação técnica. */
export async function logTechChange(input: {
  order_id: string;
  field: string;
  description: string;
  old_value?: unknown;
  new_value?: unknown;
  reason?: string;
}) {
  const u = await currentUser();
  if (!u) return;
  await supabase.from("audit_log").insert({
    user_id: u.id,
    kind: "liberacao_tecnica",
    entity_type: "order",
    entity_id: input.order_id,
    field: input.field,
    old_value: (input.old_value ?? null) as never,
    new_value: (input.new_value ?? null) as never,
    description: input.reason ? `${input.description} — motivo: ${input.reason}` : input.description,
    changed_by_id: u.id,
    changed_by_name: u.name,
  } as never);
}

export type TechLogRow = {
  id: string;
  field: string | null;
  description: string | null;
  old_value: unknown;
  new_value: unknown;
  changed_by_name: string | null;
  created_at: string;
};

export async function listTechLogs(order_id: string): Promise<TechLogRow[]> {
  const { data } = await supabase
    .from("audit_log")
    .select("id, field, description, old_value, new_value, changed_by_name, created_at")
    .eq("entity_id", order_id)
    .eq("kind", "liberacao_tecnica")
    .order("created_at", { ascending: false })
    .limit(80);
  return (data ?? []) as TechLogRow[];
}

const marker = (envId: string) => `[amb:${envId}]`;

/**
 * Cria/atualiza a comissão da técnica (2%) do ambiente liberado.
 * Uma comissão por ambiente, com histórico completo no campo notes.
 */
export async function syncEnvTechCommission(opts: {
  order_id: string;
  data: QuoteData;
  env: Environment;
  beneficiary?: string;
  remove?: boolean;
}) {
  const u = await currentUser();
  if (!u) return null;
  const { env, data, order_id } = opts;

  const { data: existing } = await supabase
    .from("commissions")
    .select("id, status, notes")
    .eq("order_id", order_id)
    .eq("scope", "tecnica");
  const row = (existing ?? []).find((c) => String(c.notes ?? "").includes(marker(env.id)));

  if (opts.remove) {
    if (row && row.status !== "pago") await supabase.from("commissions").delete().eq("id", row.id);
    return null;
  }

  const alloc = allocateEnvironments(data).find((a) => a.env_id === env.id);
  if (!alloc) return null;
  const pct = envCommissionPct(env);
  const amount = r2(alloc.effective_net * (pct / 100));
  const when = env.released_for_cut_at ?? new Date().toISOString();
  const beneficiary = opts.beneficiary?.trim() || env.tech_responsible || "Bhenda";

  const notes = [
    marker(env.id),
    `Ambiente: ${env.name}`,
    `Bruto: R$ ${alloc.gross.toFixed(2)}`,
    `Rateio → insumos R$ ${alloc.alloc.quote_supplies.toFixed(2)} · frete R$ ${alloc.alloc.freight.toFixed(2)} · coleta R$ ${alloc.alloc.mfc_pickup.toFixed(2)} · instalação R$ ${alloc.alloc.installation.toFixed(2)} · rodapé R$ ${alloc.alloc.baseboard.toFixed(2)} · desconto -R$ ${alloc.alloc.discount.toFixed(2)}`,
    `Líquido: R$ ${alloc.effective_net.toFixed(2)}${alloc.manual ? " (manual)" : ""}`,
    `Percentual: ${pct}% · Comissão: R$ ${amount.toFixed(2)}`,
    `Liberado em ${new Date(when).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} por ${env.released_by_name || u.name}`,
  ].join("\n");

  if (row) {
    if (row.status === "pago") return row.id;
    await supabase.from("commissions").update({
      beneficiary_name: beneficiary,
      base_value: alloc.effective_net,
      percent: pct,
      amount,
      notes,
    }).eq("id", row.id);
    return row.id;
  }

  const { data: ins } = await supabase.from("commissions").insert({
    user_id: u.id,
    order_id,
    seller_id: null,
    beneficiary_name: beneficiary,
    scope: "tecnica",
    base_value: alloc.effective_net,
    percent: pct,
    amount,
    status: "pendente",
    notes,
  } as never).select("id").maybeSingle();
  return ins?.id ?? null;
}
