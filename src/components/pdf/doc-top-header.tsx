/**
 * Cabeçalho compacto dos documentos Orçamento e Pedido.
 * Somente apresentação — nenhum cálculo ou dado é alterado aqui.
 */
import { Building2, CalendarDays, Clock, User } from "lucide-react";
import type { ReactNode } from "react";

export type DocTopHeaderProps = {
  logoUrl: string;
  companyName?: string | null;
  /** "ORÇAMENTO" | "PEDIDO" | "ORÇAMENTO MFC" ... */
  docType: string;
  docNumber: string;
  date?: string;
  /** Ex.: "07 dias" */
  validity?: string;
  client?: { name?: string | null; cpf?: string | null; phone?: string | null; email?: string | null };
  work?: { address?: string | null; neighborhood?: string | null; city?: string | null; reference?: string | null; kind?: string | null };
  people?: { label: string; name?: string | null; phone?: string | null }[];
};

function Row({ label, value, right }: { label: string; value?: string | null; right?: string | null }) {
  if (!value) return null;
  return (
    <div className="pt-1.5 first:pt-0">
      <div className="text-[7.5pt] text-stone-500 leading-tight">{label}</div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10pt] font-semibold leading-snug break-words">{value}</div>
        {right && <div className="text-[9pt] text-stone-600 whitespace-nowrap">{right}</div>}
      </div>
    </div>
  );
}

function Col({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-4 first:pl-0 last:pr-0 border-l border-stone-200 first:border-l-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-stone-700">{icon}</span>
        <span className="text-[9pt] uppercase tracking-[0.14em] font-semibold text-stone-800">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function DocTopHeader(p: DocTopHeaderProps) {
  const work = p.work ?? {};
  const cli = p.client ?? {};
  const people = (p.people ?? []).filter((x) => x.name);
  const cityLine = [work.city].filter(Boolean).join("");

  const hasWorkData = !!(
    work.address ||
    work.neighborhood ||
    cityLine ||
    work.reference ||
    work.kind
  );

  return (
    <header className="mb-4">
      <div className="flex items-start justify-between gap-6 pb-3">
        <img
          src={p.logoUrl}
          alt={p.companyName || "Porcelane"}
          className="h-20 w-auto max-w-[240px] object-contain object-left shrink-0"
        />
        <div className="shrink-0 text-right space-y-1">
          <div className="text-[10pt] font-semibold tracking-[0.12em] uppercase text-stone-700 leading-none">
            {p.docType}
          </div>
          <div className="font-display text-[16pt] font-bold tracking-tight leading-none">
            Nº {p.docNumber}
          </div>
          {p.date && (
            <div className="flex items-center justify-end gap-2 text-[9pt] text-stone-700 leading-tight">
              <CalendarDays className="size-3 text-stone-500" /> Data: {p.date}
            </div>
          )}
          {p.validity && (
            <div className="flex items-center justify-end gap-2 text-[9pt] text-stone-700 leading-tight">
              <Clock className="size-3 text-stone-500" /> Validade: {p.validity}
            </div>
          )}
        </div>
      </div>

      <div className={`border-y border-stone-300 py-3 grid gap-0 ${hasWorkData ? "grid-cols-3" : "grid-cols-2"}`}>
        <Col icon={<User className="size-4" />} title="Dados do cliente">
          <Row label="Nome:" value={cli.name} />
          <Row label="CPF:" value={cli.cpf} />
          <Row label="Telefone:" value={cli.phone} />
          <Row label="E-mail:" value={cli.email} />
        </Col>
        {hasWorkData && (
          <Col icon={<Building2 className="size-4" />} title="Dados da obra">
            <Row label="Endereço:" value={work.address} />
            <Row label="Bairro:" value={work.neighborhood} />
            <Row label="Cidade / UF:" value={cityLine} />
            <Row label="Referência:" value={work.reference} />
            <Row label="Tipo de obra:" value={work.kind} />
          </Col>
        )}
        <Col icon={<User className="size-4" />} title="Responsáveis">
          {people.map((r, i) => (
            <Row key={i} label={`${r.label}:`} value={r.name} right={r.phone || undefined} />
          ))}
        </Col>
      </div>
    </header>
  );
}
