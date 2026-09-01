/**
 * BIBLIOTECA DE ACABAMENTOS — camada aditiva.
 *
 * Nada aqui altera pedido, cálculos ou Ordem de Corte. A biblioteca guarda
 * desenhos técnicos (padrão CAD, preto e branco) que a Liberação Técnica
 * apenas REFERENCIA — nunca copia.
 */

export type FinishTemplate =
  | "corte_borda"
  | "corte_rebaixo"
  | "corte_cuba"
  | "corte_testeira"
  | "corte_pingadeira"
  | "corte_encaixe"
  | "planta_recorte"
  | "superficie"
  | "custom";

export type ParamDef = {
  key: string;
  label: string;
  unit: "mm" | "m" | "°";
  def: number;
  min?: number;
  max?: number;
};

export type LibraryFinish = {
  id: string;
  user_id?: string;
  category: string;
  subcategory: string | null;
  code: string | null;
  name: string;
  template: FinishTemplate;
  params: Record<string, number | string>;
  description: string | null;
  notes: string | null;
  drawing_svg: string | null;
  plan_svg: string | null;
  image_url: string | null;
  manufacturer?: string | null;
  version: number;
  active: boolean;
};

/** Seleção feita na Liberação Técnica: referência + overrides do projeto. */
export type FinishSelection = {
  id: string;
  /** Slot: cuba, borda, testeira, pingadeira, rebaixo, encabecamento, encontro, nicho, superficie */
  slot: FinishSlot;
  finish_id: string;
  /** Versão do desenho usada — rastreabilidade. */
  version: number;
  /** Nome congelado só para exibição caso o item seja desativado. */
  label?: string;
  /** Sobrescritas dimensionais válidas apenas neste projeto. */
  params?: Record<string, number>;
};

export type FinishSlot =
  | "cuba" | "borda" | "testeira" | "pingadeira" | "rebaixo"
  | "encabecamento" | "encontro" | "nicho" | "superficie";

export const SLOT_LABEL: Record<FinishSlot, string> = {
  cuba: "Cuba",
  borda: "Borda",
  testeira: "Testeira",
  pingadeira: "Pingadeira",
  rebaixo: "Rebaixo",
  encabecamento: "Encabeçamento",
  encontro: "Encontro / Emenda",
  nicho: "Nicho",
  superficie: "Acabamento de superfície",
};

export const CATEGORIES = [
  "Testeiras",
  "Encabeçamentos",
  "Cubas",
  "Bordas",
  "Pingadeiras",
  "Nichos",
  "Encontros e Emendas",
  "Rebaixos",
  "Acabamentos de superfície",
] as const;

/** Categoria da biblioteca ↔ slot usado na Liberação Técnica. */
export const CATEGORY_SLOT: Record<string, FinishSlot> = {
  "Testeiras": "testeira",
  "Encabeçamentos": "encabecamento",
  "Cubas": "cuba",
  "Bordas": "borda",
  "Pingadeiras": "pingadeira",
  "Nichos": "nicho",
  "Encontros e Emendas": "encontro",
  "Rebaixos": "rebaixo",
  "Acabamentos de superfície": "superficie",
};

export const TEMPLATE_LABEL: Record<FinishTemplate, string> = {
  corte_borda: "Corte — perfil de borda",
  corte_rebaixo: "Corte — rebaixo / área molhada",
  corte_cuba: "Corte — cuba e engaste",
  corte_testeira: "Corte — testeira / encabeçamento",
  corte_pingadeira: "Corte — pingadeira",
  corte_encaixe: "Corte — encaixe / emenda",
  planta_recorte: "Planta — recorte com elemento oculto",
  superficie: "Amostra de superfície",
  custom: "Desenho próprio (SVG enviado)",
};

