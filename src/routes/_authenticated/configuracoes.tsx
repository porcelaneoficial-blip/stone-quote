import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { fetchCep, fetchCnpj } from "@/lib/lookups";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: SettingsPage,
});

type Tab = "empresa" | "condicoes" | "materiais" | "acabamentos" | "servicos" | "insumos" | "vendedores" | "med_tecnica" | "comissoes" | "produtividade";

function SettingsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isChild = pathname.replace(/\/$/, "") !== "/configuracoes";
  const [tab, setTab] = useState<Tab>("empresa");
  const tabs: { id: Tab; label: string }[] = [
    { id: "empresa", label: "Empresa" },
    { id: "condicoes", label: "Condições" },
    { id: "materiais", label: "Materiais" },
    { id: "acabamentos", label: "Acabamentos" },
    { id: "servicos", label: "Serviços" },
    { id: "insumos", label: "Insumos" },
    { id: "vendedores", label: "Vendedores" },
    { id: "med_tecnica", label: "Med Técnica" },
    { id: "comissoes", label: "Comissões" },
    { id: "produtividade", label: "Produtividade" },
  ];
  if (isChild) return <Outlet />;
  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="label-eyebrow">Cadastros</p>
        <h1 className="font-display text-4xl mt-1">Configurações</h1>
      </div>
      <div className="flex gap-1 border-b border-stone-200 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs uppercase tracking-widest font-bold border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? "border-stone-950 text-stone-950" : "border-transparent text-stone-400 hover:text-stone-700"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "empresa" && <Empresa />}
      {tab === "condicoes" && <Condicoes />}
      {tab === "materiais" && <Materiais />}
      {tab === "acabamentos" && <Acabamentos />}
      {tab === "servicos" && <PriceList table="services" title="Serviço" />}
      {tab === "insumos" && <PriceList table="supplies" title="Insumo" />}
      {tab === "vendedores" && <Vendedores />}
      {tab === "med_tecnica" && <MedTecnica />}
      {tab === "comissoes" && <Comissoes />}
      {tab === "produtividade" && <Produtividade />}
    </div>
  );
}

/* ===== EMPRESA ===== */

type CompanySettings = {
  company_name: string; razao_social: string; cnpj: string; inscricao_estadual: string;
  phone: string; whatsapp: string; email: string; instagram: string; website: string;
  cep: string; address: string; neighborhood: string;
  logo_url: string | null; quote_terms: string; default_validity_days: number;
  default_beneficiamento: number; default_coleta: number; default_waste_pct: number; default_prazo_dias: number;
};

