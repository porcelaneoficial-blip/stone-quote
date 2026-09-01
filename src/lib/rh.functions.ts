import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: any) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin" as any,
  });
  if (!isAdmin) throw new Error("forbidden");
}

/* ============================== PARCEIROS ============================== */

export const listPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("partners")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const savePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    name: string;
    kind?: string;
    phone?: string | null;
    email?: string | null;
    document?: string | null;
    pix_key?: string | null;
    commission_type?: string;
    commission_value?: number;
    active?: boolean;
    notes?: string | null;
  }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const row = {
      user_id: context.userId,
      name: data.name,
      kind: data.kind ?? "arquiteto",
      phone: data.phone ?? null,
      email: data.email ?? null,
      document: data.document ?? null,
      pix_key: data.pix_key ?? null,
      commission_type: data.commission_type ?? "percent",
      commission_value: data.commission_value ?? 5,
      active: data.active ?? true,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("partners")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("partners")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return ins;
  });

export const deletePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("partners")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================== COLABORADORES (extra RH fields) ============================== */

export const listEmployeesRH = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("employees")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createEmployeeRH = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string;
    role: string;
    cpf?: string | null;
    login?: string | null;
    pin?: string | null;
    phone?: string | null;
    email?: string | null;
    pix_key?: string | null;
    hire_date?: string | null;
    base_salary?: number;
    productivity_type?: string;
    productivity_value?: number;
    commission_type?: string;
    commission_value?: number;
    notes?: string | null;
  }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: ins, error } = await context.supabase
      .from("employees")
      .insert({
        user_id: context.userId,
        name: data.name,
        role: data.role as never,
        cpf: data.cpf ?? null,
        login: data.login || null,
        pin: data.pin || null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        pix_key: data.pix_key ?? null,
        hire_date: data.hire_date || null,
        base_salary: Number(data.base_salary ?? 0),
        productivity_type: data.productivity_type ?? "per_env",
        productivity_value: Number(data.productivity_value ?? 0),
        commission_type: data.commission_type ?? "percent",
        commission_value: Number(data.commission_value ?? 0),
        notes: data.notes ?? null,
        active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return ins;
  });

export const deleteEmployeeRH = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("employees")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateEmployeeRH = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    name?: string;
    role?: string;
    cpf?: string | null;
    login?: string | null;
    pin?: string | null;
    custom_password?: string | null;
    active?: boolean;
    productivity_type?: string;
    productivity_value?: number;
    phone?: string | null;
    email?: string | null;
    pix_key?: string | null;
    hire_date?: string | null;
    base_salary?: number;
    commission_type?: string;
    commission_value?: number;
    notes?: string | null;
  }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { id, ...rest } = data;
    const patch = { ...rest, ...(rest.role ? { role: rest.role as never } : {}) };
    const { error } = await context.supabase
      .from("employees")
      .update(patch as never)
      .eq("id", id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================== FOLHA / CONTRACHEQUES ============================== */

// Tabelas oficiais 2024 (referência) — mantidas locais para transparência.
function calcINSS(gross: number): number {
  // faixas progressivas
  const brackets = [
    { limit: 1412.00, rate: 0.075 },
    { limit: 2666.68, rate: 0.09 },
    { limit: 4000.03, rate: 0.12 },
    { limit: 7786.02, rate: 0.14 },
  ];
  let prev = 0, total = 0;
  for (const b of brackets) {
    if (gross > b.limit) {
      total += (b.limit - prev) * b.rate;
      prev = b.limit;
    } else {
      total += (gross - prev) * b.rate;
      return round2(total);
    }
  }
  return round2(total); // teto
}

function calcIRRF(base: number): number {
  // base = bruto - INSS - dependentes (aqui sem dependentes)
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return round2(base * 0.075 - 169.44);
  if (base <= 3751.05) return round2(base * 0.15 - 381.44);
  if (base <= 4664.68) return round2(base * 0.225 - 662.77);
  return round2(base * 0.275 - 896.00);
}

function calcFGTS(gross: number): number { return round2(gross * 0.08); }
function round2(n: number): number { return Math.round(n * 100) / 100; }

export const generatePayroll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year: number; month: number }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .rpc("rh_generate_payroll", { p_year: data.year, p_month: data.month });
    if (error) throw new Error(error.message);

    // Enriquecer contracheques com INSS / IRRF / FGTS
    const { data: slips } = await context.supabase
      .from("payslips")
      .select("id, base_salary, commissions_total, breakdown")
      .eq("reference_year", data.year)
      .eq("reference_month", data.month);

    for (const s of (slips ?? []) as any[]) {
      const gross = Number(s.base_salary || 0) + Number(s.commissions_total || 0);
      const inss = calcINSS(gross);
      const irrfBase = gross - inss;
      const irrf = calcIRRF(irrfBase);
      const fgts = calcFGTS(gross); // recolhido pelo empregador, não desconta
      const netTotal = round2(gross - inss - irrf);
      const breakdown = {
        ...(s.breakdown ?? {}),
        gross,
        inss,
        irrf,
        irrf_base: round2(irrfBase),
        fgts_employer: fgts,
        deductions_total: round2(inss + irrf),
      };
      await context.supabase
        .from("payslips")
        .update({ breakdown, net_total: netTotal })
        .eq("id", s.id);
    }

    return rows ?? [];
  });

export const listPayslips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year: number; month: number }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("payslips")
      .select("id, employee_id, reference_month, reference_year, base_salary, commissions_total, net_total, status, payable_id, breakdown, paid_at, employees(name, role)")
      .eq("reference_year", data.year)
      .eq("reference_month", data.month)
      .order("employee_id");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ============================== SERVIÇOS DE PRODUTIVIDADE ============================== */

export const listProductivityServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("productivity_services")
      .select("*")
      .order("applies_to")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveProductivityService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    name: string;
    applies_to: "cortador" | "acabador" | "ambos" | "montador";
    pricing_kind?: "per_unit" | "per_m2_national" | "per_m2_imported";
    unit_price: number;
    active?: boolean;
    notes?: string | null;
  }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const row = {
      user_id: context.userId,
      name: data.name,
      applies_to: data.applies_to,
      pricing_kind: data.pricing_kind ?? "per_unit",
      unit_price: Number(data.unit_price || 0),
      active: data.active ?? true,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("productivity_services")
        .update(row)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("productivity_services")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return ins;
  });

export const deleteProductivityService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("productivity_services")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================== PRODUTIVIDADE A PAGAR ============================== */

export const listProductivityPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string; status?: "a_pagar" | "pago" | "cancelado" | "todos" }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("productivity_entries")
      .select("id, employee_id, order_id, env_name, env_material, kind, value, commission_value, gross_value, discount_pct, base_value, payout_status, paid_at, created_at, employees(name, role), orders(number, client_name)")
      .gte("created_at", data.from)
      .lte("created_at", data.to)
      .order("created_at", { ascending: false });
    if (data.status && data.status !== "todos") q = q.eq("payout_status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const markProductivityPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) => d)
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: count, error } = await context.supabase
      .rpc("mark_productivity_paid", { p_ids: data.ids });
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });
