import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, num, todayISO } from "@/lib/format";
import { Printer, Users, Hammer, Ruler, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/producao/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatório Geral de Produtividade · Petra" },
      {
        name: "description",
        content:
          "Relatório consolidado de produtividade da Porcelane: produção, vendedores, medição técnica e instalação.",
      },
      { property: "og:title", content: "Relatório Geral de Produtividade · Petra" },
      {
        property: "og:description",
        content: "Desempenho de todos os colaboradores da Porcelane em um único painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelatorioGeral,
});

type Employee = { id: string; name: string; role: string; active: boolean };
type Entry = {
  employee_id: string;
  kind: string;
  value: number | null;
  commission_value: number | null;
  order_id: string | null;
  created_at: string;
};
type OrderRow = {
  id: string;
  number: number;
  client_name: string | null;
  total: number | null;
  status: string;
  created_at: string;
  data: Record<string, unknown> | null;
};
type QuoteRow = {
  id: string;
  number: number;
  total: number | null;
  status: string;
  created_at: string;
  data: Record<string, unknown> | null;
};
type MeasurementRow = {
  id: string;
  measurer_name: string | null;
  measured_m2: number | null;
  measured_total: number | null;
  status: string;
  realized_at: string | null;
  scheduled_at: string;
};

function monthStartISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function sellerOf(data: Record<string, unknown> | null): string {
  if (!data) return "Sem vendedor";
  const d = data as Record<string, any>;
  const v = d.seller ?? d.vendedor ?? d.seller_name ?? d.vendedorNome ?? d?.client?.seller;
  const s = typeof v === "string" ? v.trim() : "";
  return s || "Sem vendedor";
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-black/10 bg-white p-4">{children}</div>;
}

function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <span className="text-black">{icon}</span>
      <h2 className="text-lg font-bold text-black">{title}</h2>
      {hint ? <span className="text-xs text-black/50">{hint}</span> : null}
    </div>
  );
}