function Empresa() {
  const [s, setS] = useState<Partial<CompanySettings> | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data, error } = await supabase.from("company_settings").select("*").eq("user_id", u.user.id).maybeSingle();
      if (error) { toast.error(error.message); return; }
      setS((data ?? {}) as Partial<CompanySettings>);
    })();
  }, []);
  const save = async () => {
    if (!s) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setBusy(false); return; }
    const { error } = await supabase.from("company_settings").update(s).eq("user_id", u.user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Salvo");
  };
  const lookupCnpj = async (cnpj: string) => {
    const d = await fetchCnpj(cnpj);
    if (!d) { toast.error("CNPJ não encontrado"); return; }
    setS((p) => ({ ...p,
      razao_social: d.razao_social,
      company_name: d.nome_fantasia || d.razao_social,
      address: `${d.logradouro}, ${d.numero}`,
      neighborhood: d.bairro,
      cep: d.cep,
      phone: d.ddd_telefone_1,
      email: d.email,
    }));
    toast.success("Dados do CNPJ preenchidos");
  };
  const lookupCep = async (cep: string) => {
    const d = await fetchCep(cep);
    if (!d) { toast.error("CEP não encontrado"); return; }
    setS((p) => ({ ...p, address: d.logradouro, neighborhood: d.bairro }));
  };
  if (!s) return <div className="text-sm text-stone-400">Carregando…</div>;

  const F = (k: keyof CompanySettings, label: string, type = "text", onBlur?: (v: string) => void) => (
    <div className="space-y-1">
      <label className="label-eyebrow">{label}</label>
      <input type={type} value={String(s[k] ?? "")}
        onChange={(e) => setS({ ...s, [k]: type === "number" ? Number(e.target.value) : e.target.value })}
        onBlur={(e) => onBlur?.(e.target.value)}
        className="w-full bg-white border border-stone-200 p-3 text-sm focus:outline-none focus:border-gold-high" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 p-8 space-y-6">
        <h3 className="font-display text-lg">Dados da empresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {F("cnpj", "CNPJ", "text", lookupCnpj)}
          {F("inscricao_estadual", "Inscrição Estadual")}
          {F("razao_social", "Razão Social")}
          {F("company_name", "Nome Fantasia")}
          {F("phone", "Telefone")}
          {F("whatsapp", "WhatsApp")}
          {F("email", "E-mail")}
          {F("instagram", "Instagram")}
          {F("website", "Site")}
          {F("cep", "CEP", "text", lookupCep)}
        </div>
        {F("address", "Endereço")}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {F("neighborhood", "Bairro")}
          {F("logo_url", "URL do logo")}
        </div>
        {s.logo_url && <img src={s.logo_url} alt="Logo" className="max-h-20 border border-stone-200 p-2" />}
      </div>

      <div className="bg-white border border-stone-200 p-8 space-y-6">
        <h3 className="font-display text-lg">Padrões financeiros</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {F("default_beneficiamento", "Beneficiamento padrão (R$)", "number")}
          {F("default_coleta", "Coleta por viagem (R$)", "number")}
          {F("default_waste_pct", "Desperdício padrão (%)", "number")}
          {F("default_validity_days", "Validade orçamento (dias)", "number")}
          {F("default_prazo_dias", "Prazo de entrega (dias)", "number")}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={busy}
          className="bg-stone-950 text-white px-6 py-3 text-sm font-semibold uppercase tracking-widest hover:bg-stone-800 disabled:opacity-50">
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

/* ===== CONDIÇÕES DE OBRA ===== */

type Clause = { id: string; title: string | null; content: string; position: number; active: boolean };

function Condicoes() {
  const [rows, setRows] = useState<Clause[]>([]);
  const [novo, setNovo] = useState({ title: "", content: "" });
  const reload = async () => {
    const { data, error } = await supabase.from("terms_clauses").select("*").order("position");
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as Clause[]);
  };
  useEffect(() => { reload(); }, []);
  const add = async () => {
    if (!novo.content) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const pos = (rows[rows.length - 1]?.position ?? 0) + 1;
    const { error } = await supabase.from("terms_clauses").insert({ ...novo, position: pos, user_id: u.user.id });
    if (error) { toast.error(error.message); return; }
    setNovo({ title: "", content: "" });
    reload();
  };
  const upd = async (id: string, patch: Partial<Clause>) => {
    const { error } = await supabase.from("terms_clauses").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const del = async (id: string) => {
    if (!confirm("Excluir cláusula?")) return;
    await supabase.from("terms_clauses").delete().eq("id", id);
    reload();
  };
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[i], b = rows[j];
    await supabase.from("terms_clauses").update({ position: b.position }).eq("id", a.id);
    await supabase.from("terms_clauses").update({ position: a.position }).eq("id", b.id);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 p-4 space-y-3">
        <Input label="Título (opcional)" value={novo.title} onChange={(v) => setNovo({ ...novo, title: v })} />
        <div className="space-y-1">
          <label className="label-eyebrow">Conteúdo da cláusula</label>
          <textarea value={novo.content} onChange={(e) => setNovo({ ...novo, content: e.target.value })} rows={3}
            className="w-full bg-white border border-stone-200 p-2 text-sm focus:outline-none focus:border-gold-high" />
        </div>
        <button onClick={add}
          className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-3 px-4 flex items-center gap-1 hover:bg-stone-800">
          <Plus className="size-3" /> Adicionar cláusula
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id} className="bg-white border border-stone-200 p-4 flex gap-3 items-start">
            <div className="flex flex-col gap-1">
              <button onClick={() => move(i, -1)} className="text-stone-400 hover:text-stone-950"><ArrowUp className="size-4" /></button>
              <button onClick={() => move(i, 1)} className="text-stone-400 hover:text-stone-950"><ArrowDown className="size-4" /></button>
            </div>
            <div className="flex-1 space-y-2">
              <input value={r.title ?? ""} onChange={(e) => upd(r.id, { title: e.target.value })}
                placeholder="Título (opcional)"
                className="w-full font-semibold bg-transparent focus:outline-none focus:border-b focus:border-gold-high" />
              <textarea value={r.content} onChange={(e) => upd(r.id, { content: e.target.value })} rows={3}
                className="w-full bg-stone-50 border border-stone-200 p-2 text-sm focus:outline-none focus:border-gold-high" />
            </div>
            <label className="text-xs flex items-center gap-2 mt-1">
              <input type="checkbox" checked={r.active} onChange={(e) => upd(r.id, { active: e.target.checked })} className="accent-stone-950" />
              Ativo
            </label>
            <button onClick={() => del(r.id)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-4" /></button>
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-stone-400 text-center py-8">Nenhuma cláusula cadastrada</div>}
      </div>
    </div>
  );
}

