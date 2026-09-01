import { createFileRoute } from "@tanstack/react-router";

const BACKUP_TABLES = [
  "orders", "quotes", "clients", "receivables", "payables",
  "commissions", "productivity_entries", "manual_romaneios",
  "employees", "sellers", "materials", "services", "supplies",
  "installation_photos", "measurements", "order_status_history",
  "authorized_emails", "user_roles", "partners", "payslips",
  "employee_documents",
];

export const Route = createFileRoute("/api/public/hooks/daily-backup")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Descobre o primeiro admin (dono da workspace) para nomear o snapshot
          const { data: admins } = await supabaseAdmin
            .from("user_roles")
            .select("target_user_id")
            .eq("role", "admin")
            .limit(1);
          const ownerId = admins?.[0]?.target_user_id ?? null;
          if (!ownerId) return new Response(JSON.stringify({ ok: false, reason: "no_admin" }), { status: 200 });

          const payload: Record<string, unknown[]> = {};
          const summary: { table: string; rows: number }[] = [];
          let total = 0;
          for (const t of BACKUP_TABLES) {
            const { data, error } = await supabaseAdmin.from(t as any).select("*");
            if (error) { payload[t] = []; summary.push({ table: t, rows: 0 }); continue; }
            const rows = (data ?? []) as unknown[];
            payload[t] = rows;
            summary.push({ table: t, rows: rows.length });
            total += rows.length;
          }

          const ts = new Date().toISOString().replace(/[:.]/g, "-");
          const path = `${ownerId}/auto/porcelane-backup-${ts}.json`;
          const body = JSON.stringify({ generated_at: new Date().toISOString(), tables: payload }, null, 2);

          const up = await supabaseAdmin.storage.from("backups").upload(path, body, {
            contentType: "application/json",
            upsert: false,
          });
          if (up.error) return new Response(JSON.stringify({ ok: false, error: up.error.message }), { status: 500 });

          await supabaseAdmin.from("backup_snapshots").insert({
            user_id: ownerId,
            tables: summary as any,
            total_rows: total,
            storage_path: path,
          });

          return new Response(JSON.stringify({ ok: true, path, total }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), { status: 500 });
        }
      },
      GET: async () => new Response("ok"),
    },
  },
});
