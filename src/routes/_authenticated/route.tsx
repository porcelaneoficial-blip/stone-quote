import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useAccessGate } from "@/lib/access-gate";
import { AccessGateScreen } from "@/components/access-gate-screen";

function AuthenticatedRoot() {
  const { session, loading } = useAccessGate();

  if (loading) {
    return <div className="p-10 text-sm text-stone-500">Carregando…</div>;
  }
  if (!session) return <AccessGateScreen />;
  return <AppShell />;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedRoot,
});
