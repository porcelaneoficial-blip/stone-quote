import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { analyzeFinancials } from "@/lib/financeiro-ai.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financeiro/insights")({
  head: () => ({
    meta: [
      { title: "Insights Financeiros — Porcelane" },
      { name: "description", content: "Análise inteligente do fluxo de caixa, inadimplência e ações prioritárias." },
      { property: "og:title", content: "Insights Financeiros — Porcelane" },
      { property: "og:description", content: "Insights do financeiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinInsights,
});

const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FinInsights() {
  const analyze = useServerFn(analyzeFinancials);
  const [result, setResult] = useState<any>(null);
  const mut = useMutation({
    mutationFn: () => analyze(),
    onSuccess: (d) => setResult(d),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const k = result?.kpis;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="size-6" /> Insights Financeiros</h1>
          <p className="text-sm text-stone-500">Diagnóstico do caixa, inadimplência e próximas ações sobre seus dados atuais.</p>
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Analisando…" : "Analisar agora"}
        </Button>
      </div>

      {k && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Recebido (30d)" value={money(k.recebido_ultimos_30)} tone="ok" />
          <Kpi label="Pago (30d)" value={money(k.pago_ultimos_30)} />
          <Kpi label="A receber (30d)" value={money(k.a_receber_30)} tone="ok" />
          <Kpi label="A pagar (30d)" value={money(k.a_pagar_30)} tone="warn" />
          <Kpi label="Saldo projetado 30d" value={money(k.saldo_projetado_30)} tone={k.saldo_projetado_30 >= 0 ? "ok" : "bad"} />
          <Kpi label="Inadimplência" value={`${money(k.inadimplencia_valor)} (${k.inadimplencia_qtd})`} tone="bad" />
          <Kpi label="Contas vencidas" value={`${money(k.contas_vencidas_valor)} (${k.contas_vencidas_qtd})`} tone="bad" />
        </div>
      )}

      {result?.topDevedores?.length ? (
        <Card className="p-4">
          <h2 className="font-semibold mb-2">Top devedores</h2>
          <ul className="text-sm space-y-1">
            {result.topDevedores.map((d: any) => (
              <li key={d.client} className="flex justify-between border-b py-1">
                <span>{d.client}</span><span className="font-medium">{money(d.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {result?.insights && (
        <Card className="p-4">
          <h2 className="font-semibold mb-2">Análise Executiva</h2>
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{result.insights}</pre>
        </Card>
      )}

      {!result && !mut.isPending && (
        <Card className="p-8 text-center text-stone-500">
          Clique em <b>Analisar agora</b> para gerar um diagnóstico executivo do financeiro dos últimos 90 dias e projeção para os próximos 60.
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : "text-stone-900";
  return (
    <Card className="p-3">
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </Card>
  );
}
