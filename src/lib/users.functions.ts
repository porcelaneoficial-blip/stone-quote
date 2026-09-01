import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "vendas" | "supervisor" | "cortador" | "acabador" | "producao" | "vendedor" | "parceiro";

function usernameToEmail(u: string): string {
  return u.trim().toLowerCase().replace(/\s+/g, "") + "@porcelane.local";
}

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { username: string; name: string; password: string; role: Role }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const email = usernameToEmail(data.username);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name, username: data.username },
    });
    if (error) throw new Error(error.message);
    const newId = created.user!.id;
    // Grant role
    await supabaseAdmin.from("user_roles").insert({
      user_id: context.userId,
      target_user_id: newId,
      role: data.role,
    });
    return { id: newId, email };
  });

const DEFAULT_ADMINS = [
  { username: "amanda", name: "Amanda" },
  { username: "roxane", name: "Roxane" },
  { username: "clovis", name: "Clóvis" },
];

export const adminSeedDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: { username: string; status: string }[] = [];
    for (const a of DEFAULT_ADMINS) {
      const email = usernameToEmail(a.username);
      // Try to find existing user by email
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
      let userId: string;
      if (existing) {
        userId = existing.id;
        results.push({ username: a.username, status: "existed" });
      } else {
        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: "Porcelane123",
          email_confirm: true,
          user_metadata: { full_name: a.name, username: a.username },
        });
        if (error) { results.push({ username: a.username, status: `error: ${error.message}` }); continue; }
        userId = created.user!.id;
        results.push({ username: a.username, status: "created" });
      }
      // Ensure admin role
      const { data: has } = await supabaseAdmin
        .from("user_roles").select("id").eq("target_user_id", userId).eq("role", "admin").maybeSingle();
      if (!has) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: context.userId, target_user_id: userId, role: "admin",
        });
      }
    }
    return { results };
  });

export const selfUpdatePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { password: string }) => i)
  .handler(async ({ data, context }) => {
    if (!data.password || data.password.length < 6) throw new Error("Senha deve ter ao menos 6 caracteres");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; password: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      { password: data.password },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const ids = list.users.map((u) => u.id);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("target_user_id, role")
      .in("target_user_id", ids);
    const byUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = byUser.get(r.target_user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.target_user_id, arr);
    });
    return list.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      username:
        (u.user_metadata as any)?.username ??
        (u.email ?? "").replace("@porcelane.local", ""),
      name: (u.user_metadata as any)?.full_name ?? "",
      created_at: u.created_at,
      roles: byUser.get(u.id) ?? [],
    }));
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string; role: Role }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    // Replace all roles for this target with single new role
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("target_user_id", data.userId);
    await supabaseAdmin.from("user_roles").insert({
      user_id: context.userId,
      target_user_id: data.userId,
      role: data.role,
    });
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { userId: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("cannot_delete_self");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
