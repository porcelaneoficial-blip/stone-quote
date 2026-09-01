import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, fmtDate } from "@/lib/format";
import { emptyQuoteData } from "@/lib/types";
import { formatQuoteName } from "@/lib/naming";
import { toast } from "sonner";
import { Plus, FileUp, Trash2 } from "lucide-react";
import { useMyRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/orcamentos/")({
  component: List,
});

function List() {
  const navigate = useNavigate();
  const perms = useMyRoles();
  const { data, refetch } = useQuery({
    queryKey: ["quotes-all", perms.parceiroSellerId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("quotes")
        .select("id, number, client_name, total, status, created_at, type, additive_of_order_id, additive_seq")
        .neq("status", "aprovado")
        .order("number", { ascending: false });
      if (perms.isParceiro && perms.parceiroSellerId) {
        q = q.filter("data->>seller_id", "eq", perms.parceiroSellerId);
      }
      const { data, error } = await q;
      if (error) throw error;
      // Carrega números dos pedidos pai (para mostrar tag PED-XXXXXX-Aseq)
      const orderIds = Array.from(new Set((data ?? []).map((q: any) => q.additive_of_order_id).filter(Boolean)));
      let orderMap: Record<string, number> = {};
      if (orderIds.length) {
        const { data: ords } = await supabase.from("orders").select("id, number").in("id", orderIds);
        for (const o of ords ?? []) orderMap[o.id] = o.number;
      }
      return (data ?? []).map((q: any) => ({ ...q, parent_order_number: q.additive_of_order_id ? orderMap[q.additive_of_order_id] : null }));
    },
    enabled: !perms.loading,
  });

  const { data: pendentes, refetch: refetchPendentes } = useQuery({
    queryKey: ["quotes-approved-no-order"],
    queryFn: async () => {
      const { listApprovedWithoutOrder } = await import("@/lib/quote-approval");
      return await listApprovedWithoutOrder();
    },
  });

  const gerarPedido = async (quoteId: string) => {
    const { createOrderFromQuote } = await import("@/lib/quote-approval");
    try {
      const r = await createOrderFromQuote(quoteId);
      toast.success("Pedido gerado");
      refetchPendentes();
      navigate({ to: "/pedidos/$id", params: { id: r.orderId } });
    } catch (e) {
      toast.error("Falha ao gerar o pedido: " + (e as Error).message);
    }
  };

  const newQuote = async (type: "convencional" | "mfc") => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("quotes")
      .insert({ user_id: u.user.id, number: 0, type, client_name: "", total: 0, data: emptyQuoteData() as never })
      .select("id").single();
    if (error) { toast.error(error.message); return; }
    refetch();
    navigate({ to: "/orcamentos/$id", params: { id: data.id } });
  };

  const deleteQuote = async (e: React.MouseEvent, id: string, number: number) => {
    e.stopPropagation();
    if (!confirm(`Apagar o orçamento #${String(number).padStart(4, "0")}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Orçamento apagado");
    refetch();
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="label-eyebrow">Documentos</p>
          <h1 className="font-display text-4xl mt-1">Orçamentos</h1>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link to="/orcamentos/importar" className="border border-stone-300 px-5 py-2.5 text-sm flex items-center gap-2 hover:bg-stone-50">
            <FileUp className="size-4" /> Importar PDF
          </Link>
          <button onClick={() => newQuote("convencional")} className="bg-stone-950 text-white px-5 py-2.5 text-sm flex items-center gap-2 hover:bg-stone-800">
            <Plus className="size-4" /> Convencional
          </button>
          <button onClick={() => newQuote("mfc")} className="border border-stone-300 px-5 py-2.5 text-sm flex items-center gap-2 hover:bg-stone-50">
            <Plus className="size-4" /> MFC
          </button>
        </div>
      </div>

      {(pendentes ?? []).length > 0 && (
        <div className="mb-6 border border-amber-300 bg-amber-50">
          <div className="px-4 py-3 border-b border-amber-200">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Aprovados sem pedido gerado ({(pendentes ?? []).length})
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5">Gere o pedido para que entrem na produção e no financeiro.</p>
          </div>
          <div className="divide-y divide-amber-200">
            {(pendentes ?? []).map((q: any) => (
              <div key={q.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold truncate">{formatQuoteName(q.number, q.client_name)}</div>
                  <div className="text-[11px] text-amber-800">{fmtDate(q.created_at)} · {brl(Number(q.total))}</div>
                </div>
                <button onClick={() => gerarPedido(q.id)} className="bg-stone-950 text-white px-4 py-2 text-xs font-bold uppercase tracking-tighter hover:bg-stone-800 shrink-0">
                  Gerar pedido
                </button>
              </div>
            ))}
          </div>
        </div>
      )}


      <div className="bg-white border border-stone-200">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100">
              <th className="text-left p-4 font-bold">Identificação</th>
              <th className="text-left p-4 font-bold">Tipo</th>
              <th className="text-left p-4 font-bold">Status</th>
              <th className="text-left p-4 font-bold">Data</th>
              <th className="text-right p-4 font-bold">Total</th>
              <th className="p-4 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(data ?? []).map((q: any) => (
              <tr key={q.id} className="hover:bg-stone-50 cursor-pointer" onClick={() => navigate({ to: "/orcamentos/$id", params: { id: q.id } })}>
                <td className="p-4">
                  <div className="font-mono text-sm font-bold">{formatQuoteName(q.number, q.client_name)}</div>
                  {q.additive_of_order_id && q.parent_order_number && (
                    <div className="text-[10px] mt-0.5 font-bold text-amber-700 uppercase tracking-wider">
                      PED-{String(q.parent_order_number).padStart(6, "0")}-A{q.additive_seq}
                    </div>
                  )}
                </td>
                <td className="p-4 text-xs uppercase tracking-wider text-stone-500">
                  {q.additive_of_order_id ? <span className="text-amber-700 font-bold">Aditivo</span> : q.type}
                </td>
                <td className="p-4 text-xs uppercase tracking-wider text-stone-500">{q.status}</td>
                <td className="p-4 text-sm text-stone-600">{fmtDate(q.created_at)}</td>
                <td className="p-4 text-right font-mono text-sm">{brl(Number(q.total))}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={(e) => deleteQuote(e, q.id, q.number)}
                    className="text-stone-400 hover:text-red-600 p-1"
                    title="Apagar orçamento"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && (
              <tr><td colSpan={6} className="p-12 text-center text-sm text-stone-400">Nenhum orçamento. <Link to="/" className="underline">Criar o primeiro</Link>.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
