import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trello, Play, RefreshCw } from "lucide-react";
import { trelloStatus } from "@/lib/trello.functions";
import { runTrelloBacklog, TRELLO_CLOSED_LIST, type MigrationReport } from "@/lib/trello-sync";
import { useMyRoles } from "@/lib/roles";

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="border border-stone-200 bg-white p-4">
      <div className="text-[10px] uppercase tracking-widest text-stone-500">{label}</div>
      <div
        className={
          "text-2xl font-mono mt-1 " +
          (tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-700" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

function Page() {
  const perms = useMyRoles();
  const status = useServerFn(trelloStatus);
  const [from, setFrom] = useState("2026-08-01");
  const [to, setTo] = useState("2026-08-31");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<MigrationReport | null>(null);

  const cfg = useQuery({
    queryKey: ["trello-status"],
    queryFn: () => status(),
    enabled: perms.isAdmin,
  });

  const run = async () => {
    setRunning(true);
    setReport(null);
    setProgress({ done: 0, total: 0 });
    try {
      const r = await runTrelloBacklog({
        from: new Date(`${from}T00:00:00`).toISOString(),
        to: new Date(`${to}T23:59:59`).toISOString(),
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setReport(r);
      toast.success(`Migração concluída: ${r.criados} card(s) criado(s).`);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao executar a migração.");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  if (!perms.isAdmin) {
    return <div className="p-10 text-sm text-stone-500">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="font-display text-3xl mb-1 flex items-center gap-2">
        <Trello className="size-6 text-[#0079BF]" /> Integração Trello
      </h1>
      <p className="text-sm text-stone-500 mb-6">
        Pedidos aprovados com <strong>ENTREGA + INSTALAÇÃO</strong> geram automaticamente um card na lista{" "}
        <strong>{TRELLO_CLOSED_LIST}</strong>, com PDF do pedido, informações completas e todos os anexos vinculados.
        A rotina é idempotente: pedidos já sincronizados nunca geram um segundo card.
      </p>

      <div className="border border-stone-200 bg-white p-4 mb-6 text-sm">
        {cfg.isLoading ? (
          "Verificando conexão…"
        ) : cfg.data?.configured ? (
          <span className="text-emerald-700">Conectado ao quadro “{cfg.data.board}”.</span>
        ) : (
          <span className="text-red-700">Trello indisponível: {cfg.data?.error}</span>
        )}
      </div>

      <div className="border border-stone-200 bg-white p-4 mb-6">
        <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-3">Migração retroativa</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="block text-stone-500 mb-1">De</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-stone-300 px-2 py-1.5" />
          </label>
          <label className="text-xs">
            <span className="block text-stone-500 mb-1">Até</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-stone-300 px-2 py-1.5" />
          </label>
          <button
            onClick={run}
            disabled={running || !cfg.data?.configured}
            className="bg-stone-950 text-white text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-60"
          >
            {running ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
            Executar migração
          </button>
          {progress && (
            <span className="text-xs text-stone-500">
              {progress.done} / {progress.total} pedidos processados…
            </span>
          )}
        </div>
      </div>

      {report && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 mb-6">
            <Stat label="Pedidos encontrados" value={report.total} />
            <Stat label="Aprovados" value={report.aprovados} />
            <Stat label="Com entrega + instalação" value={report.elegiveis} />
            <Stat label="Cards criados" value={report.criados} tone="ok" />
            <Stat label="Já sincronizados" value={report.jaSincronizados} />
            <Stat label="Ignorados" value={report.ignorados} tone="warn" />
            <Stat label="Com erro" value={report.erros.length} tone="bad" />
          </div>

          <div className="border border-stone-200 bg-white divide-y divide-stone-100">
            {report.itens.map((i) => (
              <div key={i.number} className="p-3 flex items-center justify-between gap-4 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">
                    Pedido {String(i.number).padStart(6, "0")} — {i.client}
                  </div>
                  <div className="text-xs text-stone-500">{i.result}</div>
                </div>
                {i.url && (
                  <a href={i.url} target="_blank" rel="noreferrer" className="text-xs underline text-[#0079BF]">
                    abrir card
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/configuracoes/trello")({
  head: () => ({
    meta: [
      { title: "Integração Trello | Porcelane" },
      { name: "description", content: "Sincronização automática de pedidos aprovados com entrega e instalação para o Trello." },
      { property: "og:title", content: "Integração Trello | Porcelane" },
      { property: "og:description", content: "Cards automáticos na lista PEDIDO com PDF, informações e anexos do pedido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
