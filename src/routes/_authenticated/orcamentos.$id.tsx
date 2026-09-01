import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Printer, ArrowLeft, Check, Eye, Copy, MessageCircle, GripVertical, Box, Repeat } from "lucide-react";
import { QuoteAttachmentsPanel } from "@/components/quote-attachments-panel";

import { normalizePhoneBR } from "@/lib/whatsapp-pdf";
import {
  emptyEnvironment,
  emptyQuoteData,
  type Environment,
  type EnvItem,
  type QuoteData,
  type SupplyLine,
} from "@/lib/types";
import { brl, num, fmtDate , todayISO } from "@/lib/format";
import {
  calcTotals,
  envTotal,
  envItemsTotal,
  envArea,
  itemArea,
  itemTotal,
  linesTotal,
  materialSummary,
  mergeSupplies,
} from "@/lib/quote-calc";
import { useCatalog, type Catalog } from "@/lib/catalog";
import { PaymentEditor, paymentSummaryText, ensurePaymentShape } from "@/components/payment-editor";
import { ItemFinishInline, ItemFinishEditor, FinishesLegendSummary } from "@/components/item-finishes";
import { Quote3DPreview } from "@/components/quote-3d-preview";
import { sendBase44Registro } from "@/lib/base44.functions";
import { DocTopHeader } from "@/components/pdf/doc-top-header";
import { DocBottomLayout } from "@/components/pdf/doc-bottom";
import porcelaneLogo from "@/assets/porcelane-logo.jpg.asset.json";


export const Route = createFileRoute("/_authenticated/orcamentos/$id")({
  component: Editor,
});

type Settings = {
  company_name: string; phone: string; whatsapp?: string; email: string; address: string;
  cnpj: string; logo_url: string | null; quote_terms: string;
};

const FALLBACK_SALES_PHONE = "819 9597-5549";
function companyPhone(s: Settings | null) {
  return s?.whatsapp || s?.phone || FALLBACK_SALES_PHONE;
}

