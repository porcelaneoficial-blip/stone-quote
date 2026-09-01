import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Environment } from "@/lib/types";
import { Printer, ArrowLeft, FileDown } from "lucide-react";
import { brl , todayISO } from "@/lib/format";

type Search = { from?: string; to?: string };

type StageSummary = { count: number; m2: number };

type DailySummary = {
  iso: string;
  date: string;
  iniciou_corte: StageSummary;
  concluiu_corte: StageSummary;
  iniciou_acabamento: StageSummary;
  concluiu_acabamento: StageSummary;
};

export const Route = createFileRoute("/_authenticated/producao/relatorio/$employeeId")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
  }),
  component: RelatorioFuncionario,
});

function envArea(env: Environment): number {
  return (env.items ?? []).reduce((s, it) => s + (Number(it.length) || 0) * (Number(it.width) || 0), 0);
}

function RelatorioFuncionario() {
  const { employeeId } = Route.useParams();
  const { from: fromQ, to: toQ } = Route.useSearch();
  const today = todayISO();
  const monthStart = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  })();
  const from = fromQ || monthStart;
  const to = toQ || today;

  const { data: employee } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, role, productivity_type, productivity_value")
        .eq("id", employeeId)
        .single();
      if (error) throw error;
      return data as { id: string; name: string; role: string; productivity_type: string; productivity_value: number };
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

  const { data: orders } = useQuery({
    queryKey: ["orders-for-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, client_name, data, created_at")
        .order("number", { ascending: false });
      if (error) throw error;
      return data as { id: string; number: number; client_name: string; data: any; created_at: string }[];
    },
  });

  const rows = useMemo(() => {
    const f = new Date(from + "T00:00:00").getTime();
    const t = new Date(to + "T23:59:59").getTime();
    const inRange = (iso?: string) => {
      if (!iso) return false;
      const ts = new Date(iso).getTime();
      return !isNaN(ts) && ts >= f && ts <= t;
    };
    const out: {
      order_number: number;
      client: string;
      env_name: string;
      material: string;
      m2: number;
      role: "corte" | "acabamento";
      stage: "iniciou_corte" | "concluiu_corte" | "iniciou_acabamento" | "concluiu_acabamento";
      done_at: string;
    }[] = [];
    for (const o of orders ?? []) {
      const envs: Environment[] = o.data?.environments ?? [];
      for (const env of envs) {
        const area = envArea(env);
        const base = {
          order_number: o.number,
          client: o.client_name || "—",
          env_name: env.name,
          material: env.material_name || "—",
          m2: area,
        };
        if (env.cutter_id === employeeId) {
          if (inRange(env.cut_started_at)) {
            out.push({ ...base, role: "corte", stage: "iniciou_corte", done_at: env.cut_started_at! });
          }
          if (inRange(env.cut_done_at)) {
            out.push({ ...base, role: "corte", stage: "concluiu_corte", done_at: env.cut_done_at! });
          }
        }
        if (env.finisher_id === employeeId) {
          if (inRange(env.finish_started_at)) {
            out.push({ ...base, role: "acabamento", stage: "iniciou_acabamento", done_at: env.finish_started_at! });
          }
          if (inRange(env.finish_done_at)) {
            out.push({ ...base, role: "acabamento", stage: "concluiu_acabamento", done_at: env.finish_done_at! });
          }
        }
      }
    }
    return out.sort((a, b) => a.done_at.localeCompare(b.done_at));
  }, [orders, employeeId, from, to]);

  const dailySummary = useMemo(() => {
    const map = new Map<string, DailySummary>();
    for (const r of rows) {
      if (!r.done_at) continue;
      const iso = new Date(r.done_at).toISOString().slice(0, 10);
      if (!map.has(iso)) {
        map.set(iso, {
          iso,
          date: new Date(r.done_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          iniciou_corte: { count: 0, m2: 0 },
          concluiu_corte: { count: 0, m2: 0 },
          iniciou_acabamento: { count: 0, m2: 0 },
          concluiu_acabamento: { count: 0, m2: 0 },
        });
      }
      const day = map.get(iso)!;
      day[r.stage].count += 1;
      day[r.stage].m2 += r.m2;
    }
    return Array.from(map.values()).sort((a, b) => a.iso.localeCompare(b.iso));
  }, [rows]);


  const stageLabel = (s: (typeof rows)[number]["stage"]) => ({
    iniciou_corte: "Iniciou corte",
    concluiu_corte: "Concluiu corte",
    iniciou_acabamento: "Iniciou acabamento",
    concluiu_acabamento: "Concluiu acabamento",
  }[s]);

  const completedRows = rows.filter((r) => r.stage === "concluiu_corte" || r.stage === "concluiu_acabamento");
  const totalEnvs = completedRows.length;
  const totalM2 = completedRows.reduce((s, r) => s + r.m2, 0);
  const perEnv = Number(employee?.productivity_value ?? 0);
  const valor = (employee?.productivity_type === "per_env" ? perEnv * totalEnvs : perEnv * totalM2);
  const calcValue = (count: number, m2: number) =>
    employee?.productivity_type === "per_env" ? perEnv * count : perEnv * m2;


  return (
    <div className="max-w-4xl mx-auto px-6 py-8 report-bw">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link to="/producao" className="text-sm text-stone-500 hover:text-stone-950 inline-flex items-center gap-1">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <div className="flex items-center gap-3">
          <form className="flex items-end gap-2 text-xs">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-400 mb-1">De</label>
              <input
                type="date"
                defaultValue={from}
                onChange={(e) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("from", e.target.value);
                  window.location.href = url.toString();
                }}
                className="border border-stone-300 px-2 py-1.5"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-400 mb-1">Até</label>
              <input
                type="date"
                defaultValue={to}
                onChange={(e) => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("to", e.target.value);
                  window.location.href = url.toString();
                }}
                className="border border-stone-300 px-2 py-1.5"
              />
            </div>
          </form>
          <button
            onClick={() => {
              const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
              const toRow = (arr: unknown[]) => arr.map(esc).join(";");
              const money = (n: number) => n.toFixed(2).replace(".", ",");
              const out: string[] = [];
              out.push(toRow([`Relatório de Produtividade`]));
              out.push(toRow([`Funcionário: ${employee?.name ?? ""}`]));
              out.push(toRow([`Setor: ${employee?.role ?? ""}`]));
              out.push(toRow([`Função: ${employee?.role ?? ""}`]));
              out.push(toRow([`Período: ${from} a ${to}`]));
              out.push(toRow([
                `Ambientes concluídos: ${totalEnvs}`,
                `m² Produzidos: ${money(totalM2)}`,
                `A Receber: ${money(valor)}`,
              ]));
              out.push("");
              out.push(toRow(["RESUMO DIÁRIO"]));
              out.push(toRow([
                "Data",
                "Iniciou corte (qtd)", "Iniciou corte (m²)",
                "Concluiu corte (qtd)", "Concluiu corte (m²)",
                "Iniciou acab. (qtd)", "Iniciou acab. (m²)",
                "Concluiu acab. (qtd)", "Concluiu acab. (m²)",
                "Valor corte", "Valor acab.", "Total a receber",
              ]));
              for (const d of dailySummary) {
                const vC = calcValue(d.concluiu_corte.count, d.concluiu_corte.m2);
                const vA = calcValue(d.concluiu_acabamento.count, d.concluiu_acabamento.m2);
                out.push(toRow([
                  d.date,
                  d.iniciou_corte.count, money(d.iniciou_corte.m2),
                  d.concluiu_corte.count, money(d.concluiu_corte.m2),
                  d.iniciou_acabamento.count, money(d.iniciou_acabamento.m2),
                  d.concluiu_acabamento.count, money(d.concluiu_acabamento.m2),
                  money(vC), money(vA), money(vC + vA),
                ]));
              }
              out.push(toRow([
                "Total",
                dailySummary.reduce((a, d) => a + d.iniciou_corte.count, 0),
                money(dailySummary.reduce((a, d) => a + d.iniciou_corte.m2, 0)),
                dailySummary.reduce((a, d) => a + d.concluiu_corte.count, 0),
                money(dailySummary.reduce((a, d) => a + d.concluiu_corte.m2, 0)),
                dailySummary.reduce((a, d) => a + d.iniciou_acabamento.count, 0),
                money(dailySummary.reduce((a, d) => a + d.iniciou_acabamento.m2, 0)),
                dailySummary.reduce((a, d) => a + d.concluiu_acabamento.count, 0),
                money(dailySummary.reduce((a, d) => a + d.concluiu_acabamento.m2, 0)),
                money(dailySummary.reduce((a, d) => a + calcValue(d.concluiu_corte.count, d.concluiu_corte.m2), 0)),
                money(dailySummary.reduce((a, d) => a + calcValue(d.concluiu_acabamento.count, d.concluiu_acabamento.m2), 0)),
                money(valor),
              ]));
              out.push("");
              out.push(toRow(["DETALHAMENTO POR ETAPA"]));
              out.push(toRow(["Data", "Hora", "Pedido", "Cliente", "Ambiente", "Material", "Etapa", "m²"]));
              for (const r of rows) {
                out.push(toRow([
                  r.done_at ? new Date(r.done_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
                  r.done_at ? new Date(r.done_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "",
                  `PED-${String(r.order_number).padStart(6, "0")}`,
                  r.client, r.env_name, r.material, stageLabel(r.stage), money(r.m2),
                ]));
              }
              out.push(toRow(["", "", "", "", "", "", "Total (etapas concluídas)", money(totalM2)]));
              const blob = new Blob(["\uFEFF" + out.join("\n")], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `produtividade-${employee?.name?.replace(/\s+/g, "_") ?? "func"}-${from}_a_${to}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="bg-white border border-stone-300 px-4 py-2 flex items-center gap-2 text-sm hover:bg-stone-50"
          >
            <FileDown className="size-4" /> Excel/CSV
          </button>
          <button
            onClick={() => window.print()}
            className="bg-stone-950 text-white px-4 py-2 flex items-center gap-2 text-sm hover:bg-stone-800"
          >
            <Printer className="size-4" /> Imprimir PDF
          </button>
        </div>
      </div>

      <div className="bg-white border border-stone-200 p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-stone-200 pb-4 mb-6">
          <div>
            {settings?.logo_url && <img src={settings.logo_url} alt="" className="h-12 mb-3 object-contain" />}
            <p className="text-[10px] uppercase tracking-widest text-stone-400">Relatório de Produtividade</p>
            <h1 className="font-display text-3xl mt-1">{employee?.name ?? "—"}</h1>
            <p className="text-sm text-stone-500 capitalize">Setor: {employee?.role ?? "—"}</p>
            <p className="text-sm text-stone-500 capitalize">Função: {employee?.role ?? "—"}</p>
          </div>
          <div className="text-right text-xs text-stone-500">
            <p>Período</p>
            <p className="font-mono text-stone-900 text-sm">{from} a {to}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="border border-stone-200 p-4">
            <p className="text-[10px] uppercase tracking-widest text-stone-400">Ambientes</p>
            <p className="font-display text-3xl">{totalEnvs}</p>
          </div>
          <div className="border border-stone-200 p-4">
            <p className="text-[10px] uppercase tracking-widest text-stone-400">m² Produzidos</p>
            <p className="font-display text-3xl">{totalM2.toFixed(2)}</p>
          </div>
          <div className="border border-stone-200 p-4">
            <p className="text-[10px] uppercase tracking-widest text-stone-400">A Receber</p>
            <p className="font-display text-3xl">{brl(valor)}</p>
            <p className="text-[10px] text-stone-400 mt-1">
              {employee?.productivity_type === "per_env" ? `${brl(perEnv)} / ambiente` : `${brl(perEnv)} / m²`}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-bold mb-3">Resumo diário</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-stone-200">
              <thead className="bg-stone-50 text-[11px] uppercase tracking-widest text-stone-500">
                <tr>
                  <th className="text-left p-2">Data</th>
                  <th className="text-center p-2">Iniciou corte</th>
                  <th className="text-center p-2">Concluiu corte</th>
                  <th className="text-center p-2">Iniciou acab.</th>
                  <th className="text-center p-2">Concluiu acab.</th>
                  <th className="text-right p-2">Valor corte</th>
                  <th className="text-right p-2">Valor acab.</th>
                  <th className="text-right p-2">Total a receber</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {dailySummary.length === 0 && (
                  <tr><td colSpan={8} className="p-4 text-stone-400 text-center">Sem registros no período.</td></tr>
                )}
                {dailySummary.map((d) => {
                  const vCorte = calcValue(d.concluiu_corte.count, d.concluiu_corte.m2);
                  const vAcab = calcValue(d.concluiu_acabamento.count, d.concluiu_acabamento.m2);
                  return (
                    <tr key={d.iso}>
                      <td className="p-2 font-mono text-xs">{d.date}</td>
                      <td className="p-2 text-center">{d.iniciou_corte.count} <span className="text-stone-400">({d.iniciou_corte.m2.toFixed(2)} m²)</span></td>
                      <td className="p-2 text-center">{d.concluiu_corte.count} <span className="text-stone-400">({d.concluiu_corte.m2.toFixed(2)} m²)</span></td>
                      <td className="p-2 text-center">{d.iniciou_acabamento.count} <span className="text-stone-400">({d.iniciou_acabamento.m2.toFixed(2)} m²)</span></td>
                      <td className="p-2 text-center">{d.concluiu_acabamento.count} <span className="text-stone-400">({d.concluiu_acabamento.m2.toFixed(2)} m²)</span></td>
                      <td className="p-2 text-right font-mono">{brl(vCorte)}</td>
                      <td className="p-2 text-right font-mono">{brl(vAcab)}</td>
                      <td className="p-2 text-right font-mono font-bold">{brl(vCorte + vAcab)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-stone-300 font-bold">
                  <td className="p-2">Total</td>
                  <td className="p-2 text-center">{dailySummary.reduce((a, d) => a + d.iniciou_corte.count, 0)}</td>
                  <td className="p-2 text-center">{dailySummary.reduce((a, d) => a + d.concluiu_corte.count, 0)}</td>
                  <td className="p-2 text-center">{dailySummary.reduce((a, d) => a + d.iniciou_acabamento.count, 0)}</td>
                  <td className="p-2 text-center">{dailySummary.reduce((a, d) => a + d.concluiu_acabamento.count, 0)}</td>
                  <td className="p-2 text-right font-mono">{brl(dailySummary.reduce((a, d) => a + calcValue(d.concluiu_corte.count, d.concluiu_corte.m2), 0))}</td>
                  <td className="p-2 text-right font-mono">{brl(dailySummary.reduce((a, d) => a + calcValue(d.concluiu_acabamento.count, d.concluiu_acabamento.m2), 0))}</td>
                  <td className="p-2 text-right font-mono">{brl(valor)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <h2 className="text-sm font-bold mb-3">Detalhamento por etapa</h2>
        <table className="w-full text-sm">

          <thead className="bg-stone-50 text-[11px] uppercase tracking-widest text-stone-500">
            <tr>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Hora</th>
              <th className="text-left p-2">Pedido</th>
              <th className="text-left p-2">Cliente</th>
              <th className="text-left p-2">Ambiente</th>
              <th className="text-left p-2">Material</th>
              <th className="text-left p-2">Etapa</th>
              <th className="text-right p-2">m²</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-stone-400 text-center">Sem registros no período.</td></tr>
            )}
            {rows.map((r, i) => {
              const isDone = r.stage === "concluiu_corte" || r.stage === "concluiu_acabamento";
              return (
                <tr key={i} className={isDone ? "" : "text-stone-500"}>
                  <td className="p-2 font-mono text-xs">{r.done_at ? new Date(r.done_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</td>
                  <td className="p-2 font-mono text-xs">{r.done_at ? new Date(r.done_at).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="p-2 font-mono text-xs">PED-{String(r.order_number).padStart(6, "0")}</td>
                  <td className="p-2">{r.client}</td>
                  <td className="p-2">{r.env_name}</td>
                  <td className="p-2">{r.material}</td>
                  <td className="p-2 text-xs">{stageLabel(r.stage)}</td>
                  <td className="p-2 text-right font-mono">{r.m2.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-stone-300 font-bold">
              <td className="p-2" colSpan={7}>Total (etapas concluídas)</td>
              <td className="p-2 text-right font-mono">{totalM2.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-12 grid grid-cols-2 gap-12 text-xs text-stone-500">
          <div className="border-t border-stone-300 pt-2 text-center">Funcionário</div>
          <div className="border-t border-stone-300 pt-2 text-center">Responsável</div>
        </div>
      </div>
    </div>
  );
}
