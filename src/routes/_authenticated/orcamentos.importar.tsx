import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extractQuoteFromPdf, type ExtractedQuote } from "@/lib/pdf-import.functions";
import { isSheetFile as isSheet, isPdfFile, pdfToText, sheetToText, parseQuoteFromText } from "@/lib/local-extract";
import { emptyQuoteData, type QuoteData, type Environment, type EnvItem, type ServiceLine } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileText, Loader2, Save, Plus, Trash2, X, Image as ImageIcon, Table2 } from "lucide-react";

const ACCEPTED =
  "application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/heic,.xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain";

const MAX_FILES = 20;
const MAX_TOTAL_MB = 30;
const MAX_TEXT = 60000;


export const Route = createFileRoute("/_authenticated/orcamentos/importar")({
  component: ImportarPdf,
});

function ImportarPdf() {
  const navigate = useNavigate();
  const extract = useServerFn(extractQuoteFromPdf);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [extracted, setExtracted] = useState<ExtractedQuote | null>(null);
  const [pdfStoragePath, setPdfStoragePath] = useState<string | null>(null);
  const [quoteType, setQuoteType] = useState<"convencional" | "mfc" | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [engine, setEngine] = useState<"local" | "ia">("local");

  const fileToBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const result = r.result as string;
        resolve(result.split(",")[1] ?? "");
      };
      r.onerror = () => reject(new Error("Falha ao ler arquivo"));
      r.readAsDataURL(f);
    });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const valid = incoming.filter(
      (f) => /^(application\/pdf|image\/(jpeg|jpg|png|webp|heic)|text\/plain)$/.test(f.type) || isSheet(f) || isPdfFile(f) || /\.txt$/i.test(f.name),
    );

    if (valid.length !== incoming.length) toast.error("Alguns arquivos foram ignorados (formato não suportado).");
    setFiles((prev) => {
      const next = [...prev, ...valid];
      if (next.length > MAX_FILES) toast.error(`Máximo de ${MAX_FILES} arquivos por importação.`);
      return next.slice(0, MAX_FILES);
    });
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const onUpload = async () => {
    const hasText = pastedText.trim().length > 0;
    if (files.length === 0 && !hasText) return;
    if (!quoteType) {
      toast.error("Selecione o tipo de orçamento (Comum ou MFC).");
      return;
    }
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    if (totalSize > MAX_TOTAL_MB * 1024 * 1024) {
      toast.error(`Arquivos muito grandes (máximo ${MAX_TOTAL_MB}MB no total).`);
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");

      const firstPdf = files.find((f) => f.type === "application/pdf");
      if (firstPdf) {
        const path = `${u.user.id}/${crypto.randomUUID()}.pdf`;
        const up = await supabase.storage.from("imported-pdfs").upload(path, firstPdf, {
          contentType: "application/pdf",
          upsert: false,
        });
        if (up.error) throw up.error;
        setPdfStoragePath(path);
      }

      const sheetFiles = files.filter(isSheet);
      const txtFiles = files.filter((f) => /\.txt$/i.test(f.name) || f.type === "text/plain");
      const pdfFiles = files.filter(isPdfFile);
      const mediaFiles = files.filter((f) => !isSheet(f) && !isPdfFile(f) && !txtFiles.includes(f));

      const sheetTexts = await Promise.all(sheetFiles.map(sheetToText));
      const plainTexts = await Promise.all(txtFiles.map((f) => f.text()));

      if (engine === "local") {
        const pdfTexts: string[] = [];
        for (const f of pdfFiles) {
          try {
            pdfTexts.push(await pdfToText(f));
          } catch {
            toast.error(`Não consegui ler o texto de ${f.name}.`);
          }
        }
        const localText = [pastedText.trim(), ...pdfTexts, ...sheetTexts, ...plainTexts].filter(Boolean).join("\n\n");
        if (!localText.trim()) {
          throw new Error(
            "Nada legível encontrado. PDFs escaneados e fotos só podem ser lidos no modo IA — ou cole o texto/planilha.",
          );
        }
        if (mediaFiles.length) toast.warning("Imagens são ignoradas na leitura local (sem créditos).");
        const local = parseQuoteFromText(localText);
        setExtracted(local);
        setStep("review");
        toast.success("Leitura local concluída (sem créditos). Revise e ajuste os dados.");
        return;
      }

      const payload = await Promise.all(
        [...mediaFiles, ...pdfFiles].map(async (f) => ({
          base64: await fileToBase64(f),
          mime: f.type || "application/pdf",
          filename: f.name,
        })),
      );

      let combinedText = [pastedText.trim(), ...sheetTexts, ...plainTexts].filter(Boolean).join("\n\n");
      if (combinedText.length > MAX_TEXT) {
        combinedText = combinedText.slice(0, MAX_TEXT);
        toast.warning("Conteúdo muito extenso — parte final das planilhas foi cortada.");
      }

      const result = await extract({ data: { files: payload, text: combinedText, quote_type: quoteType ?? "convencional" } });
      setExtracted(result);
      setStep("review");
      toast.success("Dados extraídos. Revise antes de salvar.");

    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!extracted) return;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");

      const base: QuoteData = emptyQuoteData();
      const quoteData: QuoteData = {
        ...base,
        client_name: extracted.client_name || "",
        client_phone: extracted.client_phone || "",
        address: extracted.address || "",
        city: extracted.city || "",
        salesperson: extracted.salesperson || "",
        architect: extracted.architect || "",
        notes: [extracted.notes, extracted.payment_text ? `Pagamento: ${extracted.payment_text}` : ""].filter(Boolean).join("\n\n"),
        environments: extracted.environments.map<Environment>((e) => ({
          id: crypto.randomUUID(),
          name: e.name || "Ambiente",
          material_name: [e.material_name, e.color].filter(Boolean).join(" · "),
          material_price_m2: 0,
          show_mc: false,
          items: e.items.length
            ? e.items.map<EnvItem>((it) => ({
                id: crypto.randomUUID(),
                description: it.description || "",
                qty: it.qty || 1,
                length: it.length_m || 0,
                width: it.width_m || 0,
                has_emenda: false,
              }))
            : [{ id: crypto.randomUUID(), description: "", qty: 1, length: 0, width: 0, has_emenda: false }],
          services: e.services.map<ServiceLine>((s) => ({
            id: crypto.randomUUID(),
            description: s.description || "",
            qty: s.qty || 1,
            unit_value: s.unit_value || 0,
          })),
          supplies: (e.supplies ?? []).map((s) => ({
            id: crypto.randomUUID(),
            description: s.description || "",
            qty: s.qty || 1,
            unit_value: s.unit_value || 0,
          })),
        })),
        imported_pdf_path: pdfStoragePath || undefined,
      };

      const { data, error } = await supabase
        .from("quotes")
        .insert({
          user_id: u.user.id,
          number: 0,
          type: quoteType ?? "convencional",
          client_name: quoteData.client_name,
          total: extracted.total || 0,
          data: quoteData as never,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Orçamento criado!");
      navigate({ to: "/orcamentos/$id", params: { id: data.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-6">
        <Link to="/orcamentos" className="text-sm text-stone-500 hover:text-stone-950 inline-flex items-center gap-1">
          <ArrowLeft className="size-4" /> Voltar para Orçamentos
        </Link>
        <h1 className="font-display text-4xl mt-2">Importar Orçamento</h1>
        <p className="text-sm text-stone-500 mt-1">Envie PDF, planilha (Excel/CSV), TXT ou fotos — a leitura local não consome créditos; a IA fica opcional.</p>
      </div>

      {step === "upload" && (
        <div className="bg-white border border-stone-200 p-10">
          <div className="mb-8 max-w-md mx-auto">
            <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-2">Modo de leitura</p>
            <div className="grid grid-cols-2 gap-2 mb-8">
              <button
                type="button"
                onClick={() => setEngine("local")}
                className={`border px-4 py-3 text-sm text-left transition ${
                  engine === "local" ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 hover:border-stone-500"
                }`}
              >
                <div className="font-semibold">Leitura local · grátis</div>
                <div className={`text-xs mt-0.5 ${engine === "local" ? "text-stone-300" : "text-stone-500"}`}>PDF com texto, Excel, CSV, TXT e texto colado — sem créditos</div>
              </button>
              <button
                type="button"
                onClick={() => setEngine("ia")}
                className={`border px-4 py-3 text-sm text-left transition ${
                  engine === "ia" ? "border-stone-950 bg-stone-950 text-white" : "border-stone-300 hover:border-stone-500"
                }`}
              >
                <div className="font-semibold">Com IA</div>
                <div className={`text-xs mt-0.5 ${engine === "ia" ? "text-stone-300" : "text-stone-500"}`}>Fotos, PDFs escaneados e projetos técnicos (usa créditos)</div>
              </button>
            </div>

            <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-2">
              Tipo de orçamento <span className="text-red-600">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQuoteType("convencional")}
                className={`border px-4 py-3 text-sm text-left transition ${
                  quoteType === "convencional"
                    ? "border-stone-950 bg-stone-950 text-white"
                    : "border-stone-300 hover:border-stone-500"
                }`}
              >
                <div className="font-semibold">Orçamento Comum</div>
                <div className={`text-xs mt-0.5 ${quoteType === "convencional" ? "text-stone-300" : "text-stone-500"}`}>Material fornecido pela marmoraria</div>
              </button>
              <button
                type="button"
                onClick={() => setQuoteType("mfc")}
                className={`border px-4 py-3 text-sm text-left transition ${
                  quoteType === "mfc"
                    ? "border-stone-950 bg-stone-950 text-white"
                    : "border-stone-300 hover:border-stone-500"
                }`}
              >
                <div className="font-semibold">MFC</div>
                <div className={`text-xs mt-0.5 ${quoteType === "mfc" ? "text-stone-300" : "text-stone-500"}`}>Material fornecido pelo cliente</div>
              </button>
            </div>
            {!quoteType && (
              <p className="text-[11px] text-stone-400 mt-2">Selecione antes de importar — define as regras aplicadas pela IA.</p>
            )}
          </div>

          <div className="text-center">
            <FileText className="size-12 text-stone-300 mx-auto mb-4" />
            <div className="flex flex-wrap justify-center gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
                <Upload className="size-4" /> Selecionar arquivos
                <input type="file" accept={ACCEPTED} multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
                <ImageIcon className="size-4" /> Tirar foto
                <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
          </div>

          {files.length > 0 && (
            <>
            <p className="mt-4 text-center text-xs text-stone-500">{files.length} de {MAX_FILES} arquivos · {(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB</p>
            <ul className="mt-2 max-w-md mx-auto divide-y divide-stone-100 border border-stone-200">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                  {f.type.startsWith("image/") ? <ImageIcon className="size-4 text-stone-400" /> : isSheet(f) ? <Table2 className="size-4 text-stone-400" /> : <FileText className="size-4 text-stone-400" />}
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-stone-400">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} className="text-stone-300 hover:text-red-600"><X className="size-4" /></button>
                </li>
              ))}
            </ul>
            </>
          )}


          <div className="mt-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-[10px] uppercase tracking-widest text-stone-400">ou cole o texto</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>
            <label className="block text-[10px] uppercase tracking-widest text-stone-500 mb-1">
              Texto do WhatsApp / mensagem com medidas
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              rows={6}
              placeholder={"Cole aqui a mensagem, ex.:\nCliente João - Cozinha\nBancada 2,91 x 0,55 com testeira 0,20 e respaldo 0,31\n4 cubas, 1 cooktop\nGranito São Gabriel 20mm polido"}
              className="w-full border border-stone-300 p-3 text-sm font-mono focus:outline-none focus:border-stone-950"
            />
            <p className="text-[11px] text-stone-400 mt-1">A IA lê o texto e monta o orçamento (pode combinar com fotos/PDF).</p>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={onUpload}
              disabled={(files.length === 0 && !pastedText.trim()) || busy || !quoteType}
              className="bg-stone-950 text-white px-6 py-2.5 text-sm hover:bg-stone-800 disabled:opacity-40 inline-flex items-center gap-2"
            >
              {busy ? <><Loader2 className="size-4 animate-spin" /> Lendo…</> : <><Upload className="size-4" /> Enviar e Extrair</>}
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-4 text-center">Aceita PDF, Excel/CSV (XLSX, XLS, CSV), imagens (JPG/PNG/WEBP/HEIC) ou texto colado · até 10 arquivos · 18MB total</p>
        </div>
      )}

      {step === "review" && extracted && (
        <ReviewForm
          data={extracted}
          onChange={setExtracted}
          onSave={save}
          busy={busy}
        />
      )}
    </div>
  );
}

function ReviewForm({
  data,
  onChange,
  onSave,
  busy,
}: {
  data: ExtractedQuote;
  onChange: (d: ExtractedQuote) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const set = <K extends keyof ExtractedQuote>(k: K, v: ExtractedQuote[K]) => onChange({ ...data, [k]: v });
  const setEnv = (i: number, patch: Partial<ExtractedQuote["environments"][number]>) => {
    const envs = [...data.environments];
    envs[i] = { ...envs[i], ...patch };
    onChange({ ...data, environments: envs });
  };
  const addEnv = () => onChange({ ...data, environments: [...data.environments, { name: "Novo ambiente", material_name: "", color: "", items: [], services: [], supplies: [] }] });
  const delEnv = (i: number) => onChange({ ...data, environments: data.environments.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 p-6">
        <h2 className="label-eyebrow mb-4">Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Field label="Nome" value={data.client_name} onChange={(v) => set("client_name", v)} />
          <Field label="Telefone" value={data.client_phone} onChange={(v) => set("client_phone", v)} />
          <Field label="E-mail" value={data.client_email} onChange={(v) => set("client_email", v)} />
          <Field label="Cidade" value={data.city} onChange={(v) => set("city", v)} />
          <Field label="Endereço" value={data.address} onChange={(v) => set("address", v)} className="md:col-span-2" />
          <Field label="Vendedor" value={data.salesperson} onChange={(v) => set("salesperson", v)} />
          <Field label="Arquiteto" value={data.architect} onChange={(v) => set("architect", v)} />
        </div>
      </div>

      <div className="bg-white border border-stone-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="label-eyebrow">Ambientes</h2>
          <button onClick={addEnv} className="text-xs uppercase tracking-widest font-bold inline-flex items-center gap-1 hover:text-gold-low">
            <Plus className="size-3" /> Adicionar
          </button>
        </div>
        <div className="space-y-5">
          {data.environments.map((env, i) => (
            <div key={i} className="border border-stone-200 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
                  <Field label="Nome do ambiente" value={env.name} onChange={(v) => setEnv(i, { name: v })} />
                  <Field label="Material" value={env.material_name} onChange={(v) => setEnv(i, { material_name: v })} />
                  <Field label="Cor" value={env.color} onChange={(v) => setEnv(i, { color: v })} />
                </div>
                <button onClick={() => delEnv(i)} className="text-stone-300 hover:text-red-600 mt-5"><Trash2 className="size-4" /></button>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Peças / Medidas (m)</p>
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-stone-400">
                    <tr><th className="text-left">Descrição</th><th className="text-right w-16">Qtd</th><th className="text-right w-20">Compr.</th><th className="text-right w-20">Larg.</th><th className="w-8"></th></tr>
                  </thead>
                  <tbody>
                    {env.items.map((it, j) => (
                      <tr key={j} className="border-t border-stone-100">
                        <td><input className="w-full p-1 bg-transparent focus:outline-none" value={it.description} onChange={(e) => {
                          const items = [...env.items]; items[j] = { ...it, description: e.target.value }; setEnv(i, { items });
                        }} /></td>
                        <td><input type="number" className="w-full p-1 bg-transparent text-right focus:outline-none" value={it.qty} onChange={(e) => {
                          const items = [...env.items]; items[j] = { ...it, qty: Number(e.target.value) }; setEnv(i, { items });
                        }} /></td>
                        <td><input type="number" step="0.01" className="w-full p-1 bg-transparent text-right focus:outline-none" value={it.length_m} onChange={(e) => {
                          const items = [...env.items]; items[j] = { ...it, length_m: Number(e.target.value) }; setEnv(i, { items });
                        }} /></td>
                        <td><input type="number" step="0.01" className="w-full p-1 bg-transparent text-right focus:outline-none" value={it.width_m} onChange={(e) => {
                          const items = [...env.items]; items[j] = { ...it, width_m: Number(e.target.value) }; setEnv(i, { items });
                        }} /></td>
                        <td><button onClick={() => setEnv(i, { items: env.items.filter((_, idx) => idx !== j) })} className="text-stone-300 hover:text-red-600"><Trash2 className="size-3" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => setEnv(i, { items: [...env.items, { description: "", qty: 1, length_m: 0, width_m: 0 }] })}
                  className="text-[10px] uppercase tracking-widest text-stone-500 hover:text-stone-950 mt-1 inline-flex items-center gap-1">
                  <Plus className="size-3" /> peça
                </button>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-stone-400 mb-1">Serviços (cuba, cooktop, rebaixo, …)</p>
                <table className="w-full text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-stone-400">
                    <tr><th className="text-left">Descrição</th><th className="text-right w-16">Qtd</th><th className="text-right w-28">Valor (R$)</th><th className="w-8"></th></tr>
                  </thead>
                  <tbody>
                    {env.services.map((s, j) => (
                      <tr key={j} className="border-t border-stone-100">
                        <td><input className="w-full p-1 bg-transparent focus:outline-none" value={s.description} onChange={(e) => {
                          const services = [...env.services]; services[j] = { ...s, description: e.target.value }; setEnv(i, { services });
                        }} /></td>
                        <td><input type="number" className="w-full p-1 bg-transparent text-right focus:outline-none" value={s.qty} onChange={(e) => {
                          const services = [...env.services]; services[j] = { ...s, qty: Number(e.target.value) }; setEnv(i, { services });
                        }} /></td>
                        <td><input type="number" step="0.01" className="w-full p-1 bg-transparent text-right focus:outline-none" value={s.unit_value} onChange={(e) => {
                          const services = [...env.services]; services[j] = { ...s, unit_value: Number(e.target.value) }; setEnv(i, { services });
                        }} /></td>
                        <td><button onClick={() => setEnv(i, { services: env.services.filter((_, idx) => idx !== j) })} className="text-stone-300 hover:text-red-600"><Trash2 className="size-3" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => setEnv(i, { services: [...env.services, { description: "", qty: 1, unit_value: 0 }] })}
                  className="text-[10px] uppercase tracking-widest text-stone-500 hover:text-stone-950 mt-1 inline-flex items-center gap-1">
                  <Plus className="size-3" /> serviço
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-stone-200 p-6 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <Field label="Forma de pagamento" value={data.payment_text} onChange={(v) => set("payment_text", v)} className="md:col-span-2" />
        <Field label="Valor total (R$)" type="number" value={String(data.total)} onChange={(v) => set("total", Number(v) || 0)} />
        <Field label="Observações" value={data.notes} onChange={(v) => set("notes", v)} textarea className="md:col-span-2" />
      </div>

      <div className="flex justify-end gap-2">
        <Link to="/orcamentos" className="border border-stone-300 px-5 py-2.5 text-sm hover:bg-stone-50">Cancelar</Link>
        <button onClick={onSave} disabled={busy} className="bg-stone-950 text-white px-6 py-2.5 text-sm hover:bg-stone-800 disabled:opacity-40 inline-flex items-center gap-2">
          {busy ? <><Loader2 className="size-4 animate-spin" /> Salvando…</> : <><Save className="size-4" /> Salvar como Orçamento</>}
        </button>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", textarea = false, className = "",
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; textarea?: boolean; className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] uppercase tracking-widest text-stone-400">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)}
          className="border border-stone-300 px-2 py-1.5 text-sm bg-white min-h-[80px]" />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
          className="border border-stone-300 px-2 py-1.5 text-sm bg-white" />
      )}
    </label>
  );
}
