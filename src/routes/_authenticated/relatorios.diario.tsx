import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl , todayISO } from "@/lib/format";
import { formatQuoteName, formatOrderName } from "@/lib/naming";
import { Printer, Download, ArrowLeft, Upload, Pencil, Trash2 } from "lucide-react";
import {
  type ImportedRow,
  loadImportedRows,
  saveImportedRows,
  upsertImportedRow,
  deleteImportedRow,
  parseSalesXlsx,
} from "@/lib/imported-sales";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportDailyXlsx } from "@/lib/daily-xlsx";
import { loadCommissionRules, resolveSellerCommissionPct } from "@/lib/commission";
import { DEFAULT_PCT } from "@/lib/generate-commissions";
import {
  CommissionPayeesDialog,
  useCommissionPayees,
  findPayee,
  payeePaymentLine,
  type CommissionPayee,
} from "@/components/commission-payees-dialog";


type KindFilter = "todos" | "orcamento" | "pedido";
type Search = { from?: string; to?: string; seller?: string; kind?: KindFilter };

export const Route = createFileRoute("/_authenticated/relatorios/diario")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    from: typeof s.from === "string" ? s.from : undefined,
    to: typeof s.to === "string" ? s.to : undefined,
    seller: typeof s.seller === "string" ? s.seller : undefined,
    kind: (["todos", "orcamento", "pedido"] as const).includes(s.kind as KindFilter) ? (s.kind as KindFilter) : undefined,
  }),
  component: RelDiario,
});

type Row = {
  kind: "orcamento" | "pedido";
  id: string;
  number: number;
  client: string;
  seller: string;
  total: number;
  status: string;
  date: string;
  payment?: string;
  notes?: string;
  delivery?: string;
  contract_date?: string;
  prazo?: number | "";
  days_type?: string;
  external?: string;
  medicao?: string;
  medidor?: string;
  architect?: string;
  imported?: boolean;
};

const DELIVERY_LABEL: Record<string, string> = {
  retirada: "Retirada",
  entrega: "Entrega",
  instalacao: "Montagem",
};

function extra(d: Record<string, unknown>) {
  const del = (d.delivery ?? {}) as Record<string, unknown>;
  return {
    delivery: DELIVERY_LABEL[String(del.mode ?? "")] ?? "",
    contract_date: (d.date as string) || "",
    prazo: typeof del.days === "number" ? del.days : ("" as const),
    days_type: del.days_type === "corridos" ? "Corridos" : del.days_type === "uteis" ? "Úteis" : "",
    external: (d.external_salesperson as string) || "",
    architect: (d.architect as string) || "",
  };
}


