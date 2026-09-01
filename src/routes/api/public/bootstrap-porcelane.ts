import { createFileRoute } from "@tanstack/react-router";

// Bootstrap: garante que Amanda, Roxane e Clóvis existam como admins
// com login por username (@porcelane.local), senha padrão Porcelane123
// e email de contato unificado porcelaneoficial@gmail.com no perfil.
// Protegida por token: ?key=porcelane-2026

const SHARED_CONTACT = "porcelaneoficial@gmail.com";
const ADMINS: { username: string; name: string }[] = [
  { username: "amanda", name: "Amanda Ferraz" },
  { username: "roxane", name: "Roxane" },
  { username: "clovis", name: "Clóvis Neto" },
];

export const Route = createFileRoute("/api/public/bootstrap-porcelane")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("key") !== "porcelane-2026") {
          return new Response("forbidden", { status: 403 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const results: Record<string, string> = {};

        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1, perPage: 200,
        });
        if (listErr) return new Response("list error: " + listErr.message, { status: 500 });

        for (const a of ADMINS) {
          const email = `${a.username}@porcelane.local`;
          let u = list.users.find((x) => (x.email ?? "").toLowerCase() === email);
          if (!u) {
            const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
              email,
              password: "Porcelane123",
              email_confirm: true,
              user_metadata: {
                full_name: a.name,
                username: a.username,
                contact_email: SHARED_CONTACT,
              },
            });
            if (cErr) { results[a.username] = "create_error: " + cErr.message; continue; }
            u = created.user!;
            results[a.username] = "created";
          } else {
            const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(u.id, {
              password: "Porcelane123",
              email_confirm: true,
              user_metadata: {
                ...(u.user_metadata ?? {}),
                full_name: a.name,
                username: a.username,
                contact_email: SHARED_CONTACT,
              },
            });
            if (pwErr) { results[a.username] = "pw_error: " + pwErr.message; continue; }
            results[a.username] = "updated";
          }

          // Perfil: email de contato compartilhado
          await supabaseAdmin.from("profiles").upsert({
            id: u.id,
            email: SHARED_CONTACT,
            full_name: a.name,
          });

          // Garante role admin
          const { data: has } = await supabaseAdmin
            .from("user_roles").select("id")
            .eq("target_user_id", u.id).eq("role", "admin").maybeSingle();
          if (!has) {
            await supabaseAdmin.from("user_roles").insert({
              user_id: u.id, target_user_id: u.id, role: "admin",
            });
          }
        }
        return new Response(JSON.stringify({ ok: true, results }, null, 2), {
          status: 200, headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
