import { supabase } from "@/integrations/supabase/client";
import { createOrderCard, updateOrderCard } from "@/lib/trello.functions";
import { orderPdfBase64 } from "@/lib/trello-order-pdf";
import { brl } from "@/lib/format";
import type { QuoteData } from "@/lib/types";

export type TrelloStatus = "pendente" | "criando" | "criado" | "erro";

export type TrelloIntegration = {
  id: string;
  order_id: string;
  order_number: number | null;
  status: TrelloStatus;
  card_id: string | null;
  card_url: string | null;
  trello_list_id: string | null;
  error: string | null;
  documents: { name: string; url: string }[];
  triggered_by_name: string | null;
  entered_installation_at: string | null;
  sent_at: string | null;
  created_at?: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const table = () => (supabase.from as any)("trello_integrations");

/** Lista oficial do Trello onde o card do pedido aprovado é criado. */
export const TRELLO_CLOSED_LIST = "PEDIDO";

const pad6 = (n: number) => String(n).padStart(6, "0");
const dash = "—";
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : dash);

export async function getTrelloIntegration(orderId: string): Promise<TrelloIntegration | null> {
  const { data } = await table().select("*").eq("order_id", orderId).maybeSingle();
  return (data as TrelloIntegration) ?? null;
}

/** Campo oficial que define o tipo de entrega/execução do pedido. */
export function orderDeliveryMode(orderData: QuoteData | null | undefined): string | null {
  const d = (orderData ?? {}) as QuoteData & { delivery_mode?: string };
  return d.delivery?.mode ?? d.delivery_mode ?? null;
}

export function orderHasInstallation(orderData: QuoteData | null | undefined): boolean {
  return orderDeliveryMode(orderData) === "instalacao";
}

/** Pedido com INSTALAÇÃO inclui, por definição, a ENTREGA do material na obra. */
export function orderHasDelivery(orderData: QuoteData | null | undefined): boolean {
  const mode = orderDeliveryMode(orderData);
  return mode === "entrega" || mode === "instalacao";
}

/** Regra principal: aprovado (pedido existe) + entrega + instalação. */
export function orderEligibleForTrello(orderData: QuoteData | null | undefined): boolean {
  return orderHasDelivery(orderData) && orderHasInstallation(orderData);
}

/* ----------------------------------------------------------------- anexos */

/** Todos os arquivos vinculados ao pedido (anexos, fotos, docs do orçamento). */
export async function orderAttachmentUrls(orderId: string, quoteId?: string | null) {
  const out: { name: string; url: string }[] = [];
  const sign = async (path: string) => {
    const { data } = await supabase.storage.from("order-files").createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl ?? null;
  };

  const { data: att } = await supabase
    .from("order_attachments")
    .select("name, storage_path, kind")
    .eq("order_id", orderId);
  for (const a of att ?? []) {
    const url = await sign(a.storage_path);
    if (url) out.push({ name: `${a.kind ? `[${a.kind}] ` : ""}${a.name}`, url });
  }

  if (quoteId) {
    const { data: qatt } = await supabase
      .from("quote_attachments")
      .select("name, storage_path")
      .eq("quote_id", quoteId);
    for (const a of qatt ?? []) {
      const url = await sign(a.storage_path);
      if (url) out.push({ name: `[orçamento] ${a.name}`, url });
    }
  }

  const { data: photos } = await supabase
    .from("installation_photos")
    .select("url, description")
    .eq("order_id", orderId);
  for (const p of photos ?? []) {
    if (p.url) out.push({ name: p.description || "Foto de instalação", url: p.url });
  }

  const { data: docs } = await supabase
    .from("tech_documents")
    .select("kind, version, env_name, pdf_path")
    .eq("order_id", orderId);
  for (const d of docs ?? []) {
    if (!d.pdf_path) continue;
    const url = await sign(d.pdf_path);
    if (url) out.push({ name: `[técnico] ${d.kind} V${d.version} — ${d.env_name || "ambiente"}`, url });
  }

  // Remove nomes duplicados (Trello identifica anexos pelo nome).
  const seen = new Set<string>();
  return out.filter((a) => (seen.has(a.name) ? false : (seen.add(a.name), true)));
}