function Editor() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [number, setNumber] = useState<number>(0);
  const [type, setType] = useState<"convencional" | "mfc">("convencional");
  const [status, setStatus] = useState<string>("rascunho");
  const [data, setData] = useState<QuoteData>(emptyQuoteData());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [clients, setClients] = useState<Array<{ id: string; name: string; phone: string | null; email: string | null; address: string | null; city: string | null; state: string | null; neighborhood: string | null }>>([]);
  const [showPdf, setShowPdf] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving">("idle");
  const [approving, setApproving] = useState(false);
  const [linkedOrderId, setLinkedOrderId] = useState<string | null>(null);

  const catalog = useCatalog();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  // Proteção contra saída com alterações ainda não gravadas.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "idle") return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveState]);


  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: q, error }, { data: c }, { data: cl }] = await Promise.all([
        supabase.from("quotes").select("*").eq("id", id).maybeSingle(),
        supabase.from("company_settings").select("*").eq("user_id", u.user.id).maybeSingle(),
        supabase.from("clients").select("id,name,phone,email,address,city,state,neighborhood").eq("user_id", u.user.id).eq("active", true).order("name"),
      ]);
      if (error || !q) { toast.error("Orçamento não encontrado"); navigate({ to: "/orcamentos" }); return; }
      setNumber(q.number);
      setType(q.type as "convencional" | "mfc");
      setStatus(q.status);
      const { data: linked } = await supabase.from("orders").select("id").eq("quote_id", id).limit(1);
      setLinkedOrderId(linked?.[0]?.id ?? null);

      const merged = { ...emptyQuoteData(), ...(q.data as QuoteData) };
      if (q.type === "mfc" && merged.installation) merged.installation = { ...merged.installation, enabled: false };
      // Telefone do consultor interno é sempre o da empresa, não editável.
      if (!merged.salesperson_phone?.trim()) merged.salesperson_phone = companyPhone(c as Settings);
      setData(merged);
      setSettings(c as Settings);
      setClients((cl ?? []) as typeof clients);
      setLoaded(true);
    })();
  }, [id, navigate]);

  const totals = useMemo(() => calcTotals(data), [data]);

  useEffect(() => {
    if (!loaded) return;
    // Sempre sincroniza a data do orçamento com o dia atual ao abrir
    const today = todayISO();
    if (data.date !== today) {
      setData({ ...data, date: today });
      if (isFirstLoad.current) isFirstLoad.current = false;
      return;
    }

    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("dirty");
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      const clientUpper = (data.client_name || "").toUpperCase();
      const { error } = await supabase
        .from("quotes")
        .update({
          client_name: clientUpper,
          total: totals.total,
          data: { ...data, client_name: clientUpper } as never,
        })
        .eq("id", id);
      if (error) toast.error(error.message);
      setSaveState(error ? "dirty" : "idle");

      // Sync para pedido vinculado quando aprovado
      if (status === "aprovado") {
        const { data: linked } = await supabase.from("orders")
          .update({ client_name: clientUpper, total: totals.total, data: { ...data, client_name: clientUpper } as never })
          .eq("quote_id", id)
          .select("id");
        // Re-sincroniza parcelas do financeiro com a forma de pagamento atual
        for (const o of linked ?? []) {
          try {
            const { syncReceivablesForOrder } = await import("@/lib/generate-receivables");
            await syncReceivablesForOrder(o.id);
          } catch (e) { console.error(e); }
        }
      }
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [data, totals.total, id, loaded, status]);

  const set = <K extends keyof QuoteData>(k: K, v: QuoteData[K]) => setData({ ...data, [k]: v });
  const setEnv = (i: number, e: Environment) => {
    const envs = [...data.environments]; envs[i] = e; setData({ ...data, environments: envs });
  };
  const addEnv = () => setData({ ...data, environments: [...data.environments, emptyEnvironment(`Ambiente ${data.environments.length + 1}`)] });
  const duplicateEnv = (i: number) => {
    const src = data.environments[i];
    const copy: Environment = {
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} (cópia)`,
      items: src.items.map((it) => ({ ...it, id: crypto.randomUUID() })),
      services: src.services.map((s) => ({ ...s, id: crypto.randomUUID() })),
      supplies: src.supplies.map((s) => ({ ...s, id: crypto.randomUUID() })),
    };
    const envs = [...data.environments];
    envs.splice(i + 1, 0, copy);
    setData({ ...data, environments: envs });
    toast.success("Ambiente duplicado — altere o material para comparar");
  };
  const removeEnv = (i: number) => setData({ ...data, environments: data.environments.filter((_, idx) => idx !== i) });

  const duplicateQuote = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: newQ, error } = await supabase
      .from("quotes")
      .insert({
        user_id: u.user.id,
        number: 0,
        type,
        status: "rascunho",
        client_name: data.client_name,
        total: totals.total,
        data: data as never,
      })
      .select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("Orçamento duplicado");
    navigate({ to: "/orcamentos/$id", params: { id: newQ.id } });
  };

  /** Grava imediatamente o estado atual (usado antes de sair da tela). */
  const flushSave = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    const clientUpper = (data.client_name || "").toUpperCase();
    const { error } = await supabase
      .from("quotes")
      .update({ client_name: clientUpper, total: totals.total, data: { ...data, client_name: clientUpper } as never })
      .eq("id", id);
    if (error) { toast.error(error.message); setSaveState("dirty"); return false; }
    setSaveState("idle");
    return true;
  };

  /** Cria outro orçamento e já abre na mesma tela — permite emitir vários em sequência. */
  const newQuote = async (t: "convencional" | "mfc") => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!(await flushSave())) return;
    const { data: newQ, error } = await supabase
      .from("quotes")
      .insert({ user_id: u.user.id, number: 0, type: t, client_name: "", total: 0, data: emptyQuoteData() as never })
      .select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success(`Novo orçamento ${t === "mfc" ? "MFC" : "convencional"} criado`);
    navigate({ to: "/orcamentos/$id", params: { id: newQ.id } });
  };

  /** Converte entre MFC e Convencional preservando dados e recalculando valores. */
  const convertType = async () => {
    const to: "convencional" | "mfc" = type === "mfc" ? "convencional" : "mfc";
    if (status === "aprovado") { toast.error("Orçamento aprovado não pode mudar de tipo"); return; }
    if (!confirm(`Converter para ${to === "mfc" ? "MFC" : "Convencional"}? Os dados são preservados e os valores recalculados.`)) return;
    const { convertQuoteType } = await import("@/lib/quote-conversion");
    const seller = catalog.sellers.find((s) => s.id === data.seller_id)?.name ?? data.salesperson;
    const { data: converted, entry } = convertQuoteType(data, to, seller);
    const { error } = await supabase.from("quotes").update({ type: to, total: entry.total_after, data: converted as never }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setType(to);
    setData(converted);
    toast.success(`Convertido para ${to === "mfc" ? "MFC" : "Convencional"} · ${brl(entry.total_before)} → ${brl(entry.total_after)}`);
  };




  const approve = async () => {
    if (approving) return;
    setApproving(true);
    try {
      // Garante que o conteúdo atual esteja gravado antes de gerar o pedido
      if (!(await flushSave())) return;
      const { createOrderFromQuote } = await import("@/lib/quote-approval");
      const r = await createOrderFromQuote(id);
      if (r.trello === "error") toast.error("⚠ Não foi possível registrar a instalação no Trello.");
      else if (r.trello === "ok") toast.success("Card criado no Trello (Pedidos Fechados)");

      setStatus("aprovado");
      toast.success(r.created ? "Orçamento aprovado! Pedido gerado." : "Pedido já existia — abrindo o pedido vinculado.");

      // Base44 registro (fire-and-forget)
      const sellerName = catalog.sellers.find((s) => s.id === data.seller_id)?.name ?? data.salesperson;
      sendBase44Registro({ data: {
        tipo: "Pedido",
        numero: r.orderId.slice(0, 8),
        data: new Date().toISOString(),
        cliente: data.client_name,
        valor_total: totals.total,
        status: "aprovado",
        vendedor_interno: sellerName ?? "",
        vendedor_externo: data.external_salesperson ?? "",
        arquiteto: data.architect ?? "",
        forma_pagamento: paymentSummaryText(data.payment, totals),
      } }).catch(() => {});
      navigate({ to: "/pedidos/$id", params: { id: r.orderId } });
    } catch (e) {
      toast.error("Falha ao gerar o pedido: " + (e as Error).message);
    } finally {
      setApproving(false);
    }
  };


  if (!loaded) return <div className="p-10 text-sm text-stone-400">Carregando…</div>;

  if (showPdf) return <PdfPreview data={data} totals={totals} settings={settings} number={number} type={type} catalog={catalog} onClose={() => setShowPdf(false)} />;

  const seller = catalog.sellers.find((s) => s.id === data.seller_id);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 pb-32">
      <button onClick={() => navigate({ to: "/orcamentos" })} className="flex items-center gap-2 text-xs text-stone-500 hover:text-stone-950 mb-4">
        <ArrowLeft className="size-3" /> Voltar
      </button>

      <section className="bg-white border border-stone-200">
        <div className="p-8 border-b border-stone-100 bg-stone-50/40">
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="text-xs font-bold tracking-widest text-gold-low uppercase">
                {type === "mfc" ? "Orçamento MFC" : "Orçamento Convencional"}
              </span>
              <h2 className="text-3xl font-display mt-1">Nº {String(number).padStart(4, "0")}</h2>
              <p className="text-xs text-stone-400 mt-1">
                {fmtDate(data.date)} · Status: <strong>{status}</strong> ·{" "}
                <span className={saveState === "idle" ? "text-emerald-600" : "text-amber-600"}>
                  {saveState === "saving" ? "Salvando…" : saveState === "dirty" ? "Alterações não salvas" : "Salvo"}
                </span>
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <button onClick={() => setShowPdf(true)} className="px-4 py-2 text-xs font-bold border border-stone-300 uppercase tracking-tighter hover:bg-stone-100 flex items-center gap-2">
                <Eye className="size-3" /> Pré-visualizar
              </button>
              <button onClick={duplicateQuote} className="px-4 py-2 text-xs font-bold border border-stone-300 uppercase tracking-tighter hover:bg-stone-100 flex items-center gap-2">
                <Copy className="size-3" /> Duplicar
              </button>
              <button onClick={convertType} disabled={status === "aprovado"} className="px-4 py-2 text-xs font-bold border border-stone-300 uppercase tracking-tighter hover:bg-stone-100 flex items-center gap-2 disabled:opacity-40">
                <Repeat className="size-3" /> → {type === "mfc" ? "Convencional" : "MFC"}
              </button>
              <button onClick={() => newQuote(type)} className="px-4 py-2 text-xs font-bold border border-stone-300 uppercase tracking-tighter hover:bg-stone-100 flex items-center gap-2">
                <Plus className="size-3" /> Novo orçamento
              </button>
              {status === "aprovado" && linkedOrderId && (
                <button onClick={() => navigate({ to: "/pedidos/$id", params: { id: linkedOrderId } })} className="px-4 py-2 text-xs font-bold border border-stone-300 uppercase tracking-tighter hover:bg-stone-100 flex items-center gap-2">
                  Abrir pedido
                </button>
              )}
              <button onClick={approve} disabled={approving || (status === "aprovado" && !!linkedOrderId)} className="px-6 py-2 text-xs font-bold bg-stone-950 text-white uppercase tracking-tighter hover:bg-stone-800 flex items-center gap-2 disabled:opacity-50">
                <Check className="size-3" /> {approving ? "Gerando…" : status === "aprovado" && linkedOrderId ? "Aprovado" : status === "aprovado" ? "Gerar pedido" : "Aprovar → Pedido"}
              </button>
            </div>
          </div>

          {status === "aprovado" && !linkedOrderId && (
            <div className="mb-6 border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              Este orçamento está aprovado mas <strong>não gerou pedido</strong>. Clique em “Gerar pedido” para criar o pedido vinculado.
            </div>
          )}

          <div className="mb-6">
            <QuoteAttachmentsPanel quoteId={id} />
          </div>



          <div className="mb-6">


            <label className="label-eyebrow">Selecionar cliente do cadastro</label>
            <div className="flex gap-2 items-center">
              <select
                value=""
                onChange={(e) => {
                  const c = clients.find((x) => x.id === e.target.value);
                  if (!c) return;
                  const addr = [c.address, c.neighborhood].filter(Boolean).join(", ");
                  const city = [c.city, c.state].filter(Boolean).join("/");
                  setData({
                    ...data,
                    client_name: c.name,
                    client_phone: c.phone ?? data.client_phone,
                    client_email: c.email ?? data.client_email,
                    address: addr || data.address,
                    city: city || data.city,
                  });
                  toast.success("Dados do cliente preenchidos");
                }}
                className="input-line bg-transparent flex-1"
              >
                <option value="">— Escolher cliente cadastrado —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ""}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => navigate({ to: "/clientes" })}
                className="px-3 py-2 text-[10px] font-bold border border-stone-300 uppercase tracking-tighter hover:bg-stone-100"
              >
                + Novo
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-y-6 gap-x-10">
            <Field label="Cliente" value={data.client_name} onChange={(v) => set("client_name", v)} />
            <Field label="Telefone" value={data.client_phone} onChange={(v) => set("client_phone", v)} />
            <Field label="Cidade/UF" value={data.city} onChange={(v) => set("city", v)} />
              <div className="space-y-1">
                <label className="label-eyebrow">Vendedor interno</label>
                <select
                  value={data.seller_id ?? ""}
                  onChange={(e) => {
                    const sid = e.target.value;
                    const s = catalog.sellers.find((x) => x.id === sid);
                    setData({
                      ...data,
                      seller_id: sid,
                      salesperson: s?.name ?? data.salesperson,
                      salesperson_phone: companyPhone(settings),
                    });
                  }}
                  className="input-line bg-transparent"
                >
                  <option value="">— Selecionar —</option>
                  {catalog.sellers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <Field className="md:col-span-2" label="Endereço da obra" value={data.address} onChange={(v) => set("address", v)} />
              <Field label="Vendedor externo" value={data.external_salesperson ?? ""} onChange={(v) => set("external_salesperson", v)} />
              <Field label="Tel. vendedor externo" value={data.external_salesperson_phone ?? ""} onChange={(v) => set("external_salesperson_phone", v)} />
              <Field label="Arquiteto" value={data.architect ?? ""} onChange={(v) => set("architect", v)} />
              <Field label="Tel. arquiteto" value={data.architect_phone ?? ""} onChange={(v) => set("architect_phone", v)} />
              <div className="space-y-1">
                <label className="label-eyebrow">Tel. consultor interno</label>
                <input
                  type="text"
                  value={companyPhone(settings)}
                  readOnly
                  className="input-line bg-stone-100 text-stone-600 cursor-not-allowed"
                />
              </div>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-eyebrow">Outros contatos de responsáveis</span>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => set("contacts", [...(data.contacts ?? []), { id: crypto.randomUUID(), label: "Responsável", name: "", phone: "" }])}
              >
                + Adicionar contato
              </button>
            </div>
            {(data.contacts ?? []).map((c, i) => (
              <div key={c.id} className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_1fr_auto] gap-3 items-end">
                <Field label="Função" value={c.label} onChange={(v) => set("contacts", (data.contacts ?? []).map((x, j) => j === i ? { ...x, label: v } : x))} />
                <Field label="Nome" value={c.name} onChange={(v) => set("contacts", (data.contacts ?? []).map((x, j) => j === i ? { ...x, name: v } : x))} />
                <Field label="Telefone" value={c.phone ?? ""} onChange={(v) => set("contacts", (data.contacts ?? []).map((x, j) => j === i ? { ...x, phone: v } : x))} />
                <button
                  type="button"
                  className="text-xs underline pb-2"
                  onClick={() => set("contacts", (data.contacts ?? []).filter((_, j) => j !== i))}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 space-y-12">
          {data.environments.map((env, i) => (
            <EnvironmentEditor
              key={env.id}
              env={env}
              catalog={catalog}
              onChange={(e) => setEnv(i, e)}
              onRemove={() => removeEnv(i)}
              onDuplicate={() => duplicateEnv(i)}
              hideMaterialPrice={type === "mfc"}
            />
          ))}

          <button onClick={addEnv} className="border border-dashed border-stone-300 w-full py-4 text-xs uppercase tracking-widest text-stone-500 hover:text-stone-950 hover:border-stone-950 flex items-center justify-center gap-2">
            <Plus className="size-4" /> Adicionar ambiente
          </button>

          {/* Quote-level supplies block — before financial summary */}
          {(() => {
            const envSuppliesTotal = data.environments.reduce(
              (s, e) => s + (e.supplies ?? []).reduce((a, l) => a + l.qty * l.unit_value, 0),
              0,
            );
            const envSupplyLines = data.environments.flatMap((e) =>
              (e.supplies ?? []).map((l) => ({ env: e.name, line: l })),
            );
            return (
              <div className="pt-8 border-t border-stone-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-xl">Insumos do orçamento</h3>
                  <span className="text-xs text-stone-400 font-mono">
                    Total geral {brl(totals.quoteSuppliesTotal + envSuppliesTotal)}
                  </span>
                </div>
                <SupplyPicker
                  lines={data.quote_supplies ?? []}
                  supplies={catalog.supplies}
                  onChange={(quote_supplies) => set("quote_supplies", quote_supplies)}
                />
                {envSupplyLines.length > 0 && (
                  <div className="mt-4 border-t border-stone-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="label-eyebrow">Insumos vindos dos ambientes</span>
                      <span className="text-xs font-mono text-stone-500">{brl(envSuppliesTotal)}</span>
                    </div>
                    <ul className="space-y-1">
                      {envSupplyLines.map(({ env, line }) => (
                        <li key={line.id} className="flex justify-between text-xs text-stone-500">
                          <span>{env} · {line.description} (x{line.qty})</span>
                          <span className="font-mono">{brl(line.qty * line.unit_value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-stone-100">
            <div className="space-y-8">
              <div>
                <h4 className="label-eyebrow mb-4">Frete</h4>
                <div className="grid grid-cols-2 gap-4">
                  <NumField label="Quantidade" value={data.freight.qty} onChange={(v) => set("freight", { ...data.freight, qty: v })} />
                  <NumField label="Valor unitário (R$)" value={data.freight.unit_value} onChange={(v) => set("freight", { ...data.freight, unit_value: v })} />
                </div>
              </div>
              {type === "mfc" && (
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={data.mfc_pickup?.enabled !== false}
                        onChange={(e) => set("mfc_pickup", { qty: data.mfc_pickup?.qty ?? 0, unit_value: data.mfc_pickup?.unit_value ?? 0, items: data.mfc_pickup?.items, enabled: e.target.checked })}
                        className="size-4 accent-stone-950"
                      />
                      <h4 className="label-eyebrow !mb-0">Valor de Coleta (MFC)</h4>
                    </label>
                    {data.mfc_pickup?.enabled !== false && (
                      <button
                        type="button"
                        onClick={() => {
                          const items = data.mfc_pickup?.items ?? [];
                          const next = [...items, { id: crypto.randomUUID(), description: "", qty: 1, unit_value: 300 }];
                          set("mfc_pickup", { qty: data.mfc_pickup?.qty ?? 0, unit_value: data.mfc_pickup?.unit_value ?? 0, items: next, enabled: true });
                        }}
                        className="text-xs uppercase tracking-wider font-bold text-gold-low hover:text-gold-high flex items-center gap-1"
                      >
                        <Plus className="size-3" /> Adicionar item
                      </button>
                    )}
                  </div>
                  {data.mfc_pickup?.enabled !== false && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-stone-500 border-b border-stone-200">
                        <th className="text-left py-1 font-bold">Descrição</th>
                        <th className="text-right py-1 font-bold w-20">Qtd</th>
                        <th className="text-right py-1 font-bold w-28">Valor unit. (R$)</th>
                        <th className="text-right py-1 font-bold w-28">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.mfc_pickup?.items ?? []).map((it, idx) => (
                        <tr key={it.id} className="border-b border-stone-100">
                          <td className="py-1">
                            <input
                              value={it.description}
                              onChange={(e) => {
                                const items = [...(data.mfc_pickup?.items ?? [])];
                                items[idx] = { ...items[idx], description: e.target.value };
                                set("mfc_pickup", { qty: data.mfc_pickup?.qty ?? 0, unit_value: data.mfc_pickup?.unit_value ?? 0, items });
                              }}
                              placeholder="Ex.: Coleta granito - Recife"
                              className="w-full bg-transparent border-b border-transparent hover:border-stone-300 focus:border-stone-950 focus:outline-none px-1 py-0.5"
                            />
                          </td>
                          <td className="py-1">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={it.qty}
                              onKeyDown={(e) => { if (e.key === "." || e.key === ",") e.preventDefault(); }}
                              onChange={(e) => {
                                const items = [...(data.mfc_pickup?.items ?? [])];
                                items[idx] = { ...items[idx], qty: Math.max(1, parseInt(e.target.value) || 1) };
                                set("mfc_pickup", { qty: data.mfc_pickup?.qty ?? 0, unit_value: data.mfc_pickup?.unit_value ?? 0, items });
                              }}
                              className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-stone-300 focus:border-stone-950 focus:outline-none px-1 py-0.5"
                            />
                          </td>
                          <td className="py-1">
                            <input
                              type="number"
                              value={it.unit_value}
                              onChange={(e) => {
                                const items = [...(data.mfc_pickup?.items ?? [])];
                                items[idx] = { ...items[idx], unit_value: +e.target.value || 0 };
                                set("mfc_pickup", { qty: data.mfc_pickup?.qty ?? 0, unit_value: data.mfc_pickup?.unit_value ?? 0, items });
                              }}
                              className="w-full text-right font-mono bg-transparent border-b border-transparent hover:border-stone-300 focus:border-stone-950 focus:outline-none px-1 py-0.5"
                            />
                          </td>
                          <td className="py-1 text-right font-mono">{brl((it.qty || 0) * (it.unit_value || 0))}</td>
                          <td className="py-1 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const items = (data.mfc_pickup?.items ?? []).filter((_, i) => i !== idx);
                                set("mfc_pickup", { qty: data.mfc_pickup?.qty ?? 0, unit_value: data.mfc_pickup?.unit_value ?? 0, items });
                              }}
                              className="text-stone-400 hover:text-red-500"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(data.mfc_pickup?.items ?? []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-3 text-center text-xs text-stone-400">
                            Nenhum item de coleta. Clique em "Adicionar item" para incluir.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="text-right text-[10px] uppercase tracking-wider font-bold pt-2">Total coleta</td>
                        <td className="text-right font-mono font-bold pt-2">{brl(totals.mfcPickup)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                  )}
                </div>
              )}
              {type === "convencional" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="label-eyebrow">Instalação</h4>
                    <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!data.installation?.enabled}
                        onChange={(e) => set("installation", { percent: 20, min_value: 590, ...(data.installation ?? {}), enabled: e.target.checked })}
                        className="size-4 accent-stone-950"
                      />
                      Incluir no orçamento
                    </label>
                  </div>
                  {data.installation?.enabled && (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <NumField
                          label="% sobre materiais"
                          value={data.installation?.percent ?? 20}
                          onChange={(v) => set("installation", { enabled: true, min_value: data.installation?.min_value ?? 590, override_value: data.installation?.override_value, percent: v })}
                        />
                        <NumField
                          label="Taxa mínima (R$)"
                          value={data.installation?.min_value ?? 590}
                          onChange={(v) => set("installation", { enabled: true, percent: data.installation?.percent ?? 20, override_value: data.installation?.override_value, min_value: v })}
                        />
                        <NumField
                          label="Valor manual (R$)"
                          value={data.installation?.override_value ?? 0}
                          onChange={(v) => set("installation", { enabled: true, percent: data.installation?.percent ?? 20, min_value: data.installation?.min_value ?? 590, override_value: v })}
                        />
                      </div>
                      <p className="text-xs text-stone-500 mt-2 font-mono">
                        Automático: {brl(totals.installationAuto)} {data.installation?.override_value && data.installation.override_value > 0 ? `· Usando manual: ${brl(totals.installation)}` : `· Aplicado: ${brl(totals.installation)}`}
                      </p>
                      <p className="text-[10px] text-stone-400 mt-1">Deixe o valor manual em 0 para usar o cálculo automático (máx entre % e taxa mínima).</p>
                    </>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 pt-4 border-t border-stone-100">
                <div className="grid grid-cols-[1fr_180px] items-end gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
                    <input
                      type="checkbox"
                      checked={!!data.baseboard_install?.enabled}
                      onChange={(e) => set("baseboard_install", { value: data.baseboard_install?.value ?? 0, enabled: e.target.checked })}
                      className="size-4 accent-stone-950"
                    />
                    <h4 className="label-eyebrow !mb-0">Instalação de rodapé pós móvel</h4>
                  </label>
                  <NumField
                    label="Valor manual (R$)"
                    value={data.baseboard_install?.value ?? 0}
                    onChange={(v) => set("baseboard_install", { enabled: data.baseboard_install?.enabled ?? false, value: v })}
                  />
                </div>
                <div className="grid grid-cols-[1fr_180px] items-end gap-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
                    <input
                      type="checkbox"
                      checked={!!data.baseboard_freight?.enabled}
                      onChange={(e) => set("baseboard_freight", { value: data.baseboard_freight?.value ?? 0, enabled: e.target.checked })}
                      className="size-4 accent-stone-950"
                    />
                    <h4 className="label-eyebrow !mb-0">Frete para rodapé pós móvel</h4>
                  </label>
                  <NumField
                    label="Valor manual (R$)"
                    value={data.baseboard_freight?.value ?? 0}
                    onChange={(v) => set("baseboard_freight", { enabled: data.baseboard_freight?.enabled ?? false, value: v })}
                  />
                </div>
              </div>
              <div>
                <h4 className="label-eyebrow mb-4">Prazo de entrega</h4>
                <div className="grid grid-cols-2 gap-4">
                  <NumField
                    label="Prazo (dias)"
                    value={data.delivery?.days ?? 0}
                    onChange={(v) => set("delivery", {
                      mode: data.delivery?.mode ?? "entrega",
                      days_type: data.delivery?.days_type ?? "uteis",
                      start_date: data.delivery?.start_date,
                      days: Math.max(0, Math.round(v)),
                    })}
                  />
                  <div className="space-y-1">
                    <label className="label-eyebrow">Tipo de dias</label>
                    <select
                      value={data.delivery?.days_type ?? "uteis"}
                      onChange={(e) => set("delivery", {
                        mode: data.delivery?.mode ?? "entrega",
                        days: data.delivery?.days ?? 0,
                        start_date: data.delivery?.start_date,
                        days_type: e.target.value as "uteis" | "corridos",
                      })}
                      className="w-full bg-white border border-stone-200 p-2 text-sm"
                    >
                      <option value="uteis">Dias úteis</option>
                      <option value="corridos">Dias corridos</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="label-eyebrow mb-4">Desconto</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="label-eyebrow">Tipo</label>
                    <select value={data.discount.type} onChange={(e) => set("discount", { ...data.discount, type: e.target.value as "percent" | "value" })} className="w-full bg-white border border-stone-200 p-2 text-sm">
                      <option value="value">Valor (R$)</option>
                      <option value="percent">Percentual (%)</option>
                    </select>
                  </div>
                  <NumField label="Valor" value={data.discount.value} onChange={(v) => set("discount", { ...data.discount, value: v })} />
                  <div className="space-y-1 col-span-2">
                    <label className="label-eyebrow">Aplicar sobre</label>
                    <select
                      value={data.discount.scope ?? "total"}
                      onChange={(e) => set("discount", { ...data.discount, scope: e.target.value as "total" | "material" })}
                      className="w-full bg-white border border-stone-200 p-2 text-sm"
                    >
                      <option value="total">Total do pedido</option>
                      <option value="material">Apenas material (sem insumos, frete e instalação)</option>
                    </select>
                    <p className="text-[11px] text-stone-500">
                      Base do desconto: {brl(totals.discountBase)} · Desconto: {brl(totals.discountValue)}
                    </p>
                    <label className="flex items-center gap-2 text-sm pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={data.discount.hide_on_pdf ?? false}
                        onChange={(e) => set("discount", { ...data.discount, hide_on_pdf: e.target.checked })}
                      />
                      Ocultar desconto no PDF (o valor continua abatido do total)
                    </label>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="label-eyebrow mb-4">Forma de Pagamento</h4>
                <PaymentEditor
                  payment={data.payment}
                  onChange={(p) => set("payment", p)}
                  totals={{ total: totals.total, entry: totals.entry, balance: totals.balance, methodBreakdown: totals.methodBreakdown }}
                />
                <textarea
                  placeholder="Observações sobre o pagamento (opcional)"
                  value={data.payment.notes ?? ""}
                  onChange={(e) => set("payment", { ...data.payment, notes: e.target.value })}
                  rows={2}
                  className="w-full mt-2 bg-white border border-stone-200 p-2 text-sm focus:outline-none focus:border-gold-high"
                />
              </div>
              <div>
                <h4 className="label-eyebrow mb-2">Observações</h4>
                <textarea value={data.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3}
                  className="w-full bg-white border border-stone-200 p-3 text-sm focus:outline-none focus:border-gold-high" />
                <div className="mt-3 border border-stone-200 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-2">Materiais exibidos no PDF</p>
                  <p className="text-[10px] text-stone-500 mb-2">Desmarque os materiais que o cliente fornecerá (não aparecerão no PDF).</p>
                  {materialSummary(data).length === 0 && (
                    <p className="text-[10px] text-stone-400 italic">Nenhum material com m² ainda.</p>
                  )}
                  <div className="space-y-1">
                    {materialSummary(data).map((s) => {
                      const hidden = (data.hidden_materials ?? []).includes(s.material);
                      return (
                        <label key={s.material} className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!hidden}
                            onChange={(e) => {
                              const cur = new Set(data.hidden_materials ?? []);
                              if (e.target.checked) cur.delete(s.material);
                              else cur.add(s.material);
                              set("hidden_materials", Array.from(cur));
                            }}
                            className="size-4 accent-stone-950"
                          />
                          <span>{s.material}</span>
                          <span className="text-stone-400 font-mono ml-auto">{num(s.area)} m²</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-3 text-xs text-stone-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!data.show_material_summary}
                    onChange={(e) => set("show_material_summary", e.target.checked)}
                    className="size-4 accent-stone-950"
                  />
                  Incluir <strong>resumo de materiais</strong> no PDF
                </label>

                <label className="flex items-center gap-2 mt-2 text-xs text-stone-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!data.show_waste_pct}
                    onChange={(e) => set("show_waste_pct", e.target.checked)}
                    className="size-4 accent-stone-950"
                  />
                  Mostrar <strong>+30% de perda</strong> no resumo de materiais
                </label>
                <label className="flex items-center gap-2 mt-2 text-xs text-stone-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!data.show_item_count}
                    onChange={(e) => set("show_item_count", e.target.checked)}
                    className="size-4 accent-stone-950"
                  />
                  Incluir <strong>quantitativo de peças</strong> no PDF
                </label>
                <label className="flex items-center gap-2 mt-2 text-xs text-stone-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!data.hide_env_m2}
                    onChange={(e) => set("hide_env_m2", e.target.checked)}
                    className="size-4 accent-stone-950"
                  />
                  Ocultar <strong>m² do ambiente</strong> no PDF (coluna e total)
                </label>
                <label className="flex items-center gap-2 mt-2 text-xs text-stone-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={data.show_item_finishes !== false}
                    onChange={(e) => set("show_item_finishes", e.target.checked)}
                    className="size-4 accent-stone-950"
                  />
                  Mostrar <strong>acabamentos por item</strong> (cor + nome) no PDF
                </label>
              </div>
            </div>

            <div className="bg-stone-950 text-white p-8 space-y-6 self-start sticky top-24">
              <div className="space-y-3 border-b border-white/10 pb-6">
                <Row label="Materiais (peças)" value={brl(totals.productsTotal)} />
                <Row label="Serviços & Insumos" value={brl(totals.servicesSum)} />
                <Row label="Frete" value={brl(totals.freight)} />
                {type === "mfc" && totals.mfcPickup > 0 && (
                  <Row label="Taxa de coleta" value={brl(totals.mfcPickup)} />
                )}
                {type === "convencional" && totals.installation > 0 && (
                  <Row label="Instalação" value={brl(totals.installation)} />
                )}
                {totals.baseboardInstall > 0 && (
                  <Row label="Instalação rodapé pós móvel" value={brl(totals.baseboardInstall)} />
                )}
                {totals.baseboardFreight > 0 && (
                  <Row label="Frete rodapé pós móvel" value={brl(totals.baseboardFreight)} />
                )}
                {totals.discountValue > 0 && (
                  <Row label="Desconto" value={`- ${brl(totals.discountValue)}`} highlight />
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-gold-low">Total Geral</p>
                <p className="text-4xl font-display font-bold mt-1">{brl(totals.total)}</p>
                {(data.delivery?.days ?? 0) > 0 && (
                  <p className="text-[11px] text-white/70 mt-2">
                    Prazo: <span className="font-mono">{data.delivery!.days}</span> {data.delivery!.days_type === "uteis" ? "dias úteis" : "dias corridos"}
                  </p>
                )}
                <p className="text-[10px] text-white/40 italic mt-2">Validade: {data.validity_days} dias</p>
                {seller && (
                  <p className="text-[10px] text-white/40 mt-1">Vendedor: {seller.name}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={"flex justify-between text-sm " + (highlight ? "text-red-300" : "text-stone-400")}>
      <span>{label}</span><span className="font-mono">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={"space-y-1 " + className}>
      <label className="label-eyebrow">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="input-line" />
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="label-eyebrow">{label}</label>
      <input type="number" step="0.01" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="input-line font-mono" />
    </div>
  );
}

function EnvironmentEditor({ env, catalog, onChange, onRemove, onDuplicate, hideMaterialPrice }: {
  env: Environment; catalog: Catalog; onChange: (e: Environment) => void; onRemove: () => void; onDuplicate: () => void; hideMaterialPrice: boolean;

}) {
  const setItem = (i: number, it: EnvItem) => {
    const items = [...env.items]; items[i] = it; onChange({ ...env, items });
  };
  const addItem = () => onChange({ ...env, items: [...env.items, { id: crypto.randomUUID(), description: "", qty: 1, length: 0, width: 0, has_emenda: false }] });
  const removeItem = (i: number) => onChange({ ...env, items: env.items.filter((_, idx) => idx !== i) });
  const moveItem = (from: number, to: number) => {
    if (from === to || to < 0 || to >= env.items.length) return;
    const items = [...env.items];
    const [m] = items.splice(from, 1);
    items.splice(to, 0, m);
    onChange({ ...env, items });
  };
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [show3D, setShow3D] = useState(false);
  const material3D = useMemo(
    () => catalog.materials.find(
      (x) => x.name.trim().toLowerCase() === (env.material_name || "").trim().toLowerCase(),
    ),
    [catalog.materials, env.material_name],
  );

  // Auto-sync (somente convencional): casa nome do material com catálogo e preenche o valor m².
  // MFC nunca puxa do catálogo — o valor é digitado manualmente pelo usuário.
  useEffect(() => {
    if (hideMaterialPrice) return;
    const name = (env.material_name || "").trim().toLowerCase();
    if (!name) return;
    const m = catalog.materials.find((x) => x.name.trim().toLowerCase() === name);
    if (!m) return;
    const price = Number(m.price_m2) || 0;
    if (price > 0 && price !== env.material_price_m2) {
      onChange({ ...env, material_price_m2: price });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env.material_name, catalog.materials, hideMaterialPrice]);

  const handleMaterialSelect = (name: string) => {
    if (hideMaterialPrice) {
      // MFC: só atualiza o nome, mantém o valor digitado manualmente
      onChange({ ...env, material_name: name });
      return;
    }
    const m = catalog.materials.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
    onChange({
      ...env,
      material_name: name,
      material_price_m2: m ? Number(m.price_m2) : env.material_price_m2,
    });
  };



  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-l-4 border-stone-950 pl-4 gap-4 flex-wrap">
        <div className="flex-1 min-w-[300px]">
          <input value={env.name} onChange={(e) => onChange({ ...env, name: e.target.value })}
            className="font-display text-2xl bg-transparent border-none focus:outline-none w-full" />
          <div className="flex flex-wrap gap-4 mt-2 items-center">
            <input
              value={env.material_name}
              onChange={(e) => handleMaterialSelect(e.target.value)}
              list={`materials-${env.id}`}
              placeholder="Material (selecione ou digite)"
              className="text-sm bg-transparent border-b border-stone-200 focus:outline-none focus:border-gold-high pb-1 flex-1 min-w-[220px]"
            />
            <datalist id={`materials-${env.id}`}>
              {catalog.materials.map((m) => (
                <option key={m.id} value={m.name}>{m.category} · R$ {m.price_m2}/m²</option>
              ))}
            </datalist>
            <div className="flex items-center gap-2" title="Apenas visualização interna — não aparece no PDF">
              <span className="label-eyebrow">{hideMaterialPrice ? "Valor fixo MFC" : "Valor m² (interno)"}</span>
              <input type="number" step="0.01" value={env.material_price_m2}
                onChange={(e) => onChange({ ...env, material_price_m2: parseFloat(e.target.value) || 0 })}
                className="w-28 text-sm font-mono bg-transparent border-b border-stone-200 focus:outline-none focus:border-gold-high pb-1 text-right" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShow3D(true)} className="text-stone-500 hover:text-stone-950 text-[10px] font-bold uppercase flex items-center gap-1" title="Ver prévia 3D deste ambiente">
            <Box className="size-3" /> Prévia 3D
          </button>
          <button onClick={onDuplicate} className="text-stone-500 hover:text-stone-950 text-[10px] font-bold uppercase flex items-center gap-1" title="Duplicar este ambiente para comparar materiais">
            <Copy className="size-3" /> Duplicar
          </button>
          <button onClick={onRemove} className="text-stone-400 hover:text-red-600 text-[10px] font-bold uppercase flex items-center gap-1">
            <Trash2 className="size-3" /> Remover
          </button>
        </div>

      </div>

      <Quote3DPreview open={show3D} onClose={() => setShow3D(false)} env={env} material={material3D} />


      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100">
              <th className="w-6"></th>
              <th className="text-left pb-2 font-bold">Descrição</th>
              <th className="text-right pb-2 font-bold w-16">Qtd</th>
              <th className="text-right pb-2 font-bold w-20">Comp.</th>
              <th className="text-right pb-2 font-bold w-20">Larg.</th>
              <th className="text-right pb-2 font-bold w-16">m²</th>
              <th className="text-center pb-2 font-bold w-16" title="Acréscimo interno de 20% — não aparece no PDF">+20%</th>
              <th className="text-center pb-2 font-bold w-16">Emenda</th>
              <th className="text-right pb-2 font-bold w-28">Valor item</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {env.items.map((it, i) => {
              const total = itemTotal(it, env);
              const isDragging = dragIndex === i;
              return (
                <tr
                  key={it.id}
                  onDragOver={(e) => { if (dragIndex !== null) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (dragIndex !== null) { moveItem(dragIndex, i); setDragIndex(null); } }}
                  className={isDragging ? "opacity-40" : ""}
                >
                  <td
                    className="py-2 text-center cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-700"
                    draggable
                    onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => setDragIndex(null)}
                    title="Arraste para reordenar"
                  >
                    <GripVertical className="size-4 inline" />
                  </td>
                  <td className="py-2">
                    <input value={it.description} onChange={(e) => setItem(i, { ...it, description: e.target.value })}
                      placeholder="ex: Bancada principal" className="w-full text-sm bg-transparent border-none focus:outline-none" />
                    <div className="flex items-center gap-2 mt-1">
                      <ItemFinishEditor
                        item={it}
                        finishTypes={catalog.finish_types}
                        onChange={(edges) => setItem(i, { ...it, finish_edges: edges })}
                        onPatch={(patch) => setItem(i, { ...it, ...patch })}
                      />
                      {it.has_emenda && (
                        <input value={it.emenda_position ?? ""} onChange={(e) => setItem(i, { ...it, emenda_position: e.target.value })}
                          placeholder="Posição da emenda (ex: Centro)" className="flex-1 text-xs text-stone-500 bg-transparent border-none focus:outline-none italic" />
                      )}
                    </div>
                  </td>
                  <td className="py-2"><input type="number" step="1" min="1" value={it.qty ?? 1} onChange={(e) => setItem(i, { ...it, qty: Math.max(1, parseInt(e.target.value) || 1) })} className="w-full text-right font-mono text-sm bg-transparent border-none focus:outline-none" /></td>
                  <td className="py-2"><input type="number" step="0.01" value={it.length} onChange={(e) => setItem(i, { ...it, length: parseFloat(e.target.value) || 0 })} className="w-full text-right font-mono text-sm bg-transparent border-none focus:outline-none" /></td>
                  <td className="py-2"><input type="number" step="0.01" value={it.width} onChange={(e) => setItem(i, { ...it, width: parseFloat(e.target.value) || 0 })} className="w-full text-right font-mono text-sm bg-transparent border-none focus:outline-none" /></td>
                  <td className="py-2 text-right font-mono text-sm">{num(itemArea(it))}</td>
                  <td className="py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!it.markup_20}
                      onChange={(e) => setItem(i, { ...it, markup_20: e.target.checked })}
                      title="Acréscimo interno de 20% no valor do item — não aparece no PDF"
                      className="accent-stone-950"
                    />
                  </td>
                  <td className="py-2 text-center"><input type="checkbox" checked={it.has_emenda} onChange={(e) => setItem(i, { ...it, has_emenda: e.target.checked })} className="accent-stone-950" /></td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={total}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        const q = Math.max(1, it.qty ?? 1);
                        setItem(i, { ...it, unit_price_override: +(v / q).toFixed(2) });
                      }}
                      title="Editar valor do item (sobrescreve cálculo automático)"
                      className="w-full text-right font-mono text-sm font-bold bg-transparent border-none focus:outline-none focus:bg-stone-50"
                    />
                    {it.unit_price_override && it.unit_price_override > 0 ? (
                      <button
                        onClick={() => setItem(i, { ...it, unit_price_override: undefined })}
                        className="block ml-auto text-[9px] uppercase text-stone-400 hover:text-stone-950"
                        title="Voltar ao cálculo automático"
                      >
                        auto
                      </button>
                    ) : null}
                  </td>
                  <td className="py-2 text-center">
                    <button onClick={() => removeItem(i)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-3" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-100">
              <td colSpan={8} className="py-3 text-right text-xs font-bold uppercase text-stone-400">Subtotal Materiais</td>
              <td className="py-3 text-right font-mono text-sm">{brl(envItemsTotal(env))}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button onClick={addItem} className="text-xs uppercase tracking-widest text-stone-500 hover:text-stone-950 flex items-center gap-1">
        <Plus className="size-3" /> Adicionar item
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
        <div>
          <h4 className="label-eyebrow mb-3">Serviços do ambiente</h4>
          <ServicePicker
            lines={env.services}
            services={catalog.services}
            onChange={(services) => onChange({ ...env, services })}
          />
        </div>
        <div>
          <h4 className="label-eyebrow mb-3">Insumos do ambiente</h4>
          <SupplyPicker
            lines={env.supplies}
            supplies={catalog.supplies}
            onChange={(supplies) => onChange({ ...env, supplies })}
          />
        </div>
      </div>

      <div className="border-t border-stone-100 pt-3 space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" className="accent-stone-950"
              checked={!!env.notes_enabled}
              onChange={(e) => onChange({ ...env, notes_enabled: e.target.checked })} />
            <span className="label-eyebrow">Adicionar observação do ambiente</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="label-eyebrow">Aditivo (R$)</span>
            <input type="number" step="0.01" min="0" value={env.additive_value ?? 0}
              onChange={(e) => onChange({ ...env, additive_value: parseFloat(e.target.value) || 0 })}
              className="w-32 text-sm font-mono bg-transparent border-b border-stone-200 focus:outline-none focus:border-gold-high pb-1 text-right" />
          </div>
        </div>
        {env.notes_enabled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="label-eyebrow">Agente</span>
              <input value={env.env_notes?.agente ?? ""}
                onChange={(e) => onChange({ ...env, env_notes: { ...(env.env_notes ?? {}), agente: e.target.value } })}
                className="w-full text-sm bg-transparent border-b border-stone-200 focus:outline-none focus:border-gold-high pb-1" />
            </label>
            <label className="space-y-1">
              <span className="label-eyebrow">Marca</span>
              <input value={env.env_notes?.marca ?? ""}
                onChange={(e) => onChange({ ...env, env_notes: { ...(env.env_notes ?? {}), marca: e.target.value } })}
                className="w-full text-sm bg-transparent border-b border-stone-200 focus:outline-none focus:border-gold-high pb-1" />
            </label>
            <label className="space-y-1">
              <span className="label-eyebrow">Informações extras</span>
              <input value={env.env_notes?.extras ?? ""}
                onChange={(e) => onChange({ ...env, env_notes: { ...(env.env_notes ?? {}), extras: e.target.value } })}
                className="w-full text-sm bg-transparent border-b border-stone-200 focus:outline-none focus:border-gold-high pb-1" />
            </label>
          </div>
        )}
        <div className="flex justify-end">
          <div className="text-right">
            <p className="label-eyebrow">Subtotal {env.name} {envArea(env) > 0 && <span className="text-stone-500">· {num(envArea(env))} m²</span>}{(env.additive_value ?? 0) > 0 && <span className="text-stone-500"> · aditivo {brl(env.additive_value!)}</span>}</p>
            <p className="font-display text-2xl font-bold">{brl(envTotal(env))}</p>
          </div>
        </div>
      </div>

    </div>
  );
}

function ServicePicker({ lines, services, onChange }: {
  lines: SupplyLine[]; services: { id: string; name: string; unit: string; price: number }[]; onChange: (l: SupplyLine[]) => void;
}) {
  return <CatalogLines lines={lines} options={services} onChange={onChange} listId="services-list" />;
}
function SupplyPicker({ lines, supplies, onChange }: {
  lines: SupplyLine[]; supplies: { id: string; name: string; unit: string; price: number }[]; onChange: (l: SupplyLine[]) => void;
}) {
  return <CatalogLines lines={lines} options={supplies} onChange={onChange} listId="supplies-list" />;
}

function CatalogLines({ lines, options, onChange, listId }: {
  lines: SupplyLine[];
  options: { id: string; name: string; unit: string; price: number }[];
  onChange: (l: SupplyLine[]) => void;
  listId: string;
}) {
  const set = (i: number, l: SupplyLine) => { const x = [...lines]; x[i] = l; onChange(x); };
  const remove = (i: number) => onChange(lines.filter((_, idx) => idx !== i));
  const add = () => onChange([...lines, { id: crypto.randomUUID(), description: "", qty: 1, unit_value: 0 }]);
  const pick = (i: number, name: string) => {
    const found = options.find((o) => o.name === name);
    set(i, { ...lines[i], description: name, unit_value: found ? Number(found.price) : lines[i].unit_value });
  };
  const uid = `${listId}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <div className="space-y-2">
      {lines.map((l, i) => (
        <div key={l.id} className="grid grid-cols-[1fr_60px_90px_90px_20px] gap-2 items-center">
          <input value={l.description} onChange={(e) => pick(i, e.target.value)} list={uid}
            placeholder="Selecionar ou digitar"
            className="text-sm border-b border-stone-200 bg-transparent pb-1 focus:outline-none focus:border-gold-high" />
          <input type="number" min={1} step={1} value={l.qty}
            onKeyDown={(e) => { if (e.key === "." || e.key === ",") e.preventDefault(); }}
            onChange={(e) => set(i, { ...l, qty: Math.max(1, parseInt(e.target.value) || 1) })}
            className="text-sm text-right font-mono border-b border-stone-200 bg-transparent pb-1 focus:outline-none focus:border-gold-high" />
          <input type="number" step="0.01" value={l.unit_value} onChange={(e) => set(i, { ...l, unit_value: parseFloat(e.target.value) || 0 })}
            placeholder="Unit" className="text-sm text-right font-mono border-b border-stone-200 bg-transparent pb-1 focus:outline-none focus:border-gold-high" />
          <span className="text-sm font-mono text-right">{brl(l.qty * l.unit_value)}</span>
          <button onClick={() => remove(i)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-3" /></button>
        </div>
      ))}
      <datalist id={uid}>
        {options.map((o) => <option key={o.id} value={o.name}>{o.unit} · R$ {o.price}</option>)}
      </datalist>
      <button onClick={add} className="text-xs uppercase tracking-widest text-stone-500 hover:text-stone-950 mt-1 flex items-center gap-1">
        <Plus className="size-3" /> Adicionar
      </button>
      {lines.length > 0 && (
        <div className="text-right text-xs font-mono text-stone-500 pt-1">
          Subtotal: {brl(linesTotal(lines))}
        </div>
      )}
    </div>
  );
}

/* ----------------- PDF Preview ----------------- */

function PdfPreview({ data, totals, settings, number, type, catalog, onClose }: {
  data: QuoteData; totals: ReturnType<typeof calcTotals>; settings: Settings | null; number: number; type: "convencional" | "mfc"; catalog: Catalog; onClose: () => void;
}) {
  const hiddenMaterials = new Set(data.hidden_materials ?? []);
  const summary = materialSummary(data).filter((s) => !hiddenMaterials.has(s.material));
  const seller = catalog.sellers.find((s) => s.id === data.seller_id);
  const sellerName = seller?.name || data.salesperson;
  const pageRef = useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);

  const handleWhatsapp = async () => {
    const tel = normalizePhoneBR(data.client_phone);
    if (!tel) { toast.error("Cliente sem telefone cadastrado"); return; }
    if (!pageRef.current) return;
    setSending(true);
    const tid = toast.loading("Gerando PDF e enviando...");
    try {
      const { elementToPdfBase64, enviarPdfWhatsapp } = await import("@/lib/whatsapp-pdf");
      const pdfBase64 = await elementToPdfBase64(pageRef.current);
      const valor = brl(totals.total).replace("R$", "").trim();
      await enviarPdfWhatsapp({
        telefone: tel,
        nomeCliente: data.client_name || "Cliente",
        valor,
        pdfBase64,
        fileName: `Orcamento_${String(number).padStart(4, "0")}.pdf`,
        caption: `Olá ${data.client_name || ""}! Segue o orçamento Nº ${String(number).padStart(4, "0")} no valor de R$ ${valor}.`,
      });
      toast.success("Enviado no WhatsApp!", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao enviar", { id: tid });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 py-8">
      <div className="no-print sticky top-0 z-50 bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between mb-6 -mt-8">
        <button onClick={onClose} className="text-sm flex items-center gap-2 text-stone-500 hover:text-stone-950">
          <ArrowLeft className="size-4" /> Voltar ao editor
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleWhatsapp}
            disabled={sending}
            className="bg-emerald-600 text-white px-6 py-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
          >
            <MessageCircle className="size-3" /> {sending ? "Enviando..." : "Enviar no WhatsApp"}
          </button>
          <button
            onClick={() => {
              const prev = document.title;
              const client = (data.client_name || "").trim().toUpperCase();
              const d = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Recife" });
              document.title = `ORÇ. ${String(number).padStart(4, "0")} ${client} - ${d}`.trim().replace(/\s+/g, "_");
              setTimeout(() => { window.print(); setTimeout(() => { document.title = prev; }, 500); }, 50);
            }}
            className="bg-stone-950 text-white px-6 py-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:bg-stone-800"
          >
            <Printer className="size-3" /> Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      <div ref={pageRef} className="a4-page print-page">
        <DocTopHeader
          logoUrl={settings?.logo_url || porcelaneLogo.url}
          companyName={settings?.company_name}
          docType={type === "mfc" ? "Orçamento MFC" : "Orçamento"}
          docNumber={String(number).padStart(6, "0")}
          date={fmtDate(data.date)}
          validity={data.validity_days ? `${String(data.validity_days).padStart(2, "0")} dias` : undefined}
          client={{ name: data.client_name, phone: data.client_phone, email: data.client_email }}
          work={{ address: data.address, city: data.city }}
          people={[
            { label: "Arquiteto(a)", name: data.architect, phone: data.architect_phone },
            { label: "Consultor(a)", name: sellerName, phone: data.salesperson_phone },
            { label: "Vendedor(a)", name: data.external_salesperson, phone: data.external_salesperson_phone },
            ...(data.contacts ?? []).map((c) => ({ label: c.label || "Contato", name: c.name, phone: c.phone })),
          ]}
        />

        {data.environments.map((env) => {
          const area = envArea(env);
          return (
          <section key={env.id} className="mb-6">
              <div className="border-b border-stone-300 pb-1 mb-2 flex items-end justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-bold">
                    {env.name}
                  </div>
                  {env.material_name && (
                    <div className="text-[12pt] text-stone-600 mt-0.5">Material: {env.material_name}</div>
                  )}
                  {env.notes_enabled && (env.env_notes?.agente || env.env_notes?.marca || env.env_notes?.extras) && (
                    <div className="text-[10pt] text-stone-600 mt-1 italic">
                      {env.env_notes?.agente && <>Agente: <b className="not-italic">{env.env_notes.agente}</b>{" · "}</>}
                      {env.env_notes?.marca && <>Marca: <b className="not-italic">{env.env_notes.marca}</b>{" · "}</>}
                      {env.env_notes?.extras && <>{env.env_notes.extras}</>}
                    </div>
                  )}
                </div>
              </div>

            <table className="w-full text-[11pt]">
              <thead>
                <tr className="text-[10pt] uppercase tracking-wider text-stone-500 border-b border-stone-200">
                  <th className="text-left py-1 font-bold">Descrição</th>
                  <th className="text-right py-1 font-bold w-10">Qtd</th>
                  <th className="text-right py-1 font-bold w-16">Comp.</th>
                  <th className="text-right py-1 font-bold w-16">Larg.</th>
                  {!data.hide_env_m2 && <th className="text-right py-1 font-bold w-14">m²</th>}
                  <th className="text-right py-1 font-bold w-24">Valor</th>
                </tr>
              </thead>
              <tbody>
                {env.items.map((it) => {
                  const isLSide = /L\s*·\s*Lado/i.test(it.description || "");
                  return (
                  <tr key={it.id} className={`border-b border-stone-100 ${isLSide ? "bg-stone-50/60" : ""}`}>
                    <td className="py-1.5">
                      {isLSide && <span className="inline-block text-[8pt] uppercase tracking-widest font-bold text-stone-500 mr-1.5 border border-stone-300 px-1">L</span>}
                      {it.description}
                      {it.has_emenda && <span className="text-[10pt] text-stone-500 italic"> · com emenda{it.emenda_position ? ` (${it.emenda_position})` : ""}</span>}
                      {data.show_item_finishes !== false && (
                        <ItemFinishInline item={it} env={env} finishTypes={catalog.finish_types} />
                      )}
                    </td>
                    <td className="text-right font-display">{it.qty ?? 1}</td>
                    <td className="text-right font-display">{num(it.length)}</td>
                    <td className="text-right font-display">{num(it.width)}</td>
                    {!data.hide_env_m2 && <td className="text-right font-display">{num(itemArea(it))}</td>}
                    <td className="text-right font-display">{brl(itemTotal(it, env))}</td>
                  </tr>
                  );
                })}
                {env.services.map((l) => (
                  <tr key={l.id} className="border-b border-stone-100">
                    <td className="py-1.5 italic text-stone-700" colSpan={data.hide_env_m2 ? 3 : 4}>{l.description} ({l.qty}×)</td>
                    <td></td>
                    <td className="text-right font-display">{brl(l.qty * l.unit_value)}</td>
                  </tr>
                ))}

              </tbody>
              <tfoot>
                {(env.additive_value ?? 0) > 0 && (
                  <tr>
                    <td colSpan={data.hide_env_m2 ? 4 : 5} className="py-1 text-right text-[10pt] italic text-stone-600">Aditivo</td>
                    <td className="text-right font-display py-1">{brl(env.additive_value!)}</td>
                  </tr>
                )}
                <tr className="border-t border-stone-300">
                  <td colSpan={data.hide_env_m2 ? 4 : 5} className="py-1.5 text-[11pt] font-bold text-left">{data.hide_env_m2 ? "" : `${num(area)} m²`}</td>
                  <td className="text-right font-display font-bold py-1.5 text-[11pt]">{brl(envTotal(env))}</td>
                </tr>
              </tfoot>

            </table>
          </section>
          );
        })}

        {data.show_item_finishes !== false && (
          <FinishesLegendSummary environments={data.environments} finishTypes={catalog.finish_types} />
        )}


        {(() => {
          const allSupplies = mergeSupplies([
            ...(data.quote_supplies ?? []),
            ...data.environments.flatMap((e) => e.supplies ?? []),
          ]);
          if (allSupplies.length === 0) return null;
          const total = allSupplies.reduce((s, l) => s + l.qty * l.unit_value, 0);
          return (
          <section className="mb-6">
            <h4 className="text-[11pt] uppercase tracking-widest font-bold mb-2 border-b border-stone-300 pb-1">Insumos</h4>
            <table className="w-full text-[11pt]">
              <tbody>
                {allSupplies.map((l, i) => (
                  <tr key={`${l.id}-${i}`} className="border-b border-stone-100">
                    <td className="py-1">{l.description}</td>
                    <td className="text-right font-display w-20">{num(l.qty)}×</td>
                    <td className="text-right font-display w-24">{brl(l.unit_value)}</td>
                    <td className="text-right font-display w-28 font-bold">{brl(l.qty * l.unit_value)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="text-right text-[10pt] uppercase tracking-wider font-bold pt-2">Total insumos</td>
                  <td className="text-right font-display font-bold pt-2">{brl(total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
          );
        })()}


        {type === "mfc" && (data.mfc_pickup?.items?.length ?? 0) > 0 && (
          <section className="mb-6">
            <h4 className="text-[12pt] uppercase tracking-widest font-bold mb-2 border-b border-stone-300 pb-1">Valor de Coleta</h4>
            <table className="w-full text-[12pt]">
              <thead>
                <tr className="text-[11pt] uppercase tracking-wider text-stone-500 border-b border-stone-200">
                  <th className="text-left py-1 font-bold">Descrição</th>
                  <th className="text-right py-1 font-bold w-16">Qtd</th>
                  <th className="text-right py-1 font-bold w-28">Valor unit.</th>
                  <th className="text-right py-1 font-bold w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.mfc_pickup!.items!.map((it) => (
                  <tr key={it.id} className="border-b border-stone-100">
                    <td className="py-1.5">{it.description || "—"}</td>
                    <td className="text-right font-display">{it.qty}</td>
                    <td className="text-right font-display">{brl(it.unit_value)}</td>
                    <td className="text-right font-display font-bold">{brl(it.qty * it.unit_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}


        {(type === "mfc" || data.show_material_summary) && summary.length > 0 && (
          <section className="mt-6 pt-4 border-t border-stone-200">
            <h4 className="text-[11pt] uppercase tracking-widest font-bold mb-2">
              Resumo de materiais{data.show_waste_pct ? " (+30% perda)" : ""}
            </h4>
            <table className="w-full text-[11pt]">
              <thead>
                <tr className="text-[10pt] uppercase text-stone-500">
                  <th className="text-left">Material</th>
                  <th className="text-right">Real (m²)</th>
                  {data.show_waste_pct && <th className="text-right">Comprar (m²)</th>}
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.material}>
                    <td>{s.material}</td>
                    <td className="text-right font-display">{num(s.area)}</td>
                    {data.show_waste_pct && <td className="text-right font-display font-bold">{num(s.areaWithLoss)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {data.show_item_count && (
          <section className="mt-6 pt-4 border-t border-stone-200">
            <h4 className="text-[11pt] uppercase tracking-widest font-bold mb-2">Quantitativo de peças</h4>
            <table className="w-full text-[11pt]">
              <thead><tr className="text-[10pt] uppercase text-stone-500"><th className="text-left">Ambiente</th><th className="text-left">Material</th><th className="text-right">Peças</th><th className="text-right">m²</th></tr></thead>
              <tbody>
                {data.environments.map((env) => (
                  <tr key={env.id}><td>{env.name}</td><td>{env.material_name}</td><td className="text-right font-display">{env.items.length}</td><td className="text-right font-display">{num(envArea(env))}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <DocBottomLayout
          className="mt-8"
          summaryRows={[
            { label: "Subtotal dos ambientes", value: brl(totals.productsTotal + totals.servicesSum) },
            ...(totals.freight > 0 ? [{ label: `Frete (${data.freight.qty}× ${brl(data.freight.unit_value)})`, value: brl(totals.freight) }] : []),
            ...(type === "mfc" && totals.mfcPickup > 0 ? [{ label: "Valor de coleta", value: brl(totals.mfcPickup) }] : []),
            ...(type === "convencional" && totals.installation > 0 ? [{ label: "Instalação", value: brl(totals.installation) }] : []),
            ...(totals.baseboardInstall > 0 ? [{ label: "Instalação rodapé pós móvel", value: brl(totals.baseboardInstall) }] : []),
            ...(totals.baseboardFreight > 0 ? [{ label: "Frete rodapé pós móvel", value: brl(totals.baseboardFreight) }] : []),
            ...(totals.discountValue > 0 && !data.discount.hide_on_pdf ? [{ label: "Desconto", value: `- ${brl(totals.discountValue)}` }] : []),
          ]}
          total={brl(totals.total)}
          totalHint={(data.delivery?.days ?? 0) > 0
            ? `Prazo de entrega: ${data.delivery!.days} ${data.delivery!.days_type === "uteis" ? "dias úteis" : "dias corridos"}`
            : undefined}
          payment={data.payment}
          totals={{ total: totals.total, entry: totals.entry, balance: totals.balance, methodBreakdown: totals.methodBreakdown }}
          infoLines={(settings?.quote_terms ?? "").split("\n").map((l) => l.trim()).filter(Boolean)}
          notes={data.notes}
          clientName={data.client_name}
          consultant={sellerName || data.external_salesperson}
          date={fmtDate(data.date)}
        />

      </div>
    </div>
  );
}

function PdfField({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="text-[9pt] uppercase tracking-widest text-stone-500 font-bold">{label}</div>
      <div>{v || "—"}</div>
    </div>
  );
}
