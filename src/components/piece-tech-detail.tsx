/**
 * DETALHE TÉCNICO DA PEÇA — dados, detalhes, acabamentos e conferência
 * reunidos no contexto da peça selecionada. Somente reorganização visual:
 * usa os mesmos campos já existentes na Liberação Técnica.
 */
import type { EnvItem, Environment } from "@/lib/types";
import { FinishSelector, useFinishLibrary } from "@/components/finish-picker";
import { StatusBadge } from "@/components/ui-kit";
import { X } from "lucide-react";

const LINE = "#E2E0DD";
const SEC = "#707070";

const relLen = (it: EnvItem) => (it.released_length ?? it.length) || 0;
const relWid = (it: EnvItem) => (it.released_width ?? it.width) || 0;
const relQty = (it: EnvItem) => {
  const v = it.released_qty ?? it.qty ?? 1;
  return v && v > 0 ? v : 1;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="min-w-0">
      <div className="text-[10px] tracking-[0.2em] font-bold" style={{ color: SEC }}>{label}</div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function PieceTechDetail(p: {
  env: Environment;
  item: EnvItem;
  index: number;
  onUpdateItem: (envId: string, itemId: string, patch: Partial<EnvItem>) => void;
  onClose: () => void;
}) {
  const { env, item } = p;
  const { finishes, loaded } = useFinishLibrary();
  const upd = (patch: Partial<EnvItem>) => p.onUpdateItem(env.id, item.id, patch);
  const inp = "w-full border px-2 py-1.5 text-sm bg-white focus:outline-none";
  const area = (relLen(item) * relWid(item) * relQty(item)).toFixed(3);
  const cortes = (item.recortes ?? []).length;
  const furos = (item.furacoes ?? []).length;

  return (
    <section className="bg-white border" style={{ borderColor: LINE }}>
      <div className="px-6 py-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: `1px solid ${LINE}` }}>
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.25em] font-bold" style={{ color: SEC }}>PEÇA SELECIONADA</div>
          <h3 className="font-display text-lg leading-tight truncate">
            {String(p.index + 1).padStart(2, "0")} · {item.description || "sem descrição"}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge>{area} m²</StatusBadge>
          {cortes > 0 && <StatusBadge tone="andamento">{cortes} recorte(s)</StatusBadge>}
          {furos > 0 && <StatusBadge tone="andamento">{furos} furação(ões)</StatusBadge>}
          {(item.tech_finishes ?? []).length > 0 && (
            <StatusBadge tone="positivo">{(item.tech_finishes ?? []).length} acabamento(s)</StatusBadge>
          )}
          <button onClick={p.onClose} className="text-stone-400 hover:text-stone-950" title="Fechar peça">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* DADOS TÉCNICOS */}
      <div className="px-6 py-5 grid gap-4 grid-cols-2 md:grid-cols-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <Row label="COMP. (M)">
          <input type="number" step="0.001" value={relLen(item)} style={{ borderColor: LINE }} className={`${inp} text-right font-mono`}
            onChange={(e) => upd({ released_length: parseFloat(e.target.value) || 0 })} />
        </Row>
        <Row label="LARG. (M)">
          <input type="number" step="0.001" value={relWid(item)} style={{ borderColor: LINE }} className={`${inp} text-right font-mono`}
            onChange={(e) => upd({ released_width: parseFloat(e.target.value) || 0 })} />
        </Row>
        <Row label="QTDE">
          <input type="number" min={1} step="1" value={relQty(item)} style={{ borderColor: LINE }} className={`${inp} text-right font-mono`}
            onChange={(e) => upd({ released_qty: Math.max(1, parseInt(e.target.value) || 1) })} />
        </Row>
        <Row label="ESPESSURA (MM)">
          <input type="number" min={0} step="1" value={item.thickness_mm ?? ""} placeholder="padrão do ambiente"
            style={{ borderColor: LINE }} className={`${inp} text-right font-mono`}
            onChange={(e) => upd({ thickness_mm: e.target.value === "" ? undefined : parseInt(e.target.value) || 0 })} />
        </Row>
        <Row label="DESCRIÇÃO">
          <input value={item.description ?? ""} style={{ borderColor: LINE }} className={inp}
            onChange={(e) => upd({ description: e.target.value })} />
        </Row>
        <Row label="USINAGEM">
          <input value={item.usinagem ?? ""} placeholder="ex.: rebaixo, furação" style={{ borderColor: LINE }} className={inp}
            onChange={(e) => upd({ usinagem: e.target.value })} />
        </Row>
        <Row label="OBSERVAÇÕES DA PEÇA">
          <input value={item.released_notes ?? ""} placeholder="cuidados, sequência…" style={{ borderColor: LINE }} className={inp}
            onChange={(e) => upd({ released_notes: e.target.value })} />
        </Row>
        <Row label="MEDIDAS DO PEDIDO">
          <div className="text-sm font-mono pt-1.5" style={{ color: SEC }}>
            {(item.length || 0).toFixed(3)} × {(item.width || 0).toFixed(3)} · {item.qty ?? 1}x
          </div>
        </Row>
      </div>

      {/* ACABAMENTOS */}
      <div className="px-6 py-5">
        <div className="text-[10px] tracking-[0.25em] font-bold mb-3" style={{ color: SEC }}>ACABAMENTOS DA PEÇA</div>
        {!loaded ? (
          <p className="text-xs" style={{ color: SEC }}>Carregando biblioteca…</p>
        ) : (
          <FinishSelector
            library={finishes}
            value={item.tech_finishes ?? []}
            onChange={(list) => upd({ tech_finishes: list })}
          />
        )}
        <p className="text-[11px] mt-3" style={{ color: SEC }}>
          Os acabamentos por borda continuam disponíveis clicando na borda da peça no desenho 2D acima.
        </p>
      </div>
    </section>
  );
}
