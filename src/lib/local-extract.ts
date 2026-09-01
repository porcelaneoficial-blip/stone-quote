import type { ExtractedQuote } from "@/lib/pdf-import.functions";

/* ============================================================
   Extração LOCAL (sem IA / sem créditos)
   Lê PDF (texto), Excel/CSV e texto colado direto no navegador
   e monta o rascunho do orçamento por heurísticas.
   ============================================================ */

export const isSheetFile = (f: File) => /\.(xlsx|xls|csv)$/i.test(f.name);
export const isPdfFile = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/** Texto de um PDF (camada de texto — PDFs digitalizados/imagem não têm texto). */
export async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [`### Documento: ${file.name}`];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // agrupa por linha (mesmo Y) para preservar tabelas
    const rows = new Map<number, Array<{ x: number; s: string }>>();
    for (const it of content.items as Array<{ str?: string; transform?: number[] }>) {
      const s = (it.str ?? "").trim();
      if (!s) continue;
      const tr = it.transform ?? [0, 0, 0, 0, 0, 0];
      const y = Math.round(tr[5] as number);
      const arr = rows.get(y) ?? [];
      arr.push({ x: tr[4] as number, s });
      rows.set(y, arr);
    }
    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, arr]) => arr.sort((a, b) => a.x - b.x).map((c) => c.s).join(" ").trim())
      .filter(Boolean);
    if (lines.length) parts.push(lines.join("\n"));
  }
  return parts.join("\n");
}

/** Texto tabular de planilhas (Excel/CSV). */
export async function sheetToText(file: File): Promise<string> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const parts: string[] = [`### Planilha: ${file.name}`];
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false });
    if (!csv.trim()) continue;
    parts.push(`-- Aba: ${name} --`, csv.trim());
  }
  return parts.join("\n");
}

/* ---------------- heurísticas ---------------- */

