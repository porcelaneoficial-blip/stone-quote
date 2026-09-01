import { useEffect, useRef, useState } from "react";
import type { EnvItem, Environment, FinishSide, FinishType, RoomFinishEdge, EdgeStyle, PieceKind, PieceCutout, PieceHole } from "@/lib/types";
import { PIECE_KIND_LABEL } from "@/lib/piece-recognition";
import { Palette, Plus, X } from "lucide-react";

const SIDE_OPTIONS: { v: FinishSide; label: string }[] = [
  { v: "frente", label: "Frente" },
  { v: "fundo", label: "Fundo" },
  { v: "esquerdo", label: "Esquerdo" },
  { v: "direito", label: "Direito" },
  { v: "superior", label: "Superior" },
  { v: "inferior", label: "Inferior" },
];
const SIDE_LABEL: Record<FinishSide, string> = {
  frente: "Frente", fundo: "Fundo", esquerdo: "Esquerdo", direito: "Direito",
  superior: "Superior", inferior: "Inferior", ambos: "Ambos",
};
const EDGE_STYLES: { v: EdgeStyle; label: string }[] = [
  { v: "reto", label: "Reto" },
  { v: "bisel_45", label: "Bisel 45°" },
  { v: "chanfrado", label: "Chanfrado" },
  { v: "boleado", label: "Boleado" },
  { v: "meia_esquadria", label: "Meia esquadria" },
];
const EDGE_STYLE_LABEL: Record<EdgeStyle, string> = Object.fromEntries(
  EDGE_STYLES.map((s) => [s.v, s.label]),
) as Record<EdgeStyle, string>;

/** Resolve os acabamentos efetivos de um item: usa item.finish_edges, ou faz fallback para o quick_room do ambiente. */
export function resolveItemFinishes(item: EnvItem, env?: Environment): RoomFinishEdge[] {
  if (item.finish_edges && item.finish_edges.length > 0) return item.finish_edges;
  const qr = env?.quick_room;
  if (qr?.finish_edges && qr.finish_edges.length > 0) return qr.finish_edges;
  if (qr?.finish_side) return [{ side: qr.finish_side }];
  return [];
}

/** Renderiza swatches coloridos + nome para exibir dentro/abaixo da célula de descrição do item nos PDFs. */
export function ItemFinishInline({
  item, env, finishTypes, className,
}: {
  item: EnvItem;
  env?: Environment;
  finishTypes: FinishType[];
  className?: string;
}) {
  const edges = resolveItemFinishes(item, env);
  if (edges.length === 0) return null;
  // deduplica por (finish_type_id + style)
  const seen = new Set<string>();
  const chips: { color: string; label: string; sides: string[] }[] = [];
  for (const e of edges) {
    const ft = finishTypes.find((f) => f.id === e.finish_type_id);
    const styleLabel = e.style ? EDGE_STYLE_LABEL[e.style] : undefined;
    const name = ft?.name ?? styleLabel ?? "Acabamento";
    const label = ft?.name && styleLabel ? `${ft.name} · ${styleLabel}` : name;
    const color = ft?.color ?? "#b8860b";
    const key = `${color}::${label}`;
    const existing = chips.find((c) => `${c.color}::${c.label}` === key);
    const sideLabel = SIDE_LABEL[e.side];
    if (existing) {
      if (sideLabel && !existing.sides.includes(sideLabel)) existing.sides.push(sideLabel);
    } else if (!seen.has(key)) {
      seen.add(key);
      chips.push({ color, label, sides: sideLabel ? [sideLabel] : [] });
    }
  }
  if (chips.length === 0) return null;
  return (
    <div className={`mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[9.5pt] text-stone-600 ${className ?? ""}`}>
      {chips.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 border border-stone-300" style={{ background: c.color, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
          <span>{c.label}{c.sides.length ? ` (${c.sides.join(", ")})` : ""}</span>
        </span>
      ))}
    </div>
  );
}

