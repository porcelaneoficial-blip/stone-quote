import type { DeliveryDaysType, Environment, QuoteData } from "./types";

export function addDays(baseISO: string, n: number, type: DeliveryDaysType): Date {
  const d = new Date(baseISO);
  if (!Number.isFinite(d.getTime())) return new Date();
  if (type === "corridos") {
    d.setDate(d.getDate() + (n || 0));
    return d;
  }
  let added = 0;
  while (added < (n || 0)) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

export type DeadlineEntry = {
  label: string;
  date: Date;
  daysLeft: number;
};

const DAY_MS = 86_400_000;

export function daysBetween(target: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / DAY_MS);
}

/**
 * Calcula previsões de prazo para um pedido.
 * - retirada/entrega: 1 entrada baseada em delivery.start_date/created_at + delivery.days
 * - instalação: 1 entrada por ambiente liberado com delivery_days definido
 */
export function orderDeadlines(orderCreatedAt: string, data: QuoteData): DeadlineEntry[] {
  const dlv = data.delivery;
  if (!dlv) return [];
  const baseDate = dlv.start_date || orderCreatedAt;
  const out: DeadlineEntry[] = [];
  if (dlv.mode !== "instalacao") {
    if (dlv.days > 0) {
      const date = addDays(baseDate, dlv.days, dlv.days_type);
      out.push({
        label: dlv.mode === "retirada" ? "Retirada" : "Entrega",
        date,
        daysLeft: daysBetween(date),
      });
    }
  } else {
    for (const env of data.environments ?? []) {
      if (!env.released_for_cut_at || !env.delivery_days) continue;
      const date = addDays(env.released_for_cut_at, env.delivery_days, dlv.days_type);
      out.push({
        label: `Instalação · ${env.name}`,
        date,
        daysLeft: daysBetween(date),
      });
    }
  }
  return out;
}

/**
 * Pega o prazo mais crítico (menor daysLeft, ignorando ambientes concluidos não filtra
 * — apenas retorna o que está mais próximo).
 */
export function closestDeadline(orderCreatedAt: string, data: QuoteData): DeadlineEntry | null {
  const list = orderDeadlines(orderCreatedAt, data);
  if (list.length === 0) return null;
  // Filtra entradas de ambientes já concluídos
  const dlv = data.delivery;
  const filtered = list.filter((e) => {
    if (!dlv || dlv.mode !== "instalacao") return true;
    const envName = e.label.replace("Instalação · ", "");
    const env: Environment | undefined = (data.environments ?? []).find((x) => x.name === envName);
    return env?.production_status !== "concluido";
  });
  const pool = filtered.length ? filtered : list;
  return pool.reduce((a, b) => (a.daysLeft <= b.daysLeft ? a : b));
}

export type AlertLevel = "vencido" | "urgente" | "atencao" | "ok";

export function alertLevel(daysLeft: number): AlertLevel {
  if (daysLeft < 0) return "vencido";
  if (daysLeft <= 3) return "urgente";
  if (daysLeft <= 7) return "atencao";
  return "ok";
}
