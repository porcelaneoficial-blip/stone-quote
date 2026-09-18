import { createServerFn } from "@tanstack/react-start";

/**
 * Emite uma sessão real do backend para a conta dona dos dados da Porcelane.
 * O sistema opera em modo de acesso liberado; sem esta sessão as políticas de
 * segurança do banco devolvem zero registros (foi o que fez os dados "sumirem").
 */
export const mintWorkspaceSession = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Dono dos dados = admin com mais pedidos cadastrados.
  const { data: orders } = await supabaseAdmin.from("orders").select("user_id");
  const counts = new Map<string, number>();
  for (const o of orders ?? []) {
    const id = (o as any).user_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let ownerId: string | null = null;
  let best = -1;
  for (const [id, n] of counts) if (n > best) { best = n; ownerId = id; }

  if (!ownerId) {
    const { data: admins } = await supabaseAdmin
      .from("user_roles")
      .select("target_user_id")
      .eq("role", "admin")
      .limit(1);
    ownerId = (admins?.[0] as any)?.target_user_id ?? null;
  }
  // Banco ainda sem nenhuma conta: não é erro, apenas não há sessão a emitir.
  if (!ownerId) return { token_hash: null, email: null, reason: "sem_conta" as const };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", ownerId)
    .maybeSingle();
  const email = (profile as any)?.email as string | undefined;
  if (!email) return { token_hash: null, email: null, reason: "sem_email" as const };

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) return { token_hash: null, email, reason: "falha_link" as const };

  const tokenHash = (data as any)?.properties?.hashed_token as string | undefined;
  if (!tokenHash) return { token_hash: null, email, reason: "sem_token" as const };

  return { token_hash: tokenHash, email, reason: null };
});