/* ------------------------------------------------------------- descrição */

function buildDescription(args: {
  number: number;
  data: QuoteData;
  total: number;
  closedAt?: string | null;
  techResponsible?: string;
  documents: { name: string }[];
}) {
  const d = args.data;
  const L: string[] = [];
  L.push(`**PEDIDO Nº ${pad6(args.number)} — ${d.client_name || "Cliente"}**`);
  L.push("");
  L.push("**PEDIDO**");
  L.push(`- Número: ${pad6(args.number)}`);
  L.push(`- Data do pedido: ${fmtDate(d.date ?? args.closedAt)}`);
  L.push(`- Tipo de venda: ${(d as { type?: string }).type === "mfc" ? "MFC / NFC" : "Convencional"}`);
  L.push(`- Valor total: ${brl(args.total)}`);
  L.push("");
  L.push("**CLIENTE**");
  L.push(`- Nome: ${d.client_name || dash}`);
  L.push(`- Telefone: ${d.client_phone || dash}`);
  L.push("");
  L.push("**ENDEREÇO DA OBRA**");
  L.push(`- ${[d.address, d.city].filter(Boolean).join(" — ") || dash}`);
  L.push("");
  L.push("**RESPONSÁVEIS**");
  L.push(`- Vendedor interno: ${d.salesperson || dash}`);
  if (d.external_salesperson) L.push(`- Vendedor externo / indicação: ${d.external_salesperson}`);
  if (d.architect) L.push(`- Arquiteto: ${d.architect}`);
  L.push(`- Responsável técnico: ${args.techResponsible || dash}`);
  L.push("");
  L.push("**ENTREGA / INSTALAÇÃO**");
  L.push(`- Modalidade: ENTREGA + INSTALAÇÃO`);
  if (d.delivery) L.push(`- Prazo: ${d.delivery.days} dias ${d.delivery.days_type}`);
  L.push("");
  L.push("**PROJETO — AMBIENTES / MATERIAIS / MEDIDAS**");
  for (const e of d.environments ?? []) {
    const pieces = (e.items ?? []).filter((i) => i.description || i.length || i.width);
    L.push(`- **${e.name || "Ambiente"}** — ${e.material_name || "material não definido"} (${pieces.length} peça(s))`);
    for (const i of pieces) {
      const q = i.qty && i.qty > 1 ? `${i.qty}x ` : "";
      L.push(`    - ${q}${i.description || "peça"} — ${i.length || 0} x ${i.width || 0} m`);
    }
    if (e.tech_notes) L.push(`    - Obs. técnica: ${e.tech_notes}`);
  }
  if (d.notes) {
    L.push("");
    L.push(`**OBSERVAÇÕES:** ${d.notes}`);
  }
  L.push("");
  L.push("**DOCUMENTAÇÃO ANEXADA**");
  if (args.documents.length) for (const doc of args.documents) L.push(`- ${doc.name}`);
  else L.push(`- ${dash}`);
  return L.join("\n");
}

/* ------------------------------------------------------------ sincronismo */

export type SyncResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: "sem_entrega_instalacao" | "em_andamento" | "atualizado";
  url?: string;
  error?: string;
};

/**
 * Cria (ou atualiza) o card do Trello na lista PEDIDO — apenas para pedidos
 * aprovados com ENTREGA + INSTALAÇÃO. Nunca altera dados do pedido e nunca
 * cria um segundo card para o mesmo pedido (idempotente).
 */
