/**
 * DOCUMENTOS TÉCNICOS POR AMBIENTE — construtor de snapshot.
 *
 * Regra absoluta: este módulo NÃO inventa dados. Ele apenas lê o pedido e o
 * ambiente já existentes e devolve uma estrutura serializável (snapshot) que
 * é usada para gerar, pré-visualizar, imprimir e arquivar o documento.
 *
 * O snapshot é congelado no momento da geração — versões antigas continuam
 * mostrando exatamente o que existia quando foram criadas.
 */
import type { Environment, EnvItem, QuoteData, FinishType, RoomFinishEdge } from "@/lib/types";
import type { LibraryFinish } from "@/lib/finish-library";
import { TEMPLATE_LABEL } from "@/lib/finish-library";

export type TechDocKind = "corte" | "acabamento";

export const TECH_DOC_LABEL: Record<TechDocKind, string> = {
  corte: "ORDEM DE CORTE",
  acabamento: "ORDEM DE ACABAMENTO",
};

export type TechDocRow = {
  index: number;
  description: string;
  qty: number;
  /** Milímetros — somente quando existir a medida cadastrada. */
  length_mm?: number;
  width_mm?: number;
  thickness_mm?: number;
  notes?: string;
  code?: string;
};

export type TechDocLegend = { label: string; color?: string };

export type TechDocSnapshot = {
  kind: TechDocKind;
  /** Identificação do pedido — nunca de outro pedido. */
  order_id: string;
  order_number: number;
  order_date?: string;
  /** Data/hora da geração desta versão. */
  generated_at: string;
  client_name?: string;
  client_phone?: string;
  env_id: string;
  env_name: string;
  material?: string;
  finish_label?: string;
  revision?: number;
  responsible?: string;
  released_by?: string;
  released_at?: string;
  release_status?: string;
  notes?: string;
  rows: TechDocRow[];
  columns: { thickness: boolean; notes: boolean; code: boolean };
  finish_legend: TechDocLegend[];
  technique_legend: TechDocLegend[];
  accessories: string[];
  supplies: { name: string; qty: number; unit?: string }[];
  /** Cópia congelada do ambiente — usada para redesenhar o 2D da versão. */
  env: Environment;
  finish_types: FinishType[];
  scale?: string;
  /** Valor da nota (R$/m²) vindo das Configurações — corte e acabamento têm valores distintos. */
  note_rate_m2?: number;
  /** Área total liberada do ambiente, em m². */
  area_m2?: number;
  /** Valor da nota do documento = área × valor por m². */
  note_value?: number;
};

const mm = (meters?: number) => {
  const v = Number(meters);
  if (!Number.isFinite(v) || v <= 0) return undefined;
  return Math.round(v * 1000);
};

const relLen = (it: EnvItem) => it.released_length ?? it.length;
const relWid = (it: EnvItem) => it.released_width ?? it.width;
const relQty = (it: EnvItem) => {
  const v = it.released_qty ?? it.qty ?? 1;
  return v && v > 0 ? v : 1;
};

/** Peças técnicas do ambiente (peças do pedido + peças extras da liberação). */
export function techPieces(env: Environment): EnvItem[] {
  return [
    ...(env.items ?? []),
    ...(env.extra_cut_pieces ?? []).map((it) => ({
      ...it,
      description: it.description ? `Extra · ${it.description}` : "Extra",
    })),
  ];
}

const RELEASE_STATUS_LABEL: Record<string, string> = {
  pendente: "PENDENTE",
  em_analise: "EM ANÁLISE",
  em_revisao: "EM REVISÃO",
  aguardando_correcao: "AGUARDANDO CORREÇÃO",
  liberado: "LIBERADO",
  bloqueado: "BLOQUEADO",
  em_producao: "EM PRODUÇÃO",
  concluido: "CONCLUÍDO",
};

export const releaseStatusLabel = (env: Environment): string | undefined => {
  const key = env.tech_check_status ?? env.tech_status;
  if (!key) return env.released_for_cut_at ? "LIBERADO" : undefined;
  return RELEASE_STATUS_LABEL[key] ?? key.toUpperCase();
};

/** Acabamentos realmente usados no ambiente (com as cores cadastradas). */
function buildFinishLegend(env: Environment, finishTypes: FinishType[]): TechDocLegend[] {
  const ids: string[] = [];
  for (const it of techPieces(env)) {
    for (const e of it.finish_edges ?? []) if (e?.finish_type_id) ids.push(e.finish_type_id);
  }
  const roomEdges = Object.values(env.quick_room?.finish_edges ?? {}) as RoomFinishEdge[];
  for (const e of roomEdges) if (e?.finish_type_id) ids.push(e.finish_type_id);

  const out: TechDocLegend[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const ft = finishTypes.find((f) => f.id === id);
    if (!ft || seen.has(ft.id)) continue;
    seen.add(ft.id);
    out.push({ label: ft.name, color: ft.color });
  }
  return out;
}

