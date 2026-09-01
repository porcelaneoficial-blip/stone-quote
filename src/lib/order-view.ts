/**
 * Helpers compartilhados de leitura do pedido (rótulos, status, progresso e
 * pendências). Apenas apresentação — não altera dados nem regras de negócio.
 */
import type { Environment, QuoteData } from "@/lib/types";
import { TECH_CHECKLIST, checklistProgress } from "@/lib/tech-checklist";

export type Tone = "neutro" | "positivo" | "atencao" | "alerta" | "andamento";

/** Nome exibido do ambiente (técnico tem prioridade, como já era feito). */
export const envLabel = (env: Environment) => env.tech_name || env.name || "Ambiente";
/** Material exibido do ambiente. */
export const envMaterial = (env: Environment) => env.tech_material || env.material_name || "—";

export const PROD_LABEL: Record<string, string> = {
  liberado: "Liberado",
  em_corte: "Em corte",
  em_acabamento: "Em acabamento",
  concluido: "Concluído",
};

export const PROD_STEPS = [
  { key: "liberado", label: "Liberado" },
  { key: "em_corte", label: "Corte" },
  { key: "em_acabamento", label: "Acabamento" },
  { key: "concluido", label: "Concluído" },
];

/** Índice da etapa de produção do ambiente (-1 quando ainda não iniciou). */
export function envProdIndex(env: Environment) {
  const key = env.production_status ?? (env.released_for_cut_at ? "liberado" : "");
  return PROD_STEPS.findIndex((s) => s.key === key);
}

/** Pendências do ambiente: itens do checklist ainda não conferidos. */
export function envPendings(env: Environment): string[] {
  const map = env.tech_checklist;
  const list = TECH_CHECKLIST.filter((c) => !map?.[c.key]).map((c) => c.label);
  return env.released_for_cut_at ? [] : list;
}

export function envPendingCount(env: Environment) {
  return envPendings(env).length;
}

export function orderPendingCount(data: QuoteData) {
  return (data.environments ?? []).reduce((s, e) => s + envPendingCount(e), 0);
}

export function orderPieceCount(data: QuoteData) {
  return (data.environments ?? []).reduce((s, e) => s + (e.items ?? []).length, 0);
}

/** Progresso de conferência do pedido (soma dos checklists dos ambientes). */
export function orderChecklistProgress(data: QuoteData) {
  const envs = data.environments ?? [];
  const acc = envs.reduce(
    (a, e) => {
      const ck = checklistProgress(e.tech_checklist);
      return { done: a.done + ck.done, total: a.total + ck.total };
    },
    { done: 0, total: 0 },
  );
  return { ...acc, pct: acc.total ? Math.round((acc.done / acc.total) * 100) : 0 };
}

/** Tom visual do ambiente conforme situação atual. */
export function envTone(env: Environment): Tone {
  if (env.tech_check_status === "bloqueado") return "alerta";
  if (env.production_status === "concluido") return "positivo";
  if (env.released_for_cut_at) return "positivo";
  if (env.production_status) return "andamento";
  if (envPendingCount(env) > 0) return "atencao";
  return "neutro";
}