/** Parâmetros dimensionais de cada template — base para as cotas do desenho. */
export const TEMPLATE_PARAMS: Record<FinishTemplate, ParamDef[]> = {
  corte_borda: [
    { key: "esp", label: "Espessura", unit: "mm", def: 20 },
    { key: "perfil", label: "Altura do perfil", unit: "mm", def: 20 },
    { key: "raio", label: "Raio / chanfro", unit: "mm", def: 3 },
  ],
  corte_rebaixo: [
    { key: "esp", label: "Espessura", unit: "mm", def: 20 },
    { key: "prof", label: "Profundidade do rebaixo", unit: "mm", def: 8 },
    { key: "larg", label: "Largura do rebaixo", unit: "mm", def: 400 },
    { key: "borda", label: "Distância da borda", unit: "mm", def: 60 },
    { key: "raio", label: "Raio interno", unit: "mm", def: 15 },
  ],
  corte_cuba: [
    { key: "esp", label: "Espessura", unit: "mm", def: 20 },
    { key: "engaste", label: "Engaste (rebaixo inferior)", unit: "mm", def: 10 },
    { key: "vao", label: "Vão da cuba", unit: "mm", def: 450 },
    { key: "alt_cuba", label: "Altura da cuba", unit: "mm", def: 160 },
    { key: "prof", label: "Profundidade da área molhada", unit: "mm", def: 6 },
  ],
  corte_testeira: [
    { key: "esp", label: "Espessura", unit: "mm", def: 20 },
    { key: "alt", label: "Altura da testeira", unit: "mm", def: 100 },
    { key: "aba", label: "Aba / retorno", unit: "mm", def: 40 },
    { key: "raio", label: "Raio / chanfro", unit: "mm", def: 3 },
  ],
  corte_pingadeira: [
    { key: "esp", label: "Espessura", unit: "mm", def: 20 },
    { key: "dist", label: "Distância da borda", unit: "mm", def: 15 },
    { key: "larg_canal", label: "Largura do canal", unit: "mm", def: 6 },
    { key: "prof", label: "Profundidade do canal", unit: "mm", def: 5 },
  ],
  corte_encaixe: [
    { key: "esp", label: "Espessura", unit: "mm", def: 20 },
    { key: "rebaixo", label: "Rebaixo / degrau", unit: "mm", def: 10 },
    { key: "folga", label: "Folga de colagem", unit: "mm", def: 1 },
    { key: "angulo", label: "Ângulo do encontro", unit: "°", def: 90 },
  ],
  planta_recorte: [
    { key: "comp", label: "Comprimento", unit: "mm", def: 560 },
    { key: "larg", label: "Largura", unit: "mm", def: 400 },
    { key: "borda", label: "Distância da borda", unit: "mm", def: 60 },
    { key: "raio", label: "Raio dos cantos", unit: "mm", def: 25 },
    { key: "oculto", label: "Folga do elemento oculto", unit: "mm", def: 20 },
  ],
  superficie: [{ key: "esp", label: "Espessura", unit: "mm", def: 20 }],
  custom: [],
};

export function defaultParams(t: FinishTemplate): Record<string, number> {
  return Object.fromEntries((TEMPLATE_PARAMS[t] ?? []).map((p) => [p.key, p.def]));
}

/** Valor final = padrão do template ← cadastro ← override do projeto. */
export function resolveParams(
  template: FinishTemplate,
  saved?: Record<string, number | string> | null,
  overrides?: Record<string, number> | null,
): Record<string, number> {
  const out = defaultParams(template);
  for (const [k, v] of Object.entries(saved ?? {})) {
    const n = typeof v === "number" ? v : parseFloat(String(v));
    if (Number.isFinite(n)) out[k] = n;
  }
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (Number.isFinite(v)) out[k] = v;
  }
  return out;
}

type SeedFinish = {
  category: string;
  subcategory: string;
  code: string;
  name: string;
  template: FinishTemplate;
  params?: Record<string, number>;
  description?: string;
};