function RelatorioGeral() {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());

  const fromTs = `${from}T00:00:00.000Z`;
  const toTs = `${to}T23:59:59.999Z`;

  const { data: employees = [] } = useQuery({
    queryKey: ["rel-employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, name, role, active").order("name");
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["rel-entries", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productivity_entries")
        .select("employee_id, kind, value, commission_value, order_id, created_at")
        .gte("created_at", fromTs)
        .lte("created_at", toTs);
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["rel-orders", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, client_name, total, status, created_at, data")
        .gte("created_at", fromTs)
        .lte("created_at", toTs);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["rel-quotes", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, number, total, status, created_at, data")
        .gte("created_at", fromTs)
        .lte("created_at", toTs);
      if (error) throw error;
      return (data ?? []) as unknown as QuoteRow[];
    },
  });

  const { data: measurements = [] } = useQuery({
    queryKey: ["rel-measurements", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("id, measurer_name, measured_m2, measured_total, status, realized_at, scheduled_at")
        .gte("scheduled_at", fromTs)
        .lte("scheduled_at", toTs);
      if (error) throw error;
      return (data ?? []) as unknown as MeasurementRow[];
    },
  });

  // --- Produção por colaborador ---
  const producao = useMemo(() => {
    const byEmp = new Map<
      string,
      { corteM2: number; acabValor: number; comissao: number; lancamentos: number; pedidos: Set<string> }
    >();
    for (const e of entries) {
      const cur =
        byEmp.get(e.employee_id) ??
        { corteM2: 0, acabValor: 0, comissao: 0, lancamentos: 0, pedidos: new Set<string>() };
      const v = Number(e.value) || 0;
      if (e.kind?.includes("corte")) cur.corteM2 += v;
      else cur.acabValor += v;
      cur.comissao += Number(e.commission_value) || 0;
      cur.lancamentos += 1;
      if (e.order_id) cur.pedidos.add(e.order_id);
      byEmp.set(e.employee_id, cur);
    }
    return employees
      .map((emp) => ({ emp, ...(byEmp.get(emp.id) ?? { corteM2: 0, acabValor: 0, comissao: 0, lancamentos: 0, pedidos: new Set<string>() }) }))
      .filter((r) => r.lancamentos > 0 || r.emp.active)
      .sort((a, b) => b.comissao - a.comissao);
  }, [employees, entries]);

  // --- Vendedores ---
  const vendedores = useMemo(() => {
    const map = new Map<
      string,
      { orcamentos: number; valorOrcado: number; pedidos: number; valorVendido: number }
    >();
    const get = (k: string) =>
      map.get(k) ?? { orcamentos: 0, valorOrcado: 0, pedidos: 0, valorVendido: 0 };
    for (const q of quotes) {
      const k = sellerOf(q.data);
      const c = get(k);
      c.orcamentos += 1;
      c.valorOrcado += Number(q.total) || 0;
      map.set(k, c);
    }
    for (const o of orders) {
      const k = sellerOf(o.data);
      const c = get(k);
      c.pedidos += 1;
      c.valorVendido += Number(o.total) || 0;
      map.set(k, c);
    }
    return [...map.entries()]
      .map(([nome, v]) => ({
        nome,
        ...v,
        conversao: v.orcamentos > 0 ? (v.pedidos / v.orcamentos) * 100 : 0,
      }))
      .sort((a, b) => b.valorVendido - a.valorVendido);
  }, [orders, quotes]);

  // --- Medição técnica ---
  const medidores = useMemo(() => {
    const map = new Map<string, { agendadas: number; realizadas: number; m2: number; valor: number }>();
    for (const m of measurements) {
      const k = (m.measurer_name || "").trim() || "Sem medidor definido";
      const c = map.get(k) ?? { agendadas: 0, realizadas: 0, m2: 0, valor: 0 };
      c.agendadas += 1;
      if (m.status === "realizada") {
        c.realizadas += 1;
        c.m2 += Number(m.measured_m2) || 0;
        c.valor += Number(m.measured_total) || 0;
      }
      map.set(k, c);
    }
    return [...map.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.realizadas - a.realizadas);
  }, [measurements]);

  const totais = useMemo(
    () => ({
      m2Corte: producao.reduce((s, r) => s + r.corteM2, 0),
      comissaoProducao: producao.reduce((s, r) => s + r.comissao, 0),
      vendido: vendedores.reduce((s, r) => s + r.valorVendido, 0),
      pedidos: vendedores.reduce((s, r) => s + r.pedidos, 0),
      medicoes: medidores.reduce((s, r) => s + r.realizadas, 0),
      colaboradores: producao.length,
    }),
    [producao, vendedores, medidores],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">📊 Relatório Geral de Produtividade</h1>
          <p className="text-sm text-black/60">Todos os colaboradores: produção, vendas, medição e instalação.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <label className="text-xs font-bold text-black/70">
            De
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="ml-2 rounded-xl border border-black/15 px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-black/70">
            Até
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="ml-2 rounded-xl border border-black/15 px-2 py-1 text-sm"
            />
          </label>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-black/15 px-3 py-1.5 text-sm font-bold"
          >
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Colaboradores", value: String(totais.colaboradores) },
          { label: "m² cortados", value: num(totais.m2Corte) },
          { label: "Comissão produção", value: brl(totais.comissaoProducao) },
          { label: "Pedidos fechados", value: String(totais.pedidos) },
          { label: "Valor vendido", value: brl(totais.vendido) },
          { label: "Medições realizadas", value: String(totais.medicoes) },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-black/10 bg-white p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-black/50">{k.label}</div>
            <div className="mt-1 text-lg font-bold text-black">{k.value}</div>
          </div>
        ))}
      </div>

      <Card>
        <SectionTitle icon={<Hammer size={18} />} title="Equipe de Produção" hint="corte, acabamento e apoio" />
        {producao.length === 0 ? (
          <p className="text-sm text-black/50">Nenhum lançamento de produção no período.</p>
        ) : (
          <div className="space-y-2">
            {producao.map((r) => (
              <div
                key={r.emp.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 p-3"
              >
                <div className="min-w-[180px]">
                  <div className="font-bold text-black">{r.emp.name}</div>
                  <div className="text-xs text-black/50">
                    {r.emp.role} {r.emp.active ? "" : "· inativo"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>
                    <b>{num(r.corteM2)}</b> m² corte
                  </span>
                  <span>
                    <b>{brl(r.acabValor)}</b> acabamento
                  </span>
                  <span>
                    <b>{r.pedidos.size}</b> pedidos
                  </span>
                  <span>
                    <b>{r.lancamentos}</b> lançamentos
                  </span>
                  <span className="font-bold">{brl(r.comissao)}</span>
                </div>
                <Link
                  to="/producao/relatorio/$employeeId"
                  params={{ employeeId: r.emp.id }}
                  search={{ from, to }}
                  className="rounded-xl border border-black/15 px-3 py-1 text-xs font-bold print:hidden"
                >
                  Detalhar
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={<TrendingUp size={18} />} title="Equipe Comercial (Vendedores)" hint="orçamentos e pedidos" />
        {vendedores.length === 0 ? (
          <p className="text-sm text-black/50">Nenhum orçamento ou pedido no período.</p>
        ) : (
          <div className="space-y-2">
            {vendedores.map((v) => (
              <div
                key={v.nome}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 p-3"
              >
                <div className="min-w-[180px] font-bold text-black">{v.nome}</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>
                    <b>{v.orcamentos}</b> orçamentos
                  </span>
                  <span>
                    <b>{brl(v.valorOrcado)}</b> orçado
                  </span>
                  <span>
                    <b>{v.pedidos}</b> pedidos
                  </span>
                  <span>
                    <b>{v.conversao.toFixed(0)}%</b> conversão
                  </span>
                  <span className="font-bold">{brl(v.valorVendido)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={<Ruler size={18} />} title="Medição Técnica" hint="agendadas e realizadas" />
        {medidores.length === 0 ? (
          <p className="text-sm text-black/50">Nenhuma medição no período.</p>
        ) : (
          <div className="space-y-2">
            {medidores.map((m) => (
              <div
                key={m.nome}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 p-3"
              >
                <div className="min-w-[180px] font-bold text-black">{m.nome}</div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>
                    <b>{m.agendadas}</b> agendadas
                  </span>
                  <span>
                    <b>{m.realizadas}</b> realizadas ✅
                  </span>
                  <span>
                    <b>{num(m.m2)}</b> m² conferidos
                  </span>
                  <span className="font-bold">{brl(m.valor)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={<Users size={18} />} title="Quadro de Colaboradores" hint="cadastro atual" />
        <div className="flex flex-wrap gap-2">
          {employees.map((e) => (
            <span
              key={e.id}
              className="rounded-full border border-black/15 px-3 py-1 text-xs font-bold text-black"
            >
              {e.active ? "🟢" : "⚪"} {e.name} · {e.role}
            </span>
          ))}
        </div>
      </Card>

      <p className="pt-2 text-center text-[11px] text-black/40">
        Documento confidencial · uso exclusivo do destinatário
      </p>
    </div>
  );
}