/** Tipos técnicos (Biblioteca) realmente referenciados pelas peças. */
function buildTechniqueLegend(env: Environment, library: LibraryFinish[]): TechDocLegend[] {
  const out: TechDocLegend[] = [];
  const seen = new Set<string>();
  for (const it of techPieces(env)) {
    for (const sel of it.tech_finishes ?? []) {
      const f = library.find((x) => x.id === sel.finish_id);
      if (!f || seen.has(f.id)) continue;
      seen.add(f.id);
      const tpl = TEMPLATE_LABEL[f.template];
      out.push({ label: tpl && tpl !== f.name ? `${f.name} · ${tpl}` : f.name });
    }
  }
  return out;
}

/** Acessórios posicionados no 2D do ambiente + quantidades declaradas. */
function buildAccessories(env: Environment): string[] {
  const out: string[] = [];
  for (const a of env.quick_room?.accessories ?? []) {
    const parts = [a.kind?.replace(/_/g, " "), a.subkind?.replace(/_/g, " "), a.label].filter(Boolean);
    if (parts.length) out.push(parts.join(" · "));
  }
  const counted: [number | undefined, string][] = [
    [env.qtd_cuba, "Cuba"],
    [env.qtd_nicho, "Nicho"],
    [env.qtd_divibox, "Divibox"],
  ];
  for (const [qty, label] of counted) if (qty && qty > 0) out.push(`${qty}× ${label}`);
  return out;
}

export function buildTechDoc(args: {
  kind: TechDocKind;
  orderId: string;
  orderNumber: number;
  orderDate?: string;
  data: QuoteData;
  env: Environment;
  finishTypes: FinishType[];
  library?: LibraryFinish[];
  scale?: string;
  /** R$/m² da nota (corte ou acabamento) conforme Configurações. */
  noteRate?: number;
}): TechDocSnapshot {
  const { env } = args;
  const pieces = techPieces(env);

  const rows: TechDocRow[] = pieces.map((it, i) => ({
    index: i + 1,
    description: it.description || "—",
    qty: relQty(it),
    length_mm: mm(relLen(it)),
    width_mm: mm(relWid(it)),
    thickness_mm: it.thickness_mm && it.thickness_mm > 0 ? it.thickness_mm : undefined,
    notes: [it.released_notes, it.usinagem].filter(Boolean).join(" · ") || undefined,
    code: it.piece_kind || undefined,
  }));

  const areaM2 = pieces.reduce(
    (acc, it) => acc + (Number(relLen(it)) || 0) * (Number(relWid(it)) || 0) * relQty(it),
    0,
  );
  const noteRate = Number(args.noteRate) || 0;

  const finishLegend = buildFinishLegend(env, args.finishTypes);
  const techniqueLegend = buildTechniqueLegend(env, args.library ?? []);

  return {
    kind: args.kind,
    order_id: args.orderId,
    order_number: args.orderNumber,
    order_date: args.orderDate,
    generated_at: new Date().toISOString(),
    client_name: args.data.client_name || undefined,
    client_phone: args.data.client_phone || undefined,
    env_id: env.id,
    env_name: env.tech_name || env.name,
    material: env.tech_material || env.material_name || undefined,
    finish_label: finishLegend.map((f) => f.label).join(" · ") || undefined,
    revision: env.tech_revision ?? 0,
    responsible: env.tech_responsible || undefined,
    released_by: env.released_by_name || undefined,
    released_at: env.released_for_cut_at || undefined,
    release_status: releaseStatusLabel(env),
    notes: env.tech_notes || undefined,
    rows,
    columns: {
      thickness: rows.some((r) => r.thickness_mm != null),
      notes: rows.some((r) => !!r.notes),
      code: rows.some((r) => !!r.code),
    },
    finish_legend: finishLegend,
    technique_legend: techniqueLegend,
    accessories: buildAccessories(env),
    supplies: (env.supplies ?? [])
      .filter((s) => s.description && (s.qty ?? 0) > 0)
      .map((s) => ({ name: s.description, qty: s.qty })),

    env: JSON.parse(JSON.stringify(env)) as Environment,
    finish_types: args.finishTypes.filter((f) => finishLegend.some((l) => l.label === f.name)),
    scale: args.scale,
    note_rate_m2: noteRate > 0 ? noteRate : undefined,
    area_m2: areaM2 > 0 ? Math.round(areaM2 * 10000) / 10000 : undefined,
    note_value: noteRate > 0 && areaM2 > 0 ? Math.round(areaM2 * noteRate * 100) / 100 : undefined,
  };
}

/** Nome do arquivo: Pedido_000254_Cozinha_Ordem_Corte_V2 */
export function techDocFileName(snap: TechDocSnapshot, version: number) {
  const slug = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const kind = snap.kind === "corte" ? "Ordem_Corte" : "Ordem_Acabamento";
  return `Pedido_${String(snap.order_number).padStart(6, "0")}_${slug(snap.env_name)}_${kind}_V${version}`;
}
