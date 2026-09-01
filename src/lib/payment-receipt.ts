/**
 * Recibo de pagamento (financeiro).
 * Gera uma folha A4 imprimível com a logo da empresa, referência do pedido
 * e os dados da parcela/valor recebido. Somente apresentação — não altera dados.
 */
import { supabase } from "@/integrations/supabase/client";
import { brl, fmtDate } from "@/lib/format";

export type ReceiptData = {
  /** Nº do recibo (ex.: id curto da parcela). */
  numero?: string;
  clientName: string;
  /** Referência do pedido, ex.: "PED. 042". */
  orderRef?: string | null;
  orderTotal?: number | null;
  amount: number;
  paidAt?: string | null;
  method?: string | null;
  description?: string;
  /** Linhas detalhadas (pagamentos recebidos, com data e forma). */
  items?: { label: string; value: number; paidAt?: string | null; method?: string | null }[];
  /** Total já pago do pedido e saldo restante. */
  totalPago?: number | null;
  saldo?: number | null;
  /** Quais vias imprimir: cliente, empresa ou ambas (padrão). */
  copies?: "cliente" | "empresa" | "ambas";
};

const UNI = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CEM = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos",
  "setecentos", "oitocentos", "novecentos"];

function tresDigitos(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), d = Math.floor((n % 100) / 10), u = n % 10;
  const parts: string[] = [];
  if (c) parts.push(CEM[c]);
  if (n % 100 < 20 && n % 100 > 0) parts.push(UNI[n % 100]);
  else {
    if (d) parts.push(DEZ[d]);
    if (u) parts.push(UNI[u]);
  }
  return parts.join(" e ");
}

