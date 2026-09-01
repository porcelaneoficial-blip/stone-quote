import { Plus, Trash2 } from "lucide-react";
import { PAYMENT_METHOD_LABEL, type Payment, type PaymentMethodCode, type PaymentMethodLine } from "@/lib/types";
import { brl } from "@/lib/format";

type Totals = {
  total: number;
  entry: number;
  balance: number;
  methodBreakdown: Array<{
    id: string; method: string; amount: number; installments: number;
    installmentValue: number; lastInstallmentValue: number;
  }>;
};

const METHODS: PaymentMethodCode[] = ["pix", "cartao", "transferencia", "boleto", "dinheiro", "cheque", "a_combinar"];

export function ensurePaymentShape(p: Payment): Payment {
  // Migra legacy → novo se ainda não tiver entry/methods
  if (p.entry && p.methods) return p;
  const entry = p.entry ?? {
    enabled: (p.entry_value ?? 0) > 0,
    type: p.entry_type ?? "percent",
    value: p.entry_value ?? 50,
    method: "pix" as PaymentMethodCode,
  };
  const methods = p.methods ?? [
    {
      id: crypto.randomUUID(),
      method: "pix" as PaymentMethodCode,
      amount_type: "remaining" as const,
      amount: 0,
      installments: Math.max(1, p.installments ?? 1),
    },
  ];
  return { ...p, entry, methods };
}

