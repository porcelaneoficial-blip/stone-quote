import { supabase } from "@/integrations/supabase/client";

/**
 * Proteção do pedido aprovado.
 *
 * Depois do fechamento, o pedido comercial (número, cliente, valores, materiais,
 * comissões, nomes internos e itens aprovados) fica SOMENTE LEITURA.
 * Ajustes técnicos vivem numa área separada (`order_revisions`), sem tocar no
 * documento comercial assinado pelo cliente.
 */

export type ApprovedSnapshot = Record<string, unknown> | null;

export type OrderLockInfo = {
  approved_snapshot?: ApprovedSnapshot;
  approved_total?: number | null;
  approved_at?: string | null;
  commercial_locked?: boolean | null;
  commission_locked?: boolean | null;
};

/** Campos comerciais que não podem ser alterados automaticamente. */
export const PROTECTED_COMMERCIAL_FIELDS = [
  "number",
  "client_name",
  "total",
  "material_price_m2",
  "unit_price_override",
  "seller_id",
  "salesperson",
  "architect",
  "external_salesperson",
  "tech_measurer_id",
  "discount",
  "items",
] as const;

export const isCommercialLocked = (o: OrderLockInfo | null | undefined) =>
  !!o && o.commercial_locked !== false;

export const isCommissionLocked = (o: OrderLockInfo | null | undefined) =>
  !!o && o.commission_locked !== false;

/** Valor base congelado no fechamento (usado para comissões). */
export function approvedBaseTotal(o: (OrderLockInfo & { total?: number | null }) | null | undefined): number {
  if (!o) return 0;
  const approved = o.approved_total;
  if (approved != null && Number.isFinite(Number(approved))) return Number(approved);
  return Number(o.total ?? 0);
}

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

/** Garante que o pedido tenha uma cópia congelada dos dados aprovados. */
export async function ensureApprovedSnapshot(orderId: string) {
  const { data } = await supabase
    .from("orders")
    .select("id, data, total, approved_snapshot, created_at")
    .eq("id", orderId)
    .maybeSingle();
  const row = data as (Record<string, unknown> & { approved_snapshot?: unknown }) | null;
  if (!row || row.approved_snapshot) return;
  await supabase
    .from("orders")
    .update({
      approved_snapshot: row.data as never,
      approved_total: row.total as never,
      approved_at: (row.created_at as string) ?? new Date().toISOString(),
    } as never)
    .eq("id", orderId);
}

export type RevisionChange = {
  field: string;
  label?: string;
  old_value?: unknown;
  new_value?: unknown;
};

export type OrderRevision = {
  id: string;
  seq: number;
  kind: string;
  status: string;
  reason: string | null;
  data: Record<string, unknown>;
  changes: RevisionChange[];
  created_by_name: string | null;
  created_at: string;
};

/** Cria uma revisão técnica independente — o pedido comercial permanece intacto. */
export async function createTechnicalRevision(input: {
  order_id: string;
  reason: string;
  changes: RevisionChange[];
  data?: Record<string, unknown>;
  kind?: string;
}): Promise<OrderRevision | null> {
  const u = await currentUser();
  if (!u) return null;
  const { data: prev } = await supabase
    .from("order_revisions")
    .select("seq")
    .eq("order_id", input.order_id)
    .order("seq", { ascending: false })
    .limit(1);
  const seq = Number((prev ?? [])[0]?.seq ?? 0) + 1;

  const { data: ins, error } = await supabase
    .from("order_revisions")
    .insert({
      user_id: u.id,
      order_id: input.order_id,
      seq,
      kind: input.kind ?? "tecnica",
      status: "aberta",
      reason: input.reason,
      data: (input.data ?? {}) as never,
      changes: input.changes as never,
      created_by_name: u.name,
    } as never)
    .select("*")
    .maybeSingle();
  if (error) throw error;

  await logOrderChange({
    order_id: input.order_id,
    kind: "revisao_tecnica",
    field: "revisao",
    description: `Revisão técnica R${seq} criada — ${input.reason}`,
    new_value: input.changes,
  });
  return (ins ?? null) as unknown as OrderRevision | null;
}

export async function listRevisions(orderId: string): Promise<OrderRevision[]> {
  const { data } = await supabase
    .from("order_revisions")
    .select("*")
    .eq("order_id", orderId)
    .order("seq", { ascending: false });
  return ((data ?? []) as unknown as OrderRevision[]);
}

/** Histórico completo: data/hora, usuário, campos, valores antigos/novos e justificativa. */
export async function logOrderChange(input: {
  order_id: string;
  kind?: string;
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
    kind: input.kind ?? "pedido_aprovado",
    entity_type: "order",
    entity_id: input.order_id,
    field: input.field,
    old_value: (input.old_value ?? null) as never,
    new_value: (input.new_value ?? null) as never,
    description: input.reason ? `${input.description} — justificativa: ${input.reason}` : input.description,
    changed_by_id: u.id,
    changed_by_name: u.name,
  } as never);
}

export type OrderLogRow = {
  id: string;
  kind: string;
  field: string | null;
  description: string | null;
  old_value: unknown;
  new_value: unknown;
  changed_by_name: string | null;
  created_at: string;
};

export async function listOrderChangeLogs(orderId: string): Promise<OrderLogRow[]> {
  const { data } = await supabase
    .from("audit_log")
    .select("id, kind, field, description, old_value, new_value, changed_by_name, created_at")
    .eq("entity_type", "order")
    .eq("entity_id", orderId)
    .in("kind", ["pedido_aprovado", "revisao_tecnica", "comissao"])
    .order("created_at", { ascending: false })
    .limit(120);
  return ((data ?? []) as unknown as OrderLogRow[]);
}

/** Liberação administrativa pontual da comissão de um pedido fechado. */
export async function setCommissionLock(orderId: string, locked: boolean, reason: string) {
  await supabase.from("orders").update({ commission_locked: locked } as never).eq("id", orderId);
  await logOrderChange({
    order_id: orderId,
    kind: "comissao",
    field: "commission_locked",
    description: locked ? "Comissão bloqueada novamente" : "Comissão desbloqueada por autorização administrativa",
    old_value: !locked,
    new_value: locked,
    reason,
  });
}
