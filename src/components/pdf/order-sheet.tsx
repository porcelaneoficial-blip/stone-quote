/**
 * Ficha interna do Pedido (controle da empresa) — layout A4 do modelo Porcelane.
 * Somente apresentação: lê os dados do pedido, não altera nada.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { QuoteData, Environment } from "@/lib/types";
import { fmtDate } from "@/lib/format";

const Line = ({ w = "100%" }: { w?: string }) => (
  <span className="inline-block border-b border-stone-400 align-bottom" style={{ width: w, height: "1em" }} />
);

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[7pt] uppercase tracking-[0.18em] text-stone-500">{label}</div>
      {value ? (
        <div className="text-[10.5pt] font-semibold leading-snug break-words">{value}</div>
      ) : (
        <div className="pt-1.5"><Line w="90%" /></div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <h3 className="text-[9.5pt] font-bold uppercase tracking-[0.22em]">{children}</h3>
      <div className="h-[1.5px] bg-stone-900 mt-1" />
    </div>
  );
}

/** Resumo de produção/características a partir das peças do ambiente. */
function envFeatures(env: Environment): string {
  const uniq = new Set<string>();
  for (const it of env.items ?? []) {
    const d = (it.description || "").trim();
    if (d) uniq.add(d);
  }
  return Array.from(uniq).join(", ");
}

function envAccessories(env: Environment): string {
  const parts: string[] = [];
  const accs = env.quick_room?.accessories ?? [];
  const names = new Set<string>();
  for (const a of accs) names.add(a.label || a.kind.replace(/_/g, " "));
  if (env.qtd_cuba) parts.push(`${env.qtd_cuba} cuba(s)`);
  if (env.qtd_nicho) parts.push(`${env.qtd_nicho} nicho(s)`);
  if (env.qtd_divibox) parts.push(`${env.qtd_divibox} divibox`);
  parts.push(...Array.from(names));
  return parts.join(" / ");
}