/** Catálogo inicial — cadastrado sob demanda pelo usuário, nunca automático. */
export const SEED_FINISHES: SeedFinish[] = [
  // TESTEIRAS
  { category: "Testeiras", subcategory: "Reta", code: "TST-01", name: "Testeira reta", template: "corte_testeira" },
  { category: "Testeiras", subcategory: "Em L", code: "TST-02", name: "Testeira em L", template: "corte_testeira", params: { aba: 60 } },
  { category: "Testeiras", subcategory: "Invertida", code: "TST-03", name: "Testeira invertida", template: "corte_testeira", params: { aba: -40 } },
  { category: "Testeiras", subcategory: "Em U", code: "TST-04", name: "Testeira em U", template: "corte_testeira", params: { aba: 80 } },
  { category: "Testeiras", subcategory: "Chanfrada", code: "TST-05", name: "Testeira chanfrada", template: "corte_testeira", params: { raio: 10 } },
  { category: "Testeiras", subcategory: "Meia-esquadria", code: "TST-06", name: "Testeira meia-esquadria", template: "corte_encaixe", params: { angulo: 45 } },
  { category: "Testeiras", subcategory: "Arredondada", code: "TST-07", name: "Testeira arredondada", template: "corte_testeira", params: { raio: 20 } },
  // ENCABEÇAMENTOS
  { category: "Encabeçamentos", subcategory: "Reto", code: "ENC-01", name: "Encabeçamento reto", template: "corte_testeira", params: { alt: 40, aba: 0 } },
  { category: "Encabeçamentos", subcategory: "Chanfrado", code: "ENC-02", name: "Encabeçamento chanfrado", template: "corte_testeira", params: { alt: 40, raio: 10 } },
  { category: "Encabeçamentos", subcategory: "Arredondado", code: "ENC-03", name: "Encabeçamento arredondado", template: "corte_testeira", params: { alt: 40, raio: 20 } },
  // CUBAS
  { category: "Cubas", subcategory: "Embutir / engaste por baixo", code: "CUB-01", name: "Cuba de embutir (engaste por baixo)", template: "corte_cuba", description: "Cuba fixada por baixo do tampo, com engaste e área molhada rebaixada." },
  { category: "Cubas", subcategory: "Sobrepor", code: "CUB-02", name: "Cuba de sobrepor", template: "corte_cuba", params: { engaste: 0, alt_cuba: 140, prof: 0 } },
  { category: "Cubas", subcategory: "Apoio", code: "CUB-03", name: "Cuba de apoio", template: "corte_cuba", params: { engaste: 0, vao: 0, alt_cuba: 130, prof: 0 } },
  { category: "Cubas", subcategory: "Esculpida", code: "CUB-04", name: "Cuba esculpida", template: "corte_cuba", params: { engaste: 20, alt_cuba: 120, prof: 10 } },
  {
    category: "Cubas", subcategory: "Cuba esculpida / Rebaixo italiano", code: "CUB-06",
    name: "Cuba esculpida — Rebaixo italiano", template: "corte_cuba",
    params: { engaste: 0, alt_cuba: 120, prof: 12 },
    description: "Cuba esculpida na própria pedra com sistema de rebaixo italiano: área molhada rebaixada, caimento direcionado e ralo posicionado conforme projeto. Vista superior e corte lateral; todas as medidas são preenchidas manualmente.",
  },
  { category: "Cubas", subcategory: "Semi-encaixe", code: "CUB-05", name: "Cuba semi-encaixe", template: "corte_cuba", params: { engaste: 6, alt_cuba: 150 } },
  // BORDAS
  { category: "Bordas", subcategory: "Reta", code: "BRD-01", name: "Borda reta", template: "corte_borda", params: { raio: 0 } },
  { category: "Bordas", subcategory: "Meia-esquadria", code: "BRD-02", name: "Meia-esquadria", template: "corte_encaixe", params: { angulo: 45 } },
  { category: "Bordas", subcategory: "Chanfrada", code: "BRD-03", name: "Borda chanfrada", template: "corte_borda", params: { raio: 6 } },
  { category: "Bordas", subcategory: "Boleada", code: "BRD-04", name: "Borda boleada", template: "corte_borda", params: { raio: 10 } },
  { category: "Bordas", subcategory: "Arredondada", code: "BRD-05", name: "Borda arredondada", template: "corte_borda", params: { raio: 20 } },
  { category: "Bordas", subcategory: "Duplo chanfro", code: "BRD-06", name: "Duplo chanfro", template: "corte_borda", params: { raio: 4, perfil: 30 } },
  // PINGADEIRAS
  { category: "Pingadeiras", subcategory: "Frontal", code: "PNG-01", name: "Pingadeira frontal", template: "corte_pingadeira" },
  { category: "Pingadeiras", subcategory: "Lateral", code: "PNG-02", name: "Pingadeira lateral", template: "corte_pingadeira", params: { dist: 20 } },
  { category: "Pingadeiras", subcategory: "Frontal + lateral", code: "PNG-03", name: "Pingadeira frontal + lateral", template: "planta_recorte", params: { borda: 20, raio: 0, oculto: 6 } },
  // NICHOS
  { category: "Nichos", subcategory: "Borda reta", code: "NCH-01", name: "Nicho com borda reta", template: "planta_recorte", params: { raio: 0 } },
  { category: "Nichos", subcategory: "Borda chanfrada", code: "NCH-02", name: "Nicho com borda chanfrada", template: "planta_recorte", params: { raio: 8 } },
  { category: "Nichos", subcategory: "Borda arredondada", code: "NCH-03", name: "Nicho com borda arredondada", template: "planta_recorte", params: { raio: 30 } },
  // ENCONTROS E EMENDAS
  { category: "Encontros e Emendas", subcategory: "Encontro 90°", code: "EMD-01", name: "Encontro 90°", template: "corte_encaixe", params: { angulo: 90, rebaixo: 0 } },
  { category: "Encontros e Emendas", subcategory: "Emenda reta", code: "EMD-02", name: "Emenda reta", template: "corte_encaixe", params: { angulo: 90, rebaixo: 0, folga: 2 } },
  { category: "Encontros e Emendas", subcategory: "Canto 45°", code: "EMD-03", name: "Canto 45°", template: "corte_encaixe", params: { angulo: 45 } },
  { category: "Encontros e Emendas", subcategory: "União com colagem", code: "EMD-04", name: "União com colagem", template: "corte_encaixe", params: { angulo: 90, folga: 1, rebaixo: 0 } },
  { category: "Encontros e Emendas", subcategory: "Encaixe", code: "EMD-05", name: "Encaixe", template: "corte_encaixe", params: { rebaixo: 10 } },
  { category: "Encontros e Emendas", subcategory: "Rebaixo / degrau", code: "EMD-06", name: "Rebaixo / degrau", template: "corte_encaixe", params: { rebaixo: 15 } },
  // REBAIXOS
  {
    category: "Rebaixos", subcategory: "Italiano", code: "RBX-01", name: "Rebaixo italiano",
    template: "corte_rebaixo",
    description: "Área molhada rebaixada em relação à superfície da bancada, com raio interno e caimento para a cuba. Elemento abaixo da superfície é representado em linha tracejada na planta.",
  },
  // SUPERFÍCIE
  { category: "Acabamentos de superfície", subcategory: "Polido", code: "SUP-01", name: "Polido", template: "superficie" },
  { category: "Acabamentos de superfície", subcategory: "Acetinado", code: "SUP-02", name: "Acetinado", template: "superficie" },
  { category: "Acabamentos de superfície", subcategory: "Levigado", code: "SUP-03", name: "Levigado", template: "superficie" },
  { category: "Acabamentos de superfície", subcategory: "Escovado", code: "SUP-04", name: "Escovado", template: "superficie" },
  { category: "Acabamentos de superfície", subcategory: "Flameado", code: "SUP-05", name: "Flameado", template: "superficie" },
  { category: "Acabamentos de superfície", subcategory: "Jateado", code: "SUP-06", name: "Jateado", template: "superficie" },
];

/** Templates que dependem de espessura/encaixe → geram corte técnico A-A. */
export function needsSectionCut(t: FinishTemplate): boolean {
  return t === "corte_rebaixo" || t === "corte_cuba" || t === "corte_encaixe" || t === "corte_pingadeira";
}

/** Informação curta para vincular à peça na Ordem de Corte (sem duplicar dados). */
export function cutNote(name: string, template: FinishTemplate, p: Record<string, number>): string | null {
  switch (template) {
    case "corte_rebaixo":
      return `${name}: rebaixo ${p.prof} mm · raio ${p.raio} mm · ${p.borda} mm da borda`;
    case "corte_cuba":
      return p.engaste > 0 ? `${name}: engaste ${p.engaste} mm · vão ${p.vao} mm` : `${name}: vão ${p.vao} mm`;
    case "corte_pingadeira":
      return `${name}: canal ${p.larg_canal}×${p.prof} mm a ${p.dist} mm da borda`;
    case "corte_encaixe":
      return `${name}: ${p.angulo}° · rebaixo ${p.rebaixo} mm · folga ${p.folga} mm`;
    default:
      return null;
  }
}
