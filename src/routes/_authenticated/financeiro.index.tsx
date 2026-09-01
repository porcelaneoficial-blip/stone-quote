import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl , todayISO } from "@/lib/format";
import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Wallet, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financeiro/")({
  component: FinanceiroResumo,
});

function FinanceiroResumo() {
  const today = todayISO();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const { data: receivables } = useQuery({
    queryKey: ["fin-recv", from, to],
    queryFn: async () => {
      const { data } = await supabase.from("receivables").select("*")
        .gte("due_date", from).lte("due_date", to);
      return data ?? [];
    },
  });
  const { data: payables } = useQuery({
    queryKey: ["fin-pay", from, to],
    queryFn: async () => {
      const { data } = await supabase.from("payables").select("*")
        .gte("due_date", from).lte("due_date", to);
      return data ?? [];
    },
  });
  const { data: commissions } = useQuery({
    queryKey: ["fin-com", from, to],
    queryFn: async () => {
      const { data } = await supabase.from("commissions").select("*")
        .gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59");
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const recvTotal = (receivables ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
    const recvPago = (receivables ?? []).reduce((s, r: any) => s + Number(r.paid_amount || 0), 0);
    const recvPend = recvTotal - recvPago;
    const recvAtraso = (receivables ?? []).filter((r: any) =>
      r.status !== "pago" && r.due_date < today
    ).reduce((s, r: any) => s + (Number(r.amount) - Number(r.paid_amount || 0)), 0);

    const payTotal = (payables ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
    const payPago = (payables ?? []).reduce((s, r: any) => s + Number(r.paid_amount || 0), 0);
    const payPend = payTotal - payPago;

    const comTotal = (commissions ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
    const comPend = (commissions ?? []).filter((r: any) => r.status === "pendente")
      .reduce((s, r: any) => s + Number(r.amount || 0), 0);

    const saldo = recvPago - payPago;
    return { recvTotal, recvPago, recvPend, recvAtraso, payTotal, payPago, payPend, comTotal, comPend, saldo };
  }, [receivables, payables, commissions, today]);

  return (
    <div className="space-y-6">
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="block border border-stone-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="block border border-stone-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card icon={<ArrowDownCircle className="size-5 text-emerald-600" />} label="A Receber (período)"
          value={brl(stats.recvTotal)} sub={`Pago: ${brl(stats.recvPago)}`} />
        <Card icon={<AlertTriangle className="size-5 text-red-600" />} label="Em atraso"
          value={brl(stats.recvAtraso)} sub="vencidos não pagos" tone="danger" />
        <Card icon={<ArrowUpCircle className="size-5 text-rose-600" />} label="A Pagar (período)"
          value={brl(stats.payTotal)} sub={`Pago: ${brl(stats.payPago)}`} />
        <Card icon={<Wallet className="size-5 text-stone-900" />} label="Saldo (recebido − pago)"
          value={brl(stats.saldo)} sub="movimento do período" tone={stats.saldo >= 0 ? "ok" : "danger"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card label="Total Recebido" value={brl(stats.recvPago)} />
        <Card label="Total Pago (despesas)" value={brl(stats.payPago)} />
        <Card label="Comissões pendentes" value={brl(stats.comPend)} sub={`Total geradas: ${brl(stats.comTotal)}`} />
      </div>

      <div className="bg-white border border-stone-200 p-6 text-sm text-stone-600">
        <p className="font-bold text-stone-900 mb-2">Como funciona</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Contas a Receber</strong>: gere as parcelas direto do pedido com a forma de pagamento cadastrada e dê baixa quando o cliente pagar.</li>
          <li><strong>Contas a Pagar</strong>: lance suas despesas (matéria-prima, energia, folha, etc.) e marque como pagas no vencimento.</li>
          <li><strong>Comissões</strong>: ao aprovar um pedido, gere as comissões dos vendedores. Controle pendente x pago.</li>
        </ul>
      </div>
    </div>
  );
}

function Card({ icon, label, value, sub, tone }: { icon?: React.ReactNode; label: string; value: string; sub?: string; tone?: "ok" | "danger" }) {
  return (
    <div className="bg-white border border-stone-200 p-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-stone-500 font-bold">
        {icon}{label}
      </div>
      <div className={"font-display text-2xl mt-2 " + (tone === "danger" ? "text-red-700" : tone === "ok" ? "text-emerald-700" : "")}>{value}</div>
      {sub && <div className="text-xs text-stone-500 mt-1">{sub}</div>}
    </div>
  );
}
