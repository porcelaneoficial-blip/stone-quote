import { fmtDate, todayISO } from "@/lib/format";

/**
 * Formato padrão do nome de arquivo PDF:
 *   "{tipo_doc}. {numero:04d} {nome_cliente} - {data:dd/mm/aaaa}"
 * Ex.: "ORÇ. 0001 JOÃO SILVA - 01/07/2026"
 *      "PED. 000001 JOÃO SILVA - 01/07/2026"
 */
function build(tipo: string, num: number, pad: number, clientName?: string | null, date?: string): string {
  const n = String(num || 0).padStart(pad, "0");
  const name = (clientName || "").trim().toUpperCase() || "SEM CLIENTE";
  const d = fmtDate(date || todayISO());
  return `${tipo}. ${n} ${name} - ${d}`;
}

export function formatQuoteName(number: number, clientName?: string | null, date?: string): string {
  return build("ORÇ", number, 4, clientName, date);
}

export function formatOrderName(number: number, clientName?: string | null, date?: string): string {
  return build("PED", number, 6, clientName, date);
}

/** Versão segura para usar como nome de arquivo (troca "/" por "-" e espaços por "_"). */
export function toFilename(label: string): string {
  return label.replace(/\//g, "-").replace(/\s+/g, "_");
}
