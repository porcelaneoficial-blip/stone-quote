import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Wand2, Loader2, Check } from "lucide-react";
import { FinishesTab } from "@/components/finishes-library-tab";

export const Route = createFileRoute("/_authenticated/configuracoes/biblioteca-3d")({
  component: Biblioteca3DPage,
});

type Texture = {
  id: string; name: string; category: string; material_id: string | null;
  texture_url: string | null; storage_path: string | null; prompt: string | null; active: boolean;
};
type LibObject = {
  id: string; kind: string; subkind: string | null; name: string;
  width_cm: number; length_cm: number; height_cm: number;
  color: string | null; image_url: string | null; notes: string | null; active: boolean;
};

const TEX_CATEGORIES = ["granito", "marmore", "quartzito", "super_nano", "outro"];
const KIND_LABEL: Record<string, string> = {
  cuba: "Cuba", cooktop: "Cooktop", torneira: "Torneira", torre_tomada: "Torre de tomada", outro: "Outro",
};
const SUBKINDS: Record<string, { value: string; label: string }[]> = {
  cuba: [
    { value: "embutir_ret", label: "Embutir retangular" },
    { value: "embutir_red", label: "Embutir redonda" },
    { value: "apoio", label: "Apoio" },
    { value: "semi_encaixe", label: "Semi-encaixe" },
  ],
  cooktop: [
    { value: "4_bocas", label: "4 bocas" },
    { value: "5_bocas", label: "5 bocas" },
    { value: "inducao", label: "Indução" },
  ],
  torneira: [{ value: "monocomando", label: "Monocomando" }, { value: "gourmet", label: "Gourmet" }],
  torre_tomada: [{ value: "vertical", label: "Vertical" }, { value: "horizontal", label: "Horizontal" }],
  outro: [],
};

