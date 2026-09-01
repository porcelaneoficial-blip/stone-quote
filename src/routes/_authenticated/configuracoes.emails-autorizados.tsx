import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

type Row = {
  email: string;
  name: string | null;
  role: string;
  allowed_modules: string[];
  active: boolean;
  cpf: string | null;
  seller_id: string | null;
};

type Seller = { id: string; name: string };

function maskCpf(v: string) {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

const ALL_MODULES = [
  "orcamentos","pedidos","medicoes","clientes","romaneio",
  "producao","financeiro","comissoes","relatorios","configuracoes","usuarios",
];

const ROLE_PRESETS: Record<string, string[]> = {
  admin: ALL_MODULES,
  vendas: ["orcamentos","pedidos","medicoes","clientes","romaneio","comissoes","relatorios"],
  tecnica: ["pedidos","medicoes","romaneio","producao","relatorios"],
  parceiro: ["orcamentos","pedidos","comissoes"],
};

function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin"|"vendas"|"tecnica"|"parceiro">("vendas");
  const [sellerId, setSellerId] = useState<string>("");

  const [cpf, setCpf] = useState("");

  const load = async () => {
    setLoading(true);
    const [rEmails, rSellers] = await Promise.all([
      supabase
        .from("authorized_emails" as never)
        .select("email, name, role, allowed_modules, active, cpf, seller_id")
        .order("email"),
      supabase.from("sellers").select("id, name").order("name"),
    ]);
    if (rEmails.error) toast.error(rEmails.error.message);
    setRows((rEmails.data as any) ?? []);
    setSellers(((rSellers.data as any) ?? []) as Seller[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!e) return;
    if (role === "parceiro" && !sellerId) {
      toast.error("Selecione o vendedor vinculado ao parceiro.");
      return;
    }
    const modules = ROLE_PRESETS[role] ?? [];
    const { error } = await supabase.from("authorized_emails" as never).upsert({
      email: e, name: name || null, role, allowed_modules: modules, active: true,
      cpf: cpf ? cpf : null,
      seller_id: role === "parceiro" ? sellerId : null,
    } as any, { onConflict: "email" });
    if (error) return toast.error(error.message);
    toast.success("E-mail autorizado.");
    setEmail(""); setName(""); setCpf(""); setSellerId("");
    load();
  };

  const setCpfFor = async (row: Row, v: string) => {
    const { error } = await supabase.from("authorized_emails" as never)
      .update({ cpf: v ? v : null } as never).eq("email", row.email);
    if (error) return toast.error(error.message);
    load();
  };

  const setSellerFor = async (row: Row, v: string) => {
    const { error } = await supabase.from("authorized_emails" as never)
      .update({ seller_id: v || null } as never).eq("email", row.email);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleModule = async (row: Row, m: string) => {
    const set = new Set(row.allowed_modules);
    if (set.has(m)) set.delete(m); else set.add(m);
    const { error } = await supabase.from("authorized_emails" as never)
      .update({ allowed_modules: [...set] } as never).eq("email", row.email);
    if (error) return toast.error(error.message);
    load();
  };

  const setRoleFor = async (row: Row, r: string) => {
    const { error } = await supabase.from("authorized_emails" as never)
      .update({ role: r, allowed_modules: ROLE_PRESETS[r] ?? row.allowed_modules } as never)
      .eq("email", row.email);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleActive = async (row: Row) => {
    await supabase.from("authorized_emails" as never)
      .update({ active: !row.active } as never).eq("email", row.email);
    load();
  };

  const remove = async (row: Row) => {
    if (!confirm(`Remover ${row.email}?`)) return;
    await supabase.from("authorized_emails" as never).delete().eq("email", row.email);
    load();
  };

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="font-display text-3xl mb-1">E-mails autorizados</h1>
      <p className="text-sm text-stone-500 mb-6">
        Perfis: <b>ADM</b>, <b>Vendas</b>, <b>Técnica</b> e <b>Parceiro</b> (vendedor externo — vê apenas seus pedidos e comissões).
      </p>

      <div className="border border-stone-200 bg-white p-4 mb-6 grid grid-cols-1 md:grid-cols-[1fr_1fr_140px_120px_160px_120px] gap-2 items-end">
        <div>
          <label className="text-xs text-stone-500">E-mail (Google)</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@gmail.com"
            className="w-full border border-stone-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-stone-500">Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full border border-stone-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-stone-500">CPF (ADM)</label>
          <input value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))}
            placeholder="000.000.000-00" inputMode="numeric"
            className="w-full border border-stone-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-stone-500">Perfil</label>
          <select value={role} onChange={(e) => setRole(e.target.value as any)}
            className="w-full border border-stone-300 px-3 py-2 text-sm">
            <option value="admin">ADM</option>
            <option value="vendas">Vendas</option>
            <option value="tecnica">Técnica</option>
            <option value="parceiro">Parceiro</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-stone-500">Vendedor vinculado</label>
          <select
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            disabled={role !== "parceiro"}
            className="w-full border border-stone-300 px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-400"
          >
            <option value="">—</option>
            {sellers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
        <button onClick={add}
          className="bg-stone-950 text-white text-sm py-2 flex items-center justify-center gap-2">
          <Plus className="size-4" /> Adicionar
        </button>
      </div>
      <p className="text-[11px] text-stone-500 -mt-4 mb-4">
        CPF só é usado quando o perfil é <b>ADM</b> e a pessoa quer entrar sem Google. Parceiros só veem os pedidos/orçamentos onde são o vendedor vinculado.
      </p>

      {loading ? <div className="text-sm text-stone-500">Carregando…</div> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.email} className="border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div>
                  <div className="font-semibold">{r.email}</div>
                  <div className="text-xs text-stone-500">{r.name || "—"}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    defaultValue={r.cpf ?? ""}
                    placeholder="CPF (só ADM)"
                    onBlur={(e) => {
                      const v = maskCpf(e.target.value);
                      if ((v || "") !== (r.cpf ?? "")) setCpfFor(r, v);
                    }}
                    className="border border-stone-300 px-2 py-1 text-xs w-40"
                  />
                  <select value={r.role} onChange={(e) => setRoleFor(r, e.target.value)}
                    className="border border-stone-300 px-2 py-1 text-xs">
                    <option value="admin">ADM</option>
                    <option value="vendas">Vendas</option>
                    <option value="tecnica">Técnica</option>
                    <option value="parceiro">Parceiro</option>
                  </select>
                  <select
                    value={r.seller_id ?? ""}
                    onChange={(e) => setSellerFor(r, e.target.value)}
                    disabled={r.role !== "parceiro"}
                    className="border border-stone-300 px-2 py-1 text-xs disabled:bg-stone-50 disabled:text-stone-400"
                    title="Vendedor vinculado (parceiro)"
                  >
                    <option value="">—</option>
                    {sellers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                  <button onClick={() => toggleActive(r)}
                    className={"px-2 py-1 text-xs border " + (r.active ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-stone-100 border-stone-300 text-stone-500")}>
                    {r.active ? "Ativo" : "Inativo"}
                  </button>
                  <button onClick={() => remove(r)} className="text-stone-400 hover:text-red-600">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_MODULES.map((m) => {
                  const on = r.allowed_modules?.includes(m);
                  return (
                    <button key={m} onClick={() => toggleModule(r, m)}
                      className={"px-2 py-1 text-[11px] border " + (on ? "bg-stone-950 text-white border-stone-950" : "bg-white text-stone-600 border-stone-300")}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/configuracoes/emails-autorizados")({
  component: Page,
});
