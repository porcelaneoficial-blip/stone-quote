import type { ReactNode } from "react";
import { Receipt, CreditCard, Info, FileText, Wallet, Banknote, User, PenLine } from "lucide-react";
import { PAYMENT_METHOD_LABEL, type Payment, type PaymentMethodCode, type DeliveryInfo } from "@/lib/types";
import { brl } from "@/lib/format";
import { ensurePaymentShape } from "@/components/payment-editor";


type Totals = {
  total: number;
  entry: number;
  balance: number;
  methodBreakdown: Array<{
    id: string; method: string; amount: number; installments: number;
    installmentValue: number; lastInstallmentValue: number;
  }>;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 py-[1.5pt]">
      <span className="text-[10pt] uppercase tracking-wider text-stone-500 whitespace-nowrap">{label}</span>
      <span className="flex-1 border-b border-dotted border-stone-300 translate-y-[-2px]" />
      <span className="text-[11pt] text-stone-900 text-right">{value}</span>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10pt] uppercase tracking-[0.18em] font-bold text-stone-900 mb-1.5 pb-1 border-b border-stone-300">
      {children}
    </h4>
  );
}

/** Linhas das condições de pagamento — mesma lógica de sempre, extraída apenas para reuso visual. */
export function paymentConditionRows(payment: Payment, totals: Totals) {
  const p = ensurePaymentShape(payment);
  const rows: Array<{ label: string; value: string }> = [];

  if (p.terms_to_agree) {
    rows.push({ label: "Condição", value: "Prazo e valor a combinar" });
  } else {
    if (p.entry?.enabled && totals.entry > 0) {
      const pct = totals.total > 0 ? (totals.entry / totals.total) * 100 : 0;
      const en = Math.max(1, p.entry.installments || 1);
      rows.push({
        label: "Entrada",
        value: `${pct.toFixed(pct % 1 === 0 ? 0 : 1)}% — ${brl(totals.entry)}${en > 1 ? ` em ${en}× ${brl(totals.entry / en)}` : ""}`,
      });
      if (p.entry.method) rows.push({ label: "Forma da entrada", value: PAYMENT_METHOD_LABEL[p.entry.method] });
      if (totals.balance > 0) {
        const bpct = totals.total > 0 ? (totals.balance / totals.total) * 100 : 0;
        rows.push({ label: "Saldo", value: `${bpct.toFixed(bpct % 1 === 0 ? 0 : 1)}% — ${brl(totals.balance)}` });
      }
    }
    for (const br of totals.methodBreakdown) {
      if (br.amount <= 0) continue;
      const label = PAYMENT_METHOD_LABEL[br.method as PaymentMethodCode] ?? br.method;
      const tail = br.installments > 1
        ? (br.lastInstallmentValue !== br.installmentValue
            ? ` em ${br.installments - 1}× ${brl(br.installmentValue)} + 1× ${brl(br.lastInstallmentValue)}`
            : ` em ${br.installments}× ${brl(br.installmentValue)}`)
        : " à vista";
      rows.push({ label, value: `${brl(br.amount)}${tail}` });
    }
    if (!rows.length) rows.push({ label: "Total", value: brl(totals.total) });
  }

  return { notes: p.notes, rows };
}

/** Apresentação organizada das condições de pagamento já existentes. Não altera cálculos. */
export function PaymentConditionsBlock({
  payment, totals, className = "",
}: { payment: Payment; totals: Totals; className?: string }) {
  const { rows, notes } = paymentConditionRows(payment, totals);

  return (
    <section className={`break-inside-avoid ${className}`}>
      <SectionTitle>Condições de pagamento</SectionTitle>
      <div className="grid grid-cols-2 gap-x-8">
        {rows.map((r, i) => <Row key={i} label={r.label} value={r.value} />)}
      </div>
      {notes && (
        <p className="text-[10pt] text-stone-600 mt-1 whitespace-pre-line">{notes}</p>
      )}
    </section>
  );
}


