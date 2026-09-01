/**
 * ORDEM DE ACABAMENTO — LIBERAÇÃO TÉCNICA (folha A4).
 * Área principal: desenhos técnicos reais do ambiente (2D do snapshot).
 * Coluna lateral: legendas dinâmicas, acessórios, conferência e liberação.
 * Nada é inventado — seções sem dado real não são exibidas.
 */
import { Suspense, lazy } from "react";
import type { TechDocSnapshot } from "@/lib/tech-doc";
import { TechDocHeader } from "@/components/pdf/cut-order-sheet";
import { techPieces } from "@/lib/tech-doc";
import { fmtDate, brl, num } from "@/lib/format";
import type { RoomFinishEdge } from "@/lib/types";

const FloorPlan2D = lazy(() =>
  import("@/components/quick-room").then((m) => ({ default: m.FloorPlan2D })),
);

export function FinishOrderSheet({ snap, hideDrawing, hidePieces }: { snap: TechDocSnapshot; hideDrawing?: boolean; hidePieces?: boolean }) {
  const room = snap.env.quick_room;
  const pieces = techPieces(snap.env).map((it) => ({
    ...it,
    length: it.released_length ?? it.length,
    width: it.released_width ?? it.width,
    qty: it.released_qty ?? it.qty ?? 1,
  }));
  const hasDrawing = !hideDrawing && !!room && !room.hide_2d_drawing && (pieces.length > 0 || (room.width ?? 0) > 0);
  const edges = (room?.finish_edges ?? []) as RoomFinishEdge[];


  return (
    <div className="a4-page print-page">
      <TechDocHeader snap={snap} title="ORDEM DE ACABAMENTO" page={1} pages={1} />

      <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 58mm" }}>
        {/* ————— Desenhos ————— */}
        <section style={{ border: "1px solid #d6d3d1" }}>
          <div className="px-3 py-1.5 text-[8pt] tracking-[0.2em] font-bold text-center"
            style={{ background: "#1c1917", color: "#fff" }}>
            {hideDrawing ? (hidePieces ? "ORDEM DE ACABAMENTO" : "RELAÇÃO DE PEÇAS") : "DESENHO TÉCNICO DO AMBIENTE"}
          </div>
          {!hideDrawing && (
          <div className="p-3">
            {hasDrawing ? (
              <Suspense fallback={<div className="text-[9pt] text-stone-400 text-center py-10">Carregando desenho…</div>}>
                <FloorPlan2D
                  shape={(room?.shape ?? "retangular") as never}
                  diameter={room?.diameter ?? 1.2}
                  width={room?.width ?? 3}
                  length={room?.length ?? 4}
                  tileW={room?.tile_w ?? 1.2}
                  tileL={room?.tile_l ?? 0.6}
                  side={(room?.finish_side ?? "frente") as never}
                  edges={edges}
                  finishTypes={snap.finish_types}
                  color="#ffffff"
                  accessories={room?.accessories ?? []}
                  items={hidePieces || room?.hide_2d_pieces ? undefined : pieces}
                  showPieceNumbers={!hidePieces && !room?.hide_2d_pieces}
                  transpasses={snap.env.tech_transpasses ?? []}
                  onMoveAccessory={() => {}}
                />
              </Suspense>
            ) : (
              <div className="text-[9pt] text-stone-500 text-center py-16 tracking-[0.15em]">
                DESENHO TÉCNICO NÃO DISPONÍVEL
              </div>
            )}
          </div>
          )}


          {!hidePieces && !room?.hide_2d_pieces && pieces.length > 0 && (
            <div className="px-3 pb-3">
              <table className="w-full text-[8pt]" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="text-stone-500" style={{ borderBottom: "1px solid #d6d3d1" }}>
                    <th className="text-left py-1">PEÇA</th>
                    <th className="text-right py-1">QT</th>
                    <th className="text-right py-1">COMP. (mm)</th>
                    <th className="text-right py-1">LARG. (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.rows.map((r) => (
                    <tr key={r.index} style={{ borderBottom: "1px solid #f5f5f4" }}>
                      <td className="py-1">{String(r.index).padStart(2, "0")} · {r.description}</td>
                      <td className="py-1 text-right">{r.qty}</td>
                      <td className="py-1 text-right">{r.length_mm ?? "—"}</td>
                      <td className="py-1 text-right">{r.width_mm ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ————— Coluna lateral ————— */}
        <aside className="space-y-2">
          {snap.technique_legend.length > 0 && (
            <SideBox title="LEGENDA — TIPOS DE ACABAMENTO">
              {snap.technique_legend.map((l, i) => (
                <div key={i} className="text-[8pt] py-0.5">{l.label}</div>
              ))}
            </SideBox>
          )}

          {snap.finish_legend.length > 0 && (
            <SideBox title="LEGENDA — CORES DOS ACABAMENTOS">
              {snap.finish_legend.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-[8pt] py-0.5">
                  {l.color && <span className="inline-block" style={{ background: l.color, width: "3mm", height: "3mm" }} />}
                  <span>{l.label}</span>
                </div>
              ))}
            </SideBox>
          )}

          {snap.accessories.length > 0 && (
            <SideBox title="ACESSÓRIOS DO CLIENTE">
              {snap.accessories.map((a, i) => (
                <div key={i} className="text-[8pt] py-0.5 capitalize">{a}</div>
              ))}
            </SideBox>
          )}

          {(snap.responsible || snap.released_by) && (
            <SideBox title="CONFERIDO POR">
              {snap.responsible && <div className="text-[8pt]">{snap.responsible}</div>}
              {snap.released_by && <div className="text-[8pt] text-stone-600">Liberou: {snap.released_by}</div>}
              {snap.released_at && <div className="text-[8pt] text-stone-500">{fmtDate(snap.released_at)}</div>}
            </SideBox>
          )}

          {snap.note_value != null && (
            <SideBox title="VALOR DA NOTA — ACABAMENTO">
              <div className="text-[8pt] text-stone-600">
                {num(snap.area_m2 ?? 0, 2)} m² × {brl(snap.note_rate_m2 ?? 0)}/m²
              </div>
              <div className="text-[12pt] font-bold">{brl(snap.note_value)}</div>
            </SideBox>
          )}

          <SideBox title="LIBERAÇÃO">
            <div className="text-[8pt]">STATUS: {snap.release_status ?? "—"}</div>
            <div className="text-[8pt]">REV. {String(snap.revision ?? 0).padStart(2, "0")}</div>
          </SideBox>

          {snap.notes && (
            <SideBox title="OBSERVAÇÕES">
              <div className="text-[8pt] whitespace-pre-wrap">{snap.notes}</div>
            </SideBox>
          )}
        </aside>
      </div>
    </div>
  );
}

function SideBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #d6d3d1" }}>
      <div className="px-2 py-1 text-[7pt] tracking-[0.15em] font-bold text-center"
        style={{ background: "#1c1917", color: "#fff" }}>{title}</div>
      <div className="px-2 py-1.5">{children}</div>
    </section>
  );
}
