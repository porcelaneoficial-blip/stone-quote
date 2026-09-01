import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Search, Copy as CopyIcon, Loader2 } from "lucide-react";
import { fetchCep, fetchCnpj } from "@/lib/lookups";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

type Client = {
  id: string;
  name: string;
  doc: string | null;
  phone: string | null;
  email: string | null;
  cep: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  active: boolean;
  // Endereço da obra
  site_same_as_client: boolean;
  site_cep: string | null;
  site_address: string | null;
  site_number: string | null;
  site_complement: string | null;
  site_neighborhood: string | null;
  site_city: string | null;
  site_state: string | null;
  site_reference: string | null;
};

const EMPTY: Partial<Client> = {
  name: "", doc: "", phone: "", email: "", cep: "",
  address: "", neighborhood: "", city: "", state: "", notes: "", active: true,
  site_same_as_client: true,
  site_cep: "", site_address: "", site_number: "", site_complement: "",
  site_neighborhood: "", site_city: "", site_state: "", site_reference: "",
};

function ClientesPage() {
  const [rows, setRows] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Partial<Client> | null>(null);
  const [busy, setBusy] = useState(false);
  const [cnpjBusy, setCnpjBusy] = useState(false);

  const lookupCnpj = async () => {
    const doc = (editing?.doc ?? "").replace(/\D/g, "");
    if (doc.length !== 14) { toast.error("CNPJ deve ter 14 dígitos"); return; }
    // Se já existe no banco, carrega
    const { data: existing } = await supabase.from("clients").select("*").eq("doc", editing?.doc ?? "").maybeSingle();
    if (existing) { setEditing(existing as Client); toast.success("Cliente já cadastrado, dados carregados"); return; }
    setCnpjBusy(true);
    const d = await fetchCnpj(doc);
    setCnpjBusy(false);
    if (!d) { toast.error("CNPJ não encontrado"); return; }
    setEditing((p) => ({
      ...p,
      name: d.razao_social || d.nome_fantasia || p?.name || "",
      phone: d.ddd_telefone_1 || p?.phone || "",
      email: d.email || p?.email || "",
      cep: d.cep || p?.cep || "",
      address: [d.logradouro, d.numero].filter(Boolean).join(", "),
      neighborhood: d.bairro || "",
      city: d.municipio || "",
      state: d.uf || "",
    }));
    toast.success("Dados do CNPJ carregados");
  };

  const reload = async () => {
    const { data, error } = await supabase.from("clients").select("*").order("name");
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as Client[]);
  };
  useEffect(() => { reload(); }, []);

  const save = async () => {
    if (!editing?.name) { toast.error("Nome é obrigatório"); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setBusy(false); return; }
    if (editing.id) {
      const { id, ...patch } = editing;
      const { error } = await supabase.from("clients").update(patch).eq("id", id);
      if (error) { toast.error(error.message); setBusy(false); return; }
    } else {
      const { error } = await supabase.from("clients").insert({ ...editing, name: editing.name!, user_id: u.user.id });
      if (error) { toast.error(error.message); setBusy(false); return; }
    }
    setBusy(false);
    setEditing(null);
    toast.success("Cliente salvo");
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir cliente?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    reload();
  };

  const lookupCep = async (cep: string, target: "client" | "site" = "client") => {
    const d = await fetchCep(cep);
    if (!d) { toast.error("CEP não encontrado"); return; }
    if (target === "client") {
      setEditing((p) => ({ ...p, address: d.logradouro, neighborhood: d.bairro, city: d.localidade, state: d.uf }));
    } else {
      setEditing((p) => ({ ...p, site_address: d.logradouro, site_neighborhood: d.bairro, site_city: d.localidade, site_state: d.uf }));
    }
  };

  const copyAddress = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      site_cep: editing.cep ?? "",
      site_address: editing.address ?? "",
      site_neighborhood: editing.neighborhood ?? "",
      site_city: editing.city ?? "",
      site_state: editing.state ?? "",
    });
    toast.success("Endereço do cliente copiado para a obra");
  };

  const filtered = rows.filter((r) =>
    !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.doc ?? "").includes(q)
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="label-eyebrow">Cadastro</p>
          <h1 className="font-display text-4xl mt-1">Clientes</h1>
        </div>
        <button
          onClick={() => setEditing(EMPTY)}
          className="bg-stone-950 text-white px-5 py-3 text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:bg-stone-800"
        >
          <Plus className="size-3" /> Novo cliente
        </button>
      </div>

      <div className="bg-white border border-stone-200 p-3 mb-4 flex items-center gap-2">
        <Search className="size-4 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome ou CPF/CNPJ..."
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
      </div>

      <div className="bg-white border border-stone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">CPF/CNPJ</th>
              <th className="text-left p-3">Telefone</th>
              <th className="text-left p-3">Cidade/UF</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-stone-400 text-sm">Nenhum cliente</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-stone-50 cursor-pointer" onClick={() => setEditing(r)}>
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3 text-stone-600">{r.doc}</td>
                <td className="p-3 text-stone-600">{r.phone}</td>
                <td className="p-3 text-stone-600">{r.city ? `${r.city}/${r.state}` : ""}</td>
                <td className="p-3 text-right">
                  <button onClick={(e) => { e.stopPropagation(); remove(r.id); }}
                    className="text-stone-300 hover:text-red-600"><Trash2 className="size-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-8 space-y-6">
              <h2 className="font-display text-2xl">{editing.id ? "Editar" : "Novo"} cliente</h2>

              {/* Bloco 1 — Dados do cliente */}
              <section className="space-y-3">
                <p className="label-eyebrow">Dados do cliente</p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nome" value={editing.name ?? ""} onChange={(v) => setEditing({ ...editing, name: v })} full />
                  <div className="space-y-1">
                    <label className="label-eyebrow">CPF / CNPJ <span className="text-stone-400 normal-case tracking-normal">(CNPJ + ENTER preenche)</span></label>
                    <div className="relative">
                      <input
                        value={editing.doc ?? ""}
                        onChange={(e) => setEditing({ ...editing, doc: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); lookupCnpj(); } }}
                        className="w-full bg-white border border-stone-200 p-2 text-sm focus:outline-none focus:border-gold-high pr-9"
                      />
                      {cnpjBusy && <Loader2 className="size-4 absolute right-2 top-2.5 animate-spin text-stone-400" />}
                    </div>
                  </div>
                  <Field label="Telefone" value={editing.phone ?? ""} onChange={(v) => setEditing({ ...editing, phone: v })} />
                  <Field label="E-mail" value={editing.email ?? ""} onChange={(v) => setEditing({ ...editing, email: v })} />
                </div>
              </section>

              {/* Bloco 2 — Endereço do cliente */}
              <section className="space-y-3">
                <p className="label-eyebrow">Endereço do cliente</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="label-eyebrow">CEP</label>
                    <input value={editing.cep ?? ""} onChange={(e) => setEditing({ ...editing, cep: e.target.value })}
                      onBlur={(e) => e.target.value && lookupCep(e.target.value, "client")}
                      className="w-full bg-white border border-stone-200 p-2 text-sm focus:outline-none focus:border-gold-high" />
                  </div>
                  <Field label="Endereço" value={editing.address ?? ""} onChange={(v) => setEditing({ ...editing, address: v })} />
                  <Field label="Bairro" value={editing.neighborhood ?? ""} onChange={(v) => setEditing({ ...editing, neighborhood: v })} />
                  <Field label="Cidade" value={editing.city ?? ""} onChange={(v) => setEditing({ ...editing, city: v })} />
                  <Field label="UF" value={editing.state ?? ""} onChange={(v) => setEditing({ ...editing, state: v })} />
                </div>
              </section>

              {/* Bloco 3 — Endereço da OBRA */}
              <section className="space-y-3 bg-stone-50 border border-stone-200 p-4 -mx-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="label-eyebrow">Endereço da obra</p>
                  <label className="text-xs flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editing.site_same_as_client}
                      onChange={(e) => setEditing({ ...editing, site_same_as_client: e.target.checked })}
                      className="accent-stone-950"
                    />
                    Mesmo endereço do cliente
                  </label>
                </div>

                {!editing.site_same_as_client && (
                  <>
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="inline-flex items-center gap-1 text-xs uppercase tracking-wider font-bold border border-stone-300 bg-white px-3 py-2 hover:bg-stone-100"
                    >
                      <CopyIcon className="size-3" /> Copiar endereço do cliente
                    </button>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="label-eyebrow">CEP</label>
                        <input value={editing.site_cep ?? ""} onChange={(e) => setEditing({ ...editing, site_cep: e.target.value })}
                          onBlur={(e) => e.target.value && lookupCep(e.target.value, "site")}
                          className="w-full bg-white border border-stone-200 p-2 text-sm focus:outline-none focus:border-gold-high" />
                      </div>
                      <Field label="Endereço" value={editing.site_address ?? ""} onChange={(v) => setEditing({ ...editing, site_address: v })} />
                      <Field label="Número" value={editing.site_number ?? ""} onChange={(v) => setEditing({ ...editing, site_number: v })} />
                      <Field label="Complemento" value={editing.site_complement ?? ""} onChange={(v) => setEditing({ ...editing, site_complement: v })} />
                      <Field label="Bairro" value={editing.site_neighborhood ?? ""} onChange={(v) => setEditing({ ...editing, site_neighborhood: v })} />
                      <Field label="Cidade" value={editing.site_city ?? ""} onChange={(v) => setEditing({ ...editing, site_city: v })} />
                      <Field label="UF" value={editing.site_state ?? ""} onChange={(v) => setEditing({ ...editing, site_state: v })} />
                      <Field label="Ponto de referência" value={editing.site_reference ?? ""} onChange={(v) => setEditing({ ...editing, site_reference: v })} full />
                    </div>
                  </>
                )}
              </section>

              <Field label="Observações" value={editing.notes ?? ""} onChange={(v) => setEditing({ ...editing, notes: v })} full textarea />
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setEditing(null)} className="px-5 py-3 text-xs uppercase tracking-widest font-bold border border-stone-200 hover:bg-stone-50">Cancelar</button>
                <button onClick={save} disabled={busy} className="bg-stone-950 text-white px-5 py-3 text-xs uppercase tracking-widest font-bold hover:bg-stone-800 disabled:opacity-50">
                  {busy ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, full, textarea }: { label: string; value: string; onChange: (v: string) => void; full?: boolean; textarea?: boolean }) {
  return (
    <div className={`space-y-1 ${full ? "col-span-2" : ""}`}>
      <label className="label-eyebrow">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
          className="w-full bg-white border border-stone-200 p-2 text-sm focus:outline-none focus:border-gold-high" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white border border-stone-200 p-2 text-sm focus:outline-none focus:border-gold-high" />
      )}
    </div>
  );
}
