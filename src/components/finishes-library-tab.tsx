/**
 * BIBLIOTECA DE ACABAMENTOS — galeria visual dos acabamentos já existentes.
 * Aba dentro de Configurações → Biblioteca. Nada aqui altera pedidos.
 * Camada aditiva: imagens, vistas técnicas e medidas manuais.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Loader2, Sparkles, X, ImagePlus, Search, ArrowLeft } from "lucide-react";
import { FinishDrawing } from "@/components/finish-drawing";
import {
  CATEGORIES, SEED_FINISHES, TEMPLATE_LABEL, TEMPLATE_PARAMS,
  defaultParams, resolveParams, needsSectionCut,
  type FinishTemplate, type LibraryFinish,
} from "@/lib/finish-library";
import {
  MEASURE_PRESETS, MEASURE_UNITS, VIEW_TYPE_LABEL, suggestNameFromFile,
  uploadFinishImage, useSignedFinishUrls,
  type FinishMeasure, type FinishView, type FinishViewType,
} from "@/lib/finish-media";

const inp = "w-full border border-stone-200 px-2 py-2 text-sm bg-white focus:outline-none focus:border-gold-high";
const btn = "text-[11px] uppercase tracking-wider font-bold border border-stone-200 px-3 py-2 flex items-center gap-2 hover:bg-stone-50 disabled:opacity-50";

export function FinishesTab() {
  const [rows, setRows] = useState<LibraryFinish[]>([]);
  const [cat, setCat] = useState<string>("todas");
  const [q, setQ] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [novo, setNovo] = useState({ name: "", category: CATEGORIES[0] as string, subcategory: "", code: "", template: "corte_borda" as FinishTemplate });
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const { data, error } = await (supabase as any).from("library_finishes").select("*").order("category").order("name");
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as LibraryFinish[]);
  };
  useEffect(() => { reload(); }, []);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) =>
      (cat === "todas" || r.category === cat) &&
      (!term || `${r.name} ${r.code ?? ""} ${r.subcategory ?? ""} ${r.manufacturer ?? ""}`.toLowerCase().includes(term)),
    );
  }, [rows, cat, q]);

  const getUrl = useSignedFinishUrls(rows.map((r) => r.image_url));

  const add = async () => {
    if (!novo.name.trim()) { toast.error("Informe o nome do acabamento"); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await (supabase as any).from("library_finishes").insert({
      user_id: u.user.id,
      name: novo.name.trim(), category: novo.category,
      subcategory: novo.subcategory || null, code: novo.code || null,
      template: novo.template, params: defaultParams(novo.template),
    });
    if (error) { toast.error(error.message); return; }
    setNovo({ ...novo, name: "", subcategory: "", code: "" });
    reload();
  };

  /** Importação em massa: cada imagem vira um acabamento com nome sugerido pelo arquivo. */
  const importImages = async (files: FileList) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error("Sessão necessária para importar"); return; }
    setImporting(true);
    let ok = 0;
    try {
      for (const file of Array.from(files)) {
        try {
          const path = await uploadFinishImage(file, u.user.id);
          const { error } = await (supabase as any).from("library_finishes").insert({
            user_id: u.user.id,
            name: suggestNameFromFile(file.name),
            category: cat === "todas" ? CATEGORIES[0] : cat,
            template: "corte_borda",
            params: defaultParams("corte_borda"),
            image_url: path,
          });
          if (error) throw error;
          ok++;
        } catch (e: any) { toast.error(`${file.name}: ${e.message ?? e}`); }
      }
      if (ok) toast.success(`${ok} imagem(ns) importada(s) — revise nome, categoria e medidas`);
      reload();
    } finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  /** Cadastro em lote do catálogo padrão — só o que ainda não existe. */
  const seed = async () => {
    setSeeding(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const have = new Set(rows.map((r) => `${r.category}|${r.name}`));
      const missing = SEED_FINISHES.filter((s) => !have.has(`${s.category}|${s.name}`));
      if (missing.length === 0) { toast.info("Catálogo padrão já cadastrado"); return; }
      const { data: inserted, error } = await (supabase as any).from("library_finishes").insert(
        missing.map((s) => ({
          user_id: u.user!.id, category: s.category, subcategory: s.subcategory,
          code: s.code, name: s.name, template: s.template,
          params: { ...defaultParams(s.template), ...(s.params ?? {}) },
          description: s.description ?? null,
        })),
      ).select("id, code");
      if (error) { toast.error(error.message); return; }
      // Rebaixo italiano / cuba esculpida já nasce com as duas vistas técnicas.
      const italiano = (inserted ?? []).find((r: any) => r.code === "CUB-06");
      if (italiano) {
        await (supabase as any).from("library_finish_views").insert([
          { user_id: u.user!.id, finish_id: italiano.id, view_type: "superior", title: "Vista 01 — superior", position: 1 },
          { user_id: u.user!.id, finish_id: italiano.id, view_type: "corte", title: "Vista 02 — corte lateral", position: 2 },
        ]);
      }
      toast.success(`${missing.length} acabamentos cadastrados`);
      reload();
    } finally { setSeeding(false); }
  };

  const open = rows.find((r) => r.id === openId) ?? null;
  if (open) {
    return (
      <FinishDetail
        row={open}
        onBack={() => setOpenId(null)}
        onReload={reload}
        onLocal={(patch) => setRows((rs) => rs.map((x) => x.id === open.id ? { ...x, ...patch } : x))}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-stone-200 p-4 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <L label="Nome"><input value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} className={inp} placeholder="ex.: Cuba esculpida" /></L>
        <L label="Categoria">
          <select value={novo.category} onChange={(e) => setNovo({ ...novo, category: e.target.value })} className={inp}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </L>
        <L label="Subcategoria"><input value={novo.subcategory} onChange={(e) => setNovo({ ...novo, subcategory: e.target.value })} className={inp} /></L>
        <L label="Código interno"><input value={novo.code} onChange={(e) => setNovo({ ...novo, code: e.target.value })} className={inp} placeholder="RBX-01" /></L>
        <L label="Desenho técnico">
          <select value={novo.template} onChange={(e) => setNovo({ ...novo, template: e.target.value as FinishTemplate })} className={inp}>
            {Object.entries(TEMPLATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </L>
        <button onClick={add} className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-3 px-4 flex items-center justify-center gap-1 hover:bg-stone-800">
          <Plus className="size-3" /> Adicionar
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="size-3 absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar acabamento"
            className="border border-stone-200 pl-7 pr-3 py-2 text-xs bg-white w-56 focus:outline-none focus:border-gold-high" />
        </div>
        <span className="text-xs text-stone-500">{list.length} acabamento(s)</span>

        <label className={`${btn} ml-auto cursor-pointer`}>
          {importing ? <Loader2 className="size-3 animate-spin" /> : <ImagePlus className="size-3" />} Importar imagens
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => e.target.files?.length && importImages(e.target.files)} />
        </label>
        <button onClick={seed} disabled={seeding} className={btn}>
          {seeding ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />} Cadastrar catálogo padrão
        </button>
      </div>

      {/* Categorias em abas — nenhum item deixa de existir, só fica mais fácil de achar */}
      <div className="flex items-center gap-1 flex-wrap border-b border-stone-200 pb-2">
        {["todas", ...CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={
              "px-3 py-1.5 text-xs border transition-colors " +
              (cat === c
                ? "bg-stone-950 text-white border-stone-950"
                : "bg-white border-stone-200 text-stone-600 hover:border-stone-400")
            }
          >
            {c === "todas" ? "Todas" : c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {list.map((r) => {
          const url = getUrl(r.image_url);
          return (
            <button key={r.id} onClick={() => setOpenId(r.id)}
              className="text-left bg-white border border-stone-200 hover:border-stone-900 transition-colors overflow-hidden">
              <div className="aspect-[4/3] bg-stone-50 flex items-center justify-center overflow-hidden">
                {url
                  ? <img src={url} alt={r.name} loading="lazy" className="w-full h-full object-cover" />
                  : <FinishDrawing template={r.template} params={resolveParams(r.template, r.params)} svg={r.drawing_svg}
                      title={r.code ?? r.name} callout={needsSectionCut(r.template) ? "A-A" : undefined} height={150} />}
              </div>
              <div className="p-3 space-y-1">
                <div className="text-sm font-semibold text-stone-900 leading-tight">{r.name}</div>
                <div className="text-[11px] text-stone-500">
                  {r.category}{r.subcategory ? ` · ${r.subcategory}` : ""}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-stone-400">
                  {r.code || "sem código"} · v{r.version}{r.active ? "" : " · inativo"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- DETALHE -------------------------------- */

function FinishDetail({ row, onBack, onReload, onLocal }: {
  row: LibraryFinish; onBack: () => void; onReload: () => void; onLocal: (p: Partial<LibraryFinish>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [views, setViews] = useState<FinishView[]>([]);
  const [measures, setMeasures] = useState<FinishMeasure[]>([]);
  const params = resolveParams(row.template, row.params);

  const loadChildren = async () => {
    const [v, m] = await Promise.all([
      (supabase as any).from("library_finish_views").select("*").eq("finish_id", row.id).order("position"),
      (supabase as any).from("library_finish_measures").select("*").eq("finish_id", row.id).order("position"),
    ]);
    setViews((v.data ?? []) as FinishView[]);
    setMeasures((m.data ?? []) as FinishMeasure[]);
  };
  useEffect(() => { loadChildren(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [row.id]);

  const getUrl = useSignedFinishUrls([row.image_url, ...views.map((v) => v.image_url)]);

  /** Toda alteração de desenho gera nova versão + snapshot (rastreabilidade). */
  const save = async (patch: Partial<LibraryFinish>, bumpVersion = false) => {
    const next = { ...patch } as Record<string, unknown>;
    if (bumpVersion) {
      next.version = row.version + 1;
      await (supabase as any).from("library_finish_versions").insert({
        user_id: row.user_id, finish_id: row.id, version: row.version,
        snapshot: { template: row.template, params: row.params, drawing_svg: row.drawing_svg, plan_svg: row.plan_svg, name: row.name },
      });
    }
    const { error } = await (supabase as any).from("library_finishes").update(next).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    onLocal(next as Partial<LibraryFinish>);
  };

  const setParam = (key: string, n: number) => save({ params: { ...(row.params ?? {}), [key]: n } }, true);

  const uploadCover = async (file: File) => {
    setUploading(true);
    try {
      const path = await uploadFinishImage(file, row.user_id as string);
      await save({ image_url: path });
      toast.success("Imagem principal atualizada");
    } catch (e: any) { toast.error(e.message ?? String(e)); }
    finally { setUploading(false); }
  };

  const uploadSvg = async (file: File) => {
    const text = await file.text();
    if (!text.includes("<svg")) { toast.error("Envie um arquivo SVG"); return; }
    await save({ drawing_svg: text }, true);
    toast.success("Desenho atualizado");
  };

  const del = async () => {
    if (!confirm(`Excluir "${row.name}"?`)) return;
    await (supabase as any).from("library_finishes").delete().eq("id", row.id);
    onBack(); onReload();
  };

  /* vistas */
  const addView = async () => {
    const { error } = await (supabase as any).from("library_finish_views").insert({
      user_id: row.user_id, finish_id: row.id,
      view_type: views.length === 0 ? "superior" : "corte",
      title: `Vista 0${views.length + 1}`, position: views.length + 1,
    });
    if (error) { toast.error(error.message); return; }
    loadChildren();
  };
  const saveView = async (id: string, patch: Partial<FinishView>) => {
    setViews((vs) => vs.map((v) => v.id === id ? { ...v, ...patch } : v));
    const { error } = await (supabase as any).from("library_finish_views").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };
  const uploadView = async (id: string, file: File) => {
    try {
      const path = await uploadFinishImage(file, row.user_id as string);
      await saveView(id, { image_url: path, storage_path: path });
    } catch (e: any) { toast.error(e.message ?? String(e)); }
  };
  const delView = async (id: string) => {
    await (supabase as any).from("library_finish_views").delete().eq("id", id);
    loadChildren();
  };

  /* medidas — sempre manuais */
  const addMeasure = async () => {
    const { error } = await (supabase as any).from("library_finish_measures").insert({
      user_id: row.user_id, finish_id: row.id, name: "", unit: "mm", position: measures.length + 1,
    });
    if (error) { toast.error(error.message); return; }
    loadChildren();
  };
  const saveMeasure = async (id: string, patch: Partial<FinishMeasure>) => {
    setMeasures((ms) => ms.map((m) => m.id === id ? { ...m, ...patch } : m));
    const { error } = await (supabase as any).from("library_finish_measures").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  };
  const delMeasure = async (id: string) => {
    await (supabase as any).from("library_finish_measures").delete().eq("id", id);
    loadChildren();
  };

  const cover = getUrl(row.image_url);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className={btn}><ArrowLeft className="size-3" /> Voltar</button>
        <button onClick={() => save({ active: !row.active })}
          className={`text-[10px] uppercase tracking-wider font-bold px-3 py-2 border ${row.active ? "border-stone-900" : "border-stone-200 text-stone-400"}`}>
          {row.active ? "Ativo" : "Inativo"}
        </button>
        <button onClick={del} className="ml-auto text-stone-400 hover:text-red-600"><Trash2 className="size-4" /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* identificação */}
        <div className="bg-white border border-stone-200 p-4 space-y-3">
          <L label="Nome do acabamento">
            <input defaultValue={row.name} onBlur={(e) => save({ name: e.target.value })} className={inp} />
          </L>
          <div className="grid grid-cols-2 gap-2">
            <L label="Categoria">
              <select defaultValue={row.category} onChange={(e) => save({ category: e.target.value })} className={inp}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </L>
            <L label="Subcategoria / tipo">
              <input defaultValue={row.subcategory ?? ""} onBlur={(e) => save({ subcategory: e.target.value })} className={inp} />
            </L>
            <L label="Código interno">
              <input defaultValue={row.code ?? ""} onBlur={(e) => save({ code: e.target.value })} className={inp} />
            </L>
            <L label="Fabricante / origem">
              <input defaultValue={row.manufacturer ?? ""} onBlur={(e) => save({ manufacturer: e.target.value } as Partial<LibraryFinish>)} className={inp} />
            </L>
          </div>
          <L label="Descrição técnica">
            <textarea rows={3} defaultValue={row.description ?? ""} onBlur={(e) => save({ description: e.target.value })}
              className="w-full text-xs border border-stone-200 p-2 focus:outline-none focus:border-gold-high" />
          </L>
          <L label="Observações">
            <textarea rows={2} defaultValue={row.notes ?? ""} onBlur={(e) => save({ notes: e.target.value })}
              className="w-full text-xs border border-stone-200 p-2 focus:outline-none focus:border-gold-high" />
          </L>
        </div>

        {/* imagem principal */}
        <div className="bg-white border border-stone-200">
          <div className="px-4 py-3 border-b border-stone-200 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-stone-500">Imagem principal</span>
            <label className="ml-auto text-stone-400 hover:text-stone-900 cursor-pointer" title="Enviar imagem">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
            </label>
            {row.image_url && (
              <button onClick={() => save({ image_url: null })} className="text-stone-300 hover:text-red-600"><X className="size-4" /></button>
            )}
          </div>
          <div className="aspect-[4/3] bg-stone-50 flex items-center justify-center overflow-hidden">
            {cover
              ? <img src={cover} alt={row.name} className="w-full h-full object-contain" />
              : <FinishDrawing template={row.template} params={params} svg={row.drawing_svg}
                  title={row.code ?? row.name} callout={needsSectionCut(row.template) ? "A-A" : undefined} />}
          </div>
        </div>
      </div>

      {/* vistas técnicas */}
      <div className="bg-white border border-stone-200">
        <div className="px-4 py-3 border-b border-stone-200 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-stone-500">Vistas técnicas</span>
          <span className="text-[11px] text-stone-400">mínimo recomendado: vista superior + corte</span>
          <button onClick={addView} className={`${btn} ml-auto`}><Plus className="size-3" /> Nova vista</button>
        </div>
        {views.length === 0 ? (
          <p className="p-4 text-xs text-stone-500">Nenhuma vista cadastrada.</p>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {views.map((v) => {
              const url = getUrl(v.image_url);
              return (
                <div key={v.id} className="border border-stone-200">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-200">
                    <input defaultValue={v.title ?? ""} onBlur={(e) => saveView(v.id, { title: e.target.value })}
                      placeholder="Título da vista" className="flex-1 text-xs bg-transparent focus:outline-none" />
                    <select value={v.view_type} onChange={(e) => saveView(v.id, { view_type: e.target.value as FinishViewType })}
                      className="text-[11px] border border-stone-200 px-1 py-1 bg-white">
                      {Object.entries(VIEW_TYPE_LABEL).map(([k, lab]) => <option key={k} value={k}>{lab}</option>)}
                    </select>
                    <label className="text-stone-400 hover:text-stone-900 cursor-pointer" title="Enviar imagem da vista">
                      <Upload className="size-4" />
                      <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadView(v.id, e.target.files[0])} />
                    </label>
                    <button onClick={() => delView(v.id)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-4" /></button>
                  </div>
                  <div className="aspect-[4/3] bg-stone-50 flex items-center justify-center overflow-hidden">
                    {url
                      ? <img src={url} alt={v.title ?? "vista"} className="w-full h-full object-contain" />
                      : <FinishDrawing template={row.template} params={params} svg={v.view_type === "superior" ? row.plan_svg : row.drawing_svg}
                          title={v.title ?? VIEW_TYPE_LABEL[v.view_type]} callout={v.view_type === "corte" ? "A-A" : undefined} height={190} />}
                  </div>
                  <input defaultValue={v.notes ?? ""} onBlur={(e) => saveView(v.id, { notes: e.target.value })}
                    placeholder="Observação da vista" className="w-full text-[11px] px-3 py-2 border-t border-stone-200 focus:outline-none" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* medidas manuais */}
      <div className="bg-white border border-stone-200">
        <div className="px-4 py-3 border-b border-stone-200 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-stone-500">Medidas técnicas (preenchimento manual)</span>
          <button onClick={addMeasure} className={`${btn} ml-auto`}><Plus className="size-3" /> Nova medida</button>
        </div>
        {measures.length === 0 ? (
          <p className="p-4 text-xs text-stone-500">Nenhuma medida cadastrada. Nenhuma medida é calculada automaticamente.</p>
        ) : (
          <div className="p-4 space-y-2">
            <datalist id="medida-presets">{MEASURE_PRESETS.map((m) => <option key={m} value={m} />)}</datalist>
            {measures.map((m) => (
              <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                <input list="medida-presets" defaultValue={m.name} onBlur={(e) => saveMeasure(m.id, { name: e.target.value })}
                  placeholder="Medida" className="col-span-4 border border-stone-200 px-2 py-1.5 text-xs" />
                <input type="number" step="any" defaultValue={m.value ?? ""} onBlur={(e) => saveMeasure(m.id, { value: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder="Valor" className="col-span-2 border border-stone-200 px-2 py-1.5 text-xs text-right font-mono" />
                <select value={m.unit} onChange={(e) => saveMeasure(m.id, { unit: e.target.value })}
                  className="col-span-2 border border-stone-200 px-2 py-1.5 text-xs bg-white">
                  {MEASURE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <input defaultValue={m.notes ?? ""} onBlur={(e) => saveMeasure(m.id, { notes: e.target.value })}
                  placeholder="Observação" className="col-span-3 border border-stone-200 px-2 py-1.5 text-xs" />
                <button onClick={() => delMeasure(m.id)} className="col-span-1 text-stone-300 hover:text-red-600 justify-self-end"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* parâmetros do desenho paramétrico (opcional) */}
      <div className="bg-white border border-stone-200">
        <div className="px-4 py-3 border-b border-stone-200 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-stone-500">Desenho paramétrico — {TEMPLATE_LABEL[row.template]}</span>
          <label className={`${btn} ml-auto cursor-pointer`}>
            <Upload className="size-3" /> Enviar SVG próprio
            <input type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => e.target.files?.[0] && uploadSvg(e.target.files[0])} />
          </label>
        </div>
        {(TEMPLATE_PARAMS[row.template] ?? []).length > 0 && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {TEMPLATE_PARAMS[row.template].map((pd) => (
              <label key={pd.key} className="text-[11px]">
                <span className="block text-stone-500">{pd.label} ({pd.unit})</span>
                <input type="number" defaultValue={params[pd.key]} onBlur={(e) => setParam(pd.key, parseFloat(e.target.value) || 0)}
                  className="w-full border border-stone-200 px-2 py-1 text-right font-mono" />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">{label}</div>
      {children}
    </div>
  );
}
