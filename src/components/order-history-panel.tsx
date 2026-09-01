import type { OrderRevision } from "@/lib/order-lock";
import type { TechLogRow } from "@/lib/tech-release";

type StatusRow = { status: string; created_at: string; notes: string | null };

type Entry = { at: string; kind: string; title: string; detail?: string; who?: string };

/** Aba Histórico — linha do tempo única (status, revisões e alterações técnicas). */
export function OrderHistoryPanel(p: {
  statusHistory: StatusRow[];
  revisions: OrderRevision[];
  techLogs: TechLogRow[];
}) {
  const entries: Entry[] = [
    ...p.statusHistory.map((h) => ({
      at: h.created_at, kind: "Status", title: h.status.replace(/_/g, " "), detail: h.notes ?? undefined,
    })),
    ...p.revisions.map((r) => ({
      at: r.created_at,
      kind: "Revisão",
      title: `V${r.seq} · ${r.kind}${r.status ? ` (${r.status})` : ""}`,
      detail: r.reason ?? ((r.changes ?? []).map((c: any) => `${c.label ?? c.field}: ${c.old_value ?? "—"} → ${c.new_value ?? "—"}`).join(" | ") || undefined),
      who: r.created_by_name ?? undefined,
    })),
    ...p.techLogs.map((l) => ({
      at: l.created_at, kind: "Técnica", title: l.description ?? "Alteração técnica", who: l.changed_by_name ?? undefined,
      detail: l.old_value != null || l.new_value != null ? `${JSON.stringify(l.old_value)} → ${JSON.stringify(l.new_value)}` : undefined,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  if (!entries.length) return <p className="text-sm text-stone-500">Sem histórico registrado.</p>;

  return (
    <ol className="relative border-l border-stone-200 ml-3 space-y-5">
      {entries.map((e, i) => (
        <li key={i} className="pl-5">
          <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-accent" />
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="label-eyebrow">{e.kind}</span>
            <span className="text-xs text-stone-400 font-mono">{new Date(e.at).toLocaleString("pt-BR")}</span>
            {e.who && <span className="text-xs text-stone-500">· {e.who}</span>}
          </div>
          <p className="text-sm mt-0.5 capitalize-first">{e.title}</p>
          {e.detail && <p className="text-xs text-stone-500 mt-0.5 break-words">{e.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
