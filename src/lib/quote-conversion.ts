import type { QuoteData } from "./types";
import { calcTotals } from "./quote-calc";

export type QuoteType = "convencional" | "mfc";

export type QuoteTypeChange = {
  from: QuoteType;
  to: QuoteType;
  at: string;
  total_before: number;
  total_after: number;
  by?: string;
};

/**
 * Converte um orçamento entre MFC e Convencional preservando todos os dados
 * (ambientes, itens, serviços, insumos, pagamento). Apenas os blocos exclusivos
 * de cada tipo são ligados/desligados — o recálculo é feito por calcTotals.
 */
export function convertQuoteType(data: QuoteData, to: QuoteType, by?: string) {
  const from: QuoteType = to === "mfc" ? "convencional" : "mfc";
  const totalBefore = calcTotals(data).total;

  const next: QuoteData = { ...data };

  if (to === "mfc") {
    // MFC não cobra instalação; mantém a configuração salva, apenas desativa.
    if (next.installation) next.installation = { ...next.installation, enabled: false };
    if (next.mfc_pickup) next.mfc_pickup = { ...next.mfc_pickup, enabled: true };
  } else {
    // Convencional não usa coleta MFC.
    if (next.mfc_pickup) next.mfc_pickup = { ...next.mfc_pickup, enabled: false };
  }

  const totalAfter = calcTotals(next).total;
  const entry: QuoteTypeChange = {
    from,
    to,
    at: new Date().toISOString(),
    total_before: totalBefore,
    total_after: totalAfter,
    ...(by ? { by } : {}),
  };
  next.type_history = [...(data.type_history ?? []), entry];

  return { data: next, entry };
}
