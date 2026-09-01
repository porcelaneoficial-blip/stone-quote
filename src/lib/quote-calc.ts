import type { Environment, EnvItem, QuoteData, SupplyLine } from "./types";

export const itemQty = (i: EnvItem) => (i.qty && i.qty > 0 ? i.qty : 1);

export const itemArea = (i: EnvItem) => +(i.length * i.width * itemQty(i)).toFixed(4);

export const itemUnitValue = (i: EnvItem, env: Environment) => {
  if (i.unit_price_override && i.unit_price_override > 0) return i.unit_price_override;
  // Acréscimo interno de 20% (marcado por item) — não aparece no PDF, só no valor.
  const factor = i.markup_20 ? 1.2 : 1;
  return +(i.length * i.width * (env.material_price_m2 || 0) * factor).toFixed(2);
};

export const itemTotal = (i: EnvItem, env: Environment) =>
  +(itemUnitValue(i, env) * itemQty(i)).toFixed(2);

export const envServicesTotal = (env: Environment) =>
  env.services.reduce((s, x) => s + x.qty * x.unit_value, 0);

export const envSuppliesTotal = (env: Environment) =>
  env.supplies.reduce((s, x) => s + x.qty * x.unit_value, 0);

export const envItemsTotal = (env: Environment) =>
  env.items.reduce((s, i) => s + itemTotal(i, env), 0);

export const envAdditive = (env: Environment) => Math.max(0, env.additive_value || 0);

export const envTotal = (env: Environment) =>
  envItemsTotal(env) + envServicesTotal(env) + envSuppliesTotal(env) + envAdditive(env);


export const envArea = (env: Environment) =>
  env.items.reduce((s, i) => s + itemArea(i), 0);

export const linesTotal = (lines: SupplyLine[]) =>
  lines.reduce((s, x) => s + x.qty * x.unit_value, 0);

