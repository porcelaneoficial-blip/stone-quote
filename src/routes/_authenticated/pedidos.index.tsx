import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, fmtDate } from "@/lib/format";
import { closestDeadline, alertLevel } from "@/lib/deadline";
import type { QuoteData } from "@/lib/types";
import { AlertTriangle, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMyRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  component: List,
});

function List() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const perms = useMyRoles();
  const { data } = useQuery({
    queryKey: ["orders-all", perms.parceiroSellerId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, number, client_name, total, status, created_at, data")
        .order("number", { ascending: false });
      if (perms.isParceiro && perms.parceiroSellerId) {
        q = q.filter("data->>seller_id", "eq", perms.parceiroSellerId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as { id: string; number: number; client_name: string; total: number; status: string; created_at: string; data: QuoteData }[];
    },
    enabled: !perms.loading,
  });

  const rows = (data ?? []).map((o) => {
    const dl = o.status === "finalizado" || o.status === "cancelado"
      ? null
      : closestDeadline(o.created_at, o.data);
    return { ...o, deadline: dl };
  });

  const urgentes = rows.filter((r) => r.deadline && r.deadline.daysLeft <= 3);

  const deleteOrder = async (e: React.MouseEvent, id: string, number: number) => {
    e.stopPropagation();
    if (!confirm(`Apagar Pedido PED-${String(number).padStart(6, "0")}?\n\nEsta ação remove o pedido, parcelas e comissões vinculadas. Não pode ser desfeita.`)) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pedido apagado");
    qc.invalidateQueries({ queryKey: ["orders-all"] });
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-eyebrow">Documentos</p>
          <h1 className="font-display text-4xl mt-1">Pedidos</h1>
        </div>
        {urgentes.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-2 text-sm flex items-center gap-2">
            <AlertTriangle className="size-4" />
            <span><strong>{urgentes.length}</strong> {urgentes.length === 1 ? "pedido" : "pedidos"} com prazo vencendo</span>
          </div>
        )}
      </div>
      <div className="bg-white border border-stone-200">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100">
              <th className="text-left p-4 font-bold w-24">Nº</th>
              <th className="text-left p-4 font-bold">Cliente</th>
              <th className="text-left p-4 font-bold">Status</th>
              <th className="text-left p-4 font-bold">Prazo</th>
              <th className="text-left p-4 font-bold">Data</th>
              <th className="text-right p-4 font-bold">Total</th>
              <th className="p-4 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((o) => {
              const lvl = o.deadline ? alertLevel(o.deadline.daysLeft) : "ok";
              return (
                <tr key={o.id} onClick={() => navigate({ to: "/pedidos/$id", params: { id: o.id } })} className="hover:bg-stone-50 cursor-pointer">
                  <td className="p-4 font-mono text-sm">PED-{String(o.number).padStart(6, "0")}</td>
                  <td className="p-4 text-sm">{o.client_name || "—"}</td>
                  <td className="p-4 text-xs uppercase tracking-wider text-stone-500">{o.status.replace(/_/g, " ")}</td>
                  <td className="p-4 text-xs">
                    {o.deadline ? (
                      <DeadlineBadge level={lvl} daysLeft={o.deadline.daysLeft} date={o.deadline.date} label={o.deadline.label} />
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-stone-600">{fmtDate(o.created_at)}</td>
                  <td className="p-4 text-right font-mono text-sm">{brl(Number(o.total))}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={(e) => deleteOrder(e, o.id, o.number)}
                      className="text-stone-400 hover:text-red-600 p-1"
                      title="Apagar pedido"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-12 text-center text-sm text-stone-400">Nenhum pedido. Aprove um orçamento para gerar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeadlineBadge({ level, daysLeft, date, label }: { level: "vencido" | "urgente" | "atencao" | "ok"; daysLeft: number; date: Date; label: string }) {
  const cls =
    level === "vencido" ? "bg-red-100 text-red-800 border-red-300" :
    level === "urgente" ? "bg-amber-100 text-amber-900 border-amber-300" :
    level === "atencao" ? "bg-yellow-50 text-yellow-800 border-yellow-200" :
    "bg-stone-50 text-stone-600 border-stone-200";
  const text =
    level === "vencido" ? `Vencido há ${Math.abs(daysLeft)}d` :
    daysLeft === 0 ? "Hoje" :
    daysLeft === 1 ? "Amanhã" :
    `${daysLeft} dias`;
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`inline-flex items-center gap-1 border px-2 py-0.5 w-fit font-medium ${cls}`}>
        {(level === "vencido" || level === "urgente") && <AlertCircle className="size-3" />}
        {text}
      </span>
      <span className="text-[10px] text-stone-400">{label} · {date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
    </div>
  );
}
