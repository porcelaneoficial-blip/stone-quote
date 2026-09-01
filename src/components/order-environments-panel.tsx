import { useState } from "react";
import type { QuoteData, Environment, EnvItem } from "@/lib/types";
import { envArea, itemArea, itemQty } from "@/lib/quote-calc";
import { checklistProgress } from "@/lib/tech-checklist";
import { envLabel, envMaterial, envPendings, envPendingCount, envTone, envProdIndex, PROD_LABEL, PROD_STEPS } from "@/lib/order-view";
import { StatusBadge, PendingBadge, EmptyState, ProgressSteps, Field } from "@/components/ui-kit";
import { Copy, Ruler, ChevronRight, ChevronDown } from "lucide-react";

const n = (v: number | undefined) => (v ?? 0).toFixed(2).replace(".", ",");

/** Detalhe técnico resumido da peça (somente leitura — edição fica no painel técnico). */
function PieceDetail({ it, onOpenTech }: { it: EnvItem; onOpenTech: () => void }) {
  const rel =
    it.released_length != null || it.released_width != null || it.released_qty != null
      ? `${n(it.released_length ?? it.length)} × ${n(it.released_width ?? it.width)} m · ${it.released_qty ?? itemQty(it)} un`
      : "Sem ajuste técnico";
  return (
    <div className="bg-stone-50 border-t border-stone-200 px-4 py-3">
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Medida comercial" value={`${n(it.length)} × ${n(it.width)} m · ${itemQty(it)} un`} />
        <Field label="Medida liberada" value={rel} />
        <Field label="Área" value={`${itemArea(it).toFixed(2)} m²`} />
        <Field label="Espessura" value={it.thickness_mm ? `${it.thickness_mm} mm` : "—"} />
        <Field label="Emenda" value={it.has_emenda ? (it.emenda_position || "Sim") : "Não"} />
        <Field label="Recortes" value={String((it.recortes ?? []).length)} />
        <Field label="Furações" value={String((it.furacoes ?? []).length)} />
        <Field label="Acabamentos" value={String((it.finish_edges ?? []).length + (it.tech_finishes ?? []).length)} />
        {it.usinagem && <Field label="Usinagem" value={it.usinagem} className="col-span-2" />}
        {it.released_notes && <Field label="Observações técnicas" value={it.released_notes} className="col-span-2" />}
      </dl>
      <button onClick={onOpenTech} className="kanban-btn mt-3 flex items-center gap-1">
        <Ruler className="size-3" /> Abrir técnico / desenho
      </button>
    </div>
  );
}

function EnvCard(p: {
  env: Environment;
  canSeeMoney?: boolean;
  envTotal?: (env: Environment) => number;
  onOpenTech: (envId: string) => void;
  onDuplicateEnv?: (envId: string) => void;
}) {
  const { env } = p;
  const [open, setOpen] = useState(false);
  const [openPiece, setOpenPiece] = useState<string | null>(null);
  const ck = checklistProgress(env.tech_checklist);
  const rel = !!env.released_for_cut_at;
  const items = env.items ?? [];
  const pend = envPendings(env);

  return (
    <div className="bg-white border border-stone-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-4 flex-wrap hover:bg-stone-50"
      >
        <div className="min-w-0 flex items-start gap-2">
          {open ? <ChevronDown className="size-4 mt-0.5 text-stone-400" /> : <ChevronRight className="size-4 mt-0.5 text-stone-400" />}
          <div className="min-w-0">
            <h4 className="font-semibold text-sm truncate">{envLabel(env)}</h4>
            <p className="text-xs text-stone-500 mt-0.5 truncate">
              {envMaterial(env)} · {items.length} peça(s) · {envArea(env).toFixed(2)} m²
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge tone={envTone(env)}>{rel ? "Liberado" : "Não liberado"}</StatusBadge>
          {env.production_status && <StatusBadge tone="andamento">{PROD_LABEL[env.production_status]}</StatusBadge>}
          <StatusBadge>Conferência {ck.done}/{ck.total}</StatusBadge>
          {!rel && <PendingBadge count={envPendingCount(env)} />}
          {env.tech_revision ? <StatusBadge>V{env.tech_revision}</StatusBadge> : null}
          {p.canSeeMoney && p.envTotal && (
            <span className="text-xs font-medium tabular-nums">
              {p.envTotal(env).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-200">
          <div className="px-4 py-3">
            <ProgressSteps steps={PROD_STEPS} current={envProdIndex(env)} />
          </div>

          {!items.length ? (
            <EmptyState>Ambiente sem peças.</EmptyState>
          ) : (
            <ul className="border-t border-stone-100">
              {items.map((it) => (
                <li key={it.id} className="border-b border-stone-100 last:border-0">
                  <button
                    onClick={() => setOpenPiece((v) => (v === it.id ? null : it.id))}
                    className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-stone-50"
                  >
                    <span className="text-sm truncate">{it.description || "Peça"}</span>
                    <span className="text-xs text-stone-500 tabular-nums shrink-0">
                      {n(it.length)} × {n(it.width)} m · {itemQty(it)} un
                    </span>
                  </button>
                  {openPiece === it.id && <PieceDetail it={it} onOpenTech={() => p.onOpenTech(env.id)} />}
                </li>
              ))}
            </ul>
          )}

          {!rel && pend.length > 0 && (
            <div className="px-4 py-3 border-t border-stone-100">
              <div className="label-eyebrow mb-1">Pendências de conferência</div>
              <p className="text-xs text-stone-500">{pend.join(" · ")}</p>
            </div>
          )}

          <div className="px-4 py-3 border-t border-stone-100 flex items-center gap-2 flex-wrap">
            <button onClick={() => p.onOpenTech(env.id)} className="kanban-btn flex items-center gap-1">
              <Ruler className="size-3" /> Liberação técnica / desenhos
            </button>
            {p.onDuplicateEnv && (
              <button onClick={() => p.onDuplicateEnv!(env.id)} className="kanban-btn flex items-center gap-1">
                <Copy className="size-3" /> Duplicar estrutura
              </button>
            )}
            <span className="text-[11px] text-stone-400">
              Ordens de corte e acabamento ficam na aba Documentos.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Aba Ambientes — centro operacional: Ambiente > Peça > detalhe técnico. */
export function OrderEnvironmentsPanel(p: {
  data: QuoteData;
  canSeeMoney?: boolean;
  onOpenTech: (envId: string) => void;
  /** Mantido por compatibilidade — a impressão canônica vive em Documentos. */
  onPrintCut?: (envId: string) => void;
  onDuplicateEnv?: (envId: string) => void;
  envTotal?: (env: Environment) => number;
}) {
  const envs = p.data.environments ?? [];
  if (!envs.length) return <EmptyState>Este pedido não possui ambientes.</EmptyState>;

  return (
    <div className="space-y-2">
      {envs.map((env) => (
        <EnvCard
          key={env.id}
          env={env}
          canSeeMoney={p.canSeeMoney}
          envTotal={p.envTotal}
          onOpenTech={p.onOpenTech}
          onDuplicateEnv={p.onDuplicateEnv}
        />
      ))}
    </div>
  );
}
