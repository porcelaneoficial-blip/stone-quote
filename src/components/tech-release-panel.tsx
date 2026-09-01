/**
 * LIBERAÇÃO TÉCNICA — camada técnica dentro do MESMO pedido.
 *
 * Regra absoluta: nada aqui altera o Pedido Original (medidas comerciais,
 * valores, comissão, vendedor, condições). As medidas técnicas ficam em
 * `released_length` / `released_width` / `released_qty` e convivem com as
 * medidas originais do pedido.
 *
 * Esta tela NÃO mostra financeiro, comissão, valores nem andamento do pedido.
 */
import { TechChecklistPanel } from "@/components/tech-checklist-panel";
import { DrawingZoom } from "@/components/drawing-zoom";
import { useMemo, useState } from "react";
import { Plus, Printer, Trash2, ChevronDown, ChevronUp, Copy, ArrowUp, ArrowDown, Check } from "lucide-react";
import type { Environment, EnvItem, QuoteData, Material, FinishType, TechTranspasse, QuickRoom, RoomFinishEdge } from "@/lib/types";
import { QuickRoomPanel, emptyQuickRoom } from "@/components/quick-room";
import { useFinishLibrary } from "@/components/finish-picker";
import { PieceTechDetail } from "@/components/piece-tech-detail";
import { envPendingCount, envPendings } from "@/lib/order-view";
import { FinishDrawing } from "@/components/finish-drawing";
import { cutNote, needsSectionCut, resolveParams, SLOT_LABEL, type FinishSlot, type LibraryFinish } from "@/lib/finish-library";
import { num, fmtDate } from "@/lib/format";


/** Identidade visual da Liberação Técnica — ponto único para futura configuração. */
export const TECH_THEME = {
  logoUrl: "" as string,
  colorPrimary: "#1A1A1A",
  colorSecondary: "#707070",
  colorLine: "#E2E0DD",
  colorAccent: "#8B5E34",
  fontDisplay: "var(--font-display)",
  fontBody: "var(--font-body)",
  titleSize: "22pt",
  textSize: "11pt",
  lineWidth: 1,
  radius: 0,
  spacing: 16,
};

/** Medida em metros, sempre com três casas — sem arredondar visualmente. */
export const m3 = (n: number) => num(Number.isFinite(n) ? n : 0, 3);

const relLen = (it: EnvItem) => (it.released_length ?? it.length) || 0;
const relWid = (it: EnvItem) => (it.released_width ?? it.width) || 0;
const relQty = (it: EnvItem) => {
  const v = it.released_qty ?? it.qty ?? 1;
  return v && v > 0 ? v : 1;
};

/** Peças da Ordem de Corte (medidas técnicas, nunca as comerciais). */
export function cutPieces(env: Environment): EnvItem[] {
  return [
    ...(env.items ?? []),
    ...(env.extra_cut_pieces ?? []).map((it) => ({
      ...it,
      description: it.description ? `Extra · ${it.description}` : "Extra",
    })),
  ];
}

export const cutPiecesFor2D = (env: Environment): EnvItem[] =>
  cutPieces(env).map((it) => ({ ...it, length: relLen(it), width: relWid(it), qty: relQty(it) }));

export const techLabels = (env: Environment) => ({
  name: env.tech_name || env.name,
  material: env.tech_material || env.material_name || "",
});

/* ============================ TELA ============================ */