const num = (raw: string): number => {
  const s = raw.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

/** Converte uma cota bruta em metros seguindo a convenção de marmoraria BR. */
export function toMeters(raw: string): number {
  const t = raw.trim().toLowerCase();
  const mmMatch = t.match(/^([\d.,]+)\s*mm$/);
  if (mmMatch) return num(mmMatch[1]) / 1000;
  const cmMatch = t.match(/^([\d.,]+)\s*cm$/);
  if (cmMatch) return num(cmMatch[1]) / 100;
  const mMatch = t.match(/^([\d.,]+)\s*m$/);
  if (mMatch) return num(mMatch[1]);
  const hasDecimal = /[.,]\d{1,2}\b/.test(t) && !/^\d{1,3}[.,]\d{3}$/.test(t);
  const n = num(t);
  if (!n) return 0;
  if (hasDecimal) return n <= 10 ? n : n / 100;
  if (n >= 100) return n / 1000;
  if (n >= 10) return n / 100;
  return n;
}

const MONEY = /r\$\s*([\d.,]+)/i;
const DIM = /([\d.,]+\s*(?:mm|cm|m)?)\s*[x×*/]\s*([\d.,]+\s*(?:mm|cm|m)?)/i;
const QTY = /(?:^|\s)(?:qtd\.?|qtde\.?|quant\.?|quantidade)?\s*(\d{1,3})\s*(?:x|un|pç|pc|peças?)\b/i;

const ENV_HINT = /^(ambiente|cozinha|banheiro|lavabo|área gourmet|area gourmet|churrasqueira|varanda|suíte|suite|sala|escada|lavanderia|closet|bwc)\b/i;
const MATERIAL_HINT = /\b(granito|m[áa]rmore|quartzo|porcelanato|silestone|dekton|quartzito|nanoglass|mfc)\b/i;
const SERVICE_HINT = /\b(recorte|cuba|cooktop|furo|rebaixo|frisado|lavat[óo]rio|torre|tomada|usinagem|acabamento especial)\b/i;
const NOISE = /^(###|--|p[áa]gina|total\b|subtotal|obs\.?$|cnpj|cpf|telefone|e-?mail|www|http)/i;

/**
 * Monta um rascunho de orçamento a partir de texto puro — 100% local, sem IA.
 * O usuário revisa e ajusta na tela antes de salvar.
 */
export function parseQuoteFromText(text: string): ExtractedQuote {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  const quote: ExtractedQuote = {
    client_name: "",
    client_phone: "",
    client_email: "",
    address: "",
    city: "",
    salesperson: "",
    architect: "",
    notes: "",
    payment_text: "",
    total: 0,
    environments: [],
  };

  const field = (re: RegExp) => {
    for (const l of lines) {
      const m = l.match(re);
      if (m?.[1]?.trim()) return m[1].trim().replace(/^[:\-–]\s*/, "");
    }
    return "";
  };

  quote.client_name = field(/^(?:cliente|nome do cliente)\s*[:\-]\s*(.+)$/i);
  quote.client_phone = field(/^(?:telefone|fone|celular|whats(?:app)?)\s*[:\-]\s*(.+)$/i) || (text.match(/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/)?.[0] ?? "");
  quote.client_email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? "";
  quote.address = field(/^(?:endere[çc]o|obra|local)\s*[:\-]\s*(.+)$/i);
  quote.city = field(/^(?:cidade|munic[íi]pio)\s*[:\-]\s*(.+)$/i);
  quote.salesperson = field(/^(?:vendedor(?:a)?|consultor(?:a)?)\s*[:\-]\s*(.+)$/i);
  quote.architect = field(/^(?:arquiteto(?:a)?|projetista)\s*[:\-]\s*(.+)$/i);
  quote.payment_text = field(/^(?:pagamento|forma de pagamento|condi[çc][õo]es?)\s*[:\-]\s*(.+)$/i);

  for (const l of lines) {
    if (/\b(total\s*(geral)?|valor\s*total)\b/i.test(l)) {
      const m = l.match(MONEY);
      if (m) quote.total = Math.max(quote.total, num(m[1]));
    }
  }

  const envs: ExtractedQuote["environments"] = [];
  const newEnv = (name: string) => {
    const e = { name, material_name: "", color: "", items: [], services: [], supplies: [] } as ExtractedQuote["environments"][number];
    envs.push(e);
    return e;
  };
  let current: ExtractedQuote["environments"][number] | null = null;

  for (const raw of lines) {
    const l = raw.trim();
    if (NOISE.test(l)) continue;

    if (ENV_HINT.test(l) && l.length <= 60 && !DIM.test(l)) {
      current = newEnv(l.replace(/^ambiente\s*[:\-]\s*/i, "").trim() || "Ambiente");
      const mat = l.match(MATERIAL_HINT);
      if (mat) current.material_name = l;
      continue;
    }

    if (!current && (DIM.test(l) || MATERIAL_HINT.test(l))) current = newEnv("Ambiente");
    if (!current) continue;

    if (!current.material_name && MATERIAL_HINT.test(l) && !DIM.test(l)) {
      current.material_name = l.replace(/^(material|pedra)\s*[:\-]\s*/i, "").slice(0, 80);
      continue;
    }

    const dim = l.match(DIM);
    if (dim) {
      const length_m = toMeters(dim[1]);
      const width_m = toMeters(dim[2]);
      const qty = Number(l.match(QTY)?.[1] ?? 1) || 1;
      const description =
        l
          .replace(DIM, " ")
          .replace(MONEY, " ")
          .replace(QTY, " ")
          .replace(/[|;]+/g, " ")
          .replace(/\s{2,}/g, " ")
          .replace(/^[\-•*\d.,\s]+/, "")
          .trim()
          .slice(0, 80) || "Peça";
      current.items.push({ description, qty, length_m, width_m });
      if (!current.material_name && MATERIAL_HINT.test(l)) current.material_name = l.slice(0, 80);
      continue;
    }

    if (SERVICE_HINT.test(l)) {
      const qty = Number(l.match(QTY)?.[1] ?? 1) || 1;
      const unit_value = num(l.match(MONEY)?.[1] ?? "0");
      current.services.push({
        description: l.replace(MONEY, " ").replace(/\s{2,}/g, " ").trim().slice(0, 80),
        qty,
        unit_value,
      });
    }
  }

  quote.environments = envs
    .map((e) => ({ ...e, name: e.name || "Ambiente" }))
    .filter((e) => e.items.length > 0 || e.services.length > 0);

  if (quote.environments.length === 0) {
    quote.environments = [
      { name: "Ambiente", material_name: "", color: "", items: [{ description: "", qty: 1, length_m: 0, width_m: 0 }], services: [], supplies: [] },
    ];
  }

  return quote;
}