function Biblioteca3DPage() {
  const [tab, setTab] = useState<"texturas" | "objetos" | "acabamentos">("texturas");
  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="label-eyebrow">Cadastros</p>
        <h1 className="font-display text-4xl mt-1">Biblioteca</h1>
        <p className="text-sm text-stone-500 mt-2">
          Texturas realistas de materiais, catálogo de objetos 3D (cubas, cooktops, torneiras, torres de tomada) e
          biblioteca de acabamentos com desenhos técnicos usados na Liberação Técnica.
        </p>
      </div>
      <div className="flex gap-1 border-b border-stone-200 mb-6">
        {(["texturas", "objetos", "acabamentos"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs uppercase tracking-widest font-bold border-b-2 -mb-px ${tab === t ? "border-stone-950 text-stone-950" : "border-transparent text-stone-400 hover:text-stone-700"}`}>
            {t === "texturas" ? "Texturas" : t === "objetos" ? "Objetos 3D" : "Acabamentos"}
          </button>
        ))}
      </div>
      {tab === "texturas" ? <TexturesTab /> : tab === "objetos" ? <ObjectsTab /> : <FinishesTab />}
    </div>
  );
}


function TexturesTab() {
  const [rows, setRows] = useState<Texture[]>([]);
  const [materials, setMaterials] = useState<{ id: string; name: string }[]>([]);
  const [novo, setNovo] = useState<Partial<Texture>>({ name: "", category: "granito", material_id: null, prompt: "", active: true });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const reload = async () => {
    const { data, error } = await (supabase as any).from("library_textures").select("*").order("name");
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as Texture[]);
  };
  useEffect(() => {
    reload();
    supabase.from("materials").select("id,name").eq("active", true).order("name").then(({ data }) => setMaterials((data ?? []) as any));
  }, []);

  const add = async () => {
    if (!novo.name) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await (supabase as any).from("library_textures").insert({ ...novo, user_id: u.user.id });
    if (error) { toast.error(error.message); return; }
    setNovo({ name: "", category: "granito", material_id: null, prompt: "", active: true });
    reload();
  };
  const upd = async (id: string, patch: Partial<Texture>) => {
    const { error } = await (supabase as any).from("library_textures").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows(rows.map((r) => r.id === id ? { ...r, ...patch } : r));
  };
  const del = async (id: string) => {
    if (!confirm("Excluir textura?")) return;
    await (supabase as any).from("library_textures").delete().eq("id", id);
    setRows(rows.filter((r) => r.id !== id));
  };

  const generate = async (r: Texture) => {
    if (!r.prompt) { toast.error("Preencha o prompt (ex: 'granito preto São Gabriel polido')"); return; }
    setBusyId(r.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { toast.error("Sessão expirada"); return; }
      const res = await fetch("/api/generate-texture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: r.id, prompt: r.prompt, accessToken: token }),
      });
      if (!res.ok) { toast.error(await res.text()); return; }
      const { url, path } = await res.json();
      await upd(r.id, { texture_url: url, storage_path: path });
      toast.success("Textura gerada");
    } finally {
      setBusyId(null);
    }
  };

  const uploadImage = async (r: Texture, file: File) => {
    setUploading(r.id);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const path = `${u.user.id}/${r.id}-${Date.now()}.${file.name.split(".").pop() || "png"}`;
      const { error } = await supabase.storage.from("materials-textures").upload(path, file, { upsert: true });
      if (error) { toast.error(error.message); return; }
      const { data: signed } = await supabase.storage.from("materials-textures").createSignedUrl(path, 60 * 60 * 24 * 365);
      await upd(r.id, { texture_url: signed?.signedUrl ?? null, storage_path: path });
      toast.success("Textura enviada");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 p-4 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <Field label="Nome"><input value={novo.name ?? ""} onChange={(e) => setNovo({ ...novo, name: e.target.value })} className={inp} /></Field>
        <Field label="Categoria">
          <select value={novo.category} onChange={(e) => setNovo({ ...novo, category: e.target.value })} className={inp}>
            {TEX_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Material vinculado">
          <select value={novo.material_id ?? ""} onChange={(e) => setNovo({ ...novo, material_id: e.target.value || null })} className={inp}>
            <option value="">— nenhum —</option>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Prompt AI (opcional)"><input value={novo.prompt ?? ""} onChange={(e) => setNovo({ ...novo, prompt: e.target.value })} placeholder="ex: granito preto São Gabriel polido" className={inp} /></Field>
        <button onClick={add} className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-3 px-4 flex items-center justify-center gap-1 hover:bg-stone-800 md:col-span-2">
          <Plus className="size-3" /> Adicionar textura
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r) => (
          <div key={r.id} className="bg-white border border-stone-200 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-24 h-24 bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center text-[10px] text-stone-400">
                {r.texture_url ? <img src={r.texture_url} alt={r.name} className="w-full h-full object-cover" /> : "sem textura"}
              </div>
              <div className="flex-1 space-y-1">
                <input value={r.name} onChange={(e) => upd(r.id, { name: e.target.value })} className="w-full text-sm font-semibold bg-transparent border-b border-stone-200 focus:outline-none focus:border-gold-high" />
                <select value={r.category} onChange={(e) => upd(r.id, { category: e.target.value })} className="text-xs bg-transparent">
                  {TEX_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={r.material_id ?? ""} onChange={(e) => upd(r.id, { material_id: e.target.value || null })} className="text-xs bg-transparent block w-full">
                  <option value="">— sem material —</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <button onClick={() => del(r.id)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-4" /></button>
            </div>
            <textarea value={r.prompt ?? ""} onChange={(e) => upd(r.id, { prompt: e.target.value })} rows={2} placeholder="Prompt AI: descreva o material" className="w-full text-xs bg-stone-50 border border-stone-200 p-2 focus:outline-none focus:border-gold-high" />
            <div className="flex items-center gap-2">
              <button onClick={() => generate(r)} disabled={busyId === r.id} className="flex-1 bg-stone-950 text-white text-[10px] uppercase tracking-widest font-bold py-2 px-3 flex items-center justify-center gap-1 hover:bg-stone-800 disabled:opacity-50">
                {busyId === r.id ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />} Gerar AI
              </button>
              <label className="flex-1 border border-stone-300 text-[10px] uppercase tracking-widest font-bold py-2 px-3 text-center cursor-pointer hover:bg-stone-50">
                {uploading === r.id ? "Enviando…" : "Upload"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(r, e.target.files[0])} />
              </label>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-stone-400 col-span-full text-center py-12">Nenhuma textura cadastrada</div>}
      </div>
    </div>
  );
}

function ObjectsTab() {
  const [rows, setRows] = useState<LibObject[]>([]);
  const [novo, setNovo] = useState<Partial<LibObject>>({ kind: "cuba", subkind: "embutir_ret", name: "", width_cm: 40, length_cm: 40, height_cm: 15, color: "#cccccc", active: true });
  const [filterKind, setFilterKind] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState<Record<string, string>>({});

  const reload = async () => {
    const { data, error } = await (supabase as any).from("library_objects").select("*").order("kind").order("name");
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as LibObject[]);
  };
  useEffect(() => { reload(); }, []);

  const add = async () => {
    if (!novo.name || !novo.kind) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await (supabase as any).from("library_objects").insert({ ...novo, user_id: u.user.id });
    if (error) { toast.error(error.message); return; }
    setNovo({ kind: novo.kind, subkind: novo.subkind, name: "", width_cm: 40, length_cm: 40, height_cm: 15, color: "#cccccc", active: true });
    reload();
  };
  const upd = async (id: string, patch: Partial<LibObject>) => {
    const { error } = await (supabase as any).from("library_objects").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r));
  };
  const del = async (id: string) => {
    if (!confirm("Excluir objeto?")) return;
    await (supabase as any).from("library_objects").delete().eq("id", id);
    setRows(rows.filter((r) => r.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
  };
  const delSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} objeto(s)?`)) return;
    await (supabase as any).from("library_objects").delete().in("id", Array.from(selected));
    setRows(rows.filter((r) => !selected.has(r.id)));
    setSelected(new Set());
  };

  const generate = async (r: LibObject) => {
    const prompt = promptDraft[r.id] ?? `${KIND_LABEL[r.kind] ?? r.kind} ${r.name}, ${r.width_cm}x${r.length_cm}cm`;
    setBusyId(r.id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { toast.error("Sessão expirada"); return; }
      const res = await fetch("/api/generate-object", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectId: r.id, prompt, accessToken: token }),
      });
      if (!res.ok) { toast.error(await res.text()); return; }
      const { url } = await res.json();
      await upd(r.id, { image_url: url });
      toast.success("Imagem gerada");
    } finally {
      setBusyId(null);
    }
  };

  const uploadImage = async (r: LibObject, file: File) => {
    setUploading(r.id);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const path = `${u.user.id}/objects/${r.id}-${Date.now()}.${file.name.split(".").pop() || "png"}`;
      const { error } = await supabase.storage.from("materials-textures").upload(path, file, { upsert: true });
      if (error) { toast.error(error.message); return; }
      const { data: signed } = await supabase.storage.from("materials-textures").createSignedUrl(path, 60 * 60 * 24 * 365);
      await upd(r.id, { image_url: signed?.signedUrl ?? null });
      toast.success("Imagem enviada");
    } finally {
      setUploading(null);
    }
  };

  const subOpts = novo.kind ? (SUBKINDS[novo.kind] ?? []) : [];
  const filtered = useMemo(() => filterKind ? rows.filter((r) => r.kind === filterKind) : rows, [rows, filterKind]);
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 p-4 grid grid-cols-2 md:grid-cols-7 gap-2 items-end">
        <Field label="Tipo">
          <select value={novo.kind} onChange={(e) => setNovo({ ...novo, kind: e.target.value, subkind: SUBKINDS[e.target.value]?.[0]?.value ?? null })} className={inp}>
            {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Subtipo">
          <select value={novo.subkind ?? ""} onChange={(e) => setNovo({ ...novo, subkind: e.target.value || null })} className={inp}>
            <option value="">—</option>
            {subOpts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Nome"><input value={novo.name ?? ""} onChange={(e) => setNovo({ ...novo, name: e.target.value })} className={inp} /></Field>
        <Field label="Larg (cm)"><input type="number" value={novo.width_cm} onChange={(e) => setNovo({ ...novo, width_cm: Number(e.target.value) })} className={inp} /></Field>
        <Field label="Comp (cm)"><input type="number" value={novo.length_cm} onChange={(e) => setNovo({ ...novo, length_cm: Number(e.target.value) })} className={inp} /></Field>
        <Field label="Alt (cm)"><input type="number" value={novo.height_cm} onChange={(e) => setNovo({ ...novo, height_cm: Number(e.target.value) })} className={inp} /></Field>
        <button onClick={add} className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-3 px-4 flex items-center justify-center gap-1 hover:bg-stone-800">
          <Plus className="size-3" /> Adicionar
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} className="text-xs bg-white border border-stone-200 px-2 py-1.5">
          <option value="">Todos os tipos</option>
          {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span className="text-xs text-stone-500">{filtered.length} objeto(s){selected.size > 0 && ` · ${selected.size} selecionado(s)`}</span>
        {selected.size > 0 && (
          <button onClick={delSelected} className="ml-auto text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-1">
            <Trash2 className="size-3" /> Excluir selecionados
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map((r) => {
          const sel = selected.has(r.id);
          return (
            <div key={r.id} className={`relative bg-white border ${sel ? "border-stone-950 ring-2 ring-stone-950" : "border-stone-200"} overflow-hidden group`}>
              <button
                type="button"
                onClick={() => toggleSel(r.id)}
                className="relative w-full aspect-square bg-stone-50 flex items-center justify-center overflow-hidden"
                title="Selecionar"
              >
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-stone-400 uppercase tracking-widest">sem imagem</span>
                )}
                {sel && (
                  <span className="absolute top-1.5 left-1.5 bg-stone-950 text-white size-5 flex items-center justify-center">
                    <Check className="size-3" />
                  </span>
                )}
              </button>
              <div className="p-2 space-y-1.5">
                <input value={r.name} onChange={(e) => upd(r.id, { name: e.target.value })} className="w-full text-xs font-semibold bg-transparent focus:outline-none border-b border-stone-100 focus:border-gold-high" />
                <input
                  value={promptDraft[r.id] ?? ""}
                  onChange={(e) => setPromptDraft({ ...promptDraft, [r.id]: e.target.value })}
                  placeholder="Prompt (opcional)"
                  className="w-full text-[10px] bg-stone-50 border border-stone-200 px-1.5 py-1 focus:outline-none"
                />
                <div className="flex items-center gap-1">
                  <button onClick={() => generate(r)} disabled={busyId === r.id} className="flex-1 bg-stone-950 text-white text-[9px] uppercase tracking-widest font-bold py-1.5 px-2 flex items-center justify-center gap-1 hover:bg-stone-800 disabled:opacity-50">
                    {busyId === r.id ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />} Gerar
                  </button>
                  <label className="flex-1 border border-stone-300 text-[9px] uppercase tracking-widest font-bold py-1.5 px-2 text-center cursor-pointer hover:bg-stone-50">
                    {uploading === r.id ? "..." : "Upload"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(r, e.target.files[0])} />
                  </label>
                  <button onClick={() => del(r.id)} className="text-stone-300 hover:text-red-600 p-1">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full text-center py-12 text-sm text-stone-400">Nenhum objeto cadastrado</div>}
      </div>
    </div>
  );
}

const inp = "w-full bg-white border border-stone-200 p-2 text-sm focus:outline-none focus:border-gold-high";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="label-eyebrow">{label}</label>{children}</div>;
}