export function TechReleaseSection(props: {
  data: QuoteData;
  orderNumber: number;
  createdAt: string;
  materials: Material[];
  finishTypes: FinishType[];
  onUpdateEnv: (envId: string, patch: Partial<Environment>) => void;
  onUpdateItem: (envId: string, itemId: string, patch: Partial<EnvItem>) => void;
  onAddExtra: (envId: string) => void;
  onRemoveExtra: (envId: string, itemId: string) => void;
  onDuplicateItem: (envId: string, itemId: string) => void;
  onMoveItem: (envId: string, itemId: string, dir: -1 | 1, extra?: boolean) => void;
  onRelease: (envId: string) => void;
  onReopen: (envId: string) => void;
  onPrint: (envId: string) => void;
}) {
  const envs = props.data.environments ?? [];
  const [activeId, setActiveId] = useState<string>(envs[0]?.id ?? "");
  const env = envs.find((e) => e.id === activeId) ?? envs[0];
  const releasedCount = envs.filter((e) => e.released_for_cut_at).length;

  if (!env) {
    return (
      <div className="bg-white border p-10 text-center text-sm" style={{ borderColor: TECH_THEME.colorLine, color: TECH_THEME.colorSecondary }}>
        Este pedido não possui ambientes.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TechHeader
        orderNumber={props.orderNumber}
        date={props.createdAt}
        clientName={props.data.client_name || "—"}
        envName={techLabels(env).name}
        material={techLabels(env).material}
      />

      {/* Abas de ambiente */}
      <div className="flex items-center gap-2 flex-wrap">
        {envs.map((e) => {
          const on = e.id === env.id;
          return (
            <button
              key={e.id}
              onClick={() => setActiveId(e.id)}
              className="px-4 py-2 text-xs uppercase tracking-widest font-bold border transition-colors"
              style={{
                borderColor: on ? TECH_THEME.colorPrimary : TECH_THEME.colorLine,
                background: on ? TECH_THEME.colorPrimary : "#fff",
                color: on ? "#fff" : TECH_THEME.colorPrimary,
              }}
            >
              {techLabels(e).name}
              {e.released_for_cut_at
                ? <Check className="inline-block size-3 ml-2" />
                : envPendingCount(e) > 0 && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] rounded-full"
                      style={{ background: on ? "#fff" : "#FBEFD6", color: "#8B5E34" }}>
                      {envPendingCount(e)}
                    </span>
                  )}
            </button>
          );
        })}
        <span className="text-xs ml-auto" style={{ color: TECH_THEME.colorSecondary }}>
          {releasedCount} de {envs.length} ambientes liberados
        </span>
      </div>

      <TechEnvironment key={env.id} env={env} {...props} />
    </div>
  );
}

function TechHeader(p: {
  orderNumber: number; date: string; clientName: string; envName: string; material: string;
}) {
  return (
    <header className="bg-white border px-8 py-6" style={{ borderColor: TECH_THEME.colorLine }}>
      <div className="flex items-start justify-between gap-8 flex-wrap">
        <div>
          <div className="font-display tracking-[0.35em] text-xl" style={{ color: TECH_THEME.colorPrimary }}>PORCELANE</div>
          <div className="text-[10px] tracking-[0.4em] mt-1" style={{ color: TECH_THEME.colorSecondary }}>MARMORARIA</div>
        </div>
        <h2 className="font-display text-3xl font-bold" style={{ color: TECH_THEME.colorPrimary }}>LIBERAÇÃO TÉCNICA</h2>
        <div className="text-right">
          <div className="font-bold text-lg" style={{ color: TECH_THEME.colorPrimary }}>
            PEDIDO Nº {String(p.orderNumber).padStart(6, "0")}
          </div>
          <div className="text-sm" style={{ color: TECH_THEME.colorSecondary }}>DATA: {fmtDate(p.date)}</div>
        </div>
      </div>
      <div className="mt-5 pt-5 grid grid-cols-1 sm:grid-cols-3 gap-6" style={{ borderTop: `2px solid ${TECH_THEME.colorPrimary}` }}>
        <Field label="CLIENTE" value={p.clientName} />
        <Field label="AMBIENTE" value={p.envName} />
        <Field label="MATERIAL" value={p.material || "—"} />
      </div>
    </header>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.25em] font-bold" style={{ color: TECH_THEME.colorSecondary }}>{label}</div>
      <div className="text-lg font-semibold mt-0.5" style={{ color: TECH_THEME.colorPrimary }}>{value}</div>
    </div>
  );
}

