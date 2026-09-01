import * as XLSX from "xlsx";

export type DailyRow = {
  kind: "orcamento" | "pedido";
  number: number;
  client: string;
  seller: string;
  total: number;
  status: string;
  date: string;
  payment?: string;
  notes?: string;
  /** Retirada / Entrega / Montagem */
  delivery?: string;
  /** Data de contratação (pedidos) */
  contract_date?: string;
  prazo?: number | "";
  days_type?: string;
  /** Indicação Pleno / vendedor externo */
  external?: string;
  medicao?: string;
  medidor?: string;
  architect?: string;
  imported?: boolean;
};

const fmtDate = (s?: string) => {
  if (!s) return "";
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T00:00:00" : s);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

const kindLabel = (k: DailyRow["kind"]) => (k === "pedido" ? "Pedido" : "Orçamento");

const MAIN_HEAD = [
  "Cliente", "Tipo", "Status", "Valor", "Entrega / Retirada / Mont.", "Contratação",
  "Prazo", "Úteis / Corridos", "Indicação Pleno", "Medição", "Medidor",
  "Arquiteto Responsável", "Nº Doc", "Pagamento", "Observações",
];

function mainAoa(rows: DailyRow[]): unknown[][] {
  const aoa: unknown[][] = [MAIN_HEAD];
  for (const r of rows) {
    aoa.push([
      r.client, kindLabel(r.kind), r.status, r.total, r.delivery ?? "",
      fmtDate(r.contract_date ?? (r.kind === "pedido" ? r.date : "")),
      r.prazo ?? "", r.days_type ?? "", r.external ?? "", fmtDate(r.medicao),
      r.medidor ?? "", r.architect ?? "", r.number, r.payment ?? "", r.notes ?? "",
    ]);
  }
  const orc = rows.filter((r) => r.kind === "orcamento").reduce((a, r) => a + r.total, 0);
  const ped = rows.filter((r) => r.kind === "pedido").reduce((a, r) => a + r.total, 0);
  aoa.push([]);
  aoa.push(["Total Orçamentos", "", "", orc]);
  aoa.push(["Total Pedidos", "", "", ped]);
  aoa.push(["Total Geral", "", "", orc + ped]);
  return aoa;
}

/** Agrupa por pessoa com subtotais de orçamento/pedido. */
function groupAoa(rows: DailyRow[], nameOf: (r: DailyRow) => string, personLabel: string): unknown[][] {
  const map = new Map<string, DailyRow[]>();
  for (const r of rows) {
    const n = (nameOf(r) || "").trim();
    if (!n) continue;
    if (!map.has(n)) map.set(n, []);
    map.get(n)!.push(r);
  }
  const aoa: unknown[][] = [[personLabel, "Tipo", "Nº", "Data", "Cliente", "Status", "Valor"]];
  const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let geral = 0;
  for (const [person, list] of entries) {
    for (const r of list) {
      aoa.push([person, kindLabel(r.kind), r.number, fmtDate(r.date), r.client, r.status, r.total]);
    }
    const orc = list.filter((r) => r.kind === "orcamento").reduce((a, r) => a + r.total, 0);
    const ped = list.filter((r) => r.kind === "pedido").reduce((a, r) => a + r.total, 0);
    aoa.push([`Subtotal ${person}`, "", "", "", `Orçamentos: ${list.filter((r) => r.kind === "orcamento").length}`, `Pedidos: ${list.filter((r) => r.kind === "pedido").length}`, orc + ped]);
    aoa.push([`  Orçamentos`, "", "", "", "", "", orc]);
    aoa.push([`  Pedidos`, "", "", "", "", "", ped]);
    aoa.push([]);
    geral += orc + ped;
  }
  if (!entries.length) aoa.push(["Nenhum registro no período", "", "", "", "", "", ""]);
  else aoa.push(["TOTAL GERAL", "", "", "", "", "", geral]);
  return aoa;
}

function addSheet(wb: XLSX.WorkBook, name: string, aoa: unknown[][], widths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = widths.map((w) => ({ wch: w }));
  // formato moeda nas colunas de valor
  const range = XLSX.utils.decode_range(ws["!ref"] as string);
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = 0; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })] as XLSX.CellObject | undefined;
      if (cell && cell.t === "n") cell.z = 'R$ #,##0.00';
    }
  }
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

export function exportDailyXlsx(rows: DailyRow[], from: string, to: string) {
  const wb = XLSX.utils.book_new();
  const W = [26, 12, 14, 14, 18, 13, 8, 14, 20, 13, 16, 22, 10, 20, 30];
  const GW = [24, 12, 8, 12, 26, 14, 14];

  addSheet(wb, "ORÇ+PED", mainAoa(rows), W);
  addSheet(wb, "Orçamentos", mainAoa(rows.filter((r) => r.kind === "orcamento")), W);
  addSheet(wb, "Pedidos", mainAoa(rows.filter((r) => r.kind === "pedido")), W);
  addSheet(wb, "Vendedor Interno", groupAoa(rows.filter((r) => !r.external), (r) => r.seller, "Vendedor"), GW);
  addSheet(wb, "Externo - Indicação Pleno", groupAoa(rows, (r) => r.external ?? "", "Indicação Pleno"), GW);
  addSheet(wb, "Arquitetos", groupAoa(rows, (r) => r.architect ?? "", "Arquiteto"), GW);
  addSheet(wb, "Medidores", groupAoa(rows, (r) => r.medidor ?? "", "Medidor"), GW);

  XLSX.writeFile(wb, `relatorio-diario-${from}_${to}.xlsx`);
}
