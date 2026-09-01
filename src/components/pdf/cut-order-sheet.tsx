/**
 * ORDEM DE CORTE — LIBERAÇÃO TÉCNICA (folha A4).
 * Renderiza EXCLUSIVAMENTE o snapshot recebido: nada é buscado ao vivo,
 * nada é inventado. Colunas e seções aparecem só quando há dado real.
 */
import { User, Home, Layers, Sparkles } from "lucide-react";
import type { TechDocSnapshot } from "@/lib/tech-doc";
import { fmtDate, brl, num } from "@/lib/format";

const ROWS_PER_PAGE = 14;

export function TechDocHeader(p: { snap: TechDocSnapshot; title: string; page: number; pages: number }) {
  const { snap } = p;
  return (
    <>
      <header className="flex items-stretch justify-between gap-6 pb-3" style={{ borderBottom: "2px solid #111" }}>
        <div className="flex flex-col justify-center">
          <div className="font-display tracking-[0.28em] text-[18pt] font-bold leading-none">PORCELANE</div>
          <div className="text-[7.5pt] tracking-[0.45em] text-stone-500 mt-1">MARMORARIA</div>
        </div>
        <div className="flex-1 text-center flex flex-col justify-center">
          <h1 className="font-display text-[19pt] font-bold leading-none">{p.title}</h1>
          <div className="text-[8pt] tracking-[0.35em] text-stone-600 mt-1.5">LIBERAÇÃO TÉCNICA</div>
        </div>
        <div className="text-right text-[8.5pt] pl-6 flex flex-col justify-center" style={{ borderLeft: "1px solid #d6d3d1" }}>
          <div className="font-bold">PEDIDO Nº {String(snap.order_number).padStart(6, "0")}</div>
          <div className="text-stone-600">DATA: {fmtDate(snap.generated_at)}</div>
          <div className="text-stone-600">PÁGINA: {String(p.page).padStart(2, "0")}/{String(p.pages).padStart(2, "0")}</div>
          {snap.scale && snap.scale !== "auto" && <div className="text-stone-600">ESCALA: {snap.scale}</div>}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-5 py-3 mb-3" style={{ borderBottom: "1px solid #e7e5e4" }}>
        <IdField icon={<User className="size-5" strokeWidth={1.3} />} label="CLIENTE" value={snap.client_name} />
        <IdField icon={<Home className="size-5" strokeWidth={1.3} />} label="AMBIENTE" value={snap.env_name} />
        <IdField icon={<Layers className="size-5" strokeWidth={1.3} />} label="MATERIAL" value={snap.material} />
        <IdField icon={<Sparkles className="size-5" strokeWidth={1.3} />} label="ACABAMENTO" value={snap.finish_label} />
      </div>
    </>
  );
}

function IdField(p: { icon: React.ReactNode; label: string; value?: string }) {
  if (!p.value) return <div />;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="shrink-0 text-stone-800">{p.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[6.5pt] tracking-[0.2em] font-bold text-stone-500">{p.label}</div>
        <div className="text-[10pt] truncate" style={{ borderBottom: "1px solid #111" }}>{p.value}</div>
      </div>
    </div>
  );
}

