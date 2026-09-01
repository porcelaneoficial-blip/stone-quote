/**
 * Anexos compactos do orçamento (PDF, imagens e planilhas).
 * Apenas apresentação + upload/remoção no bucket "order-files".
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Paperclip, Trash2, Upload, ExternalLink } from "lucide-react";

type QuoteAttachment = {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

const prettySize = (n?: number | null) =>
  !n ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export function QuoteAttachmentsPanel({ quoteId }: { quoteId: string }) {
  const [items, setItems] = useState<QuoteAttachment[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("quote_attachments")
      .select("id,name,storage_path,mime_type,size_bytes,created_at")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setItems((data ?? []) as QuoteAttachment[]);
  }, [quoteId]);

  useEffect(() => { load(); }, [load]);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setBusy(true);
    for (const f of files) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${u.user.id}/quotes/${quoteId}/${Date.now()}_${safe}`;
      const up = await supabase.storage.from("order-files").upload(path, f);
      if (up.error) { toast.error(up.error.message); continue; }
      await supabase.from("quote_attachments").insert({
        user_id: u.user.id, quote_id: quoteId, name: f.name,
        storage_path: path, mime_type: f.type, size_bytes: f.size,
      });
    }
    setBusy(false);
    e.target.value = "";
    toast.success("Anexos enviados");
    load();
  };

  const open = async (a: QuoteAttachment) => {
    const { data } = await supabase.storage.from("order-files").createSignedUrl(a.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const remove = async (a: QuoteAttachment) => {
    if (!confirm(`Remover o anexo "${a.name}"?`)) return;
    await supabase.storage.from("order-files").remove([a.storage_path]);
    await supabase.from("quote_attachments").delete().eq("id", a.id);
    load();
  };

  return (
    <div className="border border-stone-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500">
          <Paperclip className="size-3.5" /> Anexos {items.length > 0 && <span className="text-stone-400">({items.length})</span>}
        </div>
        <label className="px-3 py-1.5 text-[10px] font-bold border border-stone-300 uppercase tracking-tighter hover:bg-stone-100 cursor-pointer flex items-center gap-1.5">
          <Upload className="size-3" /> {busy ? "Enviando…" : "Adicionar"}
          <input type="file" multiple accept=".pdf,image/*,.xlsx,.xls,.csv" className="hidden" onChange={upload} disabled={busy} />
        </label>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-xs text-stone-400">Nenhum anexo. Envie plantas, fotos ou planilhas de referência.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
              <button onClick={() => open(a)} className="flex-1 text-left text-sm truncate hover:underline flex items-center gap-2">
                <ExternalLink className="size-3 text-stone-400 shrink-0" /> {a.name}
              </button>
              <span className="text-[10px] text-stone-400 tabular-nums">{prettySize(a.size_bytes)}</span>
              <button onClick={() => remove(a)} className="text-stone-400 hover:text-red-600 p-1" title="Remover">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