/** Resumo global de acabamentos — agrega todos os finishes usados em environments (item + quick_room) e mostra um bloco tipo "Legenda". Usado nos PDFs de orçamento/pedido/romaneio. */
export function FinishesLegendSummary({
  environments, finishTypes, title = "Legenda de acabamentos",
}: {
  environments: Environment[];
  finishTypes: FinishType[];
  title?: string;
}) {
  const seen = new Set<string>();
  const chips: { color: string; label: string }[] = [];
  const push = (e: RoomFinishEdge) => {
    const ft = finishTypes.find((f) => f.id === e.finish_type_id);
    const styleLabel = e.style ? EDGE_STYLE_LABEL[e.style] : undefined;
    if (!ft && !styleLabel) return;
    const name = ft?.name ?? styleLabel ?? "Acabamento";
    const label = ft?.name && styleLabel ? `${ft.name} · ${styleLabel}` : name;
    const color = ft?.color ?? "#b8860b";
    const key = `${color}::${label}`;
    if (seen.has(key)) return;
    seen.add(key);
    chips.push({ color, label });
  };
  for (const env of environments) {
    for (const it of env.items ?? []) {
      const edges = resolveItemFinishes(it, env);
      for (const e of edges) push(e);
    }
    const qrEdges = env.quick_room?.finish_edges ?? [];
    for (const e of qrEdges) push(e);
  }
  if (chips.length === 0) return null;
  return (
    <section className="mt-4 mb-4 border border-stone-300 bg-stone-50 p-2.5 print:break-inside-avoid">
      <div className="text-[10pt] uppercase tracking-widest font-bold text-stone-700 mb-1.5">{title}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11pt] text-stone-800">
        {chips.map((c, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3.5 h-3.5 border border-stone-500"
              style={{ background: c.color, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
            />
            <span>{c.label}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

/** Editor popover pequeno para escolher acabamentos por lado no item. */
export function ItemFinishEditor({
  item, finishTypes, onChange, onPatch,
}: {
  item: EnvItem;
  finishTypes: FinishType[];
  onChange: (edges: RoomFinishEdge[] | undefined) => void;
  /** Opcional: quando fornecido, o popover mostra campos técnicos da peça (tipo, espessura, recortes, furações). */
  onPatch?: (patch: Partial<EnvItem>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const edges = item.finish_edges ?? [];
  const edgeFor = (side: FinishSide) => edges.find((e) => e.side === side);
  const setEdge = (side: FinishSide, patch: Partial<RoomFinishEdge> | null) => {
    const rest = edges.filter((e) => e.side !== side);
    if (patch === null) {
      onChange(rest.length > 0 ? rest : undefined);
      return;
    }
    const cur = edgeFor(side) ?? { side };
    const next: RoomFinishEdge = { ...cur, ...patch, side };
    // remove se não tem tipo nem estilo
    if (!next.finish_type_id && !next.style) {
      onChange(rest.length > 0 ? rest : undefined);
      return;
    }
    onChange([...rest, next]);
  };
  const count = edges.length;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-1.5 py-0.5 border ${count > 0 ? "border-gold-high text-gold-high" : "border-stone-300 text-stone-500 hover:text-stone-950 hover:border-stone-950"}`}
        title="Acabamentos do item"
      >
        <Palette className="size-3" />
        Acabamentos{count > 0 ? ` (${count})` : ""}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 w-[380px] bg-white border border-stone-300 shadow-xl p-3 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="label-eyebrow">Painel da peça</span>
            <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-stone-950"><X className="size-3" /></button>
          </div>

          {onPatch && (
            <div className="space-y-1.5 border-b border-stone-100 pb-2">
              <div className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">Peça</div>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-stone-500">Tipo</span>
                  <select
                    value={item.piece_kind ?? ""}
                    onChange={(e) => onPatch({ piece_kind: (e.target.value || undefined) as PieceKind | undefined })}
                    className="text-[11px] border border-stone-200 bg-white px-1 py-0.5"
                  >
                    <option value="">— auto —</option>
                    {(Object.keys(PIECE_KIND_LABEL) as PieceKind[]).map((k) => (
                      <option key={k} value={k}>{PIECE_KIND_LABEL[k]}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-stone-500">Espessura (mm)</span>
                  <input
                    type="number" min={0} step={1}
                    value={item.thickness_mm ?? ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onPatch({ thickness_mm: isFinite(v) && v > 0 ? v : undefined });
                    }}
                    placeholder="—"
                    className="text-[11px] border border-stone-200 bg-white px-1 py-0.5 font-mono text-right"
                  />
                </label>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">Acabamentos por lado</div>
            <div className="space-y-1 max-h-56 overflow-auto">
              {SIDE_OPTIONS.map((s) => {
                const e = edgeFor(s.v);
                return (
                  <div key={s.v} className="grid grid-cols-[70px_1fr_1fr_auto] items-center gap-1.5">
                    <span className="text-[11px] text-stone-700">{s.label}</span>
                    <select
                      value={e?.finish_type_id ?? ""}
                      onChange={(ev) => setEdge(s.v, { finish_type_id: ev.target.value || undefined })}
                      className="text-[11px] border border-stone-200 bg-white px-1 py-0.5"
                    >
                      <option value="">— tipo —</option>
                      {finishTypes.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <select
                      value={e?.style ?? ""}
                      onChange={(ev) => setEdge(s.v, { style: (ev.target.value || undefined) as EdgeStyle | undefined })}
                      className="text-[11px] border border-stone-200 bg-white px-1 py-0.5"
                    >
                      <option value="">— estilo —</option>
                      {EDGE_STYLES.map((st) => (
                        <option key={st.v} value={st.v}>{st.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setEdge(s.v, null)}
                      disabled={!e}
                      className="text-stone-300 hover:text-red-600 disabled:opacity-30"
                      title="Remover lado"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                );
              })}
            </div>
            {edges.length === 0 && (
              <div className="text-[10px] text-stone-500 italic">
                Sem acabamentos definidos por item — o PDF usará o desenho 2D do ambiente (se houver).
              </div>
            )}
            <button
              onClick={() => onChange(undefined)}
              className="text-[10px] uppercase tracking-widest text-stone-400 hover:text-red-600"
            >
              Limpar acabamentos
            </button>
          </div>

          {onPatch && (
            <CutoutsHolesSection item={item} onPatch={onPatch} />
          )}
        </div>
      )}
    </div>
  );
}

function CutoutsHolesSection({
  item, onPatch,
}: {
  item: EnvItem;
  onPatch: (patch: Partial<EnvItem>) => void;
}) {
  const recortes = item.recortes ?? [];
  const furacoes = item.furacoes ?? [];
  const addRecorte = () => onPatch({ recortes: [...recortes, { id: crypto.randomUUID(), x: 0, y: 0, w: 0.4, h: 0.4 }] });
  const patchRecorte = (id: string, p: Partial<PieceCutout>) => onPatch({ recortes: recortes.map((r) => r.id === id ? { ...r, ...p } : r) });
  const rmRecorte = (id: string) => onPatch({ recortes: recortes.filter((r) => r.id !== id) });
  const addFuro = () => onPatch({ furacoes: [...furacoes, { id: crypto.randomUUID(), x: 0.1, y: 0.1, d: 35 }] });
  const patchFuro = (id: string, p: Partial<PieceHole>) => onPatch({ furacoes: furacoes.map((f) => f.id === id ? { ...f, ...p } : f) });
  const rmFuro = (id: string) => onPatch({ furacoes: furacoes.filter((f) => f.id !== id) });

  return (
    <div className="space-y-2 border-t border-stone-100 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">Recortes (m)</span>
        <button onClick={addRecorte} className="text-[10px] uppercase tracking-widest text-stone-500 hover:text-stone-950 inline-flex items-center gap-0.5">
          <Plus className="size-3" /> Recorte
        </button>
      </div>
      {recortes.length === 0 && <div className="text-[10px] text-stone-400 italic">Nenhum recorte.</div>}
      {recortes.map((r) => (
        <div key={r.id} className="grid grid-cols-[1fr_repeat(4,44px)_auto] items-center gap-1">
          <input value={r.label ?? ""} placeholder="rótulo" onChange={(e) => patchRecorte(r.id, { label: e.target.value })}
            className="text-[11px] border border-stone-200 bg-white px-1 py-0.5" />
          <input type="number" step={0.01} value={r.x} onChange={(e) => patchRecorte(r.id, { x: parseFloat(e.target.value) || 0 })}
            className="text-[11px] border border-stone-200 bg-white px-1 py-0.5 font-mono text-right" title="X" />
          <input type="number" step={0.01} value={r.y} onChange={(e) => patchRecorte(r.id, { y: parseFloat(e.target.value) || 0 })}
            className="text-[11px] border border-stone-200 bg-white px-1 py-0.5 font-mono text-right" title="Y" />
          <input type="number" step={0.01} value={r.w} onChange={(e) => patchRecorte(r.id, { w: parseFloat(e.target.value) || 0 })}
            className="text-[11px] border border-stone-200 bg-white px-1 py-0.5 font-mono text-right" title="Larg" />
          <input type="number" step={0.01} value={r.h} onChange={(e) => patchRecorte(r.id, { h: parseFloat(e.target.value) || 0 })}
            className="text-[11px] border border-stone-200 bg-white px-1 py-0.5 font-mono text-right" title="Alt" />
          <button onClick={() => rmRecorte(r.id)} className="text-stone-300 hover:text-red-600"><X className="size-3" /></button>
        </div>
      ))}

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">Furações (Ø mm)</span>
        <button onClick={addFuro} className="text-[10px] uppercase tracking-widest text-stone-500 hover:text-stone-950 inline-flex items-center gap-0.5">
          <Plus className="size-3" /> Furo
        </button>
      </div>
      {furacoes.length === 0 && <div className="text-[10px] text-stone-400 italic">Nenhuma furação.</div>}
      {furacoes.map((f) => (
        <div key={f.id} className="grid grid-cols-[1fr_repeat(3,48px)_auto] items-center gap-1">
          <input value={f.label ?? ""} placeholder="rótulo" onChange={(e) => patchFuro(f.id, { label: e.target.value })}
            className="text-[11px] border border-stone-200 bg-white px-1 py-0.5" />
          <input type="number" step={0.01} value={f.x} onChange={(e) => patchFuro(f.id, { x: parseFloat(e.target.value) || 0 })}
            className="text-[11px] border border-stone-200 bg-white px-1 py-0.5 font-mono text-right" title="X (m)" />
          <input type="number" step={0.01} value={f.y} onChange={(e) => patchFuro(f.id, { y: parseFloat(e.target.value) || 0 })}
            className="text-[11px] border border-stone-200 bg-white px-1 py-0.5 font-mono text-right" title="Y (m)" />
          <input type="number" step={1} value={f.d} onChange={(e) => patchFuro(f.id, { d: parseFloat(e.target.value) || 0 })}
            className="text-[11px] border border-stone-200 bg-white px-1 py-0.5 font-mono text-right" title="Ø (mm)" />
          <button onClick={() => rmFuro(f.id)} className="text-stone-300 hover:text-red-600"><X className="size-3" /></button>
        </div>
      ))}
    </div>
  );
}