export function PaymentEditor({
  payment, onChange, totals,
}: {
  payment: Payment;
  onChange: (p: Payment) => void;
  totals: Totals;
}) {
  const p = ensurePaymentShape(payment);
  const entry = p.entry!;
  const methods = p.methods!;

  const setEntry = (patch: Partial<typeof entry>) => onChange({ ...p, entry: { ...entry, ...patch } });
  const setMethods = (next: PaymentMethodLine[]) => onChange({ ...p, methods: next });
  const updateMethod = (id: string, patch: Partial<PaymentMethodLine>) =>
    setMethods(methods.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const addMethod = () =>
    setMethods([
      ...methods,
      { id: crypto.randomUUID(), method: "pix", amount_type: "remaining", amount: 0, installments: 1 },
    ]);
  const removeMethod = (id: string) => setMethods(methods.filter((m) => m.id !== id));

  return (
    <div className="space-y-4">
      {/* Prazo a combinar */}
      <div className="border border-stone-200 p-3 bg-stone-50">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-700">
          <input
            type="checkbox"
            checked={!!p.terms_to_agree}
            onChange={(e) => onChange({ ...p, terms_to_agree: e.target.checked })}
          />
          Prazo e valor a combinar
          <span className="ml-2 text-[10px] font-normal normal-case text-stone-500">
            (não gera parcelas com vencimento — usado quando cliente ainda vai definir a forma de pagamento)
          </span>
        </label>
      </div>

      {p.terms_to_agree ? (
        <p className="text-xs text-stone-500 italic px-3">
          Pagamento marcado como "à combinar". Após acordo com o cliente, desmarque para lançar entrada e parcelas.
        </p>
      ) : (
      <>
      {/* Entrada */}
      <div className="border border-stone-200 p-3">

        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-700">
            <input
              type="checkbox"
              checked={entry.enabled}
              onChange={(e) => setEntry({ enabled: e.target.checked })}
            />
            Entrada
          </label>
          {entry.enabled && (
            <span className="text-xs text-stone-500 font-mono ml-auto">= {brl(totals.entry)}</span>
          )}
        </div>
        {entry.enabled && (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              value={entry.type}
              onChange={(e) => setEntry({ type: e.target.value as "percent" | "value" })}
              className="bg-white border border-stone-200 p-2 text-sm"
            >
              <option value="percent">% do total</option>
              <option value="value">Valor R$</option>
            </select>
            <input
              type="number"
              step="0.01"
              min={0}
              max={entry.type === "percent" ? 100 : totals.total || undefined}
              value={entry.value || 0}
              onChange={(e) => {
                const raw = parseFloat(e.target.value) || 0;
                const cap = entry.type === "percent" ? 100 : (totals.total || raw);
                setEntry({ value: Math.max(0, Math.min(raw, cap)) });
              }}
              className="bg-white border border-stone-200 p-2 text-sm"
            />
            <select
              value={entry.method ?? "pix"}
              onChange={(e) => setEntry({ method: e.target.value as PaymentMethodCode })}
              className="bg-white border border-stone-200 p-2 text-sm"
            >
              {METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
            </select>
            <input
              type="number"
              min={1}
              value={entry.installments || 1}
              onChange={(e) => setEntry({ installments: Math.max(1, parseInt(e.target.value) || 1) })}
              className="bg-white border border-stone-200 p-2 text-sm"
              title="Parcelas da entrada"
              placeholder="Parcelas"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {[30, 50, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setEntry({ type: "percent", value: pct })}
                className="text-[11px] px-2 py-1 border border-stone-300 hover:bg-stone-100"
              >
                {pct === 100 ? "Total do pedido (100%)" : `${pct}%`}
              </button>
            ))}
            <span className="text-[11px] text-stone-500">
              A entrada pode chegar a 100% do valor do pedido.
            </span>
          </div>
          {totals.balance <= 0 && totals.entry > 0 && (
            <p className="mt-2 text-[11px] text-emerald-700">
              Entrada cobre o pedido inteiro — nenhum saldo será parcelado.
            </p>
          )}
          {(entry.installments || 1) > 1 && totals.entry > 0 && (
            <p className="mt-2 text-[11px] font-mono text-stone-500">
              Entrada dividida: {entry.installments}× {brl(totals.entry / (entry.installments || 1))}
            </p>
          )}
          </>
        )}

      </div>

      {/* Métodos do saldo */}
      <div className="border border-stone-200 p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Saldo {entry.enabled ? `(${brl(totals.balance)})` : `(${brl(totals.total)})`}
          </span>
          <button
            type="button"
            onClick={addMethod}
            className="flex items-center gap-1 text-xs px-2 py-1 border border-stone-300 hover:bg-stone-100"
          >
            <Plus className="size-3" /> Método
          </button>
        </div>
        <div className="space-y-2">
          {methods.map((m) => {
            const br = totals.methodBreakdown.find((b) => b.id === m.id);
            return (
              <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={m.method}
                  onChange={(e) => updateMethod(m.id, { method: e.target.value as PaymentMethodCode })}
                  className="col-span-3 bg-white border border-stone-200 p-2 text-sm"
                >
                  {METHODS.map((x) => <option key={x} value={x}>{PAYMENT_METHOD_LABEL[x]}</option>)}
                </select>
                <select
                  value={m.amount_type}
                  onChange={(e) =>
                    updateMethod(m.id, { amount_type: e.target.value as PaymentMethodLine["amount_type"] })
                  }
                  className="col-span-3 bg-white border border-stone-200 p-2 text-sm"
                >
                  <option value="remaining">Restante</option>
                  <option value="value">Valor R$</option>
                  <option value="percent">% do saldo</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  disabled={m.amount_type === "remaining"}
                  value={m.amount || 0}
                  onChange={(e) => updateMethod(m.id, { amount: parseFloat(e.target.value) || 0 })}
                  className="col-span-2 bg-white border border-stone-200 p-2 text-sm disabled:bg-stone-50"
                />
                <input
                  type="number"
                  min={1}
                  value={m.installments || 1}
                  onChange={(e) =>
                    updateMethod(m.id, { installments: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  className="col-span-2 bg-white border border-stone-200 p-2 text-sm"
                  title="Parcelas"
                />
                <div className="col-span-1 text-[10px] font-mono text-stone-500 truncate">
                  {br ? brl(br.amount) : "—"}
                </div>
                <button
                  type="button"
                  onClick={() => removeMethod(m.id)}
                  className="col-span-1 p-1 text-stone-400 hover:text-red-600"
                  title="Remover"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            );
          })}
          {methods.length === 0 && (
            <p className="text-xs text-stone-400 italic">Nenhum método. Clique em "Método" para adicionar.</p>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

export function paymentSummaryText(payment: Payment, totals: Totals): string {
  const p = ensurePaymentShape(payment);
  if (p.terms_to_agree) return "Prazo e valor a combinar";
  const parts: string[] = [];
  if (p.entry?.enabled && totals.entry > 0) {
    const en = Math.max(1, p.entry.installments || 1);
    const split = en > 1 ? ` em ${en}× ${brl(totals.entry / en)}` : "";
    parts.push(`Entrada de ${brl(totals.entry)}${p.entry.method ? ` (${PAYMENT_METHOD_LABEL[p.entry.method]})` : ""}${split}`);
  }
  for (const br of totals.methodBreakdown) {
    if (br.amount <= 0) continue;
    const label = PAYMENT_METHOD_LABEL[br.method as PaymentMethodCode] ?? br.method;
    if (br.installments > 1) {
      const tail = br.lastInstallmentValue !== br.installmentValue
        ? `${br.installments - 1}× ${brl(br.installmentValue)} + 1× ${brl(br.lastInstallmentValue)}`
        : `${br.installments}× ${brl(br.installmentValue)}`;
      parts.push(`${label} ${brl(br.amount)} em ${tail}`);
    } else {
      parts.push(`${label} ${brl(br.amount)}`);
    }
  }
  return parts.length ? parts.join(" · ") : `Total ${brl(totals.total)}`;
}
