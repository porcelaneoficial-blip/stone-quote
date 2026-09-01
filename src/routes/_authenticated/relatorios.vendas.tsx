import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { brl , todayISO } from "@/lib/format";
import { envTotal } from "@/lib/quote-calc";
import type { Environment } from "@/lib/types";
import { Printer, ArrowLeft } from "lucide-react";
import { loadCommissionRules, resolveSellerCommissionPct } from "@/lib/commission";

type TabKey = "resumo" | "interno" | "externo" | "tecnica" | "produtividade";
type Search = { from?: string; to?: string; seller?: string; tab?: TabKey };

export const Route = createFileRoute("/_authenticated/relatorios/vendas")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
    seller: typeof s.seller === "string" ? s.seller : undefined,
    tab: (["resumo", "interno", "externo", "tecnica", "produtividade"] as const).includes(s.tab as TabKey) ? (s.tab as TabKey) : undefined,
  }),
  component: RelatorioVendas,
});


type Seller = { id: string; name: string; commission_pct: number; kind: "interno" | "externo" | null };
type TechMeasurer = { id: string; name: string; commission_pct: number };

function RelatorioVendas() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const today = todayISO();
  const monthStart = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  })();
  const from = search.from || monthStart;
  const to = search.to || today;
  const sellerFilter = search.seller || "";
  const tab: TabKey = search.tab || "resumo";

  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  const { data: sellers } = useQuery({
    queryKey: ["sellers-rep"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("id, name, commission_pct, kind")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });

  const { data: techs } = useQuery({
    queryKey: ["tech-measurers-rep"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tech_measurers")
        .select("id, name, commission_pct")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as TechMeasurer[];
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-rep"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, role, productivity_type, productivity_value")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; role: string; productivity_type: string; productivity_value: number }[];
    },
  });


  const { data: rules } = useQuery({
    queryKey: ["commission-rules"],
    queryFn: () => loadCommissionRules(true),
  });

  const { data: quotes } = useQuery({
    queryKey: ["quotes-rep", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, number, status, total, client_name, data, created_at")
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; number: number; status: string; total: number; client_name: string; data: any; created_at: string }[];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["orders-rep", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, status, total, client_name, data, created_at")
        .gte("created_at", from + "T00:00:00")
        .lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; number: number; status: string; total: number; client_name: string; data: any; created_at: string }[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("company_settings").select("*").eq("user_id", u.user.id).maybeSingle();
      return data as any;
    },
  });

  // === Vendedores (Interno / Externo / Resumo) ===
  type SellerRow = {
    seller_id: string;
    name: string;
    kind: "interno" | "externo";
    commission_pct: number;
    orcamentos: number; orcamentos_total: number;
    aprovados: number; aprovados_total: number;
    pedidos: number; pedidos_total: number;
    comissao_aprovacao: number;
    items: { number: number; client: string; total: number; pct: number; commission: number; date: string }[];
  };

  const sellerReport = useMemo<SellerRow[]>(() => {
    const map = new Map<string, SellerRow>();
    const sellersList = sellers ?? [];
    const rulesList = rules ?? [];

    const ensure = (id: string, name: string, kind: "interno" | "externo", pct: number) => {
      if (!map.has(id)) {
        map.set(id, {
          seller_id: id, name, kind, commission_pct: pct,
          orcamentos: 0, orcamentos_total: 0,
          aprovados: 0, aprovados_total: 0,
          pedidos: 0, pedidos_total: 0,
          comissao_aprovacao: 0,
          items: [],
        });
      }
      return map.get(id)!;
    };

    const resolveSeller = (sid: string | undefined, fallback: string | undefined) => {
      const s = sid ? sellersList.find((x) => x.id === sid) : sellersList.find((x) => x.name.toLowerCase() === (fallback ?? "").toLowerCase());
      if (s) return { id: s.id, name: s.name, kind: (s.kind ?? "interno") as "interno" | "externo", pct: Number(s.commission_pct) };
      if (fallback) return { id: "name:" + fallback, name: fallback, kind: "interno" as const, pct: 0 };
      return null;
    };

    for (const q of quotes ?? []) {
      const s = resolveSeller(q.data?.seller_id, q.data?.salesperson);
      if (!s) continue;
      const r = ensure(s.id, s.name, s.kind, s.pct);
      r.orcamentos += 1;
      r.orcamentos_total += Number(q.total) || 0;
      if (q.status === "aprovado") {
        r.aprovados += 1;
        r.aprovados_total += Number(q.total) || 0;
      }
    }

    for (const o of orders ?? []) {
      const s = resolveSeller(o.data?.seller_id, o.data?.salesperson);
      if (!s) continue;
      const r = ensure(s.id, s.name, s.kind, s.pct);
      const total = Number(o.total) || 0;
      r.pedidos += 1;
      r.pedidos_total += total;
      // Comissão automática na aprovação do pedido
      const pct = resolveSellerCommissionPct(rulesList, {
        seller_id: s.id.startsWith("name:") ? null : s.id,
        scope: s.kind === "externo" ? "external" : "seller",
        value: total,
      }) || s.pct;
      const commission = (total * pct) / 100;
      r.comissao_aprovacao += commission;
      r.items.push({ number: o.number, client: o.client_name, total, pct, commission, date: o.created_at });
    }

    let arr = Array.from(map.values()).sort((a, b) => b.pedidos_total - a.pedidos_total);
    if (sellerFilter) arr = arr.filter((r) => r.seller_id === sellerFilter);
    return arr;
  }, [quotes, orders, sellers, rules, sellerFilter]);

  // === Med Técnica ===
  type TechRow = {
    tech_id: string;
    name: string;
    commission_pct: number;
    liberacoes: number;
    liberacoes_valor: number;
    comissao_liberacao: number;
    items: { number: number; client: string; env: string; value: number; pct: number; commission: number; date: string }[];
  };

  const techReport = useMemo<TechRow[]>(() => {
    const map = new Map<string, TechRow>();
    const techsList = techs ?? [];
    const ensure = (id: string, name: string, pct: number) => {
      if (!map.has(id)) {
        map.set(id, { tech_id: id, name, commission_pct: pct, liberacoes: 0, liberacoes_valor: 0, comissao_liberacao: 0, items: [] });
      }
      return map.get(id)!;
    };

    for (const o of orders ?? []) {
      const tid = o.data?.tech_measurer_id as string | undefined;
      const t = tid ? techsList.find((x) => x.id === tid) : null;
      const techName = t?.name ?? "Sem técnica designada";
      const techId = t?.id ?? "__none__";
      const pct = t ? Number(t.commission_pct) : 0;

      const envs: Environment[] = o.data?.environments ?? [];
      for (const env of envs) {
        if (!env.released_for_cut_at) continue;
        const t0 = new Date(env.released_for_cut_at).getTime();
        if (t0 < new Date(from + "T00:00:00").getTime() || t0 > new Date(to + "T23:59:59").getTime()) continue;
        const val = envTotal(env);
        const commission = (val * pct) / 100;
        const row = ensure(techId, techName, pct);
        row.liberacoes += 1;
        row.liberacoes_valor += val;
        row.comissao_liberacao += commission;
        row.items.push({ number: o.number, client: o.client_name, env: env.name, value: val, pct, commission, date: env.released_for_cut_at });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.comissao_liberacao - a.comissao_liberacao);
  }, [orders, techs, from, to]);

  // === Produtividade (funcionários de produção) ===
  type ProdRow = {
    employee_id: string;
    name: string;
    role: string;
    productivity_type: string;
    productivity_value: number;
    corte_count: number; corte_m2: number;
    acab_count: number; acab_m2: number;
    valor: number;
    items: { number: number; client: string; env: string; stage: "corte" | "acabamento"; m2: number; date: string }[];
  };

  const prodReport = useMemo<ProdRow[]>(() => {
    const map = new Map<string, ProdRow>();
    const empList = employees ?? [];
    const f = new Date(from + "T00:00:00").getTime();
    const t = new Date(to + "T23:59:59").getTime();
    const inRange = (iso?: string) => {
      if (!iso) return false;
      const ts = new Date(iso).getTime();
      return !isNaN(ts) && ts >= f && ts <= t;
    };
    const ensure = (id: string) => {
      if (!map.has(id)) {
        const e = empList.find((x) => x.id === id);
        if (!e) return null;
        map.set(id, {
          employee_id: id, name: e.name, role: e.role,
          productivity_type: e.productivity_type, productivity_value: Number(e.productivity_value) || 0,
          corte_count: 0, corte_m2: 0, acab_count: 0, acab_m2: 0, valor: 0, items: [],
        });
      }
      return map.get(id)!;
    };
    for (const o of orders ?? []) {
      const envs: Environment[] = o.data?.environments ?? [];
      for (const env of envs) {
        const area = (env.items ?? []).reduce((s, it) => s + (Number(it.length) || 0) * (Number(it.width) || 0), 0);
        if (env.cutter_id && inRange(env.cut_done_at)) {
          const r = ensure(env.cutter_id);
          if (r) {
            r.corte_count += 1;
            r.corte_m2 += area;
            r.items.push({ number: o.number, client: o.client_name, env: env.name, stage: "corte", m2: area, date: env.cut_done_at! });
          }
        }
        if (env.finisher_id && inRange(env.finish_done_at)) {
          const r = ensure(env.finisher_id);
          if (r) {
            r.acab_count += 1;
            r.acab_m2 += area;
            r.items.push({ number: o.number, client: o.client_name, env: env.name, stage: "acabamento", m2: area, date: env.finish_done_at! });
          }
        }
      }
    }
    for (const r of map.values()) {
      const totalCount = r.corte_count + r.acab_count;
      const totalM2 = r.corte_m2 + r.acab_m2;
      r.valor = r.productivity_type === "per_env" ? r.productivity_value * totalCount : r.productivity_value * totalM2;
      r.items.sort((a, b) => a.date.localeCompare(b.date));
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [orders, employees, from, to]);

  const prodTotals = useMemo(() => prodReport.reduce((acc, r) => ({
    corte_count: acc.corte_count + r.corte_count,
    corte_m2: acc.corte_m2 + r.corte_m2,
    acab_count: acc.acab_count + r.acab_count,
    acab_m2: acc.acab_m2 + r.acab_m2,
    valor: acc.valor + r.valor,
  }), { corte_count: 0, corte_m2: 0, acab_count: 0, acab_m2: 0, valor: 0 }), [prodReport]);


  const apply = () => {
    navigate({ search: { from: localFrom, to: localTo, seller: sellerFilter || undefined, tab } });
  };

  const visibleSellers = useMemo(() => {
    if (tab === "interno") return sellerReport.filter((r) => r.kind === "interno");
    if (tab === "externo") return sellerReport.filter((r) => r.kind === "externo");
    return sellerReport;
  }, [sellerReport, tab]);

  const sellerTotals = useMemo(() => visibleSellers.reduce((acc, r) => ({
    orcamentos: acc.orcamentos + r.orcamentos,
    orcamentos_total: acc.orcamentos_total + r.orcamentos_total,
    aprovados: acc.aprovados + r.aprovados,
    aprovados_total: acc.aprovados_total + r.aprovados_total,
    pedidos: acc.pedidos + r.pedidos,
    pedidos_total: acc.pedidos_total + r.pedidos_total,
    comissao_aprovacao: acc.comissao_aprovacao + r.comissao_aprovacao,
  }), { orcamentos: 0, orcamentos_total: 0, aprovados: 0, aprovados_total: 0, pedidos: 0, pedidos_total: 0, comissao_aprovacao: 0 }), [visibleSellers]);

  const techTotals = useMemo(() => techReport.reduce((acc, r) => ({
    liberacoes: acc.liberacoes + r.liberacoes,
    liberacoes_valor: acc.liberacoes_valor + r.liberacoes_valor,
    comissao_liberacao: acc.comissao_liberacao + r.comissao_liberacao,
  }), { liberacoes: 0, liberacoes_valor: 0, comissao_liberacao: 0 }), [techReport]);

  const setTab = (t: TabKey) => navigate({ search: { from, to, seller: sellerFilter || undefined, tab: t } });

  const TABS: { id: TabKey; label: string }[] = [
    { id: "resumo", label: "Resumo Geral" },
    { id: "interno", label: "Vendedor Interno" },
    { id: "externo", label: "Vendedor Externo" },
    { id: "tecnica", label: "Med Técnica" },
    { id: "produtividade", label: "Produtividade" },
  ];


  return (
    <div className="max-w-6xl mx-auto px-6 py-8 report-bw">
      <div className="flex items-center justify-between mb-6 print:hidden gap-4 flex-wrap">
        <Link to="/" className="text-sm text-stone-500 hover:text-stone-950 inline-flex items-center gap-1">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-stone-400 mb-1">De</label>
            <input type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} className="border border-stone-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-stone-400 mb-1">Até</label>
            <input type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} className="border border-stone-300 px-2 py-1.5 text-sm" />
          </div>
          {tab !== "tecnica" && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-400 mb-1">Vendedor</label>
              <select
                value={sellerFilter}
                onChange={(e) => navigate({ search: { from, to, seller: e.target.value || undefined, tab } })}
                className="border border-stone-300 px-2 py-1.5 text-sm bg-white"
              >
                <option value="">Todos</option>
                {(sellers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <button onClick={apply} className="bg-stone-200 px-3 py-2 text-sm hover:bg-stone-300">Aplicar</button>
          <button onClick={() => window.print()} className="bg-stone-950 text-white px-4 py-2 flex items-center gap-2 text-sm hover:bg-stone-800">
            <Printer className="size-4" /> Imprimir
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-stone-200 mb-6 overflow-x-auto print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs uppercase tracking-widest font-bold border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? "border-stone-950 text-stone-950" : "border-transparent text-stone-400 hover:text-stone-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-stone-200 p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-stone-200 pb-4 mb-6">
          <div>
            {settings?.logo_url && <img src={settings.logo_url} alt="" className="h-12 mb-3 object-contain" />}
            <p className="text-[10px] uppercase tracking-widest text-stone-400">Relatório</p>
            <h1 className="font-display text-3xl mt-1">
              {tab === "tecnica" ? "Comissão · Med Técnica" : tab === "interno" ? "Vendas e Comissão · Vendedor Interno" : tab === "externo" ? "Vendas e Comissão · Vendedor Externo" : tab === "produtividade" ? "Produtividade da Produção" : "Orçamentos e Vendas por Vendedor"}
            </h1>

          </div>
          <div className="text-right text-xs text-stone-500">
            <p>Período</p>
            <p className="font-mono text-stone-900 text-sm">{from} a {to}</p>
          </div>
        </div>

        {tab === "produtividade" ? (
          <ProdReport rows={prodReport} totals={prodTotals} from={from} to={to} />
        ) : tab !== "tecnica" ? (
          <SellerReport rows={visibleSellers} totals={sellerTotals} />
        ) : (
          <TechReport rows={techReport} totals={techTotals} />
        )}

      </div>
    </div>
  );
}

function SellerReport({ rows, totals }: { rows: any[]; totals: any }) {
  return (
    <>
      <div className="space-y-8">
        {rows.length === 0 && <p className="text-sm text-stone-400">Sem dados no período.</p>}
        {rows.map((r) => (
          <section key={r.seller_id} className="border border-stone-200">
            <header className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-display text-xl">{r.name}</h2>
                <span className="text-[10px] uppercase tracking-widest text-stone-400">{r.kind}</span>
              </div>
              <span className="text-xs text-stone-500">Comissão padrão: {Number(r.commission_pct).toFixed(2)}%</span>
            </header>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-stone-100">
              <Stat label="Orçamentos" main={String(r.orcamentos)} sub={brl(r.orcamentos_total)} />
              <Stat label="Aprovados" main={String(r.aprovados)} sub={brl(r.aprovados_total)} />
              <Stat label="Pedidos / Vendas" main={String(r.pedidos)} sub={brl(r.pedidos_total)} />
              <Stat label="Comissão (aprovados)" main={brl(r.comissao_aprovacao)} sub={`${r.pedidos} pedido(s)`} />
            </div>
            {r.items.length > 0 && (
              <div className="border-t border-stone-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
                    <tr>
                      <th className="text-left p-2">Pedido</th>
                      <th className="text-left p-2">Cliente</th>
                      <th className="text-right p-2">Total</th>
                      <th className="text-right p-2">%</th>
                      <th className="text-right p-2">Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {r.items.map((it: any, i: number) => (
                      <tr key={i}>
                        <td className="p-2 font-mono">PED-{String(it.number).padStart(6, "0")}</td>
                        <td className="p-2">{it.client}</td>
                        <td className="p-2 text-right font-mono">{brl(it.total)}</td>
                        <td className="p-2 text-right font-mono">{Number(it.pct).toFixed(2)}%</td>
                        <td className="p-2 text-right font-mono font-bold">{brl(it.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="mt-8 border-t-2 border-stone-300 pt-4">
          <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-3 font-bold">Total Geral</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Stat label="Total Orçamentos" main={String(totals.orcamentos)} sub={brl(totals.orcamentos_total)} />
            <Stat label="Total Aprovados" main={String(totals.aprovados)} sub={brl(totals.aprovados_total)} />
            <Stat label="Total Pedidos" main={String(totals.pedidos)} sub={brl(totals.pedidos_total)} />
            <Stat label="Total Comissão" main={brl(totals.comissao_aprovacao)} sub="" />
          </div>
        </div>
      )}
    </>
  );
}

function TechReport({ rows, totals }: { rows: any[]; totals: any }) {
  return (
    <>
      <div className="space-y-8">
        {rows.length === 0 && <p className="text-sm text-stone-400">Nenhuma liberação no período.</p>}
        {rows.map((r) => (
          <section key={r.tech_id} className="border border-stone-200">
            <header className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <h2 className="font-display text-xl">{r.name}</h2>
              <span className="text-xs text-stone-500">Comissão: {Number(r.commission_pct).toFixed(2)}% · liberado p/ corte</span>
            </header>
            <div className="grid grid-cols-3 divide-x divide-stone-100">
              <Stat label="Ambientes liberados" main={String(r.liberacoes)} sub="" />
              <Stat label="Valor liberado" main={brl(r.liberacoes_valor)} sub="" />
              <Stat label="Comissão" main={brl(r.comissao_liberacao)} sub="" />
            </div>
            {r.items.length > 0 && (
              <div className="border-t border-stone-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
                    <tr>
                      <th className="text-left p-2">Pedido</th>
                      <th className="text-left p-2">Cliente</th>
                      <th className="text-left p-2">Ambiente</th>
                      <th className="text-right p-2">Valor</th>
                      <th className="text-right p-2">%</th>
                      <th className="text-right p-2">Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {r.items.map((it: any, i: number) => (
                      <tr key={i}>
                        <td className="p-2 font-mono">PED-{String(it.number).padStart(6, "0")}</td>
                        <td className="p-2">{it.client}</td>
                        <td className="p-2">{it.env}</td>
                        <td className="p-2 text-right font-mono">{brl(it.value)}</td>
                        <td className="p-2 text-right font-mono">{Number(it.pct).toFixed(2)}%</td>
                        <td className="p-2 text-right font-mono font-bold">{brl(it.commission)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="mt-8 border-t-2 border-stone-300 pt-4">
          <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-3 font-bold">Total Geral</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <Stat label="Total Liberações" main={String(totals.liberacoes)} sub="" />
            <Stat label="Total Valor" main={brl(totals.liberacoes_valor)} sub="" />
            <Stat label="Total Comissão" main={brl(totals.comissao_liberacao)} sub="" />
          </div>
        </div>
      )}
    </>
  );
}

function ProdReport({ rows, totals, from, to }: { rows: any[]; totals: any; from: string; to: string }) {
  return (
    <>
      <div className="space-y-8">
        {rows.length === 0 && <p className="text-sm text-stone-400">Sem produção registrada no período.</p>}
        {rows.map((r) => (
          <section key={r.employee_id} className="border border-stone-200">
            <header className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-display text-xl">{r.name}</h2>
                <span className="text-[10px] uppercase tracking-widest text-stone-400">{r.role}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-stone-500">
                  {r.productivity_type === "per_env" ? `${brl(r.productivity_value)} / ambiente` : `${brl(r.productivity_value)} / m²`}
                </span>
                <Link
                  to="/producao/relatorio/$employeeId"
                  params={{ employeeId: r.employee_id }}
                  search={{ from, to }}
                  className="text-xs underline text-stone-700 hover:text-stone-950"
                >
                  Ver relatório completo
                </Link>
              </div>
            </header>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-stone-100">
              <Stat label="Corte (concluído)" main={String(r.corte_count)} sub={`${r.corte_m2.toFixed(2)} m²`} />
              <Stat label="Acabamento (concluído)" main={String(r.acab_count)} sub={`${r.acab_m2.toFixed(2)} m²`} />
              <Stat label="Total ambientes" main={String(r.corte_count + r.acab_count)} sub={`${(r.corte_m2 + r.acab_m2).toFixed(2)} m²`} />
              <Stat label="A Receber" main={brl(r.valor)} sub="" />
            </div>
            {r.items.length > 0 && (
              <div className="border-t border-stone-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
                    <tr>
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">Pedido</th>
                      <th className="text-left p-2">Cliente</th>
                      <th className="text-left p-2">Ambiente</th>
                      <th className="text-left p-2">Etapa</th>
                      <th className="text-right p-2">m²</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {r.items.map((it: any, i: number) => (
                      <tr key={i}>
                        <td className="p-2 font-mono text-xs">{new Date(it.date).toLocaleDateString("pt-BR")}</td>
                        <td className="p-2 font-mono">PED-{String(it.number).padStart(6, "0")}</td>
                        <td className="p-2">{it.client}</td>
                        <td className="p-2">{it.env}</td>
                        <td className="p-2 capitalize">{it.stage}</td>
                        <td className="p-2 text-right font-mono">{it.m2.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
      {rows.length > 0 && (
        <div className="mt-8 border-t-2 border-stone-300 pt-4">
          <p className="text-[10px] uppercase tracking-widest text-stone-500 mb-3 font-bold">Total Geral</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Stat label="Cortes concluídos" main={String(totals.corte_count)} sub={`${totals.corte_m2.toFixed(2)} m²`} />
            <Stat label="Acabamentos concluídos" main={String(totals.acab_count)} sub={`${totals.acab_m2.toFixed(2)} m²`} />
            <Stat label="Total ambientes" main={String(totals.corte_count + totals.acab_count)} sub={`${(totals.corte_m2 + totals.acab_m2).toFixed(2)} m²`} />
            <Stat label="Total a pagar" main={brl(totals.valor)} sub="" />
          </div>
        </div>
      )}
    </>
  );
}


function Stat({ label, main, sub }: { label: string; main: string; sub: string }) {
  return (
    <div className="p-4">
      <p className="text-[10px] uppercase tracking-widest text-stone-400">{label}</p>
      <p className="font-display text-2xl mt-1">{main}</p>
      {sub && <p className="text-xs text-stone-500 font-mono">{sub}</p>}
    </div>
  );
}
