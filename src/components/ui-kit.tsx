/**
 * Componentes visuais compartilhados (padronização Apple/Linear).
 * Somente apresentação — nenhuma regra de negócio aqui.
 */
import type { ReactNode } from "react";
import type { Tone } from "@/lib/order-view";

const TONE_CLASS: Record<Tone, string> = {
  neutro: "kanban-badge-neutro",
  positivo: "kanban-badge-positivo",
  atencao: "kanban-badge-atencao",
  alerta: "kanban-badge-alerta",
  andamento: "kanban-badge-andamento",
};

export function StatusBadge({ tone = "neutro", icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return <span className={"kanban-badge " + TONE_CLASS[tone]}>{icon}{children}</span>;
}

/** Contador de pendências — some quando está tudo certo. */
export function PendingBadge({ count, label = "pendência" }: { count: number; label?: string }) {
  if (!count) return <StatusBadge tone="positivo">Sem pendências</StatusBadge>;
  return <StatusBadge tone="atencao">{count} {label}{count > 1 ? "s" : ""}</StatusBadge>;
}

/** Cabeçalho de seção com título, apoio e ações à direita. */
export function SectionHeader({ eyebrow, title, hint, actions }: {
  eyebrow?: string; title: string; hint?: string; actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
      <div className="min-w-0">
        {eyebrow && <div className="label-eyebrow text-accent">{eyebrow}</div>}
        <h3 className="font-display text-lg leading-tight">{title}</h3>
        {hint && <p className="text-xs text-stone-500 mt-0.5">{hint}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}

/** Bloco branco padrão de conteúdo. */
export function Panel({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={"bg-white border border-stone-200 p-5 " + className}>{children}</section>;
}

/** Par rótulo/valor padronizado. */
export function Field({ label, value, className = "" }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={"min-w-0 " + className}>
      <div className="label-eyebrow">{label}</div>
      <div className="text-sm font-medium mt-0.5 truncate">{value ?? "—"}</div>
    </div>
  );
}

/** Barra de etapas (progresso linear). */
export function ProgressSteps({ steps, current }: { steps: { key: string; label: string }[]; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s.key} className="flex-1 min-w-0">
          <div className={"h-1.5 rounded-full " + (i <= current ? "bg-accent" : "bg-stone-200")} />
          <div className={"text-[10px] mt-1 truncate " + (i <= current ? "text-stone-950" : "text-stone-400")}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Estado vazio discreto. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="text-sm text-stone-500 py-6 text-center">{children}</p>;
}
