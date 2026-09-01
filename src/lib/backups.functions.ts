import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BACKUP_TABLES = [
  "orders", "quotes", "clients", "receivables", "payables",
  "commissions", "productivity_entries", "manual_romaneios",
  "employees", "sellers", "materials", "services", "supplies",
  "installation_photos", "measurements", "order_status_history",
  "authorized_emails", "user_roles",
] as const;

export const generateDailyBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin" as any,
    });
    if (!isAdmin) throw new Error("forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload: Record<string, unknown[]> = {};
    const summary: { table: string; rows: number }[] = [];
    let total = 0;
    for (const t of BACKUP_TABLES) {
      const { data, error } = await supabaseAdmin.from(t as any).select("*");
      if (error) {
        summary.push({ table: t, rows: 0 });
        payload[t] = [];
        continue;
      }
      const rows = (data ?? []) as unknown[];
      payload[t] = rows;
      summary.push({ table: t, rows: rows.length });
      total += rows.length;
    }

    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, "-");
    const path = `${context.userId}/porcelane-backup-${ts}.json`;
    const body = new Blob([JSON.stringify({ generated_at: now.toISOString(), tables: payload }, null, 2)], {
      type: "application/json",
    });
    const up = await supabaseAdmin.storage.from("backups").upload(path, body, {
      contentType: "application/json",
      upsert: false,
    });
    if (up.error) throw new Error(up.error.message);

    const { data: snap, error: insErr } = await supabaseAdmin
      .from("backup_snapshots")
      .insert({
        user_id: context.userId,
        tables: summary as any,
        total_rows: total,
        storage_path: path,
      })
      .select("id, created_at, storage_path, total_rows")
      .single();
    if (insErr) throw new Error(insErr.message);

    return snap;
  });

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin" as any,
    });
    if (!isAdmin) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("backup_snapshots")
      .select("id, created_at, storage_path, total_rows, tables")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => d)
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin" as any,
    });
    if (!isAdmin) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("backups")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