function TechEnvironment(props: {
  env: Environment;
  data: QuoteData;
  materials: Material[];
  finishTypes: FinishType[];
  onUpdateEnv: (envId: string, patch: Partial<Environment>) => void;
  onUpdateItem: (envId: string, itemId: string, patch: Partial<EnvItem>) => void;
  onAddExtra: (envId: string) => void;
  onRemoveExtra: (envId: string, itemId: string) => void;
  onDuplicateItem: (envId: string, itemId: string) => void;
  onMoveItem: (envId: string, itemId: string, dir: -1 | 1, extra?: boolean) => void;
  onRelease: (envId: string) => void;
  onReopen: (envId: string) => void;
  onPrint: (envId: string) => void;
}) {
  const { env } = props;
  const pieces = cutPieces(env);
  const items2D = useMemo(() => cutPiecesFor2D(env), [env]);
  const transpasses = env.tech_transpasses ?? [];

  const [tpMode, setTpMode] = useState(false);
  const [tpValue, setTpValue] = useState<string>("");
  const [openPieceId, setOpenPieceId] = useState<string | null>(null);
  const openPiece = pieces.find((x) => x.id === openPieceId) ?? null;
  const [accOpen, setAccOpen] = useState(false);
  const released = env.released_for_cut_at;

  const setTranspasses = (list: TechTranspasse[]) => props.onUpdateEnv(env.id, { tech_transpasses: list });

  const addTranspasse = (pieceIndex: number, side: TechTranspasse["side"]) => {
    const v = parseFloat(String(tpValue).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return;
    setTranspasses([
      ...transpasses,
      { id: crypto.randomUUID(), piece_index: pieceIndex, side, value_m: v, created_at: new Date().toISOString() },
    ]);
  };

  const isExtra = (it: EnvItem) => (env.extra_cut_pieces ?? []).some((x) => x.id === it.id);

  return (
    <div className="space-y-6">
      {/* DESENHO 2D EDITÁVEL */}
      <section className="bg-white border" style={{ borderColor: TECH_THEME.colorLine }}>
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap" style={{ borderBottom: `1px solid ${TECH_THEME.colorLine}` }}>
          <h3 className="text-sm tracking-[0.25em] font-bold" style={{ color: TECH_THEME.colorPrimary }}>DESENHO 2D — PLANTA</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={tpValue}
              onChange={(e) => setTpValue(e.target.value)}
              placeholder="valor (m) ex.: 0,080"
              className="border px-2 py-1.5 text-xs font-mono w-40"
              style={{ borderColor: TECH_THEME.colorLine }}
            />
            <button
              onClick={() => setTpMode((v) => !v)}
              disabled={!tpValue}
              className="text-[11px] uppercase tracking-wider font-bold border px-3 py-1.5 flex items-center gap-2 disabled:opacity-40"
              style={tpMode
                ? { background: TECH_THEME.colorAccent, borderColor: TECH_THEME.colorAccent, color: "#fff" }
                : { borderColor: TECH_THEME.colorLine, color: TECH_THEME.colorPrimary }}
            >
              <Plus className="size-3" /> Transpasse
            </button>
          </div>
        </div>
        {tpMode && (
          <p className="px-6 pt-3 text-[11px]" style={{ color: TECH_THEME.colorAccent }}>
            Clique na peça, no trecho desejado, para marcar o transpasse de {tpValue || "—"} m. O restante da bancada permanece com linha contínua.
          </p>
        )}
        <div className="px-6 py-4">
          <DrawingZoom>
          <QuickRoomPanel
            value={env.quick_room ?? emptyQuickRoom()}
            onChange={(qr: QuickRoom) => props.onUpdateEnv(env.id, { quick_room: qr })}
            materials={props.materials}
            finishTypes={props.finishTypes}
            allowThickness
            items={items2D}
            quantity={items2D.reduce((s, it) => s + relQty(it), 0)}
            showPieceNumbers
            transpasses={transpasses}
            transpasseMode={tpMode}
            onAddTranspasse={addTranspasse}
            docInfo={{
              orderNumber: undefined,
              envName: techLabels(env).name,
              materialName: techLabels(env).material,
            }}
          />
          </DrawingZoom>
        </div>

        {transpasses.length > 0 && (
          <div className="px-6 pb-5">
            <div className="text-[10px] tracking-[0.25em] font-bold mb-2" style={{ color: TECH_THEME.colorSecondary }}>TRANSPASSES</div>
            <div className="space-y-1">
              {transpasses.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 text-xs border px-3 py-2" style={{ borderColor: TECH_THEME.colorLine }}>
                  <span className="font-mono" style={{ color: TECH_THEME.colorSecondary }}>{String(i + 1).padStart(2, "0")}</span>
                  <span>Peça {String(t.piece_index + 1).padStart(2, "0")} · {SIDE_PT[t.side]}</span>
                  <input
                    type="number" step="0.001" value={t.value_m}
                    onChange={(e) => setTranspasses(transpasses.map((x) => x.id === t.id ? { ...x, value_m: parseFloat(e.target.value) || 0 } : x))}
                    className="w-24 border px-2 py-1 text-right font-mono" style={{ borderColor: TECH_THEME.colorLine }}
                  />
                  <span style={{ color: TECH_THEME.colorSecondary }}>m</span>
                  <select
                    value={t.side}
                    onChange={(e) => setTranspasses(transpasses.map((x) => x.id === t.id ? { ...x, side: e.target.value as TechTranspasse["side"] } : x))}
                    className="border px-2 py-1" style={{ borderColor: TECH_THEME.colorLine }}
                  >
                    {(["top", "bottom", "left", "right"] as const).map((s) => <option key={s} value={s}>{SIDE_PT[s]}</option>)}
                  </select>
                  <button onClick={() => setTranspasses(transpasses.filter((x) => x.id !== t.id))}
                    className="ml-auto hover:text-red-600" style={{ color: TECH_THEME.colorSecondary }}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ORDEM DE CORTE */}
      <section className="bg-white border" style={{ borderColor: TECH_THEME.colorLine }}>
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap" style={{ borderBottom: `1px solid ${TECH_THEME.colorLine}` }}>
          <h3 className="text-sm tracking-[0.25em] font-bold" style={{ color: TECH_THEME.colorPrimary }}>PEÇAS DO AMBIENTE · ORDEM DE CORTE</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => props.onAddExtra(env.id)}
              className="text-[11px] uppercase tracking-wider font-bold border px-3 py-1.5 hover:bg-stone-50 flex items-center gap-2"
              style={{ borderColor: TECH_THEME.colorLine }}>
              <Plus className="size-3" /> Peça
            </button>
            <button onClick={() => props.onPrint(env.id)}
              className="text-[11px] uppercase tracking-wider font-bold px-3 py-1.5 text-white flex items-center gap-2"
              style={{ background: TECH_THEME.colorPrimary }}>
              <Printer className="size-3" /> Gerar PDF
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest" style={{ color: TECH_THEME.colorSecondary, borderBottom: `1px solid ${TECH_THEME.colorLine}` }}>
              <th className="text-left p-3 font-bold w-14">Nº</th>
              <th className="text-left p-3 font-bold">Descrição</th>
              <th className="text-right p-3 font-bold w-32">Comp. (m)</th>
              <th className="text-right p-3 font-bold w-32">Larg. (m)</th>
              <th className="text-right p-3 font-bold w-20">Qtde</th>
              <th className="p-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: TECH_THEME.colorLine }}>
            {pieces.map((it, i) => {
              const extra = isExtra(it);
              const upd = (patch: Partial<EnvItem>) => props.onUpdateItem(env.id, it.id, patch);
              return (
                <tr key={it.id}>
                  <td className="p-3">
                    <button
                      onClick={() => setOpenPieceId(openPieceId === it.id ? null : it.id)}
                      className="font-mono text-xs px-2 py-1 border"
                      style={openPieceId === it.id
                        ? { background: TECH_THEME.colorPrimary, color: "#fff", borderColor: TECH_THEME.colorPrimary }
                        : { borderColor: TECH_THEME.colorLine, color: TECH_THEME.colorSecondary }}
                      title="Abrir detalhe técnico da peça"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </button>
                  </td>
                  <td className="p-3">
                    <input value={it.description ?? ""} onChange={(e) => upd({ description: e.target.value })}
                      className="w-full bg-transparent focus:outline-none" placeholder="Descrição da peça" />
                  </td>
                  <td className="p-3">
                    <input type="number" step="0.001" value={relLen(it)}
                      onChange={(e) => upd({ released_length: parseFloat(e.target.value) || 0 })}
                      title="Medida técnica — não altera o pedido original"
                      className="w-full text-right font-mono bg-transparent focus:outline-none" />
                    {it.length !== relLen(it) && (
                      <div className="text-[10px] text-right" style={{ color: TECH_THEME.colorSecondary }}>pedido {m3(it.length)}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <input type="number" step="0.001" value={relWid(it)}
                      onChange={(e) => upd({ released_width: parseFloat(e.target.value) || 0 })}
                      className="w-full text-right font-mono bg-transparent focus:outline-none" />
                    {it.width !== relWid(it) && (
                      <div className="text-[10px] text-right" style={{ color: TECH_THEME.colorSecondary }}>pedido {m3(it.width)}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <input type="number" min={1} step="1" value={relQty(it)}
                      onChange={(e) => upd({ released_qty: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full text-right font-mono bg-transparent focus:outline-none" />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1" style={{ color: TECH_THEME.colorSecondary }}>
                      <button title="Subir" onClick={() => props.onMoveItem(env.id, it.id, -1, extra)} className="hover:text-stone-950"><ArrowUp className="size-3.5" /></button>
                      <button title="Descer" onClick={() => props.onMoveItem(env.id, it.id, 1, extra)} className="hover:text-stone-950"><ArrowDown className="size-3.5" /></button>
                      <button title="Duplicar peça" onClick={() => props.onDuplicateItem(env.id, it.id)} className="hover:text-stone-950"><Copy className="size-3.5" /></button>
                      {extra && (
                        <button title="Remover peça extra" onClick={() => props.onRemoveExtra(env.id, it.id)} className="hover:text-red-600"><Trash2 className="size-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-6 py-3 text-[11px]" style={{ color: TECH_THEME.colorSecondary }}>
          As medidas técnicas podem diferir das medidas do pedido — o Pedido Original permanece intacto.
        </p>
      </section>

      {openPiece && (
        <PieceTechDetail
          env={env}
          item={openPiece}
          index={pieces.findIndex((x) => x.id === openPiece.id)}
          onUpdateItem={props.onUpdateItem}
          onClose={() => setOpenPieceId(null)}
        />
      )}

      {/* CUBAS, COOKTOPS E ACESSÓRIOS — recolhido */}
      <section className="bg-white border" style={{ borderColor: TECH_THEME.colorLine }}>
        <button onClick={() => setAccOpen((v) => !v)}
          className="w-full px-6 py-4 flex items-center justify-between text-sm tracking-[0.25em] font-bold"
          style={{ color: TECH_THEME.colorPrimary }}>
          <span>+ CUBAS, COOKTOPS E ACESSÓRIOS</span>
          {accOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {accOpen && (
          <div className="px-6 pb-5 grid grid-cols-2 sm:grid-cols-3 gap-4" style={{ borderTop: `1px solid ${TECH_THEME.colorLine}` }}>
            {([
              ["qtd_cuba", "Cubas"],
              ["qtd_nicho", "Nichos"],
              ["qtd_divibox", "Diviboxes"],
            ] as const).map(([field, label]) => (
              <label key={field} className="flex items-center gap-2 text-xs mt-4">
                <span style={{ color: TECH_THEME.colorSecondary }}>{label}</span>
                <input type="number" min={0} value={(env as Record<string, unknown>)[field] as number ?? ""}
                  onChange={(e) => props.onUpdateEnv(env.id, { [field]: parseInt(e.target.value) || 0 } as Partial<Environment>)}
                  className="w-20 border px-2 py-1 text-right font-mono" style={{ borderColor: TECH_THEME.colorLine }} />
              </label>
            ))}
            <p className="col-span-full text-[11px]" style={{ color: TECH_THEME.colorSecondary }}>
              Cubas, cooktops, torneiras, coifas e demais acessórios são posicionados no desenho 2D acima.
            </p>
          </div>
        )}
      </section>

      {/* OBSERVAÇÕES TÉCNICAS */}
      <section className="bg-white border p-6" style={{ borderColor: TECH_THEME.colorLine }}>
        <h3 className="text-sm tracking-[0.25em] font-bold mb-3" style={{ color: TECH_THEME.colorPrimary }}>OBSERVAÇÕES TÉCNICAS</h3>
        <textarea rows={3} value={env.tech_notes ?? ""}
          onChange={(e) => props.onUpdateEnv(env.id, { tech_notes: e.target.value })}
          placeholder="Usinagens, cuidados de corte, sequência…"
          className="w-full border px-3 py-2 text-sm" style={{ borderColor: TECH_THEME.colorLine }} />
      </section>

      <TechChecklistPanel env={env} onUpdateEnv={props.onUpdateEnv} />

      {envPendings(env).length > 0 && (
        <section className="bg-white border p-6" style={{ borderColor: TECH_THEME.colorLine }}>
          <h3 className="text-sm tracking-[0.25em] font-bold mb-3" style={{ color: TECH_THEME.colorPrimary }}>
            PENDÊNCIAS DESTE AMBIENTE
          </h3>
          <ul className="grid gap-1.5 sm:grid-cols-2 text-xs" style={{ color: TECH_THEME.colorSecondary }}>
            {envPendings(env).map((label) => (
              <li key={label} className="flex items-start gap-2">
                <span style={{ color: TECH_THEME.colorAccent }}>•</span> {label}
              </li>
            ))}
          </ul>
        </section>
      )}


      {/* LIBERAÇÃO */}
      <section className="bg-white border p-6 flex items-center justify-between gap-4 flex-wrap" style={{ borderColor: TECH_THEME.colorLine }}>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-xs">
            <span className="tracking-widest font-bold" style={{ color: TECH_THEME.colorSecondary }}>RESPONSÁVEL TÉCNICO</span>
            <input value={env.tech_responsible ?? ""} onChange={(e) => props.onUpdateEnv(env.id, { tech_responsible: e.target.value })}
              className="border px-2 py-1 w-48" style={{ borderColor: TECH_THEME.colorLine }} />
          </label>
          <span className="text-xs" style={{ color: TECH_THEME.colorSecondary }}>
            Rev. {String(env.tech_revision ?? 0).padStart(2, "0")}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {released && (
            <span className="text-xs" style={{ color: TECH_THEME.colorPrimary }}>
              ✓ AMBIENTE LIBERADO PARA CORTE — {env.released_by_name || "—"} ·{" "}
              <span className="font-mono">{new Date(released).toLocaleString("pt-BR", { timeZone: "America/Recife" })}</span>
            </span>
          )}
          {released && (
            <button onClick={() => props.onReopen(env.id)}
              className="text-[11px] uppercase tracking-wider font-bold border px-3 py-2" style={{ borderColor: TECH_THEME.colorLine }}>
              Reabrir
            </button>
          )}
          <button onClick={() => props.onRelease(env.id)}
            className="text-[11px] uppercase tracking-wider font-bold px-5 py-2 text-white"
            style={{ background: TECH_THEME.colorPrimary }}>
            {released ? "Reliberar ambiente" : "Liberar ambiente para corte"}
          </button>
        </div>
      </section>
    </div>
  );
}


/** Informações de corte geradas pelos acabamentos — vinculadas à peça. */
export function pieceCutNotes(it: EnvItem, library: LibraryFinish[]): string[] {
  const out: string[] = [];
  for (const sel of it.tech_finishes ?? []) {
    const f = library.find((x) => x.id === sel.finish_id);
    if (!f) continue;
    const note = cutNote(f.name, f.template, resolveParams(f.template, f.params, sel.params));
    if (note) out.push(note);
  }
  return out;
}

export const SIDE_PT: Record<TechTranspasse["side"], string> = {

  top: "Fundo", bottom: "Frente", left: "Esquerdo", right: "Direito",
};

/* ============================ PDF A4 ============================ */

/** Folha A4 retrato da Liberação Técnica — sem valores, sem financeiro. */
export function TechReleaseSheet(props: {
  env: Environment;
  data: QuoteData;
  orderNumber: number;
  createdAt: string;
  materials: Material[];
  finishTypes: FinishType[];
  /** Escala técnica impressa no documento (ex.: "1:10"). */
  scale?: string;
}) {
  const { env } = props;
  const pieces = cutPieces(env);
  const labels = techLabels(env);
  const transpasses = env.tech_transpasses ?? [];
  const { finishes: library } = useFinishLibrary();
  /** Cortes técnicos gerados automaticamente pelos acabamentos selecionados. */
  const details = useMemo(() => {
    const out: { key: string; pieceIndex: number; slot: FinishSlot; finish: LibraryFinish; params: Record<string, number> }[] = [];
    pieces.forEach((it, i) => {
      for (const sel of it.tech_finishes ?? []) {
        const f = library.find((x) => x.id === sel.finish_id);
        if (!f || !needsSectionCut(f.template)) continue;
        out.push({ key: sel.id, pieceIndex: i, slot: sel.slot, finish: f, params: resolveParams(f.template, f.params, sel.params) });
      }
    });
    return out;
  }, [pieces, library]);

  const finishNames = Array.from(new Set(
    pieces.flatMap((it) => (it.finish_edges ?? []).map((f) => f.finish_type_id))
      .concat((Object.values(env.quick_room?.finish_edges ?? {}) as RoomFinishEdge[]).map((e) => e?.finish_type_id ?? ""))
      .filter(Boolean)
      .map((id) => props.finishTypes.find((f) => f.id === id)?.name)
      .filter(Boolean) as string[],
  ));

  return (
    <div className="a4-page print-page">
      <header style={{ borderBottom: `2px solid ${TECH_THEME.colorPrimary}`, paddingBottom: "4mm", marginBottom: "5mm" }}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="font-display tracking-[0.3em] text-[14pt] font-bold">PORCELANE</div>
            <div className="text-[7pt] tracking-[0.4em]" style={{ color: TECH_THEME.colorSecondary }}>MARMORARIA</div>
          </div>
          <h1 className="font-display text-[18pt] font-bold">LIBERAÇÃO TÉCNICA</h1>
          <div className="text-right text-[10pt]">
            <div className="font-bold">PEDIDO Nº {String(props.orderNumber).padStart(6, "0")}</div>
            <div style={{ color: TECH_THEME.colorSecondary }}>{fmtDate(props.createdAt)}</div>
            <div style={{ color: TECH_THEME.colorSecondary }}>REV. {String(env.tech_revision ?? 0).padStart(2, "0")}</div>
            <div style={{ color: TECH_THEME.colorSecondary }}>ESCALA {props.scale && props.scale !== "auto" ? props.scale : "AUTOMÁTICA"}</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-3 text-[10pt]">
          <div><span style={{ color: TECH_THEME.colorSecondary }}>CLIENTE: </span><b>{props.data.client_name || "—"}</b></div>
          <div><span style={{ color: TECH_THEME.colorSecondary }}>AMBIENTE: </span><b>{labels.name}</b></div>
          <div><span style={{ color: TECH_THEME.colorSecondary }}>MATERIAL: </span><b>{labels.material || "—"}</b></div>
          <div><span style={{ color: TECH_THEME.colorSecondary }}>ACABAMENTO: </span><b>{finishNames.join(" · ") || "—"}</b></div>
        </div>
      </header>

      <section className="pdf-section">
        <h3 className="pdf-eyebrow mb-2">ORDEM DE CORTE</h3>
        <table className="pdf-table w-full text-[10pt]">
          <thead>
            <tr>
              <th className="text-left w-10">Nº</th>
              <th className="text-left">Descrição</th>
              <th className="text-right w-24">Comp. (m)</th>
              <th className="text-right w-24">Larg. (m)</th>
              <th className="text-right w-16">Qtde</th>
            </tr>
          </thead>
          <tbody>
            {pieces.map((it, i) => {
              const notes = pieceCutNotes(it, library);
              return (
                <tr key={it.id}>
                  <td className="font-mono">{String(i + 1).padStart(2, "0")}</td>
                  <td>
                    {it.description || "—"}
                    {notes.map((n, k) => (
                      <div key={k} className="text-[8pt]" style={{ color: TECH_THEME.colorSecondary }}>{n}</div>
                    ))}
                  </td>
                  <td className="text-right font-mono">{m3(relLen(it))}</td>
                  <td className="text-right font-mono">{m3(relWid(it))}</td>
                  <td className="text-right font-mono">{relQty(it)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {details.length > 0 && (
        <section className="pdf-section">
          <h3 className="pdf-eyebrow mb-2">DETALHES TÉCNICOS</h3>
          <div className="grid grid-cols-2 gap-3">
            {details.map((d) => (
              <div key={d.key} style={{ border: `1px solid ${TECH_THEME.colorLine}` }}>
                <div className="text-[8pt] px-2 py-1" style={{ borderBottom: `1px solid ${TECH_THEME.colorLine}` }}>
                  PEÇA {String(d.pieceIndex + 1).padStart(2, "0")} · {SLOT_LABEL[d.slot].toUpperCase()} — {d.finish.name}
                </div>
                <FinishDrawing
                  template={d.finish.template} params={d.params} svg={d.finish.drawing_svg}
                  title={d.finish.code ?? d.finish.name}
                  callout={needsSectionCut(d.finish.template) ? "A-A" : undefined}
                  height={150}
                />
              </div>
            ))}
          </div>
        </section>
      )}


      {transpasses.length > 0 && (
        <section className="pdf-section">
          <h3 className="pdf-eyebrow mb-2">TRANSPASSES</h3>
          <div className="text-[10pt] space-y-0.5">
            {transpasses.map((t, i) => (
              <div key={t.id}>
                {String(i + 1).padStart(2, "0")} · Peça {String(t.piece_index + 1).padStart(2, "0")} — {SIDE_PT[t.side]}: <b className="font-mono">{m3(t.value_m)} m</b>
              </div>
            ))}
          </div>
        </section>
      )}

      {finishNames.length > 0 && (
        <section className="pdf-section">
          <h3 className="pdf-eyebrow mb-2">ACABAMENTOS SELECIONADOS</h3>
          <div className="text-[10pt]">{finishNames.join(" · ")}</div>
        </section>
      )}

      {env.tech_notes && (
        <section className="pdf-section">
          <h3 className="pdf-eyebrow mb-2">OBSERVAÇÕES TÉCNICAS</h3>
          <div className="text-[10pt] whitespace-pre-wrap">{env.tech_notes}</div>
        </section>
      )}

      <div className="pdf-sign-block mt-16 grid grid-cols-2 gap-10 text-[9pt]">
        <div className="text-center">
          <div style={{ borderTop: `1px solid ${TECH_THEME.colorPrimary}`, paddingTop: "2mm" }}>
            {env.tech_responsible || "\u00A0"}
          </div>
          <div className="pdf-eyebrow mt-1">RESPONSÁVEL TÉCNICO</div>
        </div>
        <div className="text-center">
          <div style={{ borderTop: `1px solid ${TECH_THEME.colorPrimary}`, paddingTop: "2mm" }}>
            {env.released_by_name || "\u00A0"}
          </div>
          <div className="pdf-eyebrow mt-1">
            LIBERADO EM {env.released_for_cut_at ? fmtDate(env.released_for_cut_at) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