/** Informações importantes / observações específicas do documento. */
export function DocNotesBlock({ notes, className = "" }: { notes?: string; className?: string }) {
  if (!notes?.trim()) return null;
  const lines = notes.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <section className={`break-inside-avoid ${className}`}>
      <SectionTitle>Informações importantes</SectionTitle>
      <ul className="text-[10.5pt] text-stone-700 leading-snug space-y-[2pt]">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-1.5"><span className="text-stone-400">•</span><span>{l.replace(/^[-•]\s*/, "")}</span></li>
        ))}
      </ul>
    </section>
  );
}

/** Termos e condições aplicáveis ao documento. */
export function DocTermsBlock({
  clauses = [], terms, className = "",
}: { clauses?: Array<{ id: string; title?: string | null; content: string }>; terms?: string; className?: string }) {
  const hasTerms = clauses.length > 0 || !!terms?.trim();
  if (!hasTerms) return null;
  return (
    <section className={`break-inside-avoid ${className}`}>
      <SectionTitle>Termos e condições</SectionTitle>
      {clauses.length > 0 && (
        <ol className="text-[10pt] text-stone-700 leading-snug space-y-[3pt] columns-1">
          {clauses.map((c, i) => (
            <li key={c.id} className="break-inside-avoid">
              <span className="font-bold text-stone-900">{i + 1}. {c.title || "Cláusula"} — </span>
              <span className="whitespace-pre-line">{c.content}</span>
            </li>
          ))}
        </ol>
      )}
      {terms?.trim() && (
        <p className={`text-[10pt] text-stone-600 whitespace-pre-line leading-snug ${clauses.length ? "mt-2 pt-2 border-t border-stone-200" : ""}`}>{terms}</p>
      )}
    </section>
  );
}