export function CutOrderSheet({ snap }: { snap: TechDocSnapshot }) {
  const chunks: typeof snap.rows[] = [];
  for (let i = 0; i < Math.max(1, snap.rows.length); i += ROWS_PER_PAGE) {
    chunks.push(snap.rows.slice(i, i + ROWS_PER_PAGE));
  }
  const pages = chunks.length;

  return (
    <>
      {chunks.map((rows, pi) => (
        <div key={pi} className="a4-page print-page" style={{ pageBreakAfter: pi < pages - 1 ? "always" : "auto" }}>
          <TechDocHeader snap={snap} title="ORDEM DE CORTE" page={pi + 1} pages={pages} />

          {rows.length === 0 ? (
            <p className="text-[10pt] text-stone-500 py-8 text-center">Nenhuma peça cadastrada neste ambiente.</p>
          ) : (
            <table className="w-full text-[9.5pt]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#1c1917", color: "#fff" }}>
                  <Th w="12mm">ITEM</Th>
                  <Th align="left">DESCRIÇÃO</Th>
                  <Th w="18mm">QUANT.</Th>
                  <Th w="26mm">COMP. (mm)</Th>
                  <Th w="26mm">LARG. (mm)</Th>
                  {snap.columns.thickness && <Th w="22mm">ESP. (mm)</Th>}
                  {snap.columns.code && <Th w="24mm">CÓDIGO</Th>}
                  {snap.columns.notes && <Th align="left" w="40mm">OBSERVAÇÕES</Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.index} style={{ borderBottom: "1px solid #e7e5e4" }}>
                    <Td>
                      <span className="inline-flex items-center justify-center rounded-full text-[8pt]"
                        style={{ width: "6mm", height: "6mm", border: "1px solid #111" }}>
                        {r.index}
                      </span>
                    </Td>
                    <Td align="left">{r.description}</Td>
                    <Td>{r.qty}</Td>
                    <Td>{r.length_mm ?? "—"}</Td>
                    <Td>{r.width_mm ?? "—"}</Td>
                    {snap.columns.thickness && <Td>{r.thickness_mm ?? "—"}</Td>}
                    {snap.columns.code && <Td>{r.code ?? "—"}</Td>}
                    {snap.columns.notes && <Td align="left">{r.notes ?? ""}</Td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pi === pages - 1 && (
            <div className="mt-4 space-y-3">
              {snap.notes && (
                <div className="p-3 text-[9pt]" style={{ border: "1px solid #d6d3d1" }}>
                  <b className="tracking-[0.15em] mr-2">OBSERVAÇÕES</b>
                  <span>{snap.notes}</span>
                </div>
              )}

              {snap.supplies.length > 0 && (
                <div className="p-3 text-[9pt]" style={{ border: "1px solid #d6d3d1" }}>
                  <b className="tracking-[0.15em] block mb-1">INSUMOS</b>
                  {snap.supplies.map((s, i) => (
                    <span key={i} className="mr-4">{s.qty}× {s.name}</span>
                  ))}
                </div>
              )}

              {snap.note_value != null && (
                <div className="flex items-center justify-between p-3 text-[9pt]" style={{ border: "1px solid #111" }}>
                  <div>
                    <div className="text-[7pt] tracking-[0.2em] font-bold text-stone-500">VALOR DA NOTA — CORTE</div>
                    <div className="text-stone-600 text-[8pt]">
                      {num(snap.area_m2 ?? 0, 2)} m² × {brl(snap.note_rate_m2 ?? 0)}/m²
                    </div>
                  </div>
                  <div className="font-display text-[15pt] font-bold">{brl(snap.note_value)}</div>
                </div>
              )}

              <div className="grid grid-cols-3 text-[9pt]" style={{ border: "1px solid #d6d3d1" }}>
                <div className="p-3" style={{ borderRight: "1px solid #d6d3d1" }}>
                  <div className="text-[7pt] tracking-[0.2em] font-bold text-stone-500 mb-1">RESPONSÁVEL</div>
                  <div className="font-bold">{snap.responsible ?? "—"}</div>
                  <div className="mt-6 text-stone-500">Assinatura: ______________________</div>
                </div>
                <div className="p-3" style={{ borderRight: "1px solid #d6d3d1" }}>
                  <div className="text-[7pt] tracking-[0.2em] font-bold text-stone-500 mb-1">REVISÃO</div>
                  <div>Rev. {String(snap.revision ?? 0).padStart(2, "0")}</div>
                  {snap.order_date && <div className="text-stone-500">{fmtDate(snap.order_date)}</div>}
                </div>
                <div className="p-3">
                  <div className="text-[7pt] tracking-[0.2em] font-bold text-stone-500 mb-1">LIBERAÇÃO</div>
                  <div>{snap.release_status ?? "—"}</div>
                  {snap.released_by && <div className="text-stone-600">{snap.released_by}</div>}
                  {snap.released_at && <div className="text-stone-500">{fmtDate(snap.released_at)}</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function Th({ children, w, align = "center" }: { children: React.ReactNode; w?: string; align?: "left" | "center" }) {
  return (
    <th className="px-2 py-2 text-[8pt] tracking-[0.15em] font-bold"
      style={{ width: w, textAlign: align }}>{children}</th>
  );
}
function Td({ children, align = "center" }: { children: React.ReactNode; align?: "left" | "center" }) {
  return <td className="px-2 py-2" style={{ textAlign: align }}>{children}</td>;
}
