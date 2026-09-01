import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Paperclip, Trash2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  receiptPath: string | null;
  /** Logical bucket folder for this entity. */
  scope: "commissions" | "payables" | "receivables";
  entityId: string;
  onChange: (path: string | null) => Promise<void> | void;
};

export function ReceiptUpload({ receiptPath, scope, entityId, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("Sessão expirada"); return; }
      const ext = file.name.split(".").pop() || "bin";
      const path = `${u.user.id}/${scope}/${entityId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("comprovantes").upload(path, file, { upsert: true });
      if (error) { toast.error(error.message); return; }
      if (receiptPath && receiptPath !== path) {
        await supabase.storage.from("comprovantes").remove([receiptPath]);
      }
      await onChange(path);
      toast.success("Comprovante anexado");
    } finally { setBusy(false); }
  }

  async function open() {
    if (!receiptPath) return;
    const { data, error } = await supabase.storage.from("comprovantes").createSignedUrl(receiptPath, 60 * 10);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function remove() {
    if (!receiptPath) return;
    if (!confirm("Remover comprovante?")) return;
    setBusy(true);
    try {
      await supabase.storage.from("comprovantes").remove([receiptPath]);
      await onChange(null);
    } finally { setBusy(false); }
  }

  return (
    <div className="inline-flex items-center gap-1">
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
      {receiptPath ? (
        <>
          <button onClick={open} title="Ver comprovante" className="text-emerald-700 hover:text-emerald-900">
            <FileText className="size-4 inline" />
          </button>
          <button onClick={remove} title="Remover comprovante" className="text-stone-400 hover:text-red-600">
            <Trash2 className="size-4 inline" />
          </button>
        </>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={busy} title="Anexar comprovante"
          className="text-stone-400 hover:text-stone-950 disabled:opacity-50">
          {busy ? <Loader2 className="size-4 inline animate-spin" /> : <Paperclip className="size-4 inline" />}
        </button>
      )}
    </div>
  );
}
