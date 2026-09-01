/**
 * Seleção de acabamentos da Biblioteca na Liberação Técnica.
 * Apenas REFERENCIA o item cadastrado (id + versão) — nunca copia o desenho.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FinishDrawing } from "@/components/finish-drawing";
import { useSignedFinishUrls } from "@/lib/finish-media";
import {
  CATEGORY_SLOT, SLOT_LABEL, TEMPLATE_PARAMS, resolveParams, needsSectionCut,
  type FinishSelection, type FinishSlot, type LibraryFinish,
} from "@/lib/finish-library";

const LINE = "#E2E0DD";
const SLOTS: FinishSlot[] = ["cuba", "borda", "testeira", "pingadeira", "rebaixo", "encabecamento", "encontro", "nicho", "superficie"];

export function useFinishLibrary() {
  const [rows, setRows] = useState<LibraryFinish[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    (supabase as any)
      .from("library_finishes").select("*").eq("active", true).order("category").order("name")
      .then(({ data }: { data: LibraryFinish[] | null }) => { setRows(data ?? []); setLoaded(true); });
  }, []);
  return { finishes: rows, loaded };
}

export function finishesBySlot(list: LibraryFinish[], slot: FinishSlot) {
  return list.filter((f) => CATEGORY_SLOT[f.category] === slot);
}

/** Bloco por peça: seletores por tipo + miniaturas dos desenhos. */
export function FinishSelector(props: {
  library: LibraryFinish[];
  value: FinishSelection[];
  onChange: (list: FinishSelection[]) => void;
  compact?: boolean;
}) {
  const { library, value } = props;
  const getImg = useSignedFinishUrls(library.map((f) => f.image_url));
  const get = (slot: FinishSlot) => value.find((v) => v.slot === slot);

  const setSlot = (slot: FinishSlot, finishId: string) => {
    const rest = value.filter((v) => v.slot !== slot);
    if (!finishId) return props.onChange(rest);
    const f = library.find((x) => x.id === finishId);
    if (!f) return props.onChange(rest);
    props.onChange([...rest, { id: crypto.randomUUID(), slot, finish_id: f.id, version: f.version, label: f.name, params: {} }]);
  };

  const setParam = (slot: FinishSlot, key: string, n: number) => {
    props.onChange(value.map((v) => v.slot === slot ? { ...v, params: { ...(v.params ?? {}), [key]: n } } : v));
  };

  const available = SLOTS.filter((s) => finishesBySlot(library, s).length > 0);
  if (available.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: "#707070" }}>
        Nenhum acabamento cadastrado. Cadastre em Configurações → Biblioteca → Acabamentos.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {available.map((slot) => {
          const sel = get(slot);
          return (
            <label key={slot} className="block">
              <div className="text-[10px] tracking-[0.2em] font-bold mb-1" style={{ color: "#707070" }}>
                {SLOT_LABEL[slot].toUpperCase()}
              </div>
              <select
                value={sel?.finish_id ?? ""}
                onChange={(e) => setSlot(slot, e.target.value)}
                className="w-full border px-2 py-1.5 text-xs bg-white"
                style={{ borderColor: LINE }}
              >
                <option value="">—</option>
                {finishesBySlot(library, slot).map((f) => (
                  <option key={f.id} value={f.id}>{f.code ? `${f.code} · ` : ""}{f.name}</option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {value.map((sel) => {
            const f = library.find((x) => x.id === sel.finish_id);
            if (!f) return null;
            const p = resolveParams(f.template, f.params, sel.params);
            const img = getImg(f.image_url);
            return (
              <div key={sel.id} className="border" style={{ borderColor: LINE }}>
                <div className="px-3 py-2 text-[10px] tracking-[0.2em] font-bold flex justify-between"
                  style={{ color: "#1A1A1A", borderBottom: `1px solid ${LINE}` }}>
                  <span>{SLOT_LABEL[sel.slot].toUpperCase()} · {f.name}</span>
                  <span style={{ color: "#707070" }}>v{sel.version}</span>
                </div>
                {img && (
                  <img src={img} alt={f.name} className="w-full object-contain bg-white"
                    style={{ height: props.compact ? 120 : 160, borderBottom: `1px solid ${LINE}` }} />
                )}
                <FinishDrawing
                  template={f.template} params={p} svg={f.drawing_svg}
                  title={f.code ?? f.name} callout={needsSectionCut(f.template) ? "A-A" : undefined}
                  height={props.compact ? 150 : 200}
                />
                {!props.compact && (TEMPLATE_PARAMS[f.template] ?? []).length > 0 && (
                  <div className="px-3 py-2 grid grid-cols-2 gap-2" style={{ borderTop: `1px solid ${LINE}` }}>
                    {TEMPLATE_PARAMS[f.template].map((pd) => (
                      <label key={pd.key} className="flex items-center gap-2 text-[11px]">
                        <span className="flex-1" style={{ color: "#707070" }}>{pd.label} ({pd.unit})</span>
                        <input
                          type="number" value={p[pd.key]}
                          onChange={(e) => setParam(sel.slot, pd.key, parseFloat(e.target.value) || 0)}
                          className="w-20 border px-1.5 py-1 text-right font-mono" style={{ borderColor: LINE }}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
