import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { brl, todayISO } from "@/lib/format";
import { envArea, envItemsTotal } from "@/lib/quote-calc";
import type { Environment } from "@/lib/types";
import {
  LogOut, Scissors, Wrench, ClipboardList,
  Briefcase, Users, RefreshCw,
  MapPin, FileText, Upload, Clock, DollarSign,
} from "lucide-react";


export const Route = createFileRoute("/funcionario")({
  component: FuncionarioPortal,
});

type Role = "corte" | "acabamento" | "gerente_producao";
const ROLE_LABEL: Record<Role, string> = {
  corte: "Cortador",
  acabamento: "Acabador",
  gerente_producao: "Gerente de Produção",
};

type Order = { id: string; number: number; client_name: string; data: any };
type Employee = { id: string; user_id: string; name: string; role: Role };

const SESSION_KEY = "porcelane.employee_session.v3";
type Session = { cpf: string; password: string; employee: Employee };

function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch { return null; }
}

function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

const DEFAULT_PASSWORD = "Porcelane 123";

function FuncionarioPortal() {
  const [cpf, setCpf] = useState("");

  const [session, setSession] = useState<Session | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingEnvId, setSavingEnvId] = useState<string | null>(null);
  const [availableOrders, setAvailableOrders] = useState<Array<Order & { env_count: number; updated_at: string }>>([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (s) setSession(s);
  }, []);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf.trim()) return toast.error("Informe o CPF");
    setBusy(true);
    const { data, error } = await supabase.rpc("employee_login_cpf", {
      p_cpf: cpf, p_password: DEFAULT_PASSWORD,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const emp = (data as Employee[])?.[0];
    if (!emp) return toast.error("CPF não cadastrado");
    const sess: Session = { cpf, password: DEFAULT_PASSWORD, employee: emp };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    setSession(sess);
    toast.success(`Bem-vindo, ${emp.name}`);
  };

  const sair = () => {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setOrder(null);
    setCpf("");
  };

  const loadAvailable = useCallback(async () => {
    if (!session) return;
    if (session.employee.role !== "corte" && session.employee.role !== "acabamento") return;
    setLoadingList(true);
    const { data, error } = await (supabase.rpc as any)("employee_list_available_orders_cpf", {
      p_cpf: session.cpf, p_password: session.password,
    });
    setLoadingList(false);
    if (error) return;
    const rows = (data as any[]) ?? [];
    setAvailableOrders(rows.map((r) => ({
      id: r.order_id, number: r.number, client_name: r.client_name,
      data: r.data, env_count: r.env_count, updated_at: r.updated_at,
    })));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void loadAvailable();
    const iv = window.setInterval(() => { void loadAvailable(); }, 15000);
    const ch = supabase
      .channel("emp-orders-" + session.employee.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { void loadAvailable(); })
      .subscribe();
    return () => { window.clearInterval(iv); supabase.removeChannel(ch); };
  }, [session, loadAvailable]);

  const refreshOrder = useCallback(async () => {
    if (!session || !order) return;
    const { data } = await supabase.rpc("employee_find_order_cpf", {
      p_cpf: session.cpf, p_password: session.password, p_number: order.number,
    });
    const row = (data as any[])?.[0];
    if (row) setOrder({ id: row.order_id, number: row.number, client_name: row.client_name, data: row.data });
    void loadAvailable();
  }, [session, order, loadAvailable]);

  const registrarEnv = async (env: Environment) => {
    if (!session || !order) return;
    setSavingEnvId(env.id);
    const { data, error } = await (supabase.rpc as any)("employee_add_productivity_cpf", {
      p_cpf: session.cpf, p_password: session.password,
      p_order_id: order.id, p_env_id: env.id,
      p_kind: session.employee.role === "acabamento" ? "acabamento" : "corte",
    });
    setSavingEnvId(null);
    if (error) return toast.error("Erro: " + error.message);
    void data;
    toast.success(`${env.name} registrado`);
    await refreshOrder();
  };

  const ambientesLiberados: Environment[] = useMemo(() => {
    const envs: Environment[] = order?.data?.environments ?? [];
    if (!session) return [];
    if (session.employee.role === "corte") {
      return envs.filter((e) => (e.production_status ?? "liberado") === "liberado" && !!e.released_for_cut_at);
    }
    if (session.employee.role === "acabamento") {
      return envs.filter((e) => e.production_status === "em_acabamento");
    }
    return [];
  }, [order, session]);


  // ===== LOGIN =====
  if (!session) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <form onSubmit={entrar} className="w-full max-w-md bg-white border border-stone-200 p-8 space-y-5">
          <div className="text-center">
            <p className="label-eyebrow">Portal do Funcionário</p>
            <h1 className="font-display text-3xl mt-1">Entrar</h1>
            <p className="text-xs text-stone-500 mt-2">
              Digite seu <strong>CPF</strong> para acessar sua área.
            </p>
          </div>
          <div>
            <label className="label-eyebrow">CPF</label>
            <input
              value={cpf}
              onChange={(e) => setCpf(maskCPF(e.target.value))}
              inputMode="numeric" autoFocus placeholder="000.000.000-00"
              className="w-full border border-stone-300 px-3 py-2 font-mono text-lg mt-1"
            />
          </div>
          <button type="submit" disabled={busy}
            className="w-full bg-stone-950 text-white py-3 hover:bg-stone-800 disabled:opacity-50 font-bold uppercase tracking-wider text-sm">
            {busy ? "Validando…" : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  // ===== GERENTE =====
  if (session.employee.role === "gerente_producao") {
    return <ManagerDashboard session={session} onLogout={sair} />;
  }

  // ===== CORTADOR / ACABADOR =====
  const role = session.employee.role as "corte" | "acabamento";
  const [tab, setTab] = useState<"producao" | "ponto" | "contracheques" | "documentos">("producao");

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="label-eyebrow">{ROLE_LABEL[role]}</p>
            <h1 className="font-display text-2xl mt-0.5">{session.employee.name}</h1>
            <p className="text-xs text-stone-500">
              {role === "corte" ? "R$ 16,00 / m² cortado" : "5% sobre o material do ambiente"}
            </p>
          </div>
          <button onClick={sair} className="text-xs uppercase tracking-wider text-stone-500 hover:text-stone-950 inline-flex items-center gap-1">
            <LogOut className="size-3" /> Sair
          </button>
        </div>
        <nav className="max-w-3xl mx-auto px-6 flex gap-1 -mb-px overflow-x-auto">
          {[
            { id: "producao", label: "Produção", icon: <ClipboardList className="size-3.5" /> },
            { id: "ponto", label: "Ponto", icon: <Clock className="size-3.5" /> },
            { id: "contracheques", label: "Contracheques", icon: <DollarSign className="size-3.5" /> },
            { id: "documentos", label: "Documentos", icon: <FileText className="size-3.5" /> },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={"px-4 py-2 text-xs uppercase tracking-widest font-bold border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap " +
                (tab === t.id ? "border-stone-950 text-stone-950" : "border-transparent text-stone-400 hover:text-stone-700")}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {tab === "producao" && (
          <>
            {!order && (
              <div className="bg-white border border-stone-200 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="label-eyebrow">Pedidos disponíveis</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {role === "corte" ? "Liberados para corte" : "Prontos para acabamento"}
                      {loadingList ? " · atualizando…" : ` · ${availableOrders.length}`}
                    </p>
                  </div>
                  <button onClick={() => void loadAvailable()} title="Atualizar" className="text-stone-400 hover:text-stone-950">
                    <RefreshCw className={"size-4 " + (loadingList ? "animate-spin" : "")} />
                  </button>
                </div>
                {availableOrders.length === 0 ? (
                  <div className="text-center py-10 text-stone-400 text-sm">
                    Nenhum pedido disponível no momento.
                  </div>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {availableOrders.map((o) => (
                      <li key={o.id}>
                        <button onClick={() => setOrder(o)}
                          className="w-full text-left py-3 px-2 hover:bg-stone-50 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs text-stone-500">PED-{String(o.number).padStart(6, "0")}</p>
                            <p className="font-display text-base">{o.client_name || "—"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-stone-400">Ambientes</p>
                            <p className="font-display text-xl text-gold-high">{o.env_count}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {order && (
              <button onClick={() => setOrder(null)} className="text-xs uppercase tracking-wider text-stone-500 hover:text-stone-950 inline-flex items-center gap-1">
                ← Voltar à lista
              </button>
            )}

            {order && (
              <div className="bg-white border border-stone-200 p-6 space-y-4">
                <div className="border-b border-stone-200 pb-3 flex items-start justify-between">
                  <div>
                    <p className="label-eyebrow">Ambientes liberados</p>
                    <p className="font-display text-2xl mt-1">PED-{String(order.number).padStart(6, "0")}</p>
                    <p className="text-sm text-stone-500">{order.client_name || "—"}</p>
                  </div>
                  <button onClick={refreshOrder} title="Atualizar" className="text-stone-400 hover:text-stone-950">
                    <RefreshCw className="size-4" />
                  </button>
                </div>

                {ambientesLiberados.length === 0 ? (
                  <div className="text-center py-10 text-stone-400 text-sm">
                    Nenhum ambiente liberado para {ROLE_LABEL[role].toLowerCase()}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-stone-500">Toque no ambiente que você executou.</p>
                    {ambientesLiberados.map((env) => {
                      const area = envArea(env);
                      const valorMaterial = envItemsTotal(env);
                      const comissao = role === "acabamento"
                        ? +(valorMaterial * 0.05).toFixed(2)
                        : +(area * 16).toFixed(2);
                      return (
                        <button key={env.id} disabled={savingEnvId === env.id}
                          onClick={() => registrarEnv(env)}
                          className="w-full text-left border border-stone-200 hover:border-stone-950 hover:bg-stone-50 p-4 transition flex items-center justify-between gap-3 disabled:opacity-50">
                          <div>
                            <p className="font-display text-lg">{env.name}</p>
                            <p className="text-xs text-stone-500">{env.material_name || "—"} · {area.toFixed(2)} m²</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-stone-400">Sua comissão</p>
                            <p className="font-display text-xl text-gold-high">{brl(comissao)}</p>
                            {savingEnvId === env.id && <p className="text-[10px] text-stone-400">Registrando…</p>}
                          </div>
                        </button>
                      );
                    })}
                    {role === "acabamento" && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2 mt-2">
                        <strong>Base de cálculo:</strong> 5% somente sobre o valor da pedra do ambiente — cooktop, torre de tomada e instalações em obra não entram.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <ResumoProdutividade session={session} reloadKey={order?.id ?? ""} />
          </>
        )}

        {tab === "ponto" && <PontoPanel session={session} />}
        {tab === "contracheques" && <ContrachequesPanel session={session} />}
        {tab === "documentos" && <DocumentosPanel session={session} />}
      </main>
    </div>
  );
}

/* ====== RESUMO PESSOAL ====== */
function ResumoProdutividade({ session, reloadKey }: { session: Session; reloadKey: string }) {
  const today = todayISO();
  const monthStart = useMemo(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Array<{
    id: string; order_number: number; client_name: string; env_name: string;
    env_material: string; kind: string; value: number; commission_value: number; created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (session.employee.role !== "corte" && session.employee.role !== "acabamento") return;
    setLoading(true);
    const { data: emp } = await supabase.rpc("employee_login_cpf", { p_cpf: session.cpf, p_password: session.password });
    const employeeId = (emp as Employee[])?.[0]?.id;
    if (!employeeId) { setRows([]); setLoading(false); return; }
    const { data } = await supabase
      .from("productivity_entries")
      .select("id, order_id, env_name, env_material, kind, value, commission_value, created_at, orders(number, client_name)")
      .eq("employee_id", employeeId)
      .gte("created_at", new Date(from + "T00:00:00").toISOString())
      .lte("created_at", new Date(to + "T23:59:59").toISOString())
      .order("created_at", { ascending: false });
    setLoading(false);
    setRows((data ?? []).map((r: any) => ({
      id: r.id, order_number: r.orders?.number ?? 0, client_name: r.orders?.client_name ?? "",
      env_name: r.env_name, env_material: r.env_material, kind: r.kind,
      value: Number(r.value), commission_value: Number(r.commission_value), created_at: r.created_at,
    })));
  }, [session.cpf, session.password, session.employee.role, from, to]);

  useEffect(() => { void load(); }, [load, reloadKey]);

  // Realtime: qualquer nova produtividade atualiza os totais na hora
  useEffect(() => {
    const ch = supabase
      .channel("pe-live-" + session.employee.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "productivity_entries" }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session.employee.id, load]);


  const totals = useMemo(() => rows.reduce(
    (a, r) => ({ envs: a.envs + 1, valor: a.valor + r.value, comissao: a.comissao + r.commission_value }),
    { envs: 0, valor: 0, comissao: 0 },
  ), [rows]);

  return (
    <div className="bg-white border border-stone-200 p-6 space-y-4">
      <div className="border-b border-stone-200 pb-3 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <p className="label-eyebrow">Sua produção</p>
          <p className="font-display text-2xl mt-1">{ROLE_LABEL[session.employee.role as Role]}</p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-stone-500 font-bold">De</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-stone-300 px-2 py-1.5 text-sm mt-1" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-stone-500 font-bold">Até</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-stone-300 px-2 py-1.5 text-sm mt-1" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Ambientes" value={String(totals.envs)} icon={<ClipboardList className="size-4" />} />
        <Stat label="Valor" value={brl(totals.valor)} />
        <Stat label="Comissão" value={brl(totals.comissao)} highlight />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
            <tr>
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Pedido</th>
              <th className="text-left p-2">Ambiente</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-right p-2">Valor</th>
              <th className="text-right p-2">Comissão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading && <tr><td colSpan={6} className="p-6 text-center text-stone-400">Carregando…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-stone-400">Nenhum registro no período</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-2 text-stone-500 font-mono text-xs">{new Date(r.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                <td className="p-2 font-mono text-xs">PED-{String(r.order_number).padStart(6, "0")}</td>
                <td className="p-2">{r.env_material ? `${r.env_material} · ${r.env_name}` : r.env_name}</td>
                <td className="p-2 capitalize text-xs">
                  <span className="inline-flex items-center gap-1">
                    {r.kind === "corte" ? <Scissors className="size-3" /> : <Wrench className="size-3" />} {r.kind}
                  </span>
                </td>
                <td className="p-2 text-right font-mono">{brl(r.value)}</td>
                <td className="p-2 text-right font-mono text-gold-high font-bold">{brl(r.commission_value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ====== GERENTE ====== */
function ManagerDashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const today = todayISO();
  const monthStart = useMemo(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [team, setTeam] = useState<Array<{
    employee_id: string; employee_name: string; role: string;
    corte_m2: number; corte_commission: number;
    acab_value: number; acab_commission: number; total_commission: number;
  }>>([]);
  const [orders, setOrders] = useState<Array<{
    order_id: string; number: number; client_name: string; status: string; data: any; updated_at: string;
  }>>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: o }] = await Promise.all([
      supabase.rpc("manager_list_team_productivity", {
        p_cpf: session.cpf, p_password: session.password,
        p_from: new Date(from + "T00:00:00").toISOString(),
        p_to: new Date(to + "T23:59:59").toISOString(),
      }),
      supabase.rpc("manager_list_production", { p_cpf: session.cpf, p_password: session.password }),
    ]);
    setTeam((t as any[]) ?? []);
    setOrders((o as any[]) ?? []);
    setLoading(false);
  }, [session, from, to]);

  useEffect(() => { void load(); }, [load]);

  // Realtime: qualquer registro de produção ou mudança de pedido atualiza o painel
  useEffect(() => {
    const ch = supabase
      .channel("mgr-live-" + session.employee.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "productivity_entries" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { void load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session.employee.id, load]);

  const total = useMemo(() => team.reduce((a, r) => ({
    corte_m2: a.corte_m2 + Number(r.corte_m2),
    corte_commission: a.corte_commission + Number(r.corte_commission),
    acab_commission: a.acab_commission + Number(r.acab_commission),
    total_commission: a.total_commission + Number(r.total_commission),
  }), { corte_m2: 0, corte_commission: 0, acab_commission: 0, total_commission: 0 }), [team]);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="label-eyebrow">Gerente de Produção</p>
            <h1 className="font-display text-2xl mt-0.5">{session.employee.name}</h1>
          </div>
          <button onClick={onLogout} className="text-xs uppercase tracking-wider text-stone-500 hover:text-stone-950 inline-flex items-center gap-1">
            <LogOut className="size-3" /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* filtros */}
        <div className="bg-white border border-stone-200 p-4 flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-stone-500 font-bold">De</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-stone-300 px-2 py-1.5 text-sm mt-1" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-stone-500 font-bold">Até</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-stone-300 px-2 py-1.5 text-sm mt-1" />
          </div>
          <button onClick={load} className="ml-auto bg-stone-950 text-white px-4 py-2 text-xs uppercase tracking-widest font-bold inline-flex items-center gap-1">
            <RefreshCw className="size-3" /> Atualizar
          </button>
        </div>

        {/* totais equipe */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="m² cortados" value={total.corte_m2.toFixed(2)} icon={<Scissors className="size-4" />} />
          <Stat label="Comissão Corte" value={brl(total.corte_commission)} />
          <Stat label="Comissão Acabamento" value={brl(total.acab_commission)} />
          <Stat label="Total a pagar" value={brl(total.total_commission)} highlight />
        </div>

        {/* equipe */}
        <div className="bg-white border border-stone-200">
          <div className="border-b border-stone-200 px-4 py-3 flex items-center gap-2">
            <Users className="size-4 text-stone-500" />
            <h2 className="font-display text-lg">Produtividade da equipe</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
                <tr>
                  <th className="text-left p-3">Funcionário</th>
                  <th className="text-left p-3">Cargo</th>
                  <th className="text-right p-3">m² Corte</th>
                  <th className="text-right p-3">Comissão Corte</th>
                  <th className="text-right p-3">Valor Acab.</th>
                  <th className="text-right p-3">Comissão Acab.</th>
                  <th className="text-right p-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading && <tr><td colSpan={7} className="p-6 text-center text-stone-400">Carregando…</td></tr>}
                {!loading && team.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-stone-400">Nenhum dado no período</td></tr>
                )}
                {team.map((r) => (
                  <tr key={r.employee_id}>
                    <td className="p-3 font-medium">{r.employee_name}</td>
                    <td className="p-3 capitalize text-stone-500">{r.role}</td>
                    <td className="p-3 text-right font-mono">{Number(r.corte_m2).toFixed(2)}</td>
                    <td className="p-3 text-right font-mono">{brl(Number(r.corte_commission))}</td>
                    <td className="p-3 text-right font-mono">{brl(Number(r.acab_value))}</td>
                    <td className="p-3 text-right font-mono">{brl(Number(r.acab_commission))}</td>
                    <td className="p-3 text-right font-mono text-gold-high font-bold">{brl(Number(r.total_commission))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* pedidos em produção */}
        <div className="bg-white border border-stone-200">
          <div className="border-b border-stone-200 px-4 py-3 flex items-center gap-2">
            <Briefcase className="size-4 text-stone-500" />
            <h2 className="font-display text-lg">Pedidos em produção</h2>
          </div>
          <div className="divide-y divide-stone-100">
            {orders.length === 0 && (
              <div className="p-6 text-center text-stone-400 text-sm">Nenhum pedido em produção.</div>
            )}
            {orders.map((o) => {
              const envs: Environment[] = o.data?.environments ?? [];
              return (
                <div key={o.order_id} className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-mono text-xs text-stone-500">PED-{String(o.number).padStart(6, "0")}</p>
                      <p className="font-display text-lg">{o.client_name}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest bg-stone-100 px-2 py-1">{o.status}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {envs.map((e) => (
                      <div key={e.id} className="border border-stone-200 px-3 py-2 text-sm flex items-center justify-between">
                        <div>
                          <p className="font-medium">{e.name}</p>
                          <p className="text-xs text-stone-500">{e.material_name || "—"} · {envArea(e).toFixed(2)} m²</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-stone-500 bg-stone-50 px-2 py-1">
                          {e.production_status ?? "liberado"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, highlight, icon }: { label: string; value: string; highlight?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="border border-stone-200 p-3 bg-white">
      <p className="text-[10px] uppercase tracking-widest text-stone-400 flex items-center gap-1">{icon} {label}</p>
      <p className={"font-display mt-1 " + (highlight ? "text-2xl text-gold-high" : "text-xl")}>{value}</p>
    </div>
  );
}

/* ====== PONTO POR GEOLOCALIZAÇÃO ====== */
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
function PontoPanel({ session }: { session: Session }) {
  const today = todayISO();
  const monthStart = useMemo(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState<Array<{
    id: string; kind: string; lat: number | null; lng: number | null;
    accuracy: number | null; address: string | null; created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"in" | "out" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.rpc as any)("employee_list_time_entries_cpf", {
      p_cpf: session.cpf, p_password: session.password,
      p_from: new Date(from + "T00:00:00").toISOString(),
      p_to: new Date(to + "T23:59:59").toISOString(),
    });
    setRows((data as any[]) ?? []);
    setLoading(false);
  }, [session, from, to]);

  useEffect(() => { void load(); }, [load]);

  const QUEUE_KEY = `ponto_queue_${session.cpf}`;
  type QItem = { kind: "in" | "out"; lat: number | null; lng: number | null; accuracy: number | null; ts: string };
  const readQueue = (): QItem[] => {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
  };
  const writeQueue = (q: QItem[]) => localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  const [queued, setQueued] = useState<number>(() => readQueue().length);

  const flushQueue = useCallback(async () => {
    const q = readQueue();
    if (q.length === 0) return;
    const remaining: QItem[] = [];
    for (const it of q) {
      const { error } = await (supabase.rpc as any)("employee_clock_cpf", {
        p_cpf: session.cpf, p_password: session.password, p_kind: it.kind,
        p_lat: it.lat, p_lng: it.lng, p_accuracy: it.accuracy, p_address: null,
      });
      if (error) { remaining.push(it); }
    }
    writeQueue(remaining);
    setQueued(remaining.length);
    if (remaining.length < q.length) {
      toast.success(`${q.length - remaining.length} ponto(s) sincronizado(s)`);
      void load();
    }
  }, [session, load]);

  useEffect(() => {
    void flushQueue();
    const onOnline = () => { void flushQueue(); };
    window.addEventListener("online", onOnline);
    const iv = setInterval(() => { if (navigator.onLine) void flushQueue(); }, 60000);
    return () => { window.removeEventListener("online", onOnline); clearInterval(iv); };
  }, [flushQueue]);

  const baterPonto = async (kind: "in" | "out") => {
    setBusy(kind);
    const getPos = () => new Promise<GeolocationPosition | null>((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(
        (p) => res(p),
        () => res(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
    const pos = await getPos();
    const item: QItem = {
      kind,
      lat: pos?.coords.latitude ?? null,
      lng: pos?.coords.longitude ?? null,
      accuracy: pos?.coords.accuracy ?? null,
      ts: new Date().toISOString(),
    };
    const enqueueOffline = () => {
      const q = readQueue(); q.push(item); writeQueue(q); setQueued(q.length);
      toast.message("Sem conexão — ponto guardado. Será enviado quando voltar a internet.");
    };
    if (!navigator.onLine) { enqueueOffline(); setBusy(null); return; }
    try {
      const { error } = await (supabase.rpc as any)("employee_clock_cpf", {
        p_cpf: session.cpf, p_password: session.password, p_kind: kind,
        p_lat: item.lat, p_lng: item.lng, p_accuracy: item.accuracy, p_address: null,
      });
      if (error) throw error;
      toast.success(kind === "in" ? "Entrada registrada" : "Saída registrada");
      void load();
    } catch {
      enqueueOffline();
    } finally {
      setBusy(null);
    }
  };

  const lastKind = rows[0]?.kind;
  const nextKind: "in" | "out" = lastKind === "in" ? "out" : "in";

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 p-6 text-center space-y-4">
        <p className="label-eyebrow">Bater ponto</p>
        <p className="font-display text-4xl">
          {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
        </p>
        <p className="text-xs text-stone-500">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })}
        </p>
        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
          <button onClick={() => baterPonto("in")} disabled={!!busy}
            className={"py-4 font-bold uppercase tracking-widest text-sm inline-flex items-center justify-center gap-2 " +
              (nextKind === "in"
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-white border border-stone-300 text-stone-500 hover:text-stone-950")}>
            <MapPin className="size-4" /> {busy === "in" ? "…" : "Entrada"}
          </button>
          <button onClick={() => baterPonto("out")} disabled={!!busy}
            className={"py-4 font-bold uppercase tracking-widest text-sm inline-flex items-center justify-center gap-2 " +
              (nextKind === "out"
                ? "bg-stone-950 text-white hover:bg-stone-800"
                : "bg-white border border-stone-300 text-stone-500 hover:text-stone-950")}>
            <MapPin className="size-4" /> {busy === "out" ? "…" : "Saída"}
          </button>
        </div>
        <p className="text-[11px] text-stone-400">
          O sistema captura sua localização GPS automaticamente ao bater o ponto.
        </p>
        {queued > 0 && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
            {queued} ponto(s) aguardando sincronização offline. Enviaremos assim que a internet voltar.
          </p>
        )}
      </div>

      <div className="bg-white border border-stone-200 p-6 space-y-4">
        <div className="border-b border-stone-200 pb-3 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="label-eyebrow">Meu histórico</p>
            <p className="font-display text-xl">Espelho de ponto</p>
          </div>
          <div className="flex gap-2 items-end">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-500 font-bold">De</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-stone-300 px-2 py-1.5 text-sm mt-1" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-stone-500 font-bold">Até</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-stone-300 px-2 py-1.5 text-sm mt-1" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
              <tr>
                <th className="text-left p-2">Data</th>
                <th className="text-left p-2">Hora</th>
                <th className="text-left p-2">Tipo</th>
                <th className="text-left p-2">Localização</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && <tr><td colSpan={4} className="p-6 text-center text-stone-400">Carregando…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-stone-400">Nenhum registro no período</td></tr>
              )}
              {rows.map((r) => {
                const d = new Date(r.created_at);
                const map = r.lat != null && r.lng != null
                  ? `https://www.google.com/maps?q=${r.lat},${r.lng}` : null;
                return (
                  <tr key={r.id}>
                    <td className="p-2 font-mono text-xs">{d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                    <td className="p-2 font-mono text-xs">{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</td>
                    <td className="p-2">
                      <span className={"text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 " +
                        (r.kind === "in" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-700")}>
                        {r.kind === "in" ? "Entrada" : "Saída"}
                      </span>
                    </td>
                    <td className="p-2 text-xs">
                      {map ? (
                        <a href={map} target="_blank" rel="noreferrer" className="text-stone-600 hover:text-stone-950 underline inline-flex items-center gap-1">
                          <MapPin className="size-3" /> Ver no mapa
                          {r.accuracy != null && <span className="text-stone-400">· ±{Math.round(r.accuracy)}m</span>}
                        </a>
                      ) : (
                        <span className="text-stone-400">Sem GPS</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ====== CONTRACHEQUES ====== */
function ContrachequesPanel({ session }: { session: Session }) {
  const [rows, setRows] = useState<Array<{
    id: string; reference_month: number; reference_year: number;
    base_salary: number; commissions_total: number;
    deductions: number; extras: number; net_total: number;
    status: string; paid_at: string | null; breakdown: any; created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.rpc as any)("employee_list_payslips_cpf", {
      p_cpf: session.cpf, p_password: session.password,
    });
    setRows((data as any[]) ?? []);
    setLoading(false);
  }, [session]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="bg-white border border-stone-200 p-6 space-y-4">
      <div className="border-b border-stone-200 pb-3">
        <p className="label-eyebrow">Meus contracheques</p>
        <p className="font-display text-2xl mt-1">Holerites</p>
        <p className="text-xs text-stone-500 mt-1">Emitidos pela empresa a cada fechamento de folha.</p>
      </div>
      {loading && <p className="text-center text-stone-400 py-8">Carregando…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-center text-stone-400 py-8 text-sm">Nenhum contracheque emitido ainda.</p>
      )}
      <div className="space-y-2">
        {rows.map((r) => {
          const isOpen = open === r.id;
          return (
            <div key={r.id} className="border border-stone-200">
              <button onClick={() => setOpen(isOpen ? null : r.id)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-stone-50">
                <div>
                  <p className="label-eyebrow">Referência</p>
                  <p className="font-display text-lg">{MESES[r.reference_month - 1]} / {r.reference_year}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    <span className={"inline-block text-[10px] uppercase tracking-widest px-1.5 py-0.5 " +
                      (r.status === "pago" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                      {r.status || "gerado"}
                    </span>
                    {r.paid_at && <> · pago em {new Date(r.paid_at).toLocaleDateString("pt-BR")}</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-stone-400">Líquido</p>
                  <p className="font-display text-2xl text-gold-high">{brl(Number(r.net_total))}</p>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-stone-100 p-4 bg-stone-50 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <Row k="Salário base" v={brl(Number(r.base_salary))} />
                    <Row k="Comissões" v={brl(Number(r.commissions_total))} />
                    <Row k="Extras" v={brl(Number(r.extras || 0))} />
                    <Row k="Descontos" v={"− " + brl(Number(r.deductions || 0))} />
                  </div>
                  {Array.isArray(r.breakdown) && r.breakdown.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[10px] uppercase tracking-widest text-stone-500 font-bold mb-1">Detalhes das comissões</p>
                      <ul className="text-xs text-stone-600 divide-y divide-stone-200 border border-stone-200 bg-white">
                        {r.breakdown.map((b: any, i: number) => (
                          <li key={i} className="p-2 flex items-center justify-between gap-2">
                            <span>{b.env} · <span className="capitalize text-stone-400">{b.kind}</span></span>
                            <span className="font-mono">{brl(Number(b.commission))}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-stone-200 bg-white px-3 py-2 flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">{k}</span>
      <span className="font-mono">{v}</span>
    </div>
  );
}

/* ====== DOCUMENTOS ====== */
const DOC_KINDS = [
  { value: "atestado", label: "Atestado médico" },
  { value: "exame", label: "Exame" },
  { value: "ferias", label: "Solicitação de férias" },
  { value: "declaracao", label: "Declaração / justificativa" },
  { value: "outro", label: "Outro" },
];

function DocumentosPanel({ session }: { session: Session }) {
  const [rows, setRows] = useState<Array<{
    id: string; kind: string; title: string; file_url: string;
    status: string; reference_date: string | null; notes: string | null; created_at: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState("atestado");
  const [title, setTitle] = useState("");
  const [refDate, setRefDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase.rpc as any)("employee_list_documents_cpf", {
      p_cpf: session.cpf, p_password: session.password,
    });
    setRows((data as any[]) ?? []);
    setLoading(false);
  }, [session]);
  useEffect(() => { void load(); }, [load]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Selecione o arquivo");
    if (!title.trim()) return toast.error("Informe um título");
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      const dataBase64 = btoa(bin);
      const { employeeUploadDoc } = await import("@/lib/employee-docs.functions");
      const up = await employeeUploadDoc({
        data: {
          cpf: session.cpf,
          password: session.password,
          filename: file.name,
          contentType: file.type,
          dataBase64,
        },
      });
      const { error } = await (supabase.rpc as any)("employee_add_document_cpf", {
        p_cpf: session.cpf, p_password: session.password,
        p_kind: kind, p_title: title, p_file_url: up.url,
        p_reference_date: refDate || null, p_notes: notes || null,
      });
      if (error) throw new Error(error.message);
      toast.success("Documento enviado");
      setTitle(""); setNotes(""); setFile(null);
      void load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message ?? "falha ao enviar"));
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="space-y-6">
      <form onSubmit={enviar} className="bg-white border border-stone-200 p-6 space-y-4">
        <div className="border-b border-stone-200 pb-3">
          <p className="label-eyebrow">Enviar documento</p>
          <p className="font-display text-xl mt-1">Novo atestado / documento</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label-eyebrow">Tipo</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)}
              className="w-full border border-stone-300 px-3 py-2 mt-1 text-sm">
              {DOC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label-eyebrow">Data de referência</label>
            <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)}
              className="w-full border border-stone-300 px-3 py-2 mt-1 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="label-eyebrow">Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Atestado consulta médica"
              className="w-full border border-stone-300 px-3 py-2 mt-1 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="label-eyebrow">Observações (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border border-stone-300 px-3 py-2 mt-1 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="label-eyebrow">Arquivo (PDF ou foto)</label>
            <input type="file" accept="image/*,application/pdf" capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full border border-stone-300 px-3 py-2 mt-1 text-sm" />
          </div>
        </div>
        <button type="submit" disabled={busy}
          className="w-full bg-stone-950 text-white py-3 hover:bg-stone-800 disabled:opacity-50 font-bold uppercase tracking-wider text-sm inline-flex items-center justify-center gap-2">
          <Upload className="size-4" /> {busy ? "Enviando…" : "Enviar documento"}
        </button>
      </form>

      <div className="bg-white border border-stone-200 p-6 space-y-3">
        <div className="border-b border-stone-200 pb-3">
          <p className="label-eyebrow">Meus documentos</p>
          <p className="font-display text-xl mt-1">Histórico</p>
        </div>
        {loading && <p className="text-center text-stone-400 py-8">Carregando…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-center text-stone-400 py-8 text-sm">Nenhum documento enviado ainda.</p>
        )}
        <ul className="divide-y divide-stone-100">
          {rows.map((r) => (
            <li key={r.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-base">{r.title}</p>
                <p className="text-xs text-stone-500 capitalize">
                  {r.kind} · enviado {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  {r.reference_date && <> · ref. {new Date(r.reference_date + "T12:00:00").toLocaleDateString("pt-BR")}</>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={"text-[10px] uppercase tracking-widest px-2 py-0.5 " +
                  (r.status === "aprovado" ? "bg-emerald-50 text-emerald-700"
                    : r.status === "rejeitado" ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700")}>
                  {r.status || "pendente"}
                </span>
                <a href={r.file_url} target="_blank" rel="noreferrer"
                  className="text-xs uppercase tracking-widest text-stone-500 hover:text-stone-950 inline-flex items-center gap-1">
                  <FileText className="size-3" /> Ver
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