/** Etapas do processo — apenas as aplicáveis ao pedido. */
export function ProcessStepsBlock({
  delivery, hasInstallation, className = "",
}: { delivery?: DeliveryInfo; hasInstallation?: boolean; className?: string }) {
  const install = hasInstallation || delivery?.mode === "instalacao";
  const steps: Array<{ title: string; desc: string }> = [
    { title: "Fechamento", desc: "Aprovação do pedido e entrada." },
  ];
  if (install) {
    steps.push({ title: "Agendamento da medição", desc: "Contato para definir data." });
    steps.push({ title: "Medição e compatibilização", desc: "Conferência do projeto no local." });
  }
  steps.push({
    title: delivery?.mode === "retirada" ? "Retirada" : "Entrega",
    desc: (delivery?.days ?? 0) > 0
      ? `${delivery!.days} ${delivery!.days_type === "uteis" ? "dias úteis" : "dias corridos"}.`
      : "Conforme prazo acordado.",
  });
  if (install) steps.push({ title: "Instalação", desc: "Execução por equipe especializada." });

  return (
    <section className={`break-inside-avoid ${className}`}>
      <SectionTitle>Etapas do processo</SectionTitle>
      <div className="flex items-stretch gap-2">
        {steps.map((s, i) => (
          <div key={s.title} className="flex-1 flex items-start gap-2">
            <div className="flex-1">
              <div className="font-mono text-[9pt] text-stone-400">{String(i + 1).padStart(2, "0")}</div>
              <div className="text-[10pt] font-bold text-stone-900 leading-tight">{s.title}</div>
              <div className="text-[9pt] text-stone-600 leading-tight">{s.desc}</div>
            </div>
            {i < steps.length - 1 && <div className="text-stone-300 text-[10pt] pt-3">›</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Aceite: cliente (nome/data/assinatura) e responsável, quando aplicável. */
export function AcceptanceBlock({
  clientName, consultant, date, intro, className = "",
}: { clientName?: string; consultant?: string; date?: string; intro?: string; className?: string }) {
  return (
    <section className={`pdf-sign-block break-inside-avoid ${className}`}>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <SectionTitle>Aceite do cliente</SectionTitle>
          {intro && <p className="text-[9.5pt] text-stone-600 mb-3 leading-snug">{intro}</p>}
          <div className="text-[10.5pt] text-stone-900 mb-4">{clientName || "—"}</div>
          <div className="flex gap-4 text-[9.5pt] text-stone-600">
            <div className="w-28">Data: <span className="inline-block border-b border-stone-400 w-16" /></div>
            <div className="flex-1">Assinatura: <span className="inline-block border-b border-stone-400 w-[60%]" /></div>
          </div>
        </div>
        <div>
          <SectionTitle>Responsável / Consultor</SectionTitle>
          <div className="text-[10.5pt] text-stone-900 mb-4 mt-[calc(0.5rem)]">{consultant || "—"}</div>
          <div className="flex gap-4 text-[9.5pt] text-stone-600">
            <div className="w-28">Data: <span className="inline-block border-b border-stone-400 w-16">{date ? ` ${date}` : ""}</span></div>
            <div className="flex-1">Assinatura: <span className="inline-block border-b border-stone-400 w-[60%]" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
 * LAYOUT VISUAL DO RODAPÉ DO DOCUMENTO (Orçamento / Pedido)
 * Somente apresentação: nenhum cálculo, valor ou regra é alterado aqui.
 * ======================================================================== */

function DocCard({
  title, icon, children, className = "", allowBreak,
}: { title: string; icon: ReactNode; children: ReactNode; className?: string; allowBreak?: boolean }) {
  return (
    <section className={`border border-stone-200 rounded-md p-2.5 ${allowBreak ? "" : "break-inside-avoid"} h-full flex flex-col ${className}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-stone-500">{icon}</span>
        <h4 className="text-[9pt] uppercase tracking-[0.14em] font-bold text-stone-900">{title}</h4>
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}


/** Resumo financeiro em card, com o total em destaque. */
export function FinancialSummaryCard({
  rows, total, hint, className = "",
}: {
  rows: Array<{ label: string; value: string }>;
  total: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <DocCard title="Resumo financeiro" icon={<Receipt className="size-[12px]" strokeWidth={1.6} />} className={className}>
      <div className="space-y-[2pt]">
        {rows.map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 text-[9pt]">
            <span className="text-stone-600">{r.label}</span>
            <span className="text-stone-900">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 border border-stone-200 bg-stone-50 rounded-md px-2 py-1.5 text-center">
        <div className="text-[7.5pt] uppercase tracking-[0.14em] text-stone-500">Valor total</div>
        <div className="font-display text-[15pt] font-bold leading-tight text-stone-900">{total}</div>
        {hint && <div className="text-[8pt] text-stone-500 leading-snug mt-0.5">{hint}</div>}
      </div>
    </DocCard>
  );
}

const PAY_ICON = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes("entrada")) return <Wallet className="size-[13px]" strokeWidth={1.6} />;
  if (l.includes("cart")) return <CreditCard className="size-[13px]" strokeWidth={1.6} />;
  if (l.includes("pix") || l.includes("vista") || l.includes("saldo")) return <Banknote className="size-[13px]" strokeWidth={1.6} />;
  return <Banknote className="size-[13px]" strokeWidth={1.6} />;
};

/** Condições de pagamento em card — uma condição abaixo da outra. */
export function PaymentConditionsCard({
  payment, totals, className = "",
}: { payment: Payment; totals: Totals; className?: string }) {
  const { rows, notes } = paymentConditionRows(payment, totals);
  return (
    <DocCard title="Condições de pagamento" icon={<CreditCard className="size-[12px]" strokeWidth={1.6} />} className={className}>
      <div className="divide-y divide-stone-200">
        {rows.map((r, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 py-[3pt] break-inside-avoid">
            <span className="flex items-center gap-1.5 text-[8.5pt] uppercase tracking-wider font-bold text-stone-900 whitespace-nowrap">
              <span className="text-stone-500">{PAY_ICON(r.label)}</span>
              {r.label}
            </span>
            <span className="text-[9.5pt] text-stone-700 text-right leading-snug">{r.value}</span>
          </div>
        ))}
      </div>
      {notes && <p className="text-[8pt] text-stone-500 mt-1.5 whitespace-pre-line leading-snug">{notes}</p>}
    </DocCard>
  );
}

/** Informações importantes — uma abaixo da outra, com títulos numerados destacados. */
export function ImportantInfoCard({
  lines, className = "",
}: { lines: string[]; className?: string }) {
  if (!lines.length) return null;
  return (
    <DocCard allowBreak title="Informações importantes" icon={<Info className="size-[12px]" strokeWidth={1.6} />} className={className}>
      <div className="text-[8.5pt] text-stone-700 leading-snug space-y-[2pt]">
        {lines.map((raw, i) => {
          const l = raw.replace(/^[-•·]\s*/, "").trim();
          const isHeading = /^\d+[.)]\s/.test(l);
          return isHeading ? (
            <div
              key={i}
              className={`text-[8.5pt] uppercase tracking-[0.1em] font-bold text-stone-900 break-inside-avoid ${i ? "mt-[4pt]" : ""}`}
            >
              {l}
            </div>
          ) : (
            <div key={i} className="flex gap-1 break-inside-avoid pl-1">
              <span className="text-stone-400">•</span>
              <span className="whitespace-pre-line">{l}</span>
            </div>
          );
        })}
      </div>
    </DocCard>
  );
}


/** Observações — faixa horizontal. */
export function ObservationsCard({ notes, className = "" }: { notes?: string; className?: string }) {
  const lines = (notes ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  return (
    <DocCard allowBreak title="Observações" icon={<FileText className="size-[12px]" strokeWidth={1.6} />} className={className}>
      <ul className="text-[8.5pt] text-stone-700 leading-snug space-y-[2pt]">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-1">
            <span className="text-stone-400">•</span>
            <span>{l.replace(/^[-•]\s*/, "")}</span>
          </li>
        ))}
      </ul>
    </DocCard>
  );
}

/** Aceite do cliente + consultor responsável, lado a lado. */
export function AcceptanceCards({
  clientName, consultant, date, intro, className = "",
}: { clientName?: string; consultant?: string; date?: string; intro?: string; className?: string }) {
  const line = "inline-block border-b border-stone-400 align-baseline";
  return (
    <div className={`pdf-sign-block grid grid-cols-2 gap-3 break-inside-avoid ${className}`}>
      <DocCard title="Aceite do cliente" icon={<PenLine className="size-[12px]" strokeWidth={1.6} />}>
        {intro && <p className="text-[8.5pt] text-stone-600 leading-snug mb-1.5">{intro}</p>}
        <div className="text-[9.5pt] text-stone-900 mb-2">{clientName || "—"}</div>
        <div className="flex items-baseline gap-4 text-[8.5pt] text-stone-600">
          <div>Data: <span className={`${line} w-20`} /></div>
          <div className="flex-1">Assinatura: <span className={`${line} w-[60%]`} /></div>
        </div>
      </DocCard>
      <DocCard title="Consultor responsável" icon={<User className="size-[12px]" strokeWidth={1.6} />}>
        <div className="text-[9.5pt] text-stone-900 mb-2">{consultant || "—"}</div>
        <div className="flex items-baseline gap-4 text-[8.5pt] text-stone-600">
          <div>Data: <span className={`${line} w-20 text-stone-900`}>{date ? ` ${date}` : ""}</span></div>
          <div className="flex-1">Assinatura: <span className={`${line} w-[60%]`} /></div>
        </div>
      </DocCard>
    </div>
  );
}

/** Distribuição final: resumo + pagamento, informações/observações, aceites. */
export function DocBottomLayout({
  summaryRows, total, totalHint, payment, totals, infoLines, notes,
  clientName, consultant, date, intro, className = "",
}: {
  summaryRows: Array<{ label: string; value: string }>;
  total: string;
  totalHint?: ReactNode;
  payment: Payment;
  totals: Totals;
  infoLines: string[];
  notes?: string;
  clientName?: string;
  consultant?: string;
  date?: string;
  intro?: string;
  className?: string;
}) {
  const hasInfo = infoLines.length > 0;
  const hasNotes = !!notes?.trim();
  return (
    <div className={`pdf-doc-bottom ${className}`}>
      <div className="grid grid-cols-2 gap-2 items-start">
        <FinancialSummaryCard rows={summaryRows} total={total} hint={totalHint} />
        <PaymentConditionsCard payment={payment} totals={totals} />
      </div>
      <div className="space-y-2 mt-2">
        {hasInfo && <ImportantInfoCard lines={infoLines} />}
        {hasNotes && <ObservationsCard notes={notes} />}
      </div>

      <AcceptanceCards
        className="mt-2"
        clientName={clientName}
        consultant={consultant}
        date={date}
        intro={intro}
      />
    </div>
  );
}
