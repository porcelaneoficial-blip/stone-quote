import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export type CommissionPayee = {
  id: string;
  name: string;
  kind: string;
  doc: string | null;
  phone: string | null;
  email: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  bank_name: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  account_holder: string | null;
  notes: string | null;
  active: boolean;
};

export const PAYEE_KINDS = [
  { value: "interno", label: "Vendedor interno" },
  { value: "externo", label: "Vendedor externo / indicação" },
  { value: "arquiteto", label: "Arquiteto(a)" },
  { value: "tecnica", label: "Técnica / medição" },
];

export function useCommissionPayees() {
  return useQuery({
    queryKey: ["commission-payees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_payees")
        .select("*")
        .order("name");
      return (data ?? []) as unknown as CommissionPayee[];
    },
  });
}

/** Busca o cadastro pelo nome (case-insensitive) dentro do grupo. */
export function findPayee(payees: CommissionPayee[] | undefined, name: string, kind?: string) {
  const n = name.trim().toLowerCase();
  const list = (payees ?? []).filter((p) => p.name.trim().toLowerCase() === n);
  return list.find((p) => !kind || p.kind === kind) ?? list[0] ?? null;
}

export function payeePaymentLine(p: CommissionPayee | null) {
  if (!p) return "";
  const parts: string[] = [];
  if (p.pix_key) parts.push(`PIX ${p.pix_key_type ? `(${p.pix_key_type}) ` : ""}${p.pix_key}`);
  if (p.bank_name) parts.push([p.bank_name, p.bank_agency && `Ag. ${p.bank_agency}`, p.bank_account && `Cc. ${p.bank_account}`].filter(Boolean).join(" · "));
  if (p.account_holder) parts.push(`Titular: ${p.account_holder}`);
  return parts.join(" — ");
}

const emptyForm = (kind: string): Partial<CommissionPayee> => ({
  name: "", kind, doc: "", phone: "", email: "", pix_key: "", pix_key_type: "",
  bank_name: "", bank_agency: "", bank_account: "", account_holder: "", notes: "", active: true,
});

export function CommissionPayeesDialog({
  open, onOpenChange, initialKind = "interno", suggestions = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialKind?: string;
  /** Nomes já presentes nos relatórios, para cadastro rápido. */
  suggestions?: { name: string; kind: string }[];
}) {
  const qc = useQueryClient();
  const { data: payees } = useCommissionPayees();
  const [kind, setKind] = useState(initialKind);
  const [editing, setEditing] = useState<Partial<CommissionPayee> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setKind(initialKind); }, [open, initialKind]);

  const rows = useMemo(() => (payees ?? []).filter((p) => p.kind === kind), [payees, kind]);
  const missing = useMemo(() => {
    const have = new Set((payees ?? []).map((p) => p.name.trim().toLowerCase()));
    return suggestions
      .filter((s) => s.kind === kind && s.name.trim() && !have.has(s.name.trim().toLowerCase()))
      .map((s) => s.name.trim());
  }, [suggestions, payees, kind]);

  const save = async () => {
    if (!editing?.name?.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const payload = { ...editing, kind: editing.kind ?? kind, user_id: u.user.id };
      const { error } = editing.id
        ? await supabase.from("commission_payees").update(payload as never).eq("id", editing.id)
        : await supabase.from("commission_payees").insert(payload as never);
      if (error) throw error;
      toast.success("Cadastro salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["commission-payees"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    await supabase.from("commission_payees").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["commission-payees"] });
  };

  const F = ({ label, k }: { label: string; k: keyof CommissionPayee }) => (
    <div className="space-y-1">
      <label className="label-eyebrow">{label}</label>
      <input
        className="input-line w-full"
        value={String((editing?.[k] as string) ?? "")}
        onChange={(e) => setEditing((s) => ({ ...(s ?? {}), [k]: e.target.value }))}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
        <DialogHeader><DialogTitle>Cadastros de pagamento (comissões)</DialogTitle></DialogHeader>

        <div className="flex flex-wrap gap-2">
          {PAYEE_KINDS.map((k) => (
            <button key={k.value} onClick={() => { setKind(k.value); setEditing(null); }}
              className={"text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 border " +
                (kind === k.value ? "bg-stone-950 text-white border-stone-950" : "border-stone-200 hover:bg-stone-50")}>
              {k.label}
            </button>
          ))}
        </div>

        {missing.length > 0 && (
          <div className="text-xs text-stone-500">
            Sem cadastro:{" "}
            {missing.map((n) => (
              <button key={n} className="underline mr-2"
                onClick={() => setEditing({ ...emptyForm(kind), name: n })}>{n}</button>
            ))}
          </div>
        )}

        <div className="border border-stone-200 divide-y divide-stone-100">
          {rows.length === 0 && <p className="p-3 text-xs text-stone-400">Nenhum cadastro neste grupo.</p>}
          {rows.map((p) => (
            <div key={p.id} className="p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-stone-500 break-words">{payeePaymentLine(p) || "Sem dados de pagamento"}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="text-xs underline" onClick={() => setEditing(p)}>Editar</button>
                <button className="text-stone-400 hover:text-red-600" onClick={() => remove(p.id)}><Trash2 className="size-3.5" /></button>
              </div>
            </div>
          ))}
        </div>

        {editing ? (
          <div className="space-y-3 border-t border-stone-200 pt-4">
            <div className="grid gap-3 md:grid-cols-3">
              <F label="Nome" k="name" />
              <F label="CPF / CNPJ" k="doc" />
              <F label="Telefone" k="phone" />
              <F label="E-mail" k="email" />
              <F label="Tipo da chave PIX" k="pix_key_type" />
              <F label="Chave PIX" k="pix_key" />
              <F label="Banco" k="bank_name" />
              <F label="Agência" k="bank_agency" />
              <F label="Conta" k="bank_account" />
              <F label="Titular" k="account_holder" />
              <F label="Observações" k="notes" />
            </div>
            <div className="flex gap-2">
              <button disabled={saving} onClick={save}
                className="text-xs uppercase tracking-widest font-bold py-2 px-4 bg-stone-950 text-white disabled:opacity-50">
                Salvar
              </button>
              <button onClick={() => setEditing(null)} className="text-xs uppercase tracking-widest font-bold py-2 px-4 border border-stone-200">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setEditing(emptyForm(kind))}
            className="self-start text-xs uppercase tracking-widest font-bold py-2 px-3 border border-stone-200 hover:bg-stone-50 flex items-center gap-1">
            <Plus className="size-3" /> Novo cadastro
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