function RelDiario() {
  const today = todayISO();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [from, setFrom] = useState(search.from || today);
  const [to, setTo] = useState(search.to || today);
  const sellerFilter = search.seller || "";
  const kindFilter: KindFilter = search.kind || "todos";
  const [imported, setImported] = useState<ImportedRow[]>(() => (typeof window !== "undefined" ? loadImportedRows() : []));
  const [manageOpen, setManageOpen] = useState(false);
  const [payeesOpen, setPayeesOpen] = useState(false);
  const [payeesKind, setPayeesKind] = useState("interno");
  const [printScope, setPrintScope] = useState<"all" | "vendas" | "interno" | "externo" | "arquiteto">("all");
  const { data: payees } = useCommissionPayees();

  /** Imprime apenas um bloco do relatório (PDF separado). */
  const printBlock = (scope: "all" | "vendas" | "interno" | "externo" | "arquiteto") => {
    setPrintScope(scope);
    setTimeout(() => {
      window.print();
      setTimeout(() => setPrintScope("all"), 300);
    }, 60);
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();


  const { data: sellers } = useQuery({
    queryKey: ["rep-diario-sellers"],
    queryFn: async () => {
      const { data } = await supabase.from("sellers").select("id, name").eq("active", true).order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data, isFetching } = useQuery({
    queryKey: ["rep-diario", from, to],
    queryFn: async () => {
      const [q, o] = await Promise.all([
        supabase.from("quotes")
          .select("id, number, status, total, client_name, data, created_at")
          .gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59")
          .neq("status", "aprovado")
          .neq("status", "cancelado"),
        supabase.from("orders")
          .select("id, number, status, total, client_name, data, created_at")
          .gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59"),
      ]);
      const rows: Row[] = [];
      for (const r of (q.data ?? [])) {
        const d = (r as { data: Record<string, unknown> }).data || {};
        rows.push({
          kind: "orcamento", id: r.id as string, number: r.number as number,
          client: (r.client_name as string) || (d.client_name as string) || "",
          seller: (d.salesperson as string) || "",
          total: Number(r.total) || 0, status: (r.status as string) || "",
          date: (r.created_at as string),
          payment: paymentSummary(d as Record<string, unknown>),
          notes: (d.notes as string) || "",
          ...extra(d),
        });

      }
      for (const r of (o.data ?? [])) {
        const d = (r as { data: Record<string, unknown> }).data || {};
        rows.push({
          kind: "pedido", id: r.id as string, number: r.number as number,
          client: (r.client_name as string) || (d.client_name as string) || "",
          seller: (d.salesperson as string) || "",
          total: Number(r.total) || 0, status: (r.status as string) || "",
          date: (r.created_at as string),
          payment: paymentSummary(d as Record<string, unknown>),
          notes: (d.notes as string) || "",
          ...extra(d),
        });

      }
      return rows.sort((a, b) => a.date.localeCompare(b.date));
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 30000,
  });

  // Atualiza automaticamente quando um orçamento ou pedido é fechado/alterado
  useEffect(() => {
    const ch = supabase
      .channel("rep-diario-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () =>
        qc.invalidateQueries({ queryKey: ["rep-diario"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, () =>
        qc.invalidateQueries({ queryKey: ["rep-diario"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);


  const merged = useMemo(() => {
    const base = (data ?? []) as Row[];
    const t0 = new Date(from + "T00:00:00").getTime();
    const t1 = new Date(to + "T23:59:59").getTime();
    const impInRange: Row[] = imported
      .filter((r) => {
        const t = new Date(r.date).getTime();
        return !isNaN(t) && t >= t0 && t <= t1;
      })
      .map((r) => ({
        ...r,
        imported: true,
        external: r.sellerType === "externo" ? r.seller : "",
      }));


    return [...base, ...impInRange].sort((a, b) => a.date.localeCompare(b.date));
  }, [data, imported, from, to]);

  const filtered = useMemo(() => {
    let r = merged;
    if (sellerFilter) r = r.filter((x) => x.seller === sellerFilter);
    if (kindFilter !== "todos") r = r.filter((x) => x.kind === kindFilter);
    return r;
  }, [merged, sellerFilter, kindFilter]);

  const grouped = useMemo(() => {
    const g = new Map<string, Row[]>();
    for (const r of filtered) {
      const key = r.seller || "Sem vendedor";
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(r);
    }
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const totalGeral = filtered.reduce((acc, r) => acc + r.total, 0);
  const totalOrc = filtered.filter((r) => r.kind === "orcamento").reduce((a, r) => a + r.total, 0);
  const totalPed = filtered.filter((r) => r.kind === "pedido").reduce((a, r) => a + r.total, 0);

  const { data: rules } = useQuery({
    queryKey: ["rep-diario-commission-rules"],
    queryFn: () => loadCommissionRules(true),
  });

  /** Comissões calculadas sobre os PEDIDOS do período, com os percentuais do sistema. */
  const commissions = useMemo(() => {
    const rs = rules ?? [];
    const sellerId = new Map((sellers ?? []).map((s) => [s.name, s.id]));
    const peds = filtered.filter((r) => r.kind === "pedido");




    type Agg = { name: string; base: number; amount: number; pcts: Set<number>; count: number };
    const mk = () => new Map<string, Agg>();
    const groups = { interno: mk(), externo: mk(), arquiteto: mk() };
    const add = (g: Map<string, Agg>, name: string, base: number, pct: number) => {
      const a = g.get(name) ?? { name, base: 0, amount: 0, pcts: new Set<number>(), count: 0 };
      a.base += base; a.amount += base * pct / 100; a.pcts.add(pct); a.count += 1;
      g.set(name, a);
    };

    for (const r of peds) {
      // O vendedor interno recebe comissão sobre TODOS os pedidos dele,
      // inclusive os que também têm vendedor externo (o externo recebe à parte).
      const interno = (r.seller || "").trim();
      if (interno) {
        // base acumulada; o percentual é aplicado por faixa depois (2% até o teto, 3% acima)
        add(groups.interno, interno, r.total, 0);
      }
      const ext = (r.external || "").trim();
      if (ext) {
        const pct = resolveSellerCommissionPct(rs, { scope: "external", value: r.total }) || DEFAULT_PCT.referral;
        add(groups.externo, ext, r.total, pct);
      }
      const arq = (r.architect || "").trim();
      if (arq) {
        const pct = resolveSellerCommissionPct(rs, { scope: "architect", value: r.total }) || DEFAULT_PCT.architect;
        add(groups.arquiteto, arq, r.total, pct);
      }
    }

    // Vendedor interno: somatório do período por faixa progressiva
    const limit = DEFAULT_PCT.sellerThreshold;
    for (const a of groups.interno.values()) {
      const ruled = resolveSellerCommissionPct(rs, { seller_id: sellerId.get(a.name) ?? null, scope: "seller", value: a.base });
      a.pcts = new Set<number>();
      if (ruled) {
        a.amount = a.base * ruled / 100;
        a.pcts.add(ruled);
      } else {
        const low = Math.min(a.base, limit);
        const high = Math.max(0, a.base - limit);
        a.amount = (low * DEFAULT_PCT.sellerLow / 100) + (high * DEFAULT_PCT.sellerHigh / 100);
        if (low > 0) a.pcts.add(DEFAULT_PCT.sellerLow);
        if (high > 0) a.pcts.add(DEFAULT_PCT.sellerHigh);
      }
    }

    const list = (g: Map<string, Agg>) =>
      Array.from(g.values()).sort((a, b) => b.amount - a.amount);

    return {
      interno: list(groups.interno),
      externo: list(groups.externo),
      arquiteto: list(groups.arquiteto),
    };
  }, [filtered, rules, sellers]);


  const exportXLSX = () => {
    if (!filtered.length) { toast.error("Nenhum registro no período"); return; }
    exportDailyXlsx(filtered, from, to);
    toast.success("Planilha gerada");
  };


  const handleImport = async (file: File) => {
    try {
      const parsed = await parseSalesXlsx(file);
      if (!parsed.length) {
        toast.error("Nenhum registro encontrado na planilha");
        return;
      }
      const next = [...imported, ...parsed];
      saveImportedRows(next);
      setImported(next);
      toast.success(`${parsed.length} registro(s) importado(s)`);
    } catch (e) {
      toast.error("Falha ao ler planilha: " + (e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div data-print-scope={printScope} className="max-w-7xl mx-auto px-6 py-10 print:p-0 report-bw report-a4">
      <div className="mb-6 flex items-end justify-between no-print">
        <div>
          <p className="label-eyebrow">Relatórios</p>
          <h1 className="font-display text-4xl mt-1">Relatório Diário</h1>
        </div>
        <Link to="/relatorios/vendas" className="text-xs uppercase tracking-widest font-bold text-stone-500 hover:text-stone-950 flex items-center gap-1">
          <ArrowLeft className="size-3" /> Relatório de Vendas
        </Link>
      </div>

      <div className="bg-white border border-stone-200 p-4 mb-4 flex flex-wrap items-end gap-3 no-print">
        <div>
          <label className="label-eyebrow">De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="block bg-white border border-stone-200 p-2 text-sm" />
        </div>
        <div>
          <label className="label-eyebrow">Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="block bg-white border border-stone-200 p-2 text-sm" />
        </div>
        <div>
          <label className="label-eyebrow">Vendedor</label>
          <select value={sellerFilter} onChange={(e) => navigate({ search: (s: Search) => ({ ...s, seller: e.target.value || undefined }) })}
            className="block bg-white border border-stone-200 p-2 text-sm min-w-[180px]">
            <option value="">Todos</option>
            {(sellers ?? []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-eyebrow">Tipo</label>
          <select value={kindFilter} onChange={(e) => navigate({ search: (s: Search) => ({ ...s, kind: (e.target.value as KindFilter) }) })}
            className="block bg-white border border-stone-200 p-2 text-sm min-w-[140px]">
            <option value="todos">Todos</option>
            <option value="orcamento">Orçamentos</option>
            <option value="pedido">Pedidos</option>
          </select>
        </div>
        <button onClick={() => navigate({ search: () => ({ from, to, seller: sellerFilter || undefined, kind: kindFilter }) })}
          className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-2 px-4">
          Aplicar
        </button>
        <div className="grow" />
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
        <button onClick={() => fileRef.current?.click()}
          className="text-xs uppercase tracking-widest font-bold py-2 px-3 border border-stone-200 hover:bg-stone-50 flex items-center gap-1">
          <Upload className="size-3" /> Importar Planilha
        </button>
        <button onClick={() => setManageOpen(true)}
          className="text-xs uppercase tracking-widest font-bold py-2 px-3 border border-stone-200 hover:bg-stone-50 flex items-center gap-1">
          <Pencil className="size-3" /> Importados ({imported.length})
        </button>
        <button onClick={exportXLSX} className="text-xs uppercase tracking-widest font-bold py-2 px-3 border border-stone-200 hover:bg-stone-50 flex items-center gap-1">
          <Download className="size-3" /> Excel
        </button>

        <button onClick={() => { setPayeesKind("interno"); setPayeesOpen(true); }}
          className="text-xs uppercase tracking-widest font-bold py-2 px-3 border border-stone-200 hover:bg-stone-50 flex items-center gap-1">
          <Pencil className="size-3" /> Cadastros de pagamento
        </button>

        <button onClick={() => printBlock("all")} className="text-xs uppercase tracking-widest font-bold py-2 px-3 border border-stone-200 hover:bg-stone-50 flex items-center gap-1">
          <Printer className="size-3" /> PDF completo
        </button>
        <button onClick={() => printBlock("vendas")} className="text-xs uppercase tracking-widest font-bold py-2 px-3 border border-stone-200 hover:bg-stone-50 flex items-center gap-1">
          <Printer className="size-3" /> PDF vendas
        </button>
        <button onClick={() => printBlock("interno")} className="text-xs uppercase tracking-widest font-bold py-2 px-3 border border-stone-200 hover:bg-stone-50 flex items-center gap-1">
          <Printer className="size-3" /> PDF interno
        </button>
        <button onClick={() => printBlock("externo")} className="text-xs uppercase tracking-widest font-bold py-2 px-3 border border-stone-200 hover:bg-stone-50 flex items-center gap-1">
          <Printer className="size-3" /> PDF externo
        </button>
        <button onClick={() => printBlock("arquiteto")} className="text-xs uppercase tracking-widest font-bold py-2 px-3 border border-stone-200 hover:bg-stone-50 flex items-center gap-1">
          <Printer className="size-3" /> PDF arquiteto
        </button>
      </div>

      <div className="print:px-0 print:py-0 print:text-[8.5pt]">
        <div className="hidden print:block mb-4">
          <h1 className="font-display text-2xl">Relatório Diário · {fmt(from)} a {fmt(to)}</h1>
        </div>

        {isFetching && <div className="text-sm text-stone-400">Carregando…</div>}

        <div data-print-block="vendas">
        {grouped.map(([seller, rows]) => {
          const sub = rows.reduce((a, r) => a + r.total, 0);
          return (
            <div key={seller} className="mb-6 bg-white border border-stone-200 print:border-0 print:mb-4">
              <div className="bg-stone-50 px-4 py-2 flex items-center justify-between border-b border-stone-200">
                <div className="font-bold text-sm">{seller}</div>
                <div className="text-xs text-stone-500">{rows.length} reg. · <strong className="text-stone-900">{brl(sub)}</strong></div>
              </div>
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-stone-500">
                  <tr>
                    <th className="text-left p-2 w-64">Documento</th>
                    <th className="text-left p-2 w-24">Data</th>
                    <th className="text-left p-2">Cliente</th>
                    <th className="text-right p-2 w-28">Valor</th>
                    <th className="text-left p-2 w-36">Pagamento</th>
                    <th className="text-left p-2 w-36">Vend. interno</th>
                    <th className="text-left p-2 w-36">Vend. externo</th>
                    <th className="text-left p-2 w-36">Arquiteto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((r) => (
                    <tr key={r.kind + r.id} className={r.imported ? "bg-amber-50/50" : ""}>
                      <td className="p-2 font-mono text-xs">
                        {r.imported && <span className="mr-1 inline-block text-[9px] uppercase tracking-widest font-bold bg-amber-200 text-amber-900 px-1 py-0.5">Imp</span>}
                        {r.kind === "orcamento"
                          ? formatQuoteName(r.number, r.client)
                          : formatOrderName(r.number, r.client)}
                      </td>
                      <td className="p-2">{new Date(r.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                      <td className="p-2">{r.client}</td>
                      <td className="p-2 text-right font-mono">{brl(r.total)}</td>
                      <td className="p-2 text-stone-600">{r.payment}</td>
                      <td className="p-2 text-stone-700">{r.external ? "" : r.seller}</td>
                      <td className="p-2 text-stone-700">{r.external || ""}</td>
                      <td className="p-2 text-stone-700">{r.architect || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

            </div>
          );
        })}
        </div>

        <CommissionSummary
          groups={commissions}
          payees={payees}
          onPrint={printBlock}
          onCadastro={(k) => { setPayeesKind(k); setPayeesOpen(true); }}
        />


        <div data-print-block="vendas" className="mt-6 bg-stone-950 text-white p-4 print:bg-white print:text-stone-950 print:border-t-2 print:border-stone-950">
          <div className="flex flex-wrap justify-between gap-4 text-sm">
            <div>Orçamentos: <strong>{brl(totalOrc)}</strong></div>
            <div>Pedidos: <strong>{brl(totalPed)}</strong></div>
            <div className="text-base">Total Geral: <strong>{brl(totalGeral)}</strong></div>
          </div>
        </div>
      </div>

      <ManageImportedDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        rows={imported}
        onChange={setImported}
      />
      <CommissionPayeesDialog
        open={payeesOpen}
        onOpenChange={setPayeesOpen}
        initialKind={payeesKind}
        suggestions={[
          ...commissions.interno.map((r) => ({ name: r.name, kind: "interno" })),
          ...commissions.externo.map((r) => ({ name: r.name, kind: "externo" })),
          ...commissions.arquiteto.map((r) => ({ name: r.name, kind: "arquiteto" })),
        ]}
      />
    </div>
  );
}

function ManageImportedDialog({
  open, onOpenChange, rows, onChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  rows: ImportedRow[];
  onChange: (rows: ImportedRow[]) => void;
}) {
  const updateField = (id: string, field: keyof ImportedRow, value: string) => {
    const r = rows.find((x) => x.id === id);
    if (!r) return;
    const updated: ImportedRow = { ...r };
    if (field === "total") updated.total = Number(value.replace(",", ".")) || 0;
    else if (field === "date") updated.date = value ? new Date(value).toISOString() : r.date;
    else if (field === "kind") updated.kind = value === "pedido" ? "pedido" : "orcamento";
    else (updated as Record<string, unknown>)[field] = value;
    onChange(upsertImportedRow(updated));
  };
  const remove = (id: string) => onChange(deleteImportedRow(id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Registros importados ({rows.length})</DialogTitle>
        </DialogHeader>
        {rows.length === 0 ? (
          <p className="text-sm text-stone-500">Nenhum registro importado. Use o botão "Importar Planilha" para carregar um .xlsx.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-stone-500">
              <tr className="border-b">
                <th className="text-left p-1 w-24">Tipo</th>
                <th className="text-left p-1 w-32">Data</th>
                <th className="text-left p-1">Cliente</th>
                <th className="text-left p-1 w-40">Vendedor</th>
                <th className="text-left p-1 w-28">Status</th>
                <th className="text-right p-1 w-32">Valor</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="p-1">
                    <select value={r.kind} onChange={(e) => updateField(r.id, "kind", e.target.value)}
                      className="border border-stone-200 px-1 py-0.5 text-xs w-full">
                      <option value="orcamento">Orçamento</option>
                      <option value="pedido">Pedido</option>
                    </select>
                  </td>
                  <td className="p-1">
                    <input type="date" value={r.date.slice(0, 10)}
                      onChange={(e) => updateField(r.id, "date", e.target.value)}
                      className="border border-stone-200 px-1 py-0.5 text-xs w-full" />
                  </td>
                  <td className="p-1">
                    <input value={r.client} onChange={(e) => updateField(r.id, "client", e.target.value)}
                      className="border border-stone-200 px-1 py-0.5 text-xs w-full" />
                  </td>
                  <td className="p-1">
                    <input value={r.seller} onChange={(e) => updateField(r.id, "seller", e.target.value)}
                      className="border border-stone-200 px-1 py-0.5 text-xs w-full" />
                  </td>
                  <td className="p-1">
                    <input value={r.status} onChange={(e) => updateField(r.id, "status", e.target.value)}
                      className="border border-stone-200 px-1 py-0.5 text-xs w-full" />
                  </td>
                  <td className="p-1">
                    <input type="number" step="0.01" value={r.total}
                      onChange={(e) => updateField(r.id, "total", e.target.value)}
                      className="border border-stone-200 px-1 py-0.5 text-xs w-full text-right font-mono" />
                  </td>
                  <td className="p-1 text-center">
                    <button onClick={() => remove(r.id)} className="text-stone-400 hover:text-red-600">
                      <Trash2 className="size-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {rows.length > 0 && (
          <div className="flex justify-between items-center pt-2 border-t mt-2 text-xs">
            <button
              onClick={() => { if (confirm("Apagar todos os importados?")) { saveImportedRows([]); onChange([]); } }}
              className="text-red-600 hover:underline">
              Limpar tudo
            </button>
            <span className="text-stone-500">
              Total importado: <strong className="font-mono text-stone-900">
                {rows.reduce((a, r) => a + r.total, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function paymentSummary(d: Record<string, unknown>): string {
  const p = (d.payment ?? {}) as Record<string, unknown>;
  const methods = (p.methods ?? []) as Array<{ method: string; installments: number }>;
  if (methods.length) return methods.map((m) => `${m.method}${m.installments > 1 ? ` ${m.installments}x` : ""}`).join(" + ");
  if (p.entry_value) return `Entrada + ${p.installments || 1}x`;
  return "";
}
function fmt(s: string) { try { return new Date(s + "T00:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }); } catch { return s; } }

type CommAgg = { name: string; base: number; amount: number; pcts: Set<number>; count: number };

type PayeeKind = "interno" | "externo" | "arquiteto";

function CommissionTable({ title, rows, kind, payees, onPrint, onCadastro }: {
  title: string;
  rows: CommAgg[];
  kind: PayeeKind;
  payees?: CommissionPayee[];
  onPrint: (k: PayeeKind) => void;
  onCadastro: (k: PayeeKind) => void;
}) {
  const total = rows.reduce((a, r) => a + r.amount, 0);
  return (
    <div data-print-block={kind} className="bg-white border border-stone-200 break-inside-avoid">
      <div className="bg-stone-50 px-3 py-2 border-b border-stone-200 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-widest font-bold text-stone-600">{title}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => onCadastro(kind)} className="no-print text-[10px] uppercase tracking-widest underline text-stone-500 hover:text-stone-900">Cadastros</button>
          <button onClick={() => onPrint(kind)} className="no-print text-stone-500 hover:text-stone-900" title="PDF deste grupo"><Printer className="size-3.5" /></button>
          <strong className="text-sm font-mono">{brl(total)}</strong>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="p-3 text-xs text-stone-400">Sem registros no período.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="text-[9px] uppercase tracking-widest text-stone-500">
            <tr>
              <th className="text-left p-2">Pessoa</th>
              <th className="text-right p-2 w-16">Ped.</th>
              <th className="text-right p-2 w-28">Base</th>
              <th className="text-right p-2 w-16">%</th>
              <th className="text-right p-2 w-28">Comissão</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r) => {
              const payee = findPayee(payees, r.name, kind);
              const line = payeePaymentLine(payee);
              return (
                <tr key={r.name} className="align-top">
                  <td className="p-2">
                    <div>{r.name}</div>
                    <div className={"text-[9px] leading-tight mt-0.5 " + (line ? "text-stone-500" : "text-amber-700 no-print")}>
                      {line || "Sem dados de pagamento cadastrados"}
                    </div>
                  </td>
                  <td className="p-2 text-right font-mono">{r.count}</td>
                  <td className="p-2 text-right font-mono">{brl(r.base)}</td>
                  <td className="p-2 text-right font-mono">
                    {Array.from(r.pcts).sort((a, b) => a - b).map((p) => `${p}%`).join(" / ")}
                  </td>
                  <td className="p-2 text-right font-mono font-bold">{brl(r.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CommissionSummary({ groups, payees, onPrint, onCadastro }: {
  groups: { interno: CommAgg[]; externo: CommAgg[]; arquiteto: CommAgg[] };
  payees?: CommissionPayee[];
  onPrint: (k: PayeeKind) => void;
  onCadastro: (k: PayeeKind) => void;
}) {
  return (
    <section className="mt-8">
      <h2 className="label-eyebrow mb-2">Comissões por pessoa (base: pedidos do período)</h2>
      <div className="grid gap-4 md:grid-cols-3 print:grid-cols-3">
        <CommissionTable title="Vendedor interno" rows={groups.interno} kind="interno" payees={payees} onPrint={onPrint} onCadastro={onCadastro} />
        <CommissionTable title="Vendedor externo / indicação" rows={groups.externo} kind="externo" payees={payees} onPrint={onPrint} onCadastro={onCadastro} />
        <CommissionTable title="Arquiteto" rows={groups.arquiteto} kind="arquiteto" payees={payees} onPrint={onPrint} onCadastro={onCadastro} />
      </div>
    </section>
  );
}


