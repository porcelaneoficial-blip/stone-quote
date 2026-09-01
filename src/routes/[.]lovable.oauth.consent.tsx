import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOAuthApi, type OAuthApi } from "@/lib/oauth-api";


export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId =
      new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await getOAuthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-8 text-sm text-stone-700">
      Não foi possível carregar esta solicitação de autorização:{" "}
      {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await getOAuthApi().approveAuthorization(authorization_id)
      : await getOAuthApi().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "um aplicativo";

  return (
    <main className="min-h-screen flex items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md bg-white border border-stone-200 p-8 space-y-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-gold-high">
            Porcelane
          </div>
          <h1 className="font-display text-2xl mt-2">
            Conectar {clientName} à sua conta
          </h1>
          <p className="text-sm text-stone-500 mt-2">
            {clientName} poderá usar o Porcelane agindo em seu nome, dentro das
            permissões do seu usuário.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 border border-stone-300 py-3 text-xs font-semibold uppercase tracking-widest hover:bg-stone-50 disabled:opacity-50"
          >
            Negar
          </button>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 bg-stone-950 text-white py-3 text-xs font-semibold uppercase tracking-widest hover:bg-stone-800 disabled:opacity-50"
          >
            {busy ? "Processando…" : "Autorizar"}
          </button>
        </div>
      </div>
    </main>
  );
}
