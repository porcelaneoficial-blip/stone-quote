import type { QuoteData } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { envLabel, envMaterial, envProdIndex, PROD_LABEL, PROD_STEPS } from "@/lib/order-view";
import { EmptyState, Field, ProgressSteps, StatusBadge } from "@/components/ui-kit";

/** Aba Produção — leitura do andamento por ambiente (fonte: dados do pedido). */
export function OrderProductionPanel({ data }: { data: QuoteData }) {
  const envs = data.environments ?? [];
  if (!envs.length) return <EmptyState>Sem ambientes para produzir.</EmptyState>;

  return (
    <div className="space-y-3">
      {envs.map((env) => {
        const idx = envProdIndex(env);
        return (
          <div key={env.id} className="bg-white border border-stone-200 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div className="min-w-0">
                <h4 className="font-semibold text-sm">{envLabel(env)}</h4>
                <p className="text-xs text-stone-500 mt-0.5">{envMaterial(env)}</p>
              </div>
              <StatusBadge tone={env.production_status === "concluido" ? "positivo" : idx >= 0 ? "andamento" : "neutro"}>
                {env.production_status ? PROD_LABEL[env.production_status] : idx >= 0 ? "Liberado" : "Aguardando liberação"}
              </StatusBadge>
            </div>
            <ProgressSteps steps={PROD_STEPS} current={idx} />
            <dl className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Cortador" value={env.cut_by_name || "—"} />
              <Field label="Acabador" value={env.finish_by_name || "—"} />
              <Field label="Início corte" value={env.cut_started_at ? fmtDate(env.cut_started_at) : "—"} />
              <Field label="Fim acabamento" value={env.finish_done_at ? fmtDate(env.finish_done_at) : "—"} />
            </dl>
          </div>
        );
      })}
    </div>
  );
}
