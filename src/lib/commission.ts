import { supabase } from "@/integrations/supabase/client";

export type CommissionRule = {
  id: string;
  scope: string; // 'seller' | 'architect' | 'external'
  seller_id: string | null;
  min_value: number;
  max_value: number | null;
  percent: number;
  active: boolean;
};

let cache: CommissionRule[] | null = null;

export async function loadCommissionRules(force = false): Promise<CommissionRule[]> {
  if (cache && !force) return cache;
  const { data } = await supabase
    .from("commission_rules")
    .select("*")
    .eq("active", true);
  cache = ((data ?? []) as CommissionRule[]);
  return cache;
}

export function invalidateCommissionRulesCache() {
  cache = null;
}

/**
 * Find best-matching rule percent for a seller and value.
 * Priority: specific seller rule > generic scope rule.
 */
export function resolveSellerCommissionPct(
  rules: CommissionRule[],
  opts: { seller_id?: string | null; scope: "seller" | "external" | "architect"; value: number }
): number {
  const inRange = (r: CommissionRule) =>
    opts.value >= Number(r.min_value || 0) &&
    (r.max_value == null || opts.value < Number(r.max_value));

  // 1) specific seller rule (only meaningful for scope='seller')
  if (opts.seller_id) {
    const r = rules.find(
      (x) => x.scope === "seller" && x.seller_id === opts.seller_id && inRange(x)
    );
    if (r) return Number(r.percent);
  }
  // 2) generic scope rule (seller_id null)
  const g = rules.find((x) => x.scope === opts.scope && !x.seller_id && inRange(x));
  if (g) return Number(g.percent);
  return 0;
}
