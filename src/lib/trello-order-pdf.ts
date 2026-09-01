import jsPDF from "jspdf";
import { brl } from "@/lib/format";
import type { QuoteData } from "@/lib/types";

const pad6 = (n: number) => String(n).padStart(6, "0");

/**
 * Gera o PDF completo do pedido (dados comerciais, ambientes, peças e medidas)
 * em base64. Não altera nenhum dado do pedido — apenas lê.
 */
export function orderPdfBase64(number: number, data: QuoteData, total: number): string {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const M = 15;
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  let y = M;

  const nl = (h = 5) => {
    y += h;
    if (y > H - M) {
      pdf.addPage();
      y = M;
    }
  };
  const text = (s: string, opts: { bold?: boolean; size?: number } = {}) => {
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.size ?? 9);
    for (const line of pdf.splitTextToSize(s, W - M * 2) as string[]) {
      pdf.text(line, M, y);
      nl(opts.size && opts.size > 11 ? 7 : 4.6);
    }
  };
  const title = (s: string) => {
    nl(2);
    text(s, { bold: true, size: 11 });
  };

  text("PORCELANE MARMORARIA", { bold: true, size: 14 });
  text(`PEDIDO Nº ${pad6(number)}`, { bold: true, size: 12 });
  nl(1);

  title("CLIENTE");
  text(`Nome: ${data.client_name || "—"}`);
  if (data.client_phone) text(`Telefone: ${data.client_phone}`);

  title("OBRA");
  text(`Endereço: ${[data.address, data.city].filter(Boolean).join(" — ") || "—"}`);

  title("COMERCIAL");
  text(`Data: ${data.date ? new Date(data.date).toLocaleDateString("pt-BR") : "—"}`);
  text(`Tipo de venda: ${(data as { type?: string }).type === "mfc" ? "MFC / NFC" : "Convencional"}`);
  if (data.salesperson) text(`Vendedor interno: ${data.salesperson}`);
  if (data.external_salesperson) text(`Vendedor externo / indicação: ${data.external_salesperson}`);
  if (data.architect) text(`Arquiteto: ${data.architect}`);
  text(`Valor total: ${brl(total)}`);
  if (data.delivery) text(`Logística: ${data.delivery.mode} — ${data.delivery.days} dias ${data.delivery.days_type}`);

  title("AMBIENTES / MEDIDAS");
  for (const env of data.environments ?? []) {
    text(`${env.name || "Ambiente"} — ${env.material_name || "material não definido"}`, { bold: true });
    for (const it of env.items ?? []) {
      if (!it.description && !it.length && !it.width) continue;
      const q = it.qty && it.qty > 1 ? `${it.qty}x ` : "";
      text(`   • ${q}${it.description || "peça"} — ${it.length || 0} x ${it.width || 0} m`);
    }
    if (env.tech_notes) text(`   Obs.: ${env.tech_notes}`);
  }

  if (data.notes) {
    title("OBSERVAÇÕES");
    text(data.notes);
  }

  const uri = pdf.output("datauristring");
  return uri.split(",")[1] ?? uri;
}
