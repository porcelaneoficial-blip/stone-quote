import { supabase } from "@/integrations/supabase/client";

export type ValueChangeInput = {
  entity_type: "quote" | "order";
  entity_id: string;
  field_path: string;
  field_label?: string;
  old_value: number;
  new_value: number;
  reason?: string;
};

/** Registra alteração de valor (idempotente quando old===new — ignora). */
export async function logValueChange(input: ValueChangeInput) {
  if (Number(input.old_value) === Number(input.new_value)) return;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  let changed_by_name = u.user.email ?? null;
  try {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", u.user.id).maybeSingle();
    if (p?.full_name) changed_by_name = p.full_name;
  } catch { /* ignore */ }
  await supabase.from("value_change_log").insert({
    user_id: u.user.id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    field_path: input.field_path,
    field_label: input.field_label ?? null,
    old_value: input.old_value,
    new_value: input.new_value,
    changed_by: u.user.id,
    changed_by_name,
    reason: input.reason ?? null,
  } as never);
}

export type ValueChangeRow = {
  id: string;
  field_path: string;
  field_label: string | null;
  old_value: number;
  new_value: number;
  changed_by_name: string | null;
  reason: string | null;
  created_at: string;
};

export async function listValueChanges(entity_type: "quote" | "order", entity_id: string): Promise<ValueChangeRow[]> {
  const { data } = await supabase
    .from("value_change_log")
    .select("id, field_path, field_label, old_value, new_value, changed_by_name, reason, created_at")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .order("created_at", { ascending: false });
  return (data ?? []) as ValueChangeRow[];
}
