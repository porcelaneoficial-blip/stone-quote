import * as XLSX from "xlsx";

export type ImportedRow = {
  id: string;
  kind: "orcamento" | "pedido";
  number: number;
  client: string;
  seller: string;
  sellerType?: "interno" | "externo";
  total: number;
  status: string;
  date: string; // ISO
  payment?: string;
  notes?: string;
};

const KEY = "imported_sales_v1";

export function loadImportedRows(): ImportedRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveImportedRows(rows: ImportedRow[]): void {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function upsertImportedRow(row: ImportedRow): ImportedRow[] {
  const rows = loadImportedRows();
  const i = rows.findIndex((r) => r.id === row.id);
  if (i >= 0) rows[i] = row;
  else rows.push(row);
  saveImportedRows(rows);
  return rows;
}

export function deleteImportedRow(id: string): ImportedRow[] {
  const rows = loadImportedRows().filter((r) => r.id !== id);
  saveImportedRows(rows);
  return rows;
}

export function clearImportedRows(): void {
  localStorage.removeItem(KEY);
}

const normalize = (s: string) =>
  s.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const HEADER_MAP: Record<string, keyof Omit<ImportedRow, "id" | "number">> = {
  cliente: "client",
  nome: "client",
  tipo: "kind",
  status: "status",
  valor: "total",
  total: "total",
  preco: "total",
  data: "date",
  contratacao: "date",
  "data contratacao": "date",
  vendedor: "seller",
  salesperson: "seller",
  "indicacao pleno": "seller",
  "indicação pleno": "seller",
  "indicacao": "seller",
  consultor: "seller",
  pagamento: "payment",
  "forma de pagamento": "payment",
  observacoes: "notes",
  obs: "notes",
};

function parseDate(v: unknown, fallback?: string): string | undefined {
  if (v === undefined || v === null || v === "" || v === "-") return fallback;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0)).toISOString();
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, dd, mm, yy] = m;
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    return new Date(year, Number(mm) - 1, Number(dd)).toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? fallback : d.toISOString();
}

// Try to infer month/year from sheet names like "ORÇ+PED MÊS 06" or "JUNHO 2026"
function inferSheetDate(sheetName: string): string | undefined {
  const s = sheetName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const monthNames: Record<string, number> = {
    janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  };
  let month: number | undefined;
  let year: number | undefined;
  const numMatch = s.match(/mes\s*(\d{1,2})/);
  if (numMatch) month = Number(numMatch[1]);
  if (!month) {
    for (const [name, n] of Object.entries(monthNames)) {
      if (s.includes(name)) { month = n; break; }
    }
  }
  const yearMatch = s.match(/(20\d{2})/);
  if (yearMatch) year = Number(yearMatch[1]);
  if (!month) return undefined;
  if (!year) year = new Date().getFullYear();
  return new Date(year, month - 1, 1).toISOString();
}

function parseMoney(v: unknown): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const s = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function parseKind(v: unknown): "orcamento" | "pedido" {
  const s = normalize(String(v ?? ""));
  if (s.startsWith("ped") || s.includes("venda") || s.includes("fech")) return "pedido";
  return "orcamento";
}

export async function parseSalesXlsx(file: File): Promise<ImportedRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const out: ImportedRow[] = [];
  let counter = Math.floor(Date.now() / 1000) % 100000;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (!aoa.length) continue;
    const sheetFallbackDate = inferSheetDate(sheetName);
    // Only extract month 6 (June)
    if (sheetFallbackDate && new Date(sheetFallbackDate).getMonth() !== 5) continue;

    for (const raw of aoa) {
      const obj: Partial<ImportedRow> = {};
      let internalSeller = "";
      let externalSeller = "";
      for (const [k, v] of Object.entries(raw)) {
        const nk = normalize(k);
        const key = HEADER_MAP[nk];
        if (!key) continue;
        if (key === "total") obj.total = parseMoney(v);
        else if (key === "date") {
          const d = parseDate(v, sheetFallbackDate);
          if (d) obj.date = d;
        }
        else if (key === "kind") obj.kind = parseKind(v);
        else if (key === "seller") {
          const val = String(v ?? "").trim();
          if (!val) continue;
          if (nk.includes("indicacao")) externalSeller = val;
          else internalSeller = val;
        }
        else (obj as Record<string, unknown>)[key] = String(v ?? "").trim();
      }
      // External (indicação pleno) takes precedence and is tagged as externo
      if (externalSeller) {
        obj.seller = externalSeller;
        obj.sellerType = "externo";
      } else if (internalSeller) {
        obj.seller = internalSeller;
        obj.sellerType = "interno";
      }
      // Skip summary/empty rows: require a client name
      const client = (obj.client ?? "").trim();
      if (!client) continue;
      if (/^total\b/i.test(client) || /^vendas\b/i.test(client) || /^medi[cç][aã]o\b/i.test(client)) continue;
      const rowDate = obj.date ?? sheetFallbackDate ?? new Date().toISOString();
      // Only keep month 6 rows
      if (new Date(rowDate).getMonth() !== 5) continue;
      counter += 1;
      out.push({
        id: `imp-${Date.now()}-${counter}`,
        kind: obj.kind ?? "orcamento",
        number: counter,
        client,
        seller: obj.seller ?? "",
        sellerType: obj.sellerType,
        total: obj.total ?? 0,
        status: obj.status ?? "importado",
        date: rowDate,
        payment: obj.payment,
        notes: obj.notes,
      });
    }
  }
  return out;
}