/* ===== CRUD genérico ===== */

type CrudRow = Record<string, unknown> & { id?: string; user_id?: string; active?: boolean };
function useCrud<T extends CrudRow>(table: string, orderBy = "name") {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    const { data, error } = await supabase.from(table as never).select("*").order(orderBy);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as T[]);
    setLoading(false);
  };
  useEffect(() => { reload(); }, [table]);
  const create = async (row: Partial<T>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from(table as never).insert({ ...(row as object), user_id: u.user.id } as never);
    if (error) { toast.error(error.message); return; }
    await reload();
  };
  const update = async (id: string, patch: Partial<T>) => {
    const { error } = await supabase.from(table as never).update(patch as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir este item?")) return;
    const { error } = await supabase.from(table as never).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows(rows.filter((r) => r.id !== id));
  };
  return { rows, loading, create, update, remove };
}

/* ===== MATERIAIS ===== */

function Materiais() {
  type M = { id: string; category: string; name: string; finish: string; porosity: string; price_m2: number; indication: string; active: boolean };
  const { rows, loading, create, update, remove } = useCrud<M>("materials", "category");
  const [novo, setNovo] = useState<Partial<M>>({ category: "GRANITOS", name: "", finish: "", porosity: "", price_m2: 0, indication: "", active: true });
  if (loading) return <div className="text-sm text-stone-400">Carregando…</div>;
  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 p-4 grid grid-cols-1 md:grid-cols-7 gap-2 items-end">
        <Input label="Categoria" value={novo.category ?? ""} onChange={(v) => setNovo({ ...novo, category: v })} />
        <Input label="Nome" value={novo.name ?? ""} onChange={(v) => setNovo({ ...novo, name: v })} />
        <Input label="Acabamento" value={novo.finish ?? ""} onChange={(v) => setNovo({ ...novo, finish: v })} />
        <Input label="Porosidade" value={novo.porosity ?? ""} onChange={(v) => setNovo({ ...novo, porosity: v })} />
        <Input label="Valor m²" type="number" value={String(novo.price_m2 ?? 0)} onChange={(v) => setNovo({ ...novo, price_m2: Number(v) })} />
        <Input label="Indicação" value={novo.indication ?? ""} onChange={(v) => setNovo({ ...novo, indication: v })} />
        <button onClick={() => { if (novo.name) { create(novo); setNovo({ category: novo.category, name: "", finish: "", porosity: "", price_m2: 0, indication: "", active: true }); } }}
          className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-3 px-4 flex items-center justify-center gap-1 hover:bg-stone-800">
          <Plus className="size-3" /> Adicionar
        </button>
      </div>
      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
            <tr>
              <th className="text-left p-3">Categoria</th><th className="text-left p-3">Nome</th><th className="text-left p-3">Acab.</th>
              <th className="text-left p-3">Poros.</th><th className="text-right p-3">Valor m²</th><th className="text-left p-3">Indicação</th>
              <th className="text-center p-3">Ativo</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2"><InlineText value={r.category} onChange={(v) => update(r.id!, { category: v })} /></td>
                <td className="p-2"><InlineText value={r.name} onChange={(v) => update(r.id!, { name: v })} /></td>
                <td className="p-2"><InlineText value={r.finish} onChange={(v) => update(r.id!, { finish: v })} /></td>
                <td className="p-2"><InlineText value={r.porosity} onChange={(v) => update(r.id!, { porosity: v })} /></td>
                <td className="p-2 text-right"><InlineNum value={r.price_m2} onChange={(v) => update(r.id!, { price_m2: v })} /></td>
                <td className="p-2"><InlineText value={r.indication} onChange={(v) => update(r.id!, { indication: v })} /></td>
                <td className="p-2 text-center"><input type="checkbox" checked={r.active} onChange={(e) => update(r.id!, { active: e.target.checked })} className="accent-stone-950" /></td>
                <td className="p-2 text-right"><button onClick={() => remove(r.id!)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== SERVIÇOS / INSUMOS ===== */

function PriceList({ table, title }: { table: "services" | "supplies"; title: string }) {
  type R = { id: string; name: string; unit: string; price: number; active: boolean };
  const { rows, loading, create, update, remove } = useCrud<R>(table);
  const [novo, setNovo] = useState<Partial<R>>({ name: "", unit: "un", price: 0, active: true });
  if (loading) return <div className="text-sm text-stone-400">Carregando…</div>;
  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 p-4 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <Input label={title} value={novo.name ?? ""} onChange={(v) => setNovo({ ...novo, name: v })} />
        <Input label="Unidade" value={novo.unit ?? ""} onChange={(v) => setNovo({ ...novo, unit: v })} />
        <Input label="Preço" type="number" value={String(novo.price ?? 0)} onChange={(v) => setNovo({ ...novo, price: Number(v) })} />
        <button onClick={() => { if (novo.name) { create(novo); setNovo({ name: "", unit: "un", price: 0, active: true }); } }}
          className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-3 px-4 flex items-center justify-center gap-1 hover:bg-stone-800 md:col-span-2">
          <Plus className="size-3" /> Adicionar
        </button>
      </div>
      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
            <tr><th className="text-left p-3">Nome</th><th className="text-left p-3 w-24">Unidade</th><th className="text-right p-3 w-32">Preço</th><th className="text-center p-3 w-20">Ativo</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2"><InlineText value={r.name} onChange={(v) => update(r.id!, { name: v })} /></td>
                <td className="p-2"><InlineText value={r.unit} onChange={(v) => update(r.id!, { unit: v })} /></td>
                <td className="p-2 text-right"><InlineNum value={r.price} onChange={(v) => update(r.id!, { price: v })} /></td>
                <td className="p-2 text-center"><input type="checkbox" checked={r.active} onChange={(e) => update(r.id!, { active: e.target.checked })} className="accent-stone-950" /></td>
                <td className="p-2 text-right"><button onClick={() => remove(r.id!)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== VENDEDORES ===== */

function Vendedores() {
  type V = { id: string; name: string; commission_pct: number; active: boolean; kind: "interno" | "externo" };
  const { rows, loading, create, update, remove } = useCrud<V>("sellers");
  const [novo, setNovo] = useState<Partial<V>>({ name: "", commission_pct: 0, active: true, kind: "interno" });
  if (loading) return <div className="text-sm text-stone-400">Carregando…</div>;
  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 p-4 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
        <Input label="Nome" value={novo.name ?? ""} onChange={(v) => setNovo({ ...novo, name: v })} />
        <div className="space-y-1">
          <label className="label-eyebrow">Tipo</label>
          <select value={novo.kind ?? "interno"} onChange={(e) => setNovo({ ...novo, kind: e.target.value as "interno" | "externo" })}
            className="w-full bg-white border border-stone-200 p-2 text-sm focus:outline-none">
            <option value="interno">Interno</option>
            <option value="externo">Externo</option>
          </select>
        </div>
        <Input label="Comissão (%)" type="number" value={String(novo.commission_pct ?? 0)} onChange={(v) => setNovo({ ...novo, commission_pct: Number(v) })} />
        <button onClick={() => { if (novo.name) { create(novo); setNovo({ name: "", commission_pct: 0, active: true, kind: "interno" }); } }}
          className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-3 px-4 flex items-center justify-center gap-1 hover:bg-stone-800 md:col-span-2">
          <Plus className="size-3" /> Adicionar
        </button>
      </div>
      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3 w-32">Tipo</th>
              <th className="text-right p-3 w-32">Comissão %</th>
              <th className="text-center p-3 w-20">Ativo</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2"><InlineText value={r.name} onChange={(v) => update(r.id!, { name: v })} /></td>
                <td className="p-2">
                  <select value={r.kind ?? "interno"} onChange={(e) => update(r.id!, { kind: e.target.value as "interno" | "externo" })}
                    className="w-full bg-transparent text-sm focus:outline-none">
                    <option value="interno">Interno</option>
                    <option value="externo">Externo</option>
                  </select>
                </td>
                <td className="p-2 text-right"><InlineNum value={r.commission_pct} onChange={(v) => update(r.id!, { commission_pct: v })} /></td>
                <td className="p-2 text-center"><input type="checkbox" checked={r.active} onChange={(e) => update(r.id!, { active: e.target.checked })} className="accent-stone-950" /></td>
                <td className="p-2 text-right"><button onClick={() => remove(r.id!)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== MED TÉCNICA ===== */

function MedTecnica() {
  type T = { id: string; name: string; commission_pct: number; active: boolean };
  const { rows, loading, create, update, remove } = useCrud<T>("tech_measurers");
  const [novo, setNovo] = useState<Partial<T>>({ name: "", commission_pct: 3, active: true });
  if (loading) return <div className="text-sm text-stone-400">Carregando…</div>;
  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 p-4 text-sm text-stone-600">
        <p><strong>Med Técnica</strong> recebe comissão automaticamente quando o ambiente é <em>liberado para corte</em>. Defina o percentual padrão de cada técnico.</p>
      </div>
      <div className="bg-white border border-stone-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <Input label="Nome" value={novo.name ?? ""} onChange={(v) => setNovo({ ...novo, name: v })} />
        <Input label="Comissão (%)" type="number" value={String(novo.commission_pct ?? 0)} onChange={(v) => setNovo({ ...novo, commission_pct: Number(v) })} />
        <button onClick={() => { if (novo.name) { create(novo); setNovo({ name: "", commission_pct: 3, active: true }); } }}
          className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-3 px-4 flex items-center justify-center gap-1 hover:bg-stone-800 md:col-span-2">
          <Plus className="size-3" /> Adicionar
        </button>
      </div>
      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
            <tr><th className="text-left p-3">Nome</th><th className="text-right p-3 w-32">Comissão %</th><th className="text-center p-3 w-20">Ativo</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2"><InlineText value={r.name} onChange={(v) => update(r.id!, { name: v })} /></td>
                <td className="p-2 text-right"><InlineNum value={r.commission_pct} onChange={(v) => update(r.id!, { commission_pct: v })} /></td>
                <td className="p-2 text-center"><input type="checkbox" checked={r.active} onChange={(e) => update(r.id!, { active: e.target.checked })} className="accent-stone-950" /></td>
                <td className="p-2 text-right"><button onClick={() => remove(r.id!)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== FUNÇÕES DE PRODUÇÃO ===== */

const ROLES = [
  { v: "tecnico", l: "Técnico" },
  { v: "corte", l: "Corte" },
  { v: "acabamento", l: "Acabamento" },
  { v: "expedicao", l: "Expedição" },
  { v: "instalador", l: "Instalador" },
  { v: "administrativo", l: "Administrativo" },
  { v: "gerente_producao", l: "Gerente de Produção" },
];

/* ===== COMISSÕES ===== */

type Rule = { id: string; scope: string; seller_id: string | null; min_value: number; max_value: number | null; percent: number; active: boolean };
type Seller = { id: string; name: string };

function Comissoes() {
  const [rows, setRows] = useState<Rule[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [novo, setNovo] = useState<Partial<Rule>>({ scope: "seller", seller_id: null, min_value: 0, max_value: null, percent: 0, active: true });

  const reload = async () => {
    const [{ data: r }, { data: s }] = await Promise.all([
      supabase.from("commission_rules").select("*").order("scope").order("min_value"),
      supabase.from("sellers").select("id,name").eq("active", true).order("name"),
    ]);
    setRows((r ?? []) as Rule[]);
    setSellers((s ?? []) as Seller[]);
  };
  useEffect(() => { reload(); }, []);

  const add = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("commission_rules").insert({ ...novo, scope: novo.scope!, user_id: u.user.id });
    if (error) { toast.error(error.message); return; }
    setNovo({ scope: novo.scope, seller_id: null, min_value: 0, max_value: null, percent: 0, active: true });
    reload();
  };
  const upd = async (id: string, patch: Partial<Rule>) => {
    const { error } = await supabase.from("commission_rules").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const del = async (id: string) => {
    if (!confirm("Excluir regra?")) return;
    await supabase.from("commission_rules").delete().eq("id", id);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 p-4 space-y-2 text-sm text-stone-600">
        <p><strong>Como funciona:</strong> Cada regra define o percentual de comissão para um escopo (vendedor interno, arquiteto ou externo) numa faixa de valor.</p>
        <p>Para faixas progressivas (ex.: 2% até R$ 100k e 3% acima), crie duas regras para o mesmo vendedor.</p>
      </div>
      <div className="bg-white border border-stone-200 p-4 grid grid-cols-1 md:grid-cols-7 gap-2 items-end">
        <div className="space-y-1">
          <label className="label-eyebrow">Escopo</label>
          <select value={novo.scope} onChange={(e) => setNovo({ ...novo, scope: e.target.value, seller_id: null })}
            className="w-full bg-white border border-stone-200 p-2 text-sm focus:outline-none">
            <option value="seller">Vendedor interno</option>
            <option value="architect">Arquiteto</option>
            <option value="external">Vendedor externo</option>
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className="label-eyebrow">Vendedor</label>
          <select value={novo.seller_id ?? ""} onChange={(e) => setNovo({ ...novo, seller_id: e.target.value || null })}
            disabled={novo.scope !== "seller"}
            className="w-full bg-white border border-stone-200 p-2 text-sm focus:outline-none disabled:bg-stone-50">
            <option value="">— Todos —</option>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <Input label="De (R$)" type="number" value={String(novo.min_value ?? 0)} onChange={(v) => setNovo({ ...novo, min_value: Number(v) })} />
        <Input label="Até (R$)" type="number" value={novo.max_value == null ? "" : String(novo.max_value)} onChange={(v) => setNovo({ ...novo, max_value: v === "" ? null : Number(v) })} />
        <Input label="%" type="number" value={String(novo.percent ?? 0)} onChange={(v) => setNovo({ ...novo, percent: Number(v) })} />
        <button onClick={add}
          className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-3 px-4 flex items-center justify-center gap-1 hover:bg-stone-800">
          <Plus className="size-3" /> Add
        </button>
      </div>
      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
            <tr>
              <th className="text-left p-3">Escopo</th><th className="text-left p-3">Vendedor</th>
              <th className="text-right p-3">De</th><th className="text-right p-3">Até</th>
              <th className="text-right p-3">%</th><th className="text-center p-3">Ativo</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3 capitalize">{r.scope === "seller" ? "Vendedor" : r.scope === "architect" ? "Arquiteto" : "Externo"}</td>
                <td className="p-3">{r.seller_id ? sellers.find((s) => s.id === r.seller_id)?.name : "—"}</td>
                <td className="p-2 text-right"><InlineNum value={r.min_value} onChange={(v) => upd(r.id, { min_value: v })} /></td>
                <td className="p-2 text-right">
                  <input type="number" defaultValue={r.max_value ?? ""} placeholder="∞"
                    onBlur={(e) => upd(r.id, { max_value: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-full bg-transparent text-right text-sm focus:outline-none" />
                </td>
                <td className="p-2 text-right"><InlineNum value={r.percent} onChange={(v) => upd(r.id, { percent: v })} /></td>
                <td className="p-2 text-center"><input type="checkbox" checked={r.active} onChange={(e) => upd(r.id, { active: e.target.checked })} className="accent-stone-950" /></td>
                <td className="p-2 text-right"><button onClick={() => del(r.id)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== PRODUTIVIDADE ===== */

type ProdCfg = { id: string; role: string; type: string; value: number };

function Produtividade() {
  const [rows, setRows] = useState<ProdCfg[]>([]);
  const reload = async () => {
    const { data, error } = await supabase.from("productivity_config").select("*").order("role");
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as ProdCfg[]);
  };
  useEffect(() => { reload(); }, []);
  const upd = async (id: string, patch: Partial<ProdCfg>) => {
    const { error } = await supabase.from("productivity_config").update(patch as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const addRole = async (role: string) => {
    if (rows.find((r) => r.role === role)) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("productivity_config").insert({ user_id: u.user.id, role: role as never, type: "per_env", value: 0 });
    reload();
  };
  const labelRole = (v: string) => ROLES.find((r) => r.v === v)?.l ?? v;
  const missing = ROLES.filter((r) => !rows.find((x) => x.role === r.v));

  return (
    <div className="space-y-4">
      <RemunerationParams />
      <div className="bg-white border border-stone-200 p-4 text-sm text-stone-600">
        Configure quanto cada função recebe por ambiente concluído (R$) ou um percentual do valor do pedido.
      </div>
      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
            <tr><th className="text-left p-3">Função</th><th className="text-left p-3 w-48">Tipo</th><th className="text-right p-3 w-40">Valor</th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-medium">{labelRole(r.role)}</td>
                <td className="p-2">
                  <select value={r.type} onChange={(e) => upd(r.id, { type: e.target.value })}
                    className="bg-transparent text-sm focus:outline-none">
                    <option value="per_env">R$ por ambiente</option>
                    <option value="percent">% do pedido</option>
                  </select>
                </td>
                <td className="p-2 text-right"><InlineNum value={r.value} onChange={(v) => upd(r.id, { value: v })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {missing.length > 0 && (
        <div className="bg-white border border-stone-200 p-4 flex flex-wrap gap-2">
          <span className="text-xs text-stone-500 self-center mr-2">Adicionar função:</span>
          {missing.map((m) => (
            <button key={m.v} onClick={() => addRole(m.v)}
              className="text-xs uppercase tracking-widest font-bold py-2 px-3 border border-stone-200 hover:bg-stone-50">
              <Plus className="size-3 inline mr-1" />{m.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===== PARÂMETROS GLOBAIS DE REMUNERAÇÃO ===== */

type RemParams = { value_per_m2: number; value_special: number; finisher_percent: number; note_cut_m2: number; note_finish_m2: number };

function RemunerationParams() {
  const [p, setP] = useState<RemParams>({ value_per_m2: 16, value_special: 15, finisher_percent: 5, note_cut_m2: 0, note_finish_m2: 0 });
  const [uid, setUid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUid(u.user.id);
      const { data } = await supabase.from("remuneration_params").select("*").eq("user_id", u.user.id).maybeSingle();
      if (data) setP({
        value_per_m2: Number(data.value_per_m2) || 16,
        value_special: Number(data.value_special) || 15,
        finisher_percent: Number(data.finisher_percent) || 5,
        note_cut_m2: Number((data as { note_cut_m2?: number }).note_cut_m2) || 0,
        note_finish_m2: Number((data as { note_finish_m2?: number }).note_finish_m2) || 0,
      });
    })();
  }, []);
  const save = async (patch: Partial<RemParams>) => {
    if (!uid) return;
    const next = { ...p, ...patch };
    setP(next);
    setSaving(true);
    const { error } = await supabase.from("remuneration_params").upsert({ user_id: uid, ...next } as never);
    setSaving(false);
    if (error) toast.error(error.message);
  };
  return (
    <div className="bg-white border border-stone-200 p-4">
      <h3 className="label-eyebrow mb-3">Parâmetros de remuneração</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-stone-600">Valor por m² cortado (R$)</label>
          <input type="number" step="0.01" value={p.value_per_m2}
            onChange={(e) => save({ value_per_m2: parseFloat(e.target.value) || 0 })}
            className="w-full bg-white border border-stone-200 p-2 text-sm font-mono text-right" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-stone-600">Valor fixo por item especial (R$) — Nicho / Divibox</label>
          <input type="number" step="0.01" value={p.value_special}
            onChange={(e) => save({ value_special: parseFloat(e.target.value) || 0 })}
            className="w-full bg-white border border-stone-200 p-2 text-sm font-mono text-right" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-stone-600">Percentual acabadores (%)</label>
          <input type="number" step="0.01" value={p.finisher_percent}
            onChange={(e) => save({ finisher_percent: parseFloat(e.target.value) || 0 })}
            className="w-full bg-white border border-stone-200 p-2 text-sm font-mono text-right" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-stone-200">
        <div className="space-y-1">
          <label className="text-xs text-stone-600">Valor da nota — Ordem de Corte (R$/m²)</label>
          <input type="number" step="0.01" value={p.note_cut_m2}
            onChange={(e) => save({ note_cut_m2: parseFloat(e.target.value) || 0 })}
            className="w-full bg-white border border-stone-200 p-2 text-sm font-mono text-right" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-stone-600">Valor da nota — Ordem de Acabamento (R$/m²)</label>
          <input type="number" step="0.01" value={p.note_finish_m2}
            onChange={(e) => save({ note_finish_m2: parseFloat(e.target.value) || 0 })}
            className="w-full bg-white border border-stone-200 p-2 text-sm font-mono text-right" />
        </div>
      </div>
      <p className="text-[11px] text-stone-500 mt-2">
        Valor da nota: área liberada do ambiente (m²) × valor por m² do respectivo documento.
        O cadastro de funcionários passou para o módulo <strong>RH → Colaboradores</strong>.
      </p>
      <p className="text-[11px] text-stone-500 mt-2">
        Cortador: (Σ m² liberados × valor m²) + (qtd itens especiais × valor fixo).
        Acabador: percentual sobre valor líquido dos itens liberados.
        {saving && <span className="ml-2 text-emerald-600">Salvando…</span>}
      </p>
    </div>
  );
}


/* ===== ACABAMENTOS (com cor visual para legenda 2D/3D) ===== */

function Acabamentos() {
  type FT = { id: string; name: string; color: string; active: boolean };
  const { rows, loading, create, update, remove } = useCrud<FT>("finish_types");
  const [novo, setNovo] = useState<Partial<FT>>({ name: "", color: "#b8860b", active: true });
  if (loading) return <div className="text-sm text-stone-400">Carregando…</div>;
  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 p-4 text-sm text-stone-600">
        Cadastre os tipos de acabamento e atribua uma <strong>cor visual</strong> para cada um. As cores aparecem na legenda dos desenhos 2D e 3D.
      </div>
      <div className="bg-white border border-stone-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <Input label="Nome do acabamento" value={novo.name ?? ""} onChange={(v) => setNovo({ ...novo, name: v })} />
        <div className="space-y-1">
          <label className="label-eyebrow">Cor</label>
          <div className="flex items-center gap-2">
            <input type="color" value={novo.color ?? "#b8860b"} onChange={(e) => setNovo({ ...novo, color: e.target.value })}
              className="h-9 w-12 border border-stone-200 cursor-pointer" />
            <input value={novo.color ?? ""} onChange={(e) => setNovo({ ...novo, color: e.target.value })}
              className="flex-1 bg-white border border-stone-200 p-2 text-sm font-mono uppercase" />
          </div>
        </div>
        <button onClick={() => { if (novo.name) { create(novo); setNovo({ name: "", color: "#b8860b", active: true }); } }}
          className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-3 px-4 flex items-center justify-center gap-1 hover:bg-stone-800 md:col-span-2">
          <Plus className="size-3" /> Adicionar
        </button>
      </div>
      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
            <tr><th className="text-left p-3 w-16">Cor</th><th className="text-left p-3">Nome</th><th className="text-left p-3 w-40">Hex</th><th className="text-center p-3 w-20">Ativo</th><th></th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2"><input type="color" value={r.color} onChange={(e) => update(r.id!, { color: e.target.value })} className="h-8 w-12 cursor-pointer border border-stone-200" /></td>
                <td className="p-2"><InlineText value={r.name} onChange={(v) => update(r.id!, { name: v })} /></td>
                <td className="p-2"><InlineText value={r.color} onChange={(v) => update(r.id!, { color: v })} /></td>
                <td className="p-2 text-center"><input type="checkbox" checked={r.active} onChange={(e) => update(r.id!, { active: e.target.checked })} className="accent-stone-950" /></td>
                <td className="p-2 text-right"><button onClick={() => remove(r.id!)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-4" /></button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-sm text-stone-400">Nenhum acabamento cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== INPUTS ===== */

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <label className="label-eyebrow">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-stone-200 p-2 text-sm focus:outline-none focus:border-gold-high" />
    </div>
  );
}
function InlineText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onChange(v)}
    className="w-full bg-transparent text-sm focus:outline-none focus:border-b focus:border-gold-high" />;
}
function InlineNum({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return <input type="number" step="0.01" value={v} onChange={(e) => setV(e.target.value)}
    onBlur={() => { const n = parseFloat(v) || 0; if (n !== value) onChange(n); }}
    className="w-full bg-transparent text-sm text-right font-mono focus:outline-none focus:border-b focus:border-gold-high" />;
}
