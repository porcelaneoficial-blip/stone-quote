/**
 * Visão geral da tela principal — Padrão Oficial Porcelane.
 * Ordem obrigatória: saudação → atalhos → avisos → agenda → resumo financeiro → pedidos recentes.
 * Apenas apresentação: lê dados existentes, não altera cálculos nem regras.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import {
  FilePlus2, ClipboardList, FileText, Ruler, Wallet, Settings,
} from "lucide-react";

const SP = "America/Sao_Paulo";

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR", { timeZone: SP });
  } catch {
    return "—";
  }
}

function todayLong() {
  return new Date().toLocaleDateString("pt-BR", {
    timeZone: SP, weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
}

function greeting() {
  const h = Number(
    new Date().toLocaleString("pt-BR", { timeZone: SP, hour: "2-digit", hour12: false }),
  );
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const SHORTCUTS = [
  { to: "/orcamentos", label: "Orçamentos", icon: FileText },
  { to: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/medicoes", label: "Medições", icon: Ruler },
  { to: "/romaneios", label: "Romaneios", icon: FilePlus2 },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/configuracoes", label: "Ajustes", icon: Settings },
] as const;

/** Ícone fixo por status — padrão universal Porcelane. */
function statusIcon(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s.includes("finaliz") || s.includes("conclu") || s.includes("entreg")) return "✅";
  if (s.includes("medi")) return "⏳";
  if (s.includes("cancel") || s.includes("atras") || s.includes("bloque")) return "🔴";
  return "🔄";
}

export function HomeOverview() {
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles").select("full_name, email").eq("id", u.user.id).maybeSingle();
      setName((p?.full_name || p?.email || u.user.email || "").split("@")[0]);
    })();
  }, []);

  const { data } = useQuery({
    queryKey: ["home-overview"],
    refetchInterval: 60000,
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const [pendingQuotes, agenda, receivables, recentOrders] = await Promise.all([
        supabase.from("quotes").select("id", { count: "exact", head: true })
          .not("status", "in", '("aprovado","cancelado")'),
        supabase.from("measurements").select("id, client_name, address, scheduled_at, status")
          .gte("scheduled_at", new Date(now.getTime() - 36e5).toISOString())
          .order("scheduled_at", { ascending: true }).limit(5),
        supabase.from("receivables").select("amount, paid_amount, status, due_date")
          .gte("due_date", monthStart).lte("due_date", monthEnd),
        supabase.from("orders").select("id, number, client_name, total, status, created_at")
          .order("created_at", { ascending: false }).limit(4),
      ]);

      const recs = receivables.data ?? [];
      const monthTotal = recs.reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const toReceive = recs
        .filter((r) => (r.status ?? "") !== "pago")
        .reduce((s, r) => s + (Number(r.amount ?? 0) - Number(r.paid_amount ?? 0)), 0);

      return {
        pendingQuotes: pendingQuotes.count ?? 0,
        agenda: agenda.data ?? [],
        monthTotal,
        toReceive,
        orders: recentOrders.data ?? [],
      };
    },
  });

  const agenda = data?.agenda ?? [];
  const orders = data?.orders ?? [];

  return (
    <div className="space-y-6 mb-8">
      {/* [1] Saudação + data */}
      <div>
        <p className="label-eyebrow">Porcelane</p>
        <h2 className="font-display text-2xl mt-1">
          {greeting()}{name ? `, ${name}` : ""}
        </h2>
        <p className="text-xs text-stone-500 mt-1 capitalize">{todayLong()}</p>
      </div>

      {/* [2] Atalhos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SHORTCUTS.map((s) => (
          <Link
            key={s.to} to={s.to}
            className="bg-white border border-stone-200 rounded-lg px-4 py-4 flex items-center gap-3 hover:border-stone-950 transition-colors"
          >
            <s.icon className="size-4 text-stone-500 shrink-0" />
            <span className="text-sm font-bold text-stone-900 truncate">{s.label}</span>
          </Link>
        ))}
      </div>

      {/* [3] Avisos e alertas */}
      <div className="bg-white border border-stone-200 rounded-lg px-4 py-3 text-sm text-stone-700 space-y-1.5">
        <p>💡 <span className="font-bold">{data?.pendingQuotes ?? 0}</span> orçamento(s) aguardando aprovação</p>
        <p>📅 <span className="font-bold">{agenda.length}</span> medição(ões)/instalação(ões) agendada(s)</p>
        <p>💰 <span className="font-bold">{brl(data?.toReceive ?? 0)}</span> a receber neste mês</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* [4] Agenda */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-lg p-4">
          <h3 className="text-[11px] uppercase tracking-[0.14em] font-bold text-stone-900 mb-3 pb-2 border-b border-stone-200">
            📅 Próximos compromissos
          </h3>
          {agenda.length === 0 ? (
            <p className="text-xs text-stone-400 italic py-4">Nenhum compromisso agendado.</p>
          ) : (
            <ul className="space-y-2">
              {agenda.map((m) => (
                <li key={m.id} className="flex items-baseline gap-2 text-sm">
                  <span className="font-bold whitespace-nowrap">{fmtDate(m.scheduled_at)}</span>
                  <span className="text-stone-400">→</span>
                  <span className="truncate">
                    Medição — {m.client_name || "—"}
                    {m.address ? <span className="text-stone-500"> · {m.address}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* [5] Resumo financeiro */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">📈 Total do mês</p>
            <p className="font-display text-2xl font-bold mt-1">{brl(data?.monthTotal ?? 0)}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <p className="text-[11px] uppercase tracking-[0.14em] text-stone-500">📉 A receber</p>
            <p className="font-display text-2xl font-bold mt-1">{brl(data?.toReceive ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* [6] Pedidos recentes — cartão no formato padrão */}
      <div>
        <h3 className="text-[11px] uppercase tracking-[0.14em] font-bold text-stone-900 mb-3">
          Pedidos recentes
        </h3>
        {orders.length === 0 ? (
          <p className="text-xs text-stone-400 italic">Nenhum pedido cadastrado.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {orders.map((o) => (
              <Link
                key={o.id} to="/pedidos/$id" params={{ id: o.id }}
                className="bg-white border border-stone-200 rounded-lg p-4 hover:border-stone-950 transition-colors block"
              >
                <p className="font-bold text-sm truncate">
                  ⚫ PEDIDO {o.number} — {o.client_name || "—"}
                </p>
                <div className="mt-2 pt-2 border-t border-stone-100 space-y-1 text-xs text-stone-600">
                  <p>👤 Cliente: <span className="text-stone-900">{o.client_name || "—"}</span></p>
                  <p>💰 Valor: <span className="font-bold text-stone-900">{brl(Number(o.total ?? 0))}</span></p>
                  <p>📅 Abertura: <span className="font-bold text-stone-900">{fmtDate(o.created_at)}</span></p>
                  <p>📊 Status: {statusIcon(o.status)} {o.status || "—"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
