import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, fmtDate , todayISO } from "@/lib/format";
import { useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { ReceiptUpload } from "@/components/receipt-upload";

export const Route = createFileRoute("/_authenticated/financeiro/pagar")({
  component: ContasPagar,
});

type Row = {
  id: string; category: string; supplier: string; description: string;
  due_date: string; amount: number; paid_amount: number; paid_at: string | null;
  method: string | null; status: string; receipt_path: string | null;
};

const METHODS = ["PIX", "Dinheiro", "Transferência", "Cartão de crédito", "Boleto"];

function ContasPagar() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"todos" | "pendente" | "pago" | "atrasado">("todos");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const today = todayISO();

  const { data: rows } = useQuery({
    queryKey: ["payables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payables").select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    let r = rows ?? [];
    if (statusFilter !== "todos") {
      if (statusFilter === "atrasado") r = r.filter((x) => x.status !== "pago" && x.due_date < today);
      else r = r.filter((x) => x.status === statusFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      r = r.filter((x) =>
        x.supplier.toLowerCase().includes(s) ||
        x.description.toLowerCase().includes(s) ||
        x.category.toLowerCase().includes(s));
    }
    return r;
  }, [rows, statusFilter, search, today]);

  const totals = useMemo(() => {
    const t = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
    const p = filtered.reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    return { total: t, pago: p, pend: t - p };
  }, [filtered]);

  async function markPaid(r: Row, method: string) {
    await supabase.from("payables").update({
      paid_amount: Number(r.amount), paid_at: new Date().toISOString(), method, status: "pago",
    }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["payables"] });
  }
  async function reopen(r: Row) {
    await supabase.from("payables").update({ paid_amount: 0, paid_at: null, status: "pendente" }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["payables"] });
  }
  async function remove(r: Row) {
    if (!confirm("Excluir esta despesa?")) return;
    await supabase.from("payables").delete().eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["payables"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          {(["todos", "pendente", "pago", "atrasado"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={"px-3 py-1.5 text-xs font-bold uppercase tracking-wider border " +
                (statusFilter === s ? "bg-stone-950 text-white border-stone-950" : "border-stone-300 text-stone-600")}>
              {s}
            </button>
          ))}
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
            className="border border-stone-300 px-3 py-1.5 text-sm" />
        </div>
        <button onClick={() => setOpen(true)} className="bg-stone-950 text-white px-4 py-2 text-sm flex items-center gap-2">
          <Plus className="size-4" /> Nova despesa
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={brl(totals.total)} />
        <Stat label="Pago" value={brl(totals.pago)} tone="ok" />
        <Stat label="A pagar" value={brl(totals.pend)} tone={totals.pend > 0 ? "danger" : "ok"} />
      </div>

      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100">
              <th className="text-left p-3 font-bold">Vencimento</th>
              <th className="text-left p-3 font-bold">Categoria</th>
              <th className="text-left p-3 font-bold">Fornecedor</th>
              <th className="text-left p-3 font-bold">Descrição</th>
              <th className="text-right p-3 font-bold">Valor</th>
              <th className="text-left p-3 font-bold">Status</th>
              <th className="text-right p-3 font-bold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-stone-400">Nenhuma despesa</td></tr>
            )}
            {filtered.map((r) => {
              const atraso = r.status !== "pago" && r.due_date < today;
              return (
                <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className="p-3 whitespace-nowrap">{fmtDate(r.due_date)}</td>
                  <td className="p-3">{r.category || "—"}</td>
                  <td className="p-3">{r.supplier || "—"}</td>
                  <td className="p-3 text-stone-600">{r.description}</td>
                  <td className="p-3 text-right font-bold">{brl(Number(r.amount))}</td>
                  <td className="p-3">
                    {r.status === "pago" ? (
                      <span className="text-xs font-bold uppercase text-emerald-700">Pago</span>
                    ) : atraso ? (
                      <span className="text-xs font-bold uppercase text-red-700">Atrasado</span>
                    ) : (
                      <span className="text-xs font-bold uppercase text-stone-500">Pendente</span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <ReceiptUpload
                      receiptPath={r.receipt_path}
                      scope="payables"
                      entityId={r.id}
                      onChange={async (path) => {
                        await supabase.from("payables").update({ receipt_path: path }).eq("id", r.id);
                        qc.invalidateQueries({ queryKey: ["payables"] });
                      }}
                    />
                    {r.status !== "pago" ? (
                      <select onChange={(e) => e.target.value && markPaid(r, e.target.value)} defaultValue=""
                        className="text-xs border border-stone-300 px-2 py-1 mx-2">
                        <option value="">Dar baixa…</option>
                        {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <button onClick={() => reopen(r)} className="text-stone-400 hover:text-stone-950 mx-2" title="Reabrir">
                        <RotateCcw className="size-4 inline" />
                      </button>
                    )}
                    <button onClick={() => remove(r)} className="text-stone-400 hover:text-red-600" title="Excluir">
                      <Trash2 className="size-4 inline" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open && <NewPayableModal onClose={() => setOpen(false)} onSaved={() => {
        setOpen(false);
        qc.invalidateQueries({ queryKey: ["payables"] });
      }} />}
    </div>
  );
}

function NewPayableModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const today = todayISO();
  const [form, setForm] = useState({
    category: "", supplier: "", description: "", due_date: today, amount: "0",
    installments: 1,
  });
  async function save() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const n = Math.max(1, Number(form.installments || 1));
    const base = new Date(form.due_date);
    const parts: any[] = [];
    const total = Number(form.amount || 0);
    const per = total / n;
    for (let i = 0; i < n; i++) {
      const d = new Date(base); d.setMonth(d.getMonth() + i);
      parts.push({
        user_id: u.user.id,
        category: form.category, supplier: form.supplier,
        description: n > 1 ? `${form.description} (${i + 1}/${n})` : form.description,
        due_date: d.toISOString().slice(0, 10), amount: per, status: "pendente",
      });
    }
    const { error } = await supabase.from("payables").insert(parts);
    if (error) { alert(error.message); return; }
    onSaved();
  }
  return (
    <div className="fixed inset-0 bg-stone-950/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-6 space-y-3">
        <h2 className="font-display text-xl">Nova despesa</h2>
        <Field label="Categoria"><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" placeholder="Ex.: Matéria-prima" /></Field>
        <Field label="Fornecedor"><input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="input" /></Field>
        <Field label="Descrição"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Vencimento"><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input" /></Field>
          <Field label="Valor total"><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" /></Field>
          <Field label="Parcelas"><input type="number" min={1} value={form.installments} onChange={(e) => setForm({ ...form, installments: Number(e.target.value) })} className="input" /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-stone-300">Cancelar</button>
          <button onClick={save} className="px-4 py-2 text-sm bg-stone-950 text-white">Salvar</button>
        </div>
      </div>
      <style>{`.input{display:block;width:100%;border:1px solid #d6d3d1;padding:.5rem .75rem;font-size:.875rem}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <div className="bg-white border border-stone-200 p-4">
      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">{label}</div>
      <div className={"font-display text-xl mt-1 " + (tone === "danger" ? "text-red-700" : tone === "ok" ? "text-emerald-700" : "")}>{value}</div>
    </div>
  );
}