export function OrderInternalSheet({
  data,
  number,
  createdAt,
  sellerName,
  logoUrl,
}: {
  data: QuoteData;
  number: number;
  createdAt: string;
  sellerName?: string;
  logoUrl?: string | null;
}) {
  const prazo = data.delivery
    ? `${data.delivery.days} dias ${data.delivery.days_type === "uteis" ? "úteis" : "corridos"}`
    : "";

  // Enquadra o conteúdo em uma única folha A4 (reduz proporcionalmente só se necessário).
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const measure = () => {
      const el = boxRef.current;
      const parent = el?.parentElement;
      if (!el || !parent) return;
      const cs = getComputedStyle(parent);
      const availH = parent.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const availW = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const h = el.scrollHeight * scale; // altura real renderizada
      const w = el.scrollWidth * scale;
      if (!availH || !h) return;
      const ratio = Math.min(availH / h, availW / w);
      const next = ratio < 1 ? Math.max(0.5, scale * ratio) : Math.min(1, scale * ratio);
      if (Math.abs(next - scale) > 0.01) setScale(next);
    };
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
    };
  }, [scale, data, number]);

  const envs = data.environments ?? [];
  // Garante corpo de tabela com altura equilibrada mesmo com poucos ambientes.
  const filler = Math.max(0, 4 - envs.length);

  return (
    <div className="a4-page print-page ficha-a4 pdf-no-footer mx-auto bg-white">
      <div
        ref={boxRef}
        className="flex h-full flex-col"
        style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: `${100 / scale}%`, height: `${100 / scale}%` }}
      >
        <header className="flex items-center justify-between gap-6 pb-3">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Porcelane" className="h-20 w-auto max-w-[200px] object-contain" />
            ) : (
              <div className="font-display text-[22pt] font-bold tracking-[0.28em] uppercase">Porcelane</div>
            )}
            <div className="border-l border-stone-300 pl-3">
              <div className="text-[7.5pt] uppercase tracking-[0.28em] text-stone-500">Documento</div>
              <div className="text-[11pt] font-semibold uppercase tracking-[0.12em]">Ficha interna do pedido</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[7.5pt] uppercase tracking-[0.28em] text-stone-500">Pedido Nº</div>
            <div className="font-display text-[24pt] font-bold leading-none">{String(number).padStart(6, "0")}</div>
          </div>
        </header>
        <div className="h-[2px] bg-stone-900" />

        <div className="flex justify-between gap-8 text-[9pt] py-2 border-b border-stone-300">
          <div>DATA DE FECHAMENTO: <strong>{fmtDate(createdAt)}</strong></div>
          <div className="flex-1 text-right">LIBERAÇÃO TÉC.: <Line w="40%" /></div>
        </div>

        <section className="pt-4">
          <SectionTitle>Dados da obra</SectionTitle>
          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Cliente" value={data.client_name} />
            <Field label="Telefone" value={data.client_phone} />
            <Field label="Consultor" value={sellerName || data.salesperson} />
            <div className="col-span-2"><Field label="Obra / Endereço" value={data.address} /></div>
            <Field label="Cidade / Referência" value={data.city} />
            <Field label="Prazo do pedido" value={prazo} />
            <Field label="Previsão de medição" />
            <Field label="Previsão de entrega" />
          </div>
        </section>

        <section className="pt-5">
          <SectionTitle>Responsáveis</SectionTitle>
          <div className="grid grid-cols-4 gap-x-6 gap-y-4">
            <Field label="Arquiteto" value={data.architect} />
            <Field label="Contato do arquiteto" />
            <Field label="Engenheiro" />
            <Field label="Contato do engenheiro" />
            <Field label="Mestre de obra" />
            <Field label="Contato do mestre" />
            <Field label="Vendedor externo" value={data.external_salesperson} />
            <Field label="Contato do vendedor" />
          </div>
        </section>

        <section className="pt-5 flex-1 flex flex-col min-h-0">
          <SectionTitle>Resumo dos ambientes</SectionTitle>
          <table className="w-full text-[8.5pt] border border-stone-400 border-collapse table-fixed">
            <colgroup>
              <col style={{ width: "16%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr className="bg-stone-100 text-[7.5pt] uppercase tracking-wider">
                <th className="border border-stone-400 py-1.5 px-2 text-left">Ambiente</th>
                <th className="border border-stone-400 py-1.5 px-2">Medição</th>
                <th className="border border-stone-400 py-1.5 px-2 text-left">Material</th>
                <th className="border border-stone-400 py-1.5 px-2 text-left">Produção / Características</th>
                <th className="border border-stone-400 py-1.5 px-2 text-left">Cuba / Acessório</th>
                <th className="border border-stone-400 py-1.5 px-2">Entrega</th>
              </tr>
            </thead>
            <tbody>
              {envs.map((env) => (
                <tr key={env.id} className="align-top">
                  <td className="border border-stone-400 py-2 px-2 font-bold">{env.name}</td>
                  <td className="border border-stone-400 py-2 px-2 text-center whitespace-nowrap">__/__/____</td>
                  <td className="border border-stone-400 py-2 px-2">{env.material_name}</td>
                  <td className="border border-stone-400 py-2 px-2">{envFeatures(env)}</td>
                  <td className="border border-stone-400 py-2 px-2">{envAccessories(env)}</td>
                  <td className="border border-stone-400 py-2 px-2 text-center whitespace-nowrap">__/__/____</td>
                </tr>
              ))}
              {Array.from({ length: filler }).map((_, i) => (
                <tr key={`f${i}`}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="border border-stone-400 py-2.5 px-2">&nbsp;</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="pt-5">
          <SectionTitle>Observações</SectionTitle>
          <div className="text-[9pt] leading-relaxed whitespace-pre-wrap min-h-[16mm]">
            {data.notes?.trim() ||
              "Todas as medidas, recortes e posições conforme projeto aprovado.\nVerificar paginação para detalhes técnicos de cada ambiente."}
          </div>
        </section>

        <footer className="mt-auto pt-6 grid grid-cols-3 gap-8 text-[8pt] uppercase tracking-[0.14em] text-stone-600">
          {["Conferido por", "Liberação técnica", "Produção"].map((l) => (
            <div key={l}>
              <div className="border-b border-stone-500 h-6" />
              <div className="pt-1 text-center">{l}</div>
            </div>
          ))}
        </footer>
      </div>
    </div>
  );
}
