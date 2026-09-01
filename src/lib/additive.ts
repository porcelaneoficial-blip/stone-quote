import { todayISO } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import type { Environment, EnvItem, QuoteData } from "./types";
import { emptyQuoteData } from "./types";

/** Limiar (em metros) para que a diferença gere aditivo. 30 cm = 0,30 m */
export const ADDITIVE_THRESHOLD_M = 0.30;

export type ItemDiff = {
  envId: string;
  envName: string;
  materialName: string;
  materialPriceM2: number;
  itemId: string;
  description: string;
  origLength: number;
  origWidth: number;
  curLength: number;
  curWidth: number;
  origArea: number;
  curArea: number;
  extraArea: number;
  extraValue: number;
};

/**
 * Compara medidas originais (do orçamento aprovado) com as atuais (pedido).
 * Retorna apenas itens onde length OU width cresceram ≥ 30 cm.
 */
export function diffMeasurements(originalEnvs: Environment[], currentEnvs: Environment[]): ItemDiff[] {
  const diffs: ItemDiff[] = [];
  const origMap = new Map<string, { env: Environment; item: EnvItem }>();
  for (const e of originalEnvs) {
    for (const i of e.items) origMap.set(i.id, { env: e, item: i });
  }
  for (const env of currentEnvs) {
    for (const it of env.items) {
      const orig = origMap.get(it.id);
      if (!orig) continue;
      const curLen = it.released_length ?? it.length;
      const curWid = it.released_width ?? it.width;
      const curQtyRaw = it.released_qty ?? it.qty;
      const dL = (curLen || 0) - (orig.item.length || 0);
      const dW = (curWid || 0) - (orig.item.width || 0);
      if (dL < ADDITIVE_THRESHOLD_M && dW < ADDITIVE_THRESHOLD_M) continue;
      const qty = Math.max(1, curQtyRaw || 1);
      const origArea = +(orig.item.length * orig.item.width * qty).toFixed(4);
      const curArea = +(curLen * curWid * qty).toFixed(4);
      const extraArea = +Math.max(0, curArea - origArea).toFixed(4);
      if (extraArea <= 0) continue;
      const priceM2 = env.material_price_m2 || orig.env.material_price_m2 || 0;
      diffs.push({
        envId: env.id,
        envName: env.name,
        materialName: env.material_name || orig.env.material_name,
        materialPriceM2: priceM2,
        itemId: it.id,
        description: it.description || "Item",
        origLength: orig.item.length,
        origWidth: orig.item.width,
        curLength: curLen,
        curWidth: curWid,
        origArea,
        curArea,
        extraArea,
        extraValue: +(extraArea * priceM2).toFixed(2),
      });
    }
  }
  return diffs;
}

/**
 * Cria um orçamento-aditivo vinculado ao pedido.
 * - Se `diffs` for passado, cria ambientes pré-preenchidos com a área extra.
 * - Se vazio, cria um aditivo em branco para preenchimento manual.
 * Retorna { quoteId, seq, orderNumber }.
 */
export async function createAdditive(orderId: string, diffs: ItemDiff[] = []): Promise<{ quoteId: string; seq: number; orderNumber: number }> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Não autenticado");

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("id, number, client_name, data")
    .eq("id", orderId)
    .single();
  if (oErr || !order) throw new Error("Pedido não encontrado");

  const { data: seq, error: sErr } = await supabase.rpc("next_additive_seq", { _order_id: orderId });
  if (sErr) throw sErr;
  const seqNum = Number(seq) || 1;

  const orderData = (order.data ?? {}) as QuoteData;

  // Base: clona dados do cliente do pedido
  const data: QuoteData = {
    ...emptyQuoteData(),
    date: todayISO(),
    client_name: order.client_name ?? orderData.client_name ?? "",
    client_phone: orderData.client_phone ?? "",
    client_email: orderData.client_email ?? "",
    address: orderData.address ?? "",
    city: orderData.city ?? "",
    salesperson: orderData.salesperson ?? "",
    seller_id: orderData.seller_id,
    tech_measurer_id: orderData.tech_measurer_id,
    architect: orderData.architect,
    environments: [],
    quote_supplies: [],
    notes: `Aditivo do Pedido PED-${String(order.number).padStart(6, "0")} (A${seqNum}).`,
  };

  if (diffs.length > 0) {
    // Agrupa por env
    const byEnv = new Map<string, ItemDiff[]>();
    for (const d of diffs) {
      if (!byEnv.has(d.envId)) byEnv.set(d.envId, []);
      byEnv.get(d.envId)!.push(d);
    }
    for (const [envId, list] of byEnv) {
      const first = list[0];
      data.environments.push({
        id: crypto.randomUUID(),
        name: `${first.envName} — aditivo`,
        material_name: first.materialName,
        material_price_m2: first.materialPriceM2,
        show_mc: false,
        items: list.map((d) => ({
          id: crypto.randomUUID(),
          description: `${d.description} (medida ${d.curLength.toFixed(2)}×${d.curWidth.toFixed(2)} — extra ${d.extraArea.toFixed(2)} m²)`,
          qty: 1,
          length: 1,
          width: d.extraArea, // 1 × extraArea = área extra
          has_emenda: false,
          unit_price_override: d.extraValue, // garante valor exato
        })),
        services: [],
        supplies: [],
      });
    }
  }

  const total = data.environments.reduce((s, e) => {
    return s + e.items.reduce((a, i) => a + (i.unit_price_override ?? 0), 0);
  }, 0);

  const { data: newQ, error: insErr } = await supabase
    .from("quotes")
    .insert({
      user_id: u.user.id,
      number: 0,
      type: "convencional",
      status: "rascunho",
      client_name: data.client_name,
      total,
      data: data as never,
      additive_of_order_id: orderId,
      additive_seq: seqNum,
    } as never)
    .select("id")
    .single();
  if (insErr || !newQ) throw insErr ?? new Error("Falha ao criar aditivo");

  return { quoteId: newQ.id, seq: seqNum, orderNumber: order.number };
}