/** Valor por extenso em reais (pt-BR). */
export function extenso(valor: number): string {
  const inteiro = Math.floor(Math.abs(valor));
  const centavos = Math.round((Math.abs(valor) - inteiro) * 100);
  const blocos: string[] = [];
  const milhoes = Math.floor(inteiro / 1_000_000);
  const milhares = Math.floor((inteiro % 1_000_000) / 1000);
  const resto = inteiro % 1000;
  if (milhoes) blocos.push(`${tresDigitos(milhoes)} ${milhoes === 1 ? "milhão" : "milhões"}`);
  if (milhares) blocos.push(`${milhares === 1 ? "mil" : `${tresDigitos(milhares)} mil`}`);
  if (resto) blocos.push(tresDigitos(resto));
  let txt = blocos.length ? blocos.join(" e ") : "zero";
  txt += inteiro === 1 ? " real" : " reais";
  if (centavos) txt += ` e ${tresDigitos(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  return txt;
}

type Company = {
  company_name?: string | null; razao_social?: string | null; cnpj?: string | null;
  inscricao_estadual?: string | null; phone?: string | null; whatsapp?: string | null;
  email?: string | null; address?: string | null; neighborhood?: string | null;
  cep?: string | null; city?: string | null; logo_url?: string | null;
};

async function loadCompany(): Promise<Company> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return {};
  const { data } = await supabase.from("company_settings").select("*")
    .eq("user_id", u.user.id).maybeSingle();
  return (data ?? {}) as Company;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Abre uma nova janela com o recibo e dispara a impressão. */
export async function printPaymentReceipt(d: ReceiptData) {
  const c = await loadCompany();
  const w = window.open("", "_blank", "width=900,height=800");
  if (!w) { alert("Permita pop-ups para gerar o recibo."); return; }

  const endereco = [c.address, c.neighborhood, c.cep, c.city].filter(Boolean).join(" · ");
  const contato = [c.phone, c.whatsapp, c.email].filter(Boolean).join(" · ");
  const data = d.paidAt ? fmtDate(d.paidAt) : fmtDate(new Date().toISOString());

  const copia = (titulo: string) => `
<section class="recibo">
  <header>
    <div class="emp">
      ${c.logo_url ? `<img class="logo" src="${esc(c.logo_url)}" alt="logo" />` : ""}
      <div>
        <div class="nome">${esc(c.company_name || c.razao_social || "")}</div>
        ${c.razao_social && c.company_name ? `<div class="sub">${esc(c.razao_social)}</div>` : ""}
        <div class="sub">${c.cnpj ? `CNPJ ${esc(c.cnpj)}` : ""}${c.inscricao_estadual ? ` · IE ${esc(c.inscricao_estadual)}` : ""}</div>
        ${endereco ? `<div class="sub">${esc(endereco)}</div>` : ""}
        ${contato ? `<div class="sub">${esc(contato)}</div>` : ""}
      </div>
    </div>
    <div class="ident">
      <div class="eyebrow">${esc(titulo)}</div>
      <div class="valor">${esc(brl(d.amount))}</div>
      <div class="rule"></div>
      <div class="sub">${d.numero ? `Recibo Nº <b>${esc(d.numero)}</b><br/>` : ""}${d.orderRef ? `Ref. <b>${esc(d.orderRef)}</b><br/>` : ""}Data: ${esc(data)}</div>
    </div>
  </header>

  <p class="corpo">
    Recebemos de <b>${esc(d.clientName || "—")}</b> a importância de
    <b>${esc(brl(d.amount))}</b> (${esc(extenso(d.amount))})
    ${d.method ? `, pago via <b>${esc(d.method)}</b>` : ""}
    referente a ${esc(d.description || "pagamento")}${d.orderRef ? ` — <b>${esc(d.orderRef)}</b>` : ""},
    dando plena e geral quitação do valor ora recebido.
  </p>

  ${d.items && d.items.length > 0 ? `
  <table>
    <thead><tr><th>Pagamentos recebidos</th><th>Data</th><th>Forma</th><th class="r">Valor</th></tr></thead>
    <tbody>
      ${d.items.map((i) => `<tr><td>${esc(i.label)}</td><td>${i.paidAt ? esc(fmtDate(i.paidAt)) : "—"}</td><td>${esc(i.method || "—")}</td><td class="r">${esc(brl(i.value))}</td></tr>`).join("")}
      <tr class="tot"><td colspan="3" class="r">Total recebido</td><td class="r">${esc(brl(d.amount))}</td></tr>
    </tbody>
  </table>` : ""}

  <div class="cards">
    ${d.orderTotal != null ? `<div class="card"><span>Valor do pedido</span><b>${esc(brl(Number(d.orderTotal)))}</b></div>` : ""}
    ${d.totalPago != null ? `<div class="card"><span>Total pago</span><b>${esc(brl(Number(d.totalPago)))}</b></div>` : ""}
    ${d.saldo != null ? `<div class="card"><span>Saldo</span><b>${esc(brl(Number(d.saldo)))}</b></div>` : ""}
  </div>

  <div class="assin">
    <div class="linha"></div>
    <div class="sub">${esc(c.company_name || c.razao_social || "")}${c.cnpj ? ` — CNPJ ${esc(c.cnpj)}` : ""}</div>
  </div>
</section>`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Recibo${d.orderRef ? ` — ${esc(d.orderRef)}` : ""}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
body{font-family:Inter,system-ui,sans-serif;color:#1A1A1A;background:#fff;margin:0;padding:14mm}
.recibo{border:1px solid #DDD8D2;padding:10mm;margin-bottom:8mm}
header{display:flex;justify-content:space-between;gap:12mm;border-bottom:1px solid #1A1A1A;padding-bottom:6px}
.emp{display:flex;gap:10px;align-items:flex-start}
.logo{height:64px;width:auto;max-width:180px;object-fit:contain}
.nome{font-family:'Playfair Display',serif;font-size:17px;font-weight:700;line-height:1.1}
.sub{font-size:10px;color:#5C5751;line-height:1.4}
.ident{text-align:right;min-width:52mm}
.eyebrow{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#5C5751;font-weight:700}
.valor{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;line-height:1.05;margin-top:2px}
.rule{height:2px;background:#8B5E34;width:34mm;margin:6px 0 6px auto}
.corpo{font-size:12.5px;line-height:1.8;margin:14px 0 10px;text-align:justify}
table{width:100%;border-collapse:collapse;font-size:11px;margin:8px 0}
th,td{padding:6px 8px;border-bottom:1px solid #EEE;text-align:left}
th{background:#F4F2EF;text-transform:uppercase;font-size:9px;letter-spacing:.06em}
.r{text-align:right}.tot{font-weight:700;background:#FAF8F6}
.cards{display:flex;gap:8px;margin-top:10px}
.card{flex:1;border:1px solid #E8E6E3;background:#FAF8F6;padding:8px 10px;display:flex;flex-direction:column}
.card span{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#5C5751;font-weight:700}
.card b{font-size:13px;margin-top:2px}
.assin{margin-top:20mm;text-align:center}
.linha{border-top:1px solid #1A1A1A;width:80mm;margin:0 auto 4px}
@media print{@page{size:A4;margin:0}body{padding:12mm}.recibo{page-break-inside:avoid}}
</style></head><body>
${(d.copies ?? "ambas") !== "empresa" ? copia("Via do cliente") : ""}
${(d.copies ?? "ambas") !== "cliente" ? copia("Via da empresa") : ""}
<script>window.onload=()=>{setTimeout(()=>window.print(),350)}</script>
</body></html>`;

  w.document.write(html);
  w.document.close();
}
