/**
 * DOCUMENTOS TÉCNICOS DO AMBIENTE — geração, versionamento e arquivo.
 *
 * Cada ambiente tem seus próprios documentos (Ordem de Corte e Ordem de
 * Acabamento) e seu próprio histórico de versões. Versões já geradas são
 * somente leitura: guardam o snapshot do estado do ambiente naquele momento.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Scissors, Sparkles, Eye, Printer, FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { QuoteData, Environment, FinishType } from "@/lib/types";
import { buildTechDoc, techDocFileName, releaseStatusLabel, type TechDocKind, type TechDocSnapshot } from "@/lib/tech-doc";
import { useFinishLibrary } from "@/components/finish-picker";
import { currentUserName } from "@/lib/tech-release";

import { fmtDate } from "@/lib/format";

export type TechDocRecord = {
  id: string;
  env_id: string;
  env_name: string | null;
  kind: TechDocKind;
  version: number;
  status: string;
  responsible: string | null;
  created_by_name: string | null;
  created_at: string;
  snapshot: TechDocSnapshot;
};

export function TechDocsPanel(p: {
  orderId: string;
  orderNumber: number;
  orderDate?: string;
  data: QuoteData;
  finishTypes: FinishType[];
  /** Ambiente inicialmente selecionado. */
  initialEnvId?: string;
  currentUserName?: string;
  onPreview: (rec: TechDocRecord) => void;
}) {
  const envs = p.data.environments ?? [];
  const [envId, setEnvId] = useState(p.initialEnvId ?? envs[0]?.id ?? "");
  const env: Environment | undefined = envs.find((e) => e.id === envId) ?? envs[0];
  const [docs, setDocs] = useState<TechDocRecord[]>([]);
  const [busy, setBusy] = useState<TechDocKind | null>(null);
  const { finishes: library } = useFinishLibrary();
  const [noteRates, setNoteRates] = useState({ corte: 0, acabamento: 0 });

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("remuneration_params")
        .select("note_cut_m2, note_finish_m2")
        .eq("user_id", uid)
        .maybeSingle();
      if (data) setNoteRates({
        corte: Number((data as { note_cut_m2?: number }).note_cut_m2) || 0,
        acabamento: Number((data as { note_finish_m2?: number }).note_finish_m2) || 0,
      });
    })();
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("tech_documents")
      .select("id, env_id, env_name, kind, version, status, responsible, created_by_name, created_at, snapshot")
      .eq("order_id", p.orderId)
      .order("version", { ascending: false });
    if (error) return;
    setDocs((data ?? []) as unknown as TechDocRecord[]);
  }, [p.orderId]);

  useEffect(() => { void load(); }, [load]);

  const envDocs = useMemo(
    () => docs.filter((d) => d.env_id === env?.id),
    [docs, env?.id],
  );

  const generate = async (kind: TechDocKind) => {
    if (!env) return;
    setBusy(kind);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("sessão expirada");

      const snap = buildTechDoc({
        kind,
        orderId: p.orderId,
        orderNumber: p.orderNumber,
        orderDate: p.orderDate,
        data: p.data,
        env,
        finishTypes: p.finishTypes,
        library,
        noteRate: noteRates[kind],
      });

      const last = docs.filter((d) => d.env_id === env.id && d.kind === kind)[0]?.version ?? 0;
      const version = last + 1;

      const { error } = await supabase.from("tech_documents").insert({
        user_id: uid,
        order_id: p.orderId,
        order_number: p.orderNumber,
        env_id: env.id,
        env_name: snap.env_name,
        kind,
        version,
        status: releaseStatusLabel(env) ?? "GERADA",
        responsible: env.tech_responsible ?? null,
        created_by_name: p.currentUserName ?? (await currentUserName()) ?? null,
        snapshot: JSON.parse(JSON.stringify(snap)),
      });
      if (error) throw error;
      toast.success(`${kind === "corte" ? "Ordem de Corte" : "Ordem de Acabamento"} V${version} gerada.`);
      await load();
    } catch (e) {
      toast.error(`Não foi possível gerar o documento: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const printDoc = (rec: TechDocRecord) => {
    p.onPreview(rec);
    setTimeout(() => {
      const prev = document.title;
      document.title = techDocFileName(rec.snapshot, rec.version);
      window.print();
      setTimeout(() => { document.title = prev; }, 500);
    }, 300);
  };

  if (!env) return <p className="text-sm text-stone-500">Este pedido não possui ambientes.</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        {envs.map((e) => {
          const on = e.id === env.id;
          return (
            <button key={e.id} onClick={() => setEnvId(e.id)}
              className={`px-4 py-2 text-xs uppercase tracking-widest font-bold border ${on ? "bg-stone-950 text-white border-stone-950" : "bg-white border-stone-200 text-stone-600"}`}>
              {e.tech_name || e.name}
            </button>
          );
        })}
      </div>

      <section className="bg-white border border-stone-200 p-5">
        <h4 className="label-eyebrow mb-3">Documentos técnicos · {env.tech_name || env.name}</h4>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy === "corte"} onClick={() => generate("corte")}
            className="bg-stone-950 text-white px-4 py-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 disabled:opacity-50">
            {busy === "corte" ? <Loader2 className="size-3 animate-spin" /> : <Scissors className="size-3" />} Gerar Ordem de Corte
          </button>
          <button disabled={busy === "acabamento"} onClick={() => generate("acabamento")}
            className="bg-stone-950 text-white px-4 py-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 disabled:opacity-50">
            {busy === "acabamento" ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />} Gerar Ordem de Acabamento
          </button>
        </div>
        <p className="text-[11px] text-stone-500 mt-2">
          Cada geração cria uma nova versão somente leitura com os dados atuais deste ambiente.
        </p>
      </section>

      {(["corte", "acabamento"] as TechDocKind[]).map((kind) => {
        const list = envDocs.filter((d) => d.kind === kind);
        return (
          <section key={kind} className="bg-white border border-stone-200 p-5">
            <h4 className="label-eyebrow mb-3">
              {kind === "corte" ? "Ordem de corte — versões" : "Ordem de acabamento — versões"}
            </h4>
            {!list.length ? (
              <p className="text-sm text-stone-500">Nenhuma versão gerada.</p>
            ) : (
              <ul className="divide-y divide-stone-200">
                {list.map((d) => (
                  <li key={d.id} className="py-2 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">V{d.version} — {fmtDate(d.created_at)} — {d.status}</p>
                      <p className="text-xs text-stone-500">
                        {new Date(d.created_at).toLocaleTimeString("pt-BR", { timeZone: "America/Recife", hour: "2-digit", minute: "2-digit" })}
                        {d.responsible ? ` · Responsável: ${d.responsible}` : ""}
                        {d.created_by_name ? ` · Gerado por ${d.created_by_name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => p.onPreview(d)} className="kanban-btn flex items-center gap-1"><Eye className="size-3" /> Pré-visualizar</button>
                      <button onClick={() => printDoc(d)} className="kanban-btn flex items-center gap-1"><Printer className="size-3" /> Imprimir</button>
                      <button onClick={() => printDoc(d)} className="kanban-btn flex items-center gap-1"><FileDown className="size-3" /> PDF</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
