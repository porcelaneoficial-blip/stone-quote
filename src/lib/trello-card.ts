import { supabase } from "@/integrations/supabase/client";
import { createOrderCard } from "@/lib/trello.functions";
import { brl } from "@/lib/format";
import type { QuoteData } from "@/lib/types";

const pad = (n: number) => String(n).padStart(4, "0");

const DELIVERY_LABEL: Record<string, string> = {
  retirada: "Retirada",
  entrega: "Entrega",
  instalacao: "Instalação",
};

export function buildCardTitle(number: number, data: QuoteData) {
  return `#${pad(number)} — ${data.client_name || "Cliente"}`;
}

export function buildCardDescription(number: number, data: QuoteData, total: number, sellerName?: string) {
  const L: string[] = [];
  L.push(`**Pedido Nº ${pad(number)}**`);
  L.push("");
  L.push(`- **Cliente:** ${data.client_name || "—"}`);
  if (data.client_phone) L.push(`- **Telefone:** ${data.client_phone}`);
  if (data.address || data.city) L.push(`- **Endereço:** ${[data.address, data.city].filter(Boolean).join(" — ")}`);
  L.push(`- **Valor total:** ${brl(total)}`);
  if (sellerName || data.salesperson) L.push(`- **Vendedor:** ${sellerName || data.salesperson}`);
  if (data.external_salesperson) L.push(`- **Indicação:** ${data.external_salesperson}`);
  if (data.architect) L.push(`- **Arquiteto:** ${data.architect}`);
  if (data.delivery) {
    L.push(`- **Logística:** ${DELIVERY_LABEL[data.delivery.mode] ?? data.delivery.mode} — ${data.delivery.days} dias ${data.delivery.days_type}`);
  }
  L.push("");
  L.push("**Ambientes**");
  for (const e of data.environments ?? []) {
    const pieces = (e.items ?? []).filter((i) => i.description || i.length || i.width);
    L.push(`- **${e.name}** — ${e.material_name || "material não definido"} (${pieces.length} peça(s))`);
    for (const i of pieces) {
      const q = i.qty && i.qty > 1 ? `${i.qty}x ` : "";
      L.push(`    - ${q}${i.description || "peça"} ${i.length || 0} x ${i.width || 0} m`);
    }
  }
  if (data.notes) {
    L.push("");
    L.push(`**Observações:** ${data.notes}`);
  }
  return L.join("\n");
}

/** URLs assinadas (7 dias) dos anexos/fotos do pedido. */
export async function attachmentUrls(orderId: string) {
  const out: { name: string; url: string }[] = [];
  const { data: att } = await supabase
    .from("order_attachments")
    .select("name, storage_path")
    .eq("order_id", orderId);
  for (const a of att ?? []) {
    const { data } = await supabase.storage.from("order-files").createSignedUrl(a.storage_path, 60 * 60 * 24 * 7);
    if (data?.signedUrl) out.push({ name: a.name, url: data.signedUrl });
  }
  const { data: photos } = await supabase
    .from("installation_photos")
    .select("url, description")
    .eq("order_id", orderId);
  for (const p of photos ?? []) {
    if (p.url) out.push({ name: p.description || "Foto de instalação", url: p.url });
  }
  return out;
}

export const DEFAULT_CHECKLIST = ["Medição", "Liberação técnica", "Corte", "Acabamento", "Entrega / Instalação"];

export async function sendOrderToTrello(args: {
  orderId: string;
  number: number;
  data: QuoteData;
  total: number;
  sellerName?: string;
  pdfBase64?: string;
}) {
  const urls = await attachmentUrls(args.orderId);
  return createOrderCard({
    data: {
      title: buildCardTitle(args.number, args.data),
      description: buildCardDescription(args.number, args.data, args.total, args.sellerName),
      pdfBase64: args.pdfBase64,
      pdfFileName: `Pedido_${pad(args.number)}.pdf`,
      urls,
      checklist: DEFAULT_CHECKLIST,
    },
  });
}