// Round to exact cents (banker-safe for money).
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const calcTotals = (q: QuoteData) => {
  const envSubtotals = q.environments.map((e) => r2(envTotal(e)));
  const productsTotal = r2(q.environments.reduce((s, e) => s + envItemsTotal(e), 0));
  const additivesTotal = r2(q.environments.reduce((s, e) => s + envAdditive(e), 0));
  const envServicesSum = q.environments.reduce(

    (s, e) => s + envServicesTotal(e) + envSuppliesTotal(e),
    0,
  );
  const quoteSuppliesTotal = r2(linesTotal(q.quote_supplies ?? []));
  const servicesSum = r2(envServicesSum + quoteSuppliesTotal);
  const freight = r2((q.freight.qty || 0) * (q.freight.unit_value || 0));
  const pickupItems = q.mfc_pickup?.items ?? [];
  const pickupEnabled = q.mfc_pickup?.enabled !== false;
  const mfcPickup = r2(
    !pickupEnabled
      ? 0
      : pickupItems.length > 0
        ? pickupItems.reduce((s, x) => s + (x.qty || 0) * (x.unit_value || 0), 0)
        : (q.mfc_pickup?.qty || 0) * (q.mfc_pickup?.unit_value || 0),
  );
  const inst = q.installation;
  const installationAuto = inst?.enabled
    ? r2(Math.max(productsTotal * ((inst.percent || 0) / 100), inst.min_value || 0))
    : 0;
  const installation = inst?.enabled
    ? r2(inst.override_value && inst.override_value > 0 ? inst.override_value : installationAuto)
    : 0;
  const baseboardInstall = r2(q.baseboard_install?.enabled ? (q.baseboard_install.value || 0) : 0);
  const baseboardFreight = r2(q.baseboard_freight?.enabled ? (q.baseboard_freight.value || 0) : 0);
  const subtotal = r2(productsTotal + additivesTotal + servicesSum + freight + mfcPickup + installation + baseboardInstall + baseboardFreight);
  // Base do desconto: total do pedido ou apenas materiais (sem insumos, frete e instalação).
  const discountBase = q.discount.scope === "material" ? productsTotal : subtotal;
  const discountValue = r2(
    Math.min(
      discountBase,
      q.discount.type === "percent"
        ? discountBase * ((q.discount.value || 0) / 100)
        : q.discount.value || 0,
    ),
  );
  const total = r2(Math.max(0, subtotal - discountValue));

  // Entrada (novo modelo prevalece). A entrada pode chegar a 100% do total do pedido.
  const newEntry = q.payment.entry;
  const entryRaw = r2(
    newEntry
      ? (newEntry.enabled
          ? (newEntry.type === "percent"
              ? total * ((newEntry.value || 0) / 100)
              : (newEntry.value || 0))
          : 0)
      : (q.payment.entry_type === "percent"
          ? total * ((q.payment.entry_value || 0) / 100)
          : q.payment.entry_value || 0),
  );
  const entry = r2(Math.min(Math.max(0, entryRaw), total));
  const balance = r2(Math.max(0, total - entry));


  // Breakdown novo: linhas multi-método
  type MethodBreak = {
    id: string; method: string; amount: number; installments: number;
    installmentValue: number; lastInstallmentValue: number; installmentsList: number[];
  };
  const methods = q.payment.methods ?? [];
  let methodBreakdown: MethodBreak[] = [];
  if (methods.length > 0) {
    // Calcula valores fixos + percentuais primeiro, depois rateia "remaining"
    const tentative = methods.map((m) => {
      let v = 0;
      if (m.amount_type === "percent") v = balance * ((m.amount || 0) / 100);
      else if (m.amount_type === "value") v = m.amount || 0;
      else v = 0; // remaining: calculado depois
      return { m, v };
    });
    const fixedSum = tentative.reduce((s, t) => s + (t.m.amount_type === "remaining" ? 0 : t.v), 0);
    const remainingCount = tentative.filter((t) => t.m.amount_type === "remaining").length;
    const leftover = Math.max(0, balance - fixedSum);
    const perRemaining = remainingCount > 0 ? leftover / remainingCount : 0;
    methodBreakdown = tentative.map((t) => {
      const amount = r2(t.m.amount_type === "remaining" ? perRemaining : t.v);
      const n = Math.max(1, Math.round(t.m.installments || 1));
      // Parcelas iguais: mesmo valor em todas
      const inst = r2(amount / n);
      const last = inst;
      const list = n > 1 ? Array(n).fill(inst) : [amount];
      return {
        id: t.m.id, method: t.m.method, amount,
        installments: n, installmentValue: inst, lastInstallmentValue: last, installmentsList: list,
      };
    });
  }

  // Compat: parcelas únicas do saldo (legacy)
  const n = q.payment.balance_type === "parcelado" && q.payment.installments > 0
    ? q.payment.installments
    : 1;
  const installmentValue = r2(balance / n);
  const lastInstallmentValue = installmentValue;
  const installmentsList: number[] = n > 1
    ? Array(n).fill(installmentValue)
    : [balance];

  return {
    envSubtotals,
    productsTotal,
    additivesTotal,
    servicesSum,

    quoteSuppliesTotal,
    freight,
    mfcPickup,
    installation,
    installationAuto,
    baseboardInstall,
    baseboardFreight,
    subtotal,
    discountBase,
    discountValue,
    total,
    entry,
    balance,
    installmentValue,
    lastInstallmentValue,
    installmentsList,
    methodBreakdown,
  };
};

export const materialSummary = (q: QuoteData) => {
  const map = new Map<string, number>();
  for (const env of q.environments) {
    const name = (env.material_name || "Material").trim();
    const area = envArea(env);
    map.set(name, (map.get(name) || 0) + area);
  }
  return Array.from(map.entries()).map(([material, area]) => ({
    material,
    area: +area.toFixed(2),
    areaWithLoss: +(area * 1.3).toFixed(2),
  }));
};

/** Agrupa insumos iguais (mesma descrição e valor unitário) somando as quantidades. */
export const mergeSupplies = (lines: SupplyLine[]): SupplyLine[] => {
  const map = new Map<string, SupplyLine>();
  for (const l of lines) {
    const key = `${(l.description || "").trim().toLowerCase()}|${l.unit_value}`;
    const cur = map.get(key);
    if (cur) cur.qty = +(cur.qty + l.qty).toFixed(4);
    else map.set(key, { ...l, qty: l.qty });
  }
  return Array.from(map.values());
};
