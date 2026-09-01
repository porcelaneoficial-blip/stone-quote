/**
 * Camada visual compartilhada dos documentos PDF da Porcelane.
 * Somente apresentação — nenhum componente aqui altera dados,
 * cálculos, consultas ou regras de negócio.
 */
import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { DocHeader, type DocHeaderProps } from "@/components/doc-header";

export const PdfHeader = DocHeader;
export type { DocHeaderProps as PdfHeaderProps };

/** Página A4 retrato padrão (cabeçalho/rodapé institucionais). */
export function PdfPage({
  children,
  landscape,
  noFooter,
  className = "",
}: {
  children: ReactNode;
  landscape?: boolean;
  noFooter?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`a4-page print-page ${landscape ? "print-landscape" : ""} ${
        noFooter ? "pdf-no-footer" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function PdfTitle({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-3">
      {eyebrow && <div className="pdf-eyebrow">{eyebrow}</div>}
      <h2 className="pdf-title">{children}</h2>
      <div className="pdf-rule-gold mt-1.5" />
    </div>
  );
}

export function PdfDivider() {
  return <div className="pdf-divider" />;
}

export function PdfSection({
  title,
  right,
  children,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="pdf-section">
      {(title || right) && (
        <div className="flex items-end justify-between gap-4 mb-2">
          {title && <h3 className="pdf-eyebrow">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function PdfInfoCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="pdf-card">
      <div className="pdf-eyebrow">{label}</div>
      <div className="text-[11pt] font-semibold leading-snug mt-0.5">{value}</div>
      {hint && <div className="text-[8.5pt] text-stone-500 mt-0.5">{hint}</div>}
    </div>
  );
}

export function PdfTable({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <table className={`pdf-table ${className}`}>{children}</table>;
}

export function PdfTh(props: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} />;
}

export function PdfTd(props: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} />;
}

/** Resumo financeiro/operacional com destaque no total. */
export function PdfSummary({
  rows,
  total,
}: {
  rows: { label: string; value: ReactNode; strong?: boolean }[];
  total?: { label: string; value: ReactNode };
}) {
  return (
    <div className="pdf-card w-full max-w-[95mm] ml-auto">
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between gap-4 text-[10pt]">
            <span className="text-stone-600">{r.label}</span>
            <span className={r.strong ? "font-semibold" : ""}>{r.value}</span>
          </div>
        ))}
      </div>
      {total && (
        <>
          <div className="pdf-divider" />
          <div className="flex items-baseline justify-between gap-4">
            <span className="pdf-eyebrow">{total.label}</span>
            <span className="font-display text-[18pt] font-bold leading-none">{total.value}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function PdfSignature({ name, role }: { name?: string; role?: string }) {
  return (
    <div className="pdf-signature mt-10">
      <div>{name || "\u00A0"}</div>
      {role && <div className="pdf-eyebrow mt-0.5">{role}</div>}
    </div>
  );
}

export function PdfCheckbox({ label }: { label?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="pdf-checkbox" />
      {label && <span className="text-[9.5pt]">{label}</span>}
    </span>
  );
}

export function PdfPageNumber() {
  // A numeração é aplicada automaticamente pelo rodapé de `.a4-page`.
  return null;
}