export async function syncOrderToTrelloOnClose(
  orderId: string,
  opts: { force?: boolean; triggeredByName?: string } = {},
): Promise<SyncResult> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { ok: false, error: "Não autenticado" };

  const existing = await getTrelloIntegration(orderId);
  if (existing?.status === "criando" && !opts.force && !existing.card_id) {
    return { ok: true, skipped: true, reason: "em_andamento" };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, number, data, total, quote_id, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Pedido não encontrado" };

  const data = (order.data ?? {}) as unknown as QuoteData;
  if (!orderEligibleForTrello(data)) return { ok: true, skipped: true, reason: "sem_entrega_instalacao" };

  const now = new Date().toISOString();
  await table().upsert(
    {
      user_id: userId,
      order_id: orderId,
      order_number: order.number,
      status: existing?.card_id ? "criado" : "criando",
      card_id: existing?.card_id ?? null,
      card_url: existing?.card_url ?? null,
      error: null,
      entered_installation_at: existing?.entered_installation_at ?? now,
      triggered_by_name: opts.triggeredByName ?? existing?.triggered_by_name ?? null,
    },
    { onConflict: "order_id" },
  );

  try {
    const documents = await orderAttachmentUrls(orderId, order.quote_id);
    const techResponsible = (data.environments ?? [])
      .map((e) => e.tech_responsible)
      .find(Boolean) as string | undefined;
    const total = Number(order.total ?? 0);

    const title = `${data.client_name || "Cliente"} — Pedido ${pad6(order.number)}`;
    const description = buildDescription({
      number: order.number,
      data,
      total,
      closedAt: order.created_at,
      techResponsible,
      documents,
    });

    let pdfBase64: string | undefined;
    try {
      pdfBase64 = orderPdfBase64(order.number, data, total);
    } catch {
      pdfBase64 = undefined;
    }
    const pdfFileName = `Pedido_${pad6(order.number)}.pdf`;

    // 5. Proteção contra duplicidade: com card existente, apenas atualiza.
    if (existing?.card_id) {
      const upd = await updateOrderCard({
        data: { cardId: existing.card_id, title, description, urls: documents, pdfBase64, pdfFileName },
      });
      if (upd.error) {
        await table().update({ status: "erro", error: upd.error }).eq("order_id", orderId);
        return { ok: false, error: upd.error };
      }
      await table()
        .update({ status: "criado", card_url: upd.url, error: null, documents, sent_at: new Date().toISOString() })
        .eq("order_id", orderId);
      return { ok: true, skipped: true, reason: "atualizado", url: upd.url ?? undefined };
    }

    const card = await createOrderCard({
      data: { title, description, listName: TRELLO_CLOSED_LIST, urls: documents, pdfBase64, pdfFileName },
    });
    if (card.error) {
      await table().update({ status: "erro", error: card.error }).eq("order_id", orderId);
      return { ok: false, error: card.error };
    }

    await table()
      .update({
        status: "criado",
        card_id: card.id,
        card_url: card.url,
        trello_list_id: card.listId ?? null,
        error: null,
        documents,
        sent_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    return { ok: true, url: card.url ?? undefined };
  } catch (e) {
    const msg = (e as Error)?.message || "Falha ao registrar o pedido no Trello";
    await table().update({ status: "erro", error: msg }).eq("order_id", orderId);
    return { ok: false, error: msg };
  }
}

/* -------------------------------------------------- migração retroativa */

export type MigrationReport = {
  total: number;
  aprovados: number;
  elegiveis: number;
  criados: number;
  jaSincronizados: number;
  ignorados: number;
  erros: { number: number; message: string }[];
  itens: { number: number; client: string; result: string; url?: string }[];
};

/**
 * Rotina retroativa idempotente: processa os pedidos de um período (padrão
 * agosto/2026), cria o card apenas para os elegíveis que ainda não têm card.
 */
export async function runTrelloBacklog(
  opts: { from?: string; to?: string; onProgress?: (done: number, total: number) => void } = {},
): Promise<MigrationReport> {
  const from = opts.from ?? "2026-08-01T00:00:00.000Z";
  const to = opts.to ?? "2026-08-31T23:59:59.999Z";

  const report: MigrationReport = {
    total: 0,
    aprovados: 0,
    elegiveis: 0,
    criados: 0,
    jaSincronizados: 0,
    ignorados: 0,
    erros: [],
    itens: [],
  };

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, number, data, created_at")
    .gte("created_at", from)
    .lte("created_at", to)
    .order("number", { ascending: true });
  if (error) throw new Error(error.message);

  const list = orders ?? [];
  report.total = list.length;
  // Todo pedido nasce de um orçamento aprovado — a existência do pedido é a aprovação.
  report.aprovados = list.length;

  let done = 0;
  for (const o of list) {
    const d = (o.data ?? {}) as unknown as QuoteData;
    const client = d.client_name || "Cliente";
    if (!orderEligibleForTrello(d)) {
      report.ignorados++;
      report.itens.push({ number: o.number, client, result: "ignorado — sem entrega + instalação" });
      opts.onProgress?.(++done, list.length);
      continue;
    }
    report.elegiveis++;

    const existing = await getTrelloIntegration(o.id);
    if (existing?.card_id) {
      report.jaSincronizados++;
      report.itens.push({ number: o.number, client, result: "já sincronizado", url: existing.card_url ?? undefined });
      opts.onProgress?.(++done, list.length);
      continue;
    }

    try {
      const r = await syncOrderToTrelloOnClose(o.id, { triggeredByName: "Migração agosto/2026" });
      if (r.ok && r.url && !r.skipped) {
        report.criados++;
        report.itens.push({ number: o.number, client, result: "card criado", url: r.url });
      } else if (r.ok && r.skipped) {
        report.jaSincronizados++;
        report.itens.push({ number: o.number, client, result: "já sincronizado", url: r.url });
      } else {
        report.erros.push({ number: o.number, message: r.error || "erro desconhecido" });
        report.itens.push({ number: o.number, client, result: `erro — ${r.error || "desconhecido"}` });
      }
    } catch (e) {
      const msg = (e as Error).message;
      report.erros.push({ number: o.number, message: msg });
      report.itens.push({ number: o.number, client, result: `erro — ${msg}` });
    }
    opts.onProgress?.(++done, list.length);
  }

  return report;
}

/* ------------------------------------------------- automação (varredura) */

let autoRunning = false;
let lastAutoRun = 0;

/**
 * Automação: procura pedidos aprovados com ENTREGA + INSTALAÇÃO que ainda não
 * têm card no Trello e cria automaticamente. Idempotente e seguro para rodar
 * em intervalos — nunca altera o pedido nem duplica cards.
 */
export async function autoSyncPendingTrello(
  opts: { days?: number; limit?: number; minIntervalMs?: number } = {},
): Promise<{ created: number; checked: number }> {
  const minInterval = opts.minIntervalMs ?? 5 * 60 * 1000;
  if (autoRunning || Date.now() - lastAutoRun < minInterval) return { created: 0, checked: 0 };
  autoRunning = true;
  lastAutoRun = Date.now();
  let created = 0;
  let checked = 0;
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) return { created: 0, checked: 0 };

    const since = new Date(Date.now() - (opts.days ?? 120) * 24 * 60 * 60 * 1000).toISOString();
    const { data: orders } = await supabase
      .from("orders")
      .select("id, number, data, created_at")
      .gte("created_at", since)
      .order("number", { ascending: false })
      .limit(opts.limit ?? 200);

    for (const o of orders ?? []) {
      const d = (o.data ?? {}) as unknown as QuoteData;
      if (!orderEligibleForTrello(d)) continue;
      checked++;
      const existing = await getTrelloIntegration(o.id);
      if (existing?.card_id) continue;
      if (existing?.status === "criando") continue;
      const r = await syncOrderToTrelloOnClose(o.id, { triggeredByName: "Automação" });
      if (r.ok && r.url && !r.skipped) created++;
    }
  } catch {
    /* automação silenciosa */
  } finally {
    autoRunning = false;
  }
  return { created, checked };
}
