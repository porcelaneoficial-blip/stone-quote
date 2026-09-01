import type { QuoteData } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { envLabel, envMaterial } from "@/lib/order-view";
import { EmptyState, Panel, SectionHeader } from "@/components/ui-kit";
import { FileText, Truck, FileIcon, Scissors, Ruler, Download, Trash2 } from "lucide-react";

type Attachment = {
  id: string; kind: string; name: string; storage_path: string; mime_type: string | null; created_at: string;
};

/**
 * Aba Documentos — ÚNICA porta de entrada para gerar/visualizar documentos.
 * Cada documento tem exatamente um caminho: nada de quatro atalhos para a
 * mesma Ordem de Corte. Ordens técnicas (corte/acabamento) e suas versões
 * abrem sempre pelo painel de documentos técnicos do ambiente.
 */
export function OrderDocumentsPanel(p: {
  data: QuoteData;
  attachments: Attachment[];
  onOpenDoc: (doc: "pedido" | "romaneio" | "ficha" | "tecnica" | "docs_tec") => void;
  /** Abre o painel de ordens técnicas já posicionado no ambiente. */
  onOpenTechDocs: (envId: string) => void;
  onOpen: (a: Attachment) => void;
  onRemove: (a: Attachment) => void;
}) {
  const envs = p.data.environments ?? [];
  return (
    <div className="space-y-4">
      <Panel>
        <SectionHeader eyebrow="Documentos" title="Documentos comerciais" hint="Abrem em modo de visualização e impressão." />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => p.onOpenDoc("pedido")} className="kanban-btn flex items-center gap-1"><FileText className="size-3" /> Pedido</button>
          <button onClick={() => p.onOpenDoc("romaneio")} className="kanban-btn flex items-center gap-1"><Truck className="size-3" /> Romaneio</button>
          <button onClick={() => p.onOpenDoc("ficha")} className="kanban-btn flex items-center gap-1"><FileIcon className="size-3" /> Ficha interna</button>
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          eyebrow="Por ambiente"
          title="Documentos técnicos"
          hint="Ordem de corte, ordem de acabamento, liberação técnica e versões."
          actions={
            <button onClick={() => p.onOpenDoc("docs_tec")} className="kanban-btn flex items-center gap-1">
              <Scissors className="size-3" /> Todas as ordens
            </button>
          }
        />
        <ul className="divide-y divide-stone-100">
          {envs.map((env) => (
            <li key={env.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm truncate">{envLabel(env)} <span className="text-stone-400">· {envMaterial(env)}</span></p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {env.released_for_cut_at ? `Liberado · V${env.tech_revision ?? 1}` : "Ainda não liberado"}
                </p>
              </div>
              <button onClick={() => p.onOpenTechDocs(env.id)} className="kanban-btn flex items-center gap-1 shrink-0">
                <Ruler className="size-3" /> Ordens e versões
              </button>
            </li>
          ))}
          {!envs.length && <li><EmptyState>Sem ambientes.</EmptyState></li>}
        </ul>
      </Panel>

      <Panel>
        <SectionHeader eyebrow="Anexos" title="Arquivos anexados" />
        {!p.attachments.length ? (
          <EmptyState>Nenhum arquivo anexado.</EmptyState>
        ) : (
          <ul className="divide-y divide-stone-100">
            {p.attachments.map((a) => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">{a.name}</p>
                  <p className="text-xs text-stone-400">{a.kind} · {fmtDate(a.created_at)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => p.onOpen(a)} className="text-stone-400 hover:text-stone-950" title="Abrir"><Download className="size-4" /></button>
                  <button onClick={() => p.onRemove(a)} className="text-stone-400 hover:text-destructive" title="Remover"><Trash2 className="size-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
