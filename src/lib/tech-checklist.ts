/** Checklist técnico de conferência por ambiente (Liberação Técnica). */
export const TECH_CHECKLIST: { key: string; label: string }[] = [
  { key: "medidas", label: "Medidas conferidas com a medição" },
  { key: "esquadro", label: "Esquadro / ângulos conferidos" },
  { key: "material", label: "Material confere com o pedido" },
  { key: "cor_veio", label: "Cor e sentido do veio definidos" },
  { key: "espessura", label: "Espessura conferida" },
  { key: "acabamentos", label: "Acabamentos de borda definidos" },
  { key: "recortes", label: "Recortes conferidos" },
  { key: "furos", label: "Furos conferidos" },
  { key: "cubas", label: "Cubas / válvulas conferidas" },
  { key: "cooktop", label: "Cooktop / churrasqueira conferidos" },
  { key: "transpasse", label: "Transpasses definidos" },
  { key: "rodabancada", label: "Rodabancada / frontão definidos" },
  { key: "saias", label: "Saias e engrossamentos definidos" },
  { key: "emendas", label: "Emendas e encaixes definidos" },
  { key: "logistica", label: "Logística e local de instalação confirmados" },
];

export type TechCheckStatus =
  | "pendente"
  | "em_analise"
  | "em_revisao"
  | "aguardando_correcao"
  | "liberado"
  | "bloqueado";

export const TECH_CHECK_STATUS: { key: TechCheckStatus; label: string }[] = [
  { key: "pendente", label: "Pendente" },
  { key: "em_analise", label: "Em análise" },
  { key: "em_revisao", label: "Em revisão" },
  { key: "aguardando_correcao", label: "Aguardando correção" },
  { key: "liberado", label: "Liberado" },
  { key: "bloqueado", label: "Bloqueado" },
];

export const checklistProgress = (map?: Record<string, boolean>) => {
  const done = TECH_CHECKLIST.filter((c) => map?.[c.key]).length;
  return { done, total: TECH_CHECKLIST.length, pct: Math.round((done / TECH_CHECKLIST.length) * 100) };
};
