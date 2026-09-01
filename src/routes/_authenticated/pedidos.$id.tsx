import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TrelloOrderStatus } from "@/components/trello-order-status";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Printer, FileText, Truck, Settings as Cog, Upload, Trash2, Edit, Image as ImageIcon, FileIcon, Scissors, ArrowRight, CalendarClock, AlertTriangle, AlertCircle, MessageCircle, Plus, ChevronUp, ChevronDown, Copy, Trello, Boxes, History } from "lucide-react";
import { normalizePhoneBR } from "@/lib/whatsapp-pdf";
import { brl, num, numMed, fmtDate , todayISO } from "@/lib/format";
import { calcTotals, envArea, envTotal, itemArea, itemQty, itemTotal, materialSummary, mergeSupplies } from "@/lib/quote-calc";
import type { QuoteData, EnvItem, Environment, DeliveryInfo, DeliveryMode, DeliveryDaysType, SupplyLine } from "@/lib/types";
import { useCatalog } from "@/lib/catalog";
import { orderDeadlines, alertLevel } from "@/lib/deadline";
import { useMyRoles } from "@/lib/roles";
import { DocTopHeader } from "@/components/pdf/doc-top-header";
import { AcceptanceBlock, DocBottomLayout } from "@/components/pdf/doc-bottom";
import porcelaneLogo from "@/assets/porcelane-logo.jpg.asset.json";
import guiaCuidados from "@/assets/guia-cuidados.png.asset.json";

import { PaymentEditor, paymentSummaryText } from "@/components/payment-editor";
import { createAdditive, diffMeasurements } from "@/lib/additive";
import { QuickRoomPanel, QuickRoomPrintPages, emptyQuickRoom } from "@/components/quick-room";
import { ItemFinishInline, ItemFinishEditor, FinishesLegendSummary } from "@/components/item-finishes";
import { sendBase44Registro } from "@/lib/base44.functions";
import { PixModal } from "@/components/pix-modal";
import { OrderInternalSheet } from "@/components/pdf/order-sheet";
import { OrderFinancialPanel } from "@/components/order-financial-panel";
import { OrderHubHeader } from "@/components/order-hub-header";
import { useOrderReceived } from "@/lib/order-money";
import { OrderEnvironmentsPanel } from "@/components/order-environments-panel";
import { OrderProductionPanel } from "@/components/order-production-panel";
import { OrderDocumentsPanel } from "@/components/order-documents-panel";
import { OrderHistoryPanel } from "@/components/order-history-panel";
import { TechReleaseSection, TechReleaseSheet } from "@/components/tech-release-panel";
import { TechDocsPanel, type TechDocRecord } from "@/components/tech-docs-panel";
import { DocZoomViewer } from "@/components/doc-zoom-viewer";
import { CutOrderSheet } from "@/components/pdf/cut-order-sheet";
import { FinishOrderSheet } from "@/components/pdf/finish-order-sheet";

import { novoTxid } from "@/lib/pix";
import {
  allocateEnvironments, envCommissionPct, suggestedLogistics, LOGISTICS_LABEL,
  syncEnvTechCommission, logTechChange, listTechLogs, currentUserName,
  type TechLogRow,
} from "@/lib/tech-release";
import { useApprovedOrderGuard } from "@/components/approved-order-guard";
import {
  ensureApprovedSnapshot, listRevisions, isCommercialLocked, isCommissionLocked,
  setCommissionLock, approvedBaseTotal, type OrderRevision,
} from "@/lib/order-lock";


// Soma N dias úteis ou corridos a uma data base
function addDays(baseISO: string, n: number, type: DeliveryDaysType): Date {
  const d = new Date(baseISO);
  if (!Number.isFinite(d.getTime())) return new Date();
  if (type === "corridos") {
    d.setDate(d.getDate() + (n || 0));
    return d;
  }
  let added = 0;
  while (added < (n || 0)) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

const DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = {
  retirada: "Retirada na loja",
  entrega: "Entrega",
  instalacao: "Instalação",
};

const defaultDelivery = (): DeliveryInfo => ({ mode: "entrega", days_type: "uteis", days: 10 });

// Helpers: valor liberado pela responsável técnica (não altera o pedido).
const relLen = (it: EnvItem) => (it.released_length ?? it.length) || 0;
const relWid = (it: EnvItem) => (it.released_width ?? it.width) || 0;
const relQty = (it: EnvItem) => {
  const v = it.released_qty ?? it.qty ?? 1;
  return v && v > 0 ? v : 1;
};
const relItemArea = (it: EnvItem) => +(relLen(it) * relWid(it) * relQty(it)).toFixed(4);
const relEnvArea = (env: Environment) =>
  (env.items ?? []).reduce((s, it) => s + relItemArea(it), 0) +
  (env.extra_cut_pieces ?? []).reduce((s, it) => s + relItemArea(it), 0);

const releasedItemsFor2D = (env: Environment): EnvItem[] => [
  ...(env.items ?? []).map((it) => ({ ...it, length: relLen(it), width: relWid(it), qty: relQty(it) })),
  ...(env.extra_cut_pieces ?? []).map((it) => ({
    ...it,
    description: it.description ? `Extra · ${it.description}` : "Extra",
    length: relLen(it),
    width: relWid(it),
    qty: relQty(it),
  })),
];




export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  component: OrderView,
});

type Settings = {
  company_name: string; phone: string; email: string; address: string;
  cnpj: string; logo_url: string | null; quote_terms: string;
  pix_key?: string | null; pix_beneficiary_name?: string | null; pix_city?: string | null;
};

type OrderRow = {
  id: string; number: number; status: string; client_name: string | null;
  total: number | null; created_at: string; data: QuoteData;
  quote_id: string | null;
  approved_snapshot?: QuoteData | null;
  approved_total?: number | null;
  approved_at?: string | null;
  commercial_locked?: boolean | null;
  commission_locked?: boolean | null;
};

type Attachment = {
  id: string; kind: string; name: string; storage_path: string; mime_type: string | null; created_at: string;
};

const STAGES = [
  { key: "aguardando_projeto", label: "Aguardando projeto" },
  { key: "liberacao_tecnica", label: "Liberação técnica" },
  { key: "em_producao", label: "Em produção" },
  { key: "corte", label: "Corte" },
  { key: "acabamento", label: "Acabamento" },
  { key: "romaneio", label: "Romaneio" },
  { key: "entrega", label: "Entrega" },
  { key: "instalacao", label: "Instalação" },
  { key: "finalizado", label: "Finalizado" },
];

/** Abas de gestão que compartilham o mesmo cabeçalho-resumo (uma única vez). */
const HUB_TABS: string[] = ["gestao", "ambientes", "financeiro", "producao", "documentos", "historico"];

/** Modos de documento/impressão — não são abas: são visualizações. */
const DOC_MODES: string[] = ["pedido", "romaneio", "ficha", "corte", "tecnica_pdf", "docs_tec"];

function OrderView() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mode, setMode] = useState<"gestao" | "pedido" | "romaneio" | "corte" | "ficha" | "tecnica" | "tecnica_pdf" | "financeiro" | "ambientes" | "producao" | "documentos" | "historico" | "docs_tec">("gestao");
  const [techDocPreview, setTechDocPreview] = useState<TechDocRecord | null>(null);
  const [hideDocDrawing, setHideDocDrawing] = useState(false);
  const [hideDocPieces, setHideDocPieces] = useState(false);

  const [corteEnvId, setCorteEnvId] = useState<string | null>(null);

  const [cortePreview, setCortePreview] = useState(false);
  const [corteZoom, setCorteZoom] = useState(0.7);
  const [cortePage, setCortePage] = useState(1);
  const [pdfScale, setPdfScale] = useState<string>("auto");
  const cortePagesRef = useRef<HTMLDivElement | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [history, setHistory] = useState<{ status: string; created_at: string; notes: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [clauses, setClauses] = useState<{ id: string; title: string | null; content: string; position: number }[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalog = useCatalog();
  const perms = useMyRoles();
  const canSeeMoney = perms.isAdmin || perms.canSeeEmployeePayments;
  // Romaneio: seleção de ambientes e insumos a entregar
  const [romaneioEnvs, setRomaneioEnvs] = useState<Set<string>>(new Set());
  const [romaneioSupplies, setRomaneioSupplies] = useState<Set<string>>(new Set());
  const [romaneioInitialized, setRomaneioInitialized] = useState(false);
  const [romaneioDate, setRomaneioDate] = useState<string>(() => todayISO());
  const [romaneioExtraSupplies, setRomaneioExtraSupplies] = useState<{ id: string; description: string; qty: number }[]>([]);
  const [pixOpen, setPixOpen] = useState(false);
  const [pixTxid, setPixTxid] = useState<string>("");
  const [techLogs, setTechLogs] = useState<TechLogRow[]>([]);
  const [revisions, setRevisions] = useState<OrderRevision[]>([]);
  /** Recebido vem SEMPRE de receivables — orders.received é coluna legada. */
  const money = useOrderReceived(id);


  const refreshRevisions = async () => {
    try { setRevisions(await listRevisions(id)); } catch { /* ignore */ }
  };

  const loadAll = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: o }, { data: s }, { data: at }, { data: h }, { data: cl }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase.from("company_settings").select("*").eq("user_id", u.user.id).maybeSingle(),
      supabase.from("order_attachments").select("*").eq("order_id", id).order("created_at", { ascending: false }),
      supabase.from("order_status_history").select("status, created_at, notes").eq("order_id", id).order("created_at", { ascending: false }),
      supabase.from("terms_clauses").select("id, title, content, position").eq("active", true).order("position"),
    ]);
    if (o) setOrder(o as unknown as OrderRow);
    if (s) setSettings(s as unknown as Settings);
    setAttachments((at ?? []) as Attachment[]);
    setHistory((h ?? []) as typeof history);
    setClauses((cl ?? []) as typeof clauses);
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { listTechLogs(id).then(setTechLogs).catch(() => {}); }, [id]);
  useEffect(() => {
    ensureApprovedSnapshot(id).catch(() => {});
    refreshRevisions();
    /* eslint-disable-next-line */
  }, [id]);

  const guard = useApprovedOrderGuard(id, {
    onChanged: loadAll,
    onRevisionCreated: refreshRevisions,
  });
  const commercialLocked = isCommercialLocked(order);
  const commissionLocked = isCommissionLocked(order);



  // Initialize romaneio selection (all envs, all supplies) when order loads
  useEffect(() => {
    if (!order || romaneioInitialized) return;
    const envIds = new Set(order.data.environments.map((e) => e.id));
    const supplyIds = new Set<string>();
    for (const e of order.data.environments) for (const s of e.supplies) supplyIds.add(`env:${e.id}:${s.id}`);
    for (const s of order.data.quote_supplies ?? []) supplyIds.add(`quote:${s.id}`);
    setRomaneioEnvs(envIds);
    setRomaneioSupplies(supplyIds);
    setRomaneioInitialized(true);
  }, [order, romaneioInitialized]);

  const changeStatus = async (status: string) => {
    if (!order) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("orders").update({ status }).eq("id", order.id);
    await supabase.from("order_status_history").insert({ user_id: u.user.id, order_id: order.id, status });
    if (status === "liberacao_tecnica" || status === "corte" || status === "em_producao") {
      try {
        const { generateCommissionsForOrder } = await import("@/lib/generate-commissions");
        await generateCommissionsForOrder(order.id, { tech: true });
      } catch (e) { console.error(e); }
    }
    // Detecção automática de aditivo na liberação técnica
    if (status === "liberacao_tecnica") {
      const orig = order.data.original_environments ?? order.data.environments;
      if (orig && orig.length) {
        try {
          const diffs = diffMeasurements(orig, order.data.environments);
          if (diffs.length > 0) {
            const total = diffs.reduce((s, d) => s + d.extraValue, 0);
            const ok = confirm(
              `Detectada diferença ≥ 30cm em ${diffs.length} item(ns) liberado(s).\n` +
              `Aditivo sugerido: R$ ${total.toFixed(2)}.\n\n` +
              `Gerar orçamento-aditivo agora?\n(as medidas da liberação NÃO alteram o pedido — só o aditivo).`
            );

            if (ok) {
              const { quoteId, seq, orderNumber } = await createAdditive(order.id, diffs);
              toast.success(`Aditivo PED-${String(orderNumber).padStart(6, "0")}-A${seq} criado`);
              navigate({ to: "/orcamentos/$id", params: { id: quoteId } });
              return;
            }
          }
        } catch (e: any) { console.error(e); toast.error(e?.message || "Falha ao analisar aditivo"); }
      }
    }
    toast.success("Etapa atualizada");
    // Base44 (fire-and-forget)
    try {
      const totals = calcTotals(order.data);
      sendBase44Registro({ data: {
        tipo: "Pedido",
        numero: `PED-${String(order.number).padStart(6, "0")}`,
        data: new Date().toISOString(),
        cliente: order.client_name ?? "",
        valor_total: totals.total,
        status,
        vendedor_interno: order.data.salesperson ?? "",
        vendedor_externo: order.data.external_salesperson ?? "",
        arquiteto: order.data.architect ?? "",
        forma_pagamento: paymentSummaryText(order.data.payment, totals),
      } }).catch(() => {});
    } catch {}
    loadAll();
  };

  const generateAdditiveManual = async () => {
    if (!order) return;
    try {
      const baseOrig = order.data.original_environments ?? order.data.environments;
      const diffs = baseOrig && baseOrig.length
        ? diffMeasurements(baseOrig, order.data.environments)
        : [];
      const { quoteId, seq, orderNumber } = await createAdditive(order.id, diffs);
      toast.success(`Aditivo PED-${String(orderNumber).padStart(6, "0")}-A${seq} criado`);
      navigate({ to: "/orcamentos/$id", params: { id: quoteId } });
    } catch (e: any) { toast.error(e?.message || "Falha"); }
  };

  const deleteOrder = async () => {
    if (!order) return;
    if (!confirm(`Apagar Pedido PED-${String(order.number).padStart(6, "0")}?\n\nEsta ação remove o pedido, parcelas e comissões vinculadas. Não pode ser desfeita.`)) return;
    const { error } = await supabase.from("orders").delete().eq("id", order.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pedido apagado");
    navigate({ to: "/pedidos" });
  };

  // Persiste alterações em order.data (medições da liberação técnica) com debounce
  const updateOrderData = (next: QuoteData) => {
    if (!order) return;
    setOrder({ ...order, data: next });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("orders").update({ data: next as never }).eq("id", order.id);
      if (error) toast.error(error.message);
    }, 600);
  };

  // Forma de pagamento: salva no pedido e re-sincroniza as parcelas do financeiro
  const paySyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updatePayment = (p: QuoteData["payment"]) => {
    if (!order) return;
    const next = { ...order.data, payment: p };
    setOrder({ ...order, data: next });
    if (paySyncTimer.current) clearTimeout(paySyncTimer.current);
    paySyncTimer.current = setTimeout(async () => {
      const { error } = await supabase.from("orders").update({ data: next as never }).eq("id", order.id);
      if (error) { toast.error(error.message); return; }
      try {
        const { syncReceivablesForOrder } = await import("@/lib/generate-receivables");
        const r = await syncReceivablesForOrder(order.id);
        if (r && r.created > 0) toast.success("Parcelas do financeiro atualizadas");
        else if (r?.skipped === "paid") toast.message("Há parcelas já baixadas — financeiro não foi regerado");
      } catch (e) { console.error(e); }
      // Reflete também no orçamento de origem
      if (order.quote_id) {
        const { data: q } = await supabase.from("quotes").select("data").eq("id", order.quote_id).maybeSingle();
        if (q?.data) {
          await supabase.from("quotes")
            .update({ data: { ...(q.data as Record<string, unknown>), payment: p } as never })
            .eq("id", order.quote_id);
        }
      }
    }, 800);
  };

  const updateEnv = (envId: string, patch: Partial<Environment>) => {
    if (!order) return;
    const envs = order.data.environments.map((e) => e.id === envId ? { ...e, ...patch } : e);
    updateOrderData({ ...order.data, environments: envs });
  };

  const updateItem = (envId: string, itemId: string, patch: Partial<EnvItem>) => {
    if (!order) return;
    const envs = order.data.environments.map((e) => {
      if (e.id !== envId) return e;
      return { ...e, items: e.items.map((it) => it.id === itemId ? { ...it, ...patch } : it) };
    });
    updateOrderData({ ...order.data, environments: envs });
  };

  const addItem = (envId: string) => {
    if (!order) return;
    const envs = order.data.environments.map((e) => {
      if (e.id !== envId) return e;
      return {
        ...e,
        items: [...e.items, {
          id: crypto.randomUUID(),
          description: "",
          qty: 1,
          length: 0,
          width: 0,
          has_emenda: false,
        }],
      };
    });
    updateOrderData({ ...order.data, environments: envs });
  };

  const updateExtra = (envId: string, itemId: string, patch: Partial<EnvItem>) => {
    if (!order) return;
    const envs = order.data.environments.map((e) => {
      if (e.id !== envId) return e;
      const list = (e.extra_cut_pieces ?? []).map((it) => it.id === itemId ? { ...it, ...patch } : it);
      return { ...e, extra_cut_pieces: list };
    });
    updateOrderData({ ...order.data, environments: envs });
  };

  const addExtra = (envId: string) => {
    if (!order) return;
    const envs = order.data.environments.map((e) => {
      if (e.id !== envId) return e;
      const list = [...(e.extra_cut_pieces ?? []), {
        id: crypto.randomUUID(),
        description: "",
        qty: 1,
        length: 0,
        width: 0,
        has_emenda: false,
      } as EnvItem];
      return { ...e, extra_cut_pieces: list };
    });
    updateOrderData({ ...order.data, environments: envs });
  };

  const removeExtra = (envId: string, itemId: string) => {
    if (!order) return;
    const envs = order.data.environments.map((e) => {
      if (e.id !== envId) return e;
      return { ...e, extra_cut_pieces: (e.extra_cut_pieces ?? []).filter((it) => it.id !== itemId) };
    });
    updateOrderData({ ...order.data, environments: envs });
  };

  const removeItem = (envId: string, itemId: string) => {
    if (!order) return;
    const envs = order.data.environments.map((e) => {
      if (e.id !== envId) return e;
      return { ...e, items: e.items.filter((it) => it.id !== itemId) };
    });
    updateOrderData({ ...order.data, environments: envs });
  };

  // ——— Liberação Técnica: independente do pedido comercial ———
  const cloneItem = (it: EnvItem): EnvItem => ({
    ...it,
    id: crypto.randomUUID(),
    finish_edges: it.finish_edges ? it.finish_edges.map((f) => ({ ...f })) : undefined,
    recortes: it.recortes?.map((r) => ({ ...r, id: crypto.randomUUID() })),
    furacoes: it.furacoes?.map((f) => ({ ...f, id: crypto.randomUUID() })),
  });

  /** Duplica a peça criando uma peça extra independente (não altera o pedido). */
  const duplicateItem = (envId: string, itemId: string) => {
    if (!order) return;
    const envs = order.data.environments.map((e) => {
      if (e.id !== envId) return e;
      const src = e.items.find((i) => i.id === itemId) ?? (e.extra_cut_pieces ?? []).find((i) => i.id === itemId);
      if (!src) return e;
      const copy = cloneItem(src);
      copy.description = `${src.description || "Peça"} (cópia)`;
      return { ...e, extra_cut_pieces: [...(e.extra_cut_pieces ?? []), copy] };
    });
    updateOrderData({ ...order.data, environments: envs });
    logTechChange({ order_id: order.id, field: "peca", description: `Peça duplicada na Ordem de Corte` });
    toast.success("Peça duplicada na Ordem de Corte");
  };

  /** Reordena a sequência das peças da Ordem de Corte. */
  const moveItem = (envId: string, itemId: string, dir: -1 | 1, extra = false) => {
    if (!order) return;
    const envs = order.data.environments.map((e) => {
      if (e.id !== envId) return e;
      const list = [...(extra ? (e.extra_cut_pieces ?? []) : e.items)];
      const i = list.findIndex((x) => x.id === itemId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return e;
      [list[i], list[j]] = [list[j], list[i]];
      return extra ? { ...e, extra_cut_pieces: list } : { ...e, items: list };
    });
    updateOrderData({ ...order.data, environments: envs });
  };

  /** Duplica o ambiente inteiro — apenas para a produção (Ordem de Corte). */
  const duplicateEnv = (envId: string) => {
    if (!order) return;
    const src = order.data.environments.find((e) => e.id === envId);
    if (!src) return;
    const copy: Environment = {
      ...src,
      id: crypto.randomUUID(),
      name: `${src.name} (cópia)`,
      tech_name: `${src.tech_name || src.name} (cópia)`,
      items: src.items.map(cloneItem),
      services: src.services.map((s) => ({ ...s, id: crypto.randomUUID() })),
      supplies: src.supplies.map((s) => ({ ...s, id: crypto.randomUUID() })),
      extra_cut_pieces: (src.extra_cut_pieces ?? []).map(cloneItem),
      released_for_cut_at: undefined,
      released_by_name: undefined,
      tech_status: "pendente",
      production_status: undefined,
      cut_started_at: undefined, cut_done_at: undefined,
      finish_started_at: undefined, finish_done_at: undefined,
    };
    const idx = order.data.environments.findIndex((e) => e.id === envId);
    const envs = [...order.data.environments];
    envs.splice(idx + 1, 0, copy);
    updateOrderData({ ...order.data, environments: envs });
    logTechChange({ order_id: order.id, field: "ambiente", description: `Ambiente "${src.name}" duplicado` });
    toast.success("Ambiente duplicado");
  };

  /** Libera um ambiente individualmente: registra data/hora, usuário e gera comissão de 2%. */
  const releaseEnv = async (envId: string) => {
    if (!order) return;
    const env = order.data.environments.find((e) => e.id === envId);
    if (!env) return;
    const who = await currentUserName();
    const when = new Date().toISOString();
    const version = (env.tech_releases?.length ?? 0) + 1;
    const patched: Environment = {
      ...env,
      released_for_cut_at: when,
      released_by_name: who,
      tech_status: "liberado",
      tech_check_status: "liberado",
      tech_revision: version,
      tech_releases: [...(env.tech_releases ?? []), { version, at: when, by: who }],
      tech_logistics: env.tech_logistics ?? suggestedLogistics(order.data),
    };
    const next = { ...order.data, environments: order.data.environments.map((e) => e.id === envId ? patched : e) };
    setOrder({ ...order, data: next });
    await supabase.from("orders").update({ data: next as never }).eq("id", order.id);
    try {
      await syncEnvTechCommission({ order_id: order.id, data: next, env: patched });
    } catch (e) { console.error(e); }
    await logTechChange({
      order_id: order.id, field: "liberacao",
      description: `Ambiente "${env.name}" liberado`,
      new_value: { released_at: when, by: who },
    });
    await refreshTechLogs();
    toast.success("Ambiente liberado — Ordem de Corte atualizada e comissão gerada");
  };

  const reopenEnv = async (envId: string) => {
    if (!order) return;
    const env = order.data.environments.find((e) => e.id === envId);
    if (!env) return;
    const patched: Environment = { ...env, released_for_cut_at: undefined, tech_status: "pendente" };
    const next = { ...order.data, environments: order.data.environments.map((e) => e.id === envId ? patched : e) };
    setOrder({ ...order, data: next });
    await supabase.from("orders").update({ data: next as never }).eq("id", order.id);
    try { await syncEnvTechCommission({ order_id: order.id, data: next, env: patched, remove: true }); } catch (e) { console.error(e); }
    await logTechChange({ order_id: order.id, field: "liberacao", description: `Ambiente "${env.name}" reaberto`, old_value: { released_at: env.released_for_cut_at } });
    await refreshTechLogs();
    toast.message("Ambiente reaberto");
  };

  /** Recalcula a comissão após edição manual de líquido/percentual. */
  const resyncEnvCommission = async (envId: string) => {
    if (!order) return;
    const env = order.data.environments.find((e) => e.id === envId);
    if (!env || !env.released_for_cut_at) return;
    await supabase.from("orders").update({ data: order.data as never }).eq("id", order.id);
    await syncEnvTechCommission({ order_id: order.id, data: order.data, env });
    await refreshTechLogs();
    toast.success("Comissão recalculada");
  };

  const refreshTechLogs = async () => {
    if (!order) return;
    try { setTechLogs(await listTechLogs(order.id)); } catch { /* ignore */ }
  };


  const doPrint = (label: string, num?: number | string, pad = 6) => {
    const prev = document.title;
    const n = num != null ? String(num).padStart(pad, "0") : "";
    const client = (order?.data.client_name || "").trim().toUpperCase();
    const d = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Recife" });
    // Formato: "{tipo}. {numero} {cliente} - dd/mm/aaaa"
    document.title = `${label}. ${n} ${client} - ${d}`.trim().replace(/\s+/g, "_");
    setTimeout(() => { window.print(); setTimeout(() => { document.title = prev; }, 500); }, 50);
  };
  const printCorte = (envId: string) => {
    setCorteEnvId(envId);
    setMode("corte");
    setCortePage(1);
    setCorteZoom(0.7);
    setCortePreview(true);
  };
  const confirmPrintCorte = () => {
    setCortePreview(false);
    setTimeout(() => doPrint("Liberacao_Corte", order?.number), 150);
  };
  const scrollToCortePage = (n: number) => {
    setCortePage(n);
    const root = cortePagesRef.current;
    if (!root) return;
    const pages = root.querySelectorAll<HTMLElement>(".a4-page");
    const target = pages[n - 1];
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };


  const upload = async (e: React.ChangeEvent<HTMLInputElement>, kind: "projeto" | "foto") => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !order) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setUploading(true);
    for (const f of files) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${u.user.id}/${order.id}/${kind}/${Date.now()}_${safe}`;
      const { error } = await supabase.storage.from("order-files").upload(path, f);
      if (error) { toast.error(error.message); continue; }
      await supabase.from("order_attachments").insert({
        user_id: u.user.id, order_id: order.id, kind, name: f.name,
        storage_path: path, mime_type: f.type, size_bytes: f.size,
      });
    }
    setUploading(false);
    e.target.value = "";
    loadAll();
  };

  const removeAttachment = async (a: Attachment) => {
    await supabase.storage.from("order-files").remove([a.storage_path]);
    await supabase.from("order_attachments").delete().eq("id", a.id);
    loadAll();
  };

  const openAttachment = async (a: Attachment) => {
    const { data } = await supabase.storage.from("order-files").createSignedUrl(a.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (!order) return <div className="p-10 text-sm text-stone-400">Carregando…</div>;

  const data = order.data;
  const totals = calcTotals(data);
  const allocations = allocateEnvironments(data);

  const seller = catalog.sellers.find((s) => s.id === data.seller_id);
  const sellerName = seller?.name || data.salesperson;

  return (
    <div className="min-h-screen bg-stone-100">
      <div className="no-print sticky top-0 z-50 bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
        <button onClick={() => navigate({ to: "/pedidos" })} className="text-sm flex items-center gap-2 text-stone-500 hover:text-stone-950">
          <ArrowLeft className="size-4" /> Pedidos
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { tab: "gestao", label: "Resumo", icon: <Cog className="size-3" />, modes: ["gestao"] },
            { tab: "ambientes", label: "Ambientes", icon: <Boxes className="size-3" />, modes: ["ambientes", "tecnica", "tecnica_pdf", "corte"] },
            { tab: "financeiro", label: "Financeiro", icon: <FileText className="size-3" />, modes: ["financeiro"] },
            { tab: "producao", label: "Produção", icon: <Scissors className="size-3" />, modes: ["producao"] },
            { tab: "documentos", label: "Documentos", icon: <FileIcon className="size-3" />, modes: ["documentos", "pedido", "romaneio", "ficha", "docs_tec"] },
            { tab: "historico", label: "Histórico", icon: <History className="size-3" />, modes: ["historico"] },
          ] as const).map((t) => (
            <TabBtn key={t.tab} active={(t.modes as readonly string[]).includes(mode)} onClick={() => setMode(t.tab as any)} icon={t.icon}>{t.label}</TabBtn>
          ))}
          {(["pedido", "romaneio", "ficha", "tecnica", "tecnica_pdf", "corte", "docs_tec"] as const).includes(mode as any) && (
            <span className="kanban-badge kanban-badge-andamento">
              {mode === "pedido" ? "Pedido"
                : mode === "romaneio" ? "Romaneio"
                : mode === "ficha" ? "Ficha interna"
                : mode === "docs_tec" ? "Ordens técnicas"
                : mode === "corte" ? "Ordem de corte"
                : "Liberação técnica"}
            </span>
          )}

          {order.quote_id && (
            <button onClick={() => navigate({ to: "/orcamentos/$id", params: { id: order.quote_id! } })} className="px-4 py-2 text-xs uppercase tracking-widest font-bold border border-stone-300 hover:bg-stone-100 flex items-center gap-2">
              <Edit className="size-3" /> Editar
            </button>
          )}
          {DOC_MODES.includes(mode) && (
            <>
              <button
                onClick={async () => {
                  const tel = normalizePhoneBR(data.client_phone);
                  if (!tel) { toast.error("Cliente sem telefone cadastrado"); return; }
                  const els = Array.from(document.querySelectorAll<HTMLElement>(".a4-page"));
                  if (!els.length) { toast.error("Documento não está visível"); return; }
                  const tid = toast.loading("Gerando PDF e enviando...");
                  try {
                    const { elementsToPdfBase64, enviarPdfWhatsapp } = await import("@/lib/whatsapp-pdf");
                    const pdfBase64 = await elementsToPdfBase64(els);
                    const valor = brl(totals.total).replace("R$", "").trim();
                    const label = mode === "romaneio" ? "Romaneio" : "Pedido";
                    await enviarPdfWhatsapp({
                      telefone: tel,
                      nomeCliente: data.client_name || "Cliente",
                      valor,
                      pdfBase64,
                      fileName: `${label}_${String(order.number).padStart(4, "0")}.pdf`,
                      caption: `Olá ${data.client_name || ""}! Segue o ${label.toLowerCase()} Nº ${String(order.number).padStart(4, "0")}.`,
                    });
                    toast.success("Enviado no WhatsApp!", { id: tid });
                  } catch (e: any) {
                    toast.error(e?.message || "Falha ao enviar", { id: tid });
                  }
                }}
                className="bg-emerald-600 text-white px-6 py-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:bg-emerald-700"
              >
                <MessageCircle className="size-3" /> WhatsApp
              </button>
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-stone-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={data.show_item_finishes !== false}
                  onChange={(e) => updateOrderData({ ...data, show_item_finishes: e.target.checked })}
                  className="size-3 accent-stone-950"
                />
                Acabamentos no PDF
              </label>
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-stone-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!data.hide_env_m2}
                  onChange={(e) => updateOrderData({ ...data, hide_env_m2: e.target.checked })}
                  className="size-3 accent-stone-950"
                />
                Ocultar m²
              </label>
              <button onClick={() => doPrint(mode === "romaneio" ? "Romaneio" : mode === "ficha" ? "Ficha" : "Pedido", order.number)} className="bg-gold-low text-stone-950 px-6 py-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:opacity-90">
                <Printer className="size-3" /> Imprimir / PDF
              </button>
              <TrelloOrderStatus orderId={order.id} orderData={data} />

              {totals.entry > 0 && (
                <button
                  onClick={async () => {
                    // Reaproveita txid já vinculado à parcela de entrada, se existir; senão gera e persiste.
                    const { data: recs } = await supabase
                      .from("receivables")
                      .select("id, pix_txid, installment_no, status")
                      .eq("order_id", order.id)
                      .order("installment_no", { ascending: true })
                      .limit(1);
                    const rec = recs?.[0];
                    let tx = rec?.pix_txid || pixTxid || novoTxid();
                    if (rec && !rec.pix_txid) {
                      await supabase.from("receivables").update({ pix_txid: tx }).eq("id", rec.id);
                    }
                    setPixTxid(tx);
                    setPixOpen(true);
                  }}
                  className="bg-purple-700 text-white px-5 py-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:bg-purple-800"
                  title="Gerar PIX Copia e Cola para a entrada"
                >
                  <span className="font-mono">PIX</span> Entrada
                </button>
              )}
            </>
          )}
          <details className="relative">
            <summary className="list-none cursor-pointer px-4 py-2 text-xs uppercase tracking-widest font-bold border border-stone-300 hover:bg-stone-100 select-none">
              Ações
            </summary>
            <div className="absolute right-0 mt-2 z-50 bg-white border border-stone-200 shadow-lg p-2 flex flex-col gap-2 min-w-56">
          {(() => {
            const isMfc = !!data.mfc_pickup?.enabled;
            const toggleMfc = async () => {
              const targetLabel = isMfc ? "Convencional" : "MFC";
              const apply = async () => {
                const next: QuoteData = {
                  ...data,
                  mfc_pickup: {
                    ...(data.mfc_pickup ?? { qty: 1, unit_value: 300 }),
                    enabled: !isMfc,
                  },
                  installation: {
                    ...(data.installation ?? { enabled: true, percent: 20, min_value: 590 }),
                    enabled: isMfc, // se estava MFC, volta a habilitar instalação
                  },
                };
                updateOrderData(next);
                // Sincroniza type no orçamento vinculado (se existir)
                if (order.quote_id) {
                  await supabase.from("quotes").update({ type: isMfc ? "convencional" : "mfc" }).eq("id", order.quote_id);
                }
                toast.success(`Pedido convertido para ${targetLabel}`);
              };
              if (commercialLocked) {
                guard.request({
                  label: "Modalidade do pedido",
                  changes: [{ field: "mfc_pickup", label: "Modalidade", old_value: isMfc ? "MFC" : "Convencional", new_value: targetLabel }],
                  revisionData: { modalidade: targetLabel },
                  applyToOriginal: apply,
                });
                return;
              }
              if (!confirm(`Converter este pedido para ${targetLabel}?`)) return;
              await apply();
            };
            return (
              <button
                onClick={toggleMfc}
                className="px-4 py-2 text-xs uppercase tracking-widest font-bold border border-stone-400 text-stone-700 hover:bg-stone-100 flex items-center gap-2"
                title={isMfc ? "Converter para Convencional" : "Converter para MFC"}
              >
                {isMfc ? "→ Convencional" : "→ MFC"}
              </button>
            );
          })()}
          <button
            onClick={generateAdditiveManual}
            className="px-4 py-2 text-xs uppercase tracking-widest font-bold border border-amber-400 text-amber-700 hover:bg-amber-50 flex items-center gap-2"
            title="Gerar orçamento-aditivo deste pedido"
          >
            <Plus className="size-3" /> Aditivo
          </button>
          <button
            onClick={deleteOrder}
            className="px-3 py-2 text-xs uppercase tracking-widest font-bold border border-red-300 text-red-700 hover:bg-red-50 flex items-center gap-2 w-full justify-start"
            title="Apagar pedido"
          >
            <Trash2 className="size-3" /> Apagar
          </button>
            </div>
          </details>
        </div>
      </div>

      {HUB_TABS.includes(mode) && (
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <OrderHubHeader
            number={order.number} createdAt={order.created_at} status={order.status}
            data={data} total={totals.total} received={money.received}
            sellerName={sellerName} canSeeMoney={canSeeMoney}
          />
        </div>
      )}

      {/* Prazo de entrega — somente no Resumo */}
      {mode === "gestao" && (
        <div className="max-w-6xl mx-auto px-6 pt-6">
          {(() => {
            const delivery: DeliveryInfo = data.delivery ?? defaultDelivery();
            const baseDate = delivery.start_date || order.created_at;
            const setDelivery = (patch: Partial<DeliveryInfo>) =>
              updateOrderData({ ...data, delivery: { ...delivery, ...patch } });
            const previewDate =
              delivery.mode !== "instalacao"
                ? addDays(baseDate, delivery.days, delivery.days_type)
                : null;
            return (
              <div className="bg-white border border-stone-200 p-6 print:hidden">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarClock className="size-4 text-gold-low" />
                  <h4 className="label-eyebrow">Prazo de entrega</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Modalidade</span>
                    <select
                      value={delivery.mode}
                      onChange={(e) => setDelivery({ mode: e.target.value as DeliveryMode })}
                      className="border border-stone-300 px-2 py-1.5 bg-white"
                    >
                      <option value="retirada">Retirada na loja</option>
                      <option value="entrega">Entrega</option>
                      <option value="instalacao">Instalação</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Tipo de dias</span>
                    <select
                      value={delivery.days_type}
                      onChange={(e) => setDelivery({ days_type: e.target.value as DeliveryDaysType })}
                      className="border border-stone-300 px-2 py-1.5 bg-white"
                    >
                      <option value="uteis">Dias úteis</option>
                      <option value="corridos">Dias corridos</option>
                    </select>
                  </label>
                  {delivery.mode !== "instalacao" && (
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Prazo (dias)</span>
                      <input
                        type="number"
                        min={0}
                        value={delivery.days}
                        onChange={(e) => setDelivery({ days: parseInt(e.target.value) || 0 })}
                        className="border border-stone-300 px-2 py-1.5 bg-white"
                      />
                    </label>
                  )}
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Início da contagem</span>
                    <input
                      type="date"
                      value={(delivery.start_date || order.created_at).slice(0, 10)}
                      onChange={(e) => setDelivery({ start_date: e.target.value })}
                      className="border border-stone-300 px-2 py-1.5 bg-white"
                    />
                  </label>
                </div>
                {delivery.mode !== "instalacao" ? (
                  <p className="text-sm mt-4">
                    Previsão de {delivery.mode === "retirada" ? "retirada" : "entrega"}:{" "}
                    <strong className="font-mono">{previewDate ? previewDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</strong>
                    <span className="text-stone-500"> · {delivery.days} {delivery.days_type === "uteis" ? "dias úteis" : "dias corridos"} a partir de {new Date(baseDate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                  </p>
                ) : (
                  <p className="text-xs text-stone-500 mt-4">
                    Instalação: o prazo é individual por ambiente e começa a contar a partir da liberação para corte de cada um. Configure abaixo, em <strong>Liberação Técnica</strong>.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {mode === "gestao" && (
        <div className="max-w-6xl mx-auto px-6 pb-10 pt-4 space-y-8">
          {(() => {
            const dls = orderDeadlines(order.created_at, data);
            const alerts = dls.filter((d) => d.daysLeft <= 3);
            if (alerts.length === 0) return null;
            return (
              <div className="border-l-4 border-amber-500 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-amber-900 text-sm">
                      {alerts.some((a) => a.daysLeft < 0) ? "Prazo vencido!" : "Prazo próximo do vencimento"}
                    </p>
                    <ul className="text-sm text-amber-800 mt-1 space-y-0.5">
                      {alerts.map((a, i) => {
                        const lvl = alertLevel(a.daysLeft);
                        const txt = a.daysLeft < 0
                          ? `Vencido há ${Math.abs(a.daysLeft)} dia(s)`
                          : a.daysLeft === 0 ? "Hoje" : a.daysLeft === 1 ? "Amanhã" : `Faltam ${a.daysLeft} dias`;
                        return (
                          <li key={i} className="flex items-center gap-2">
                            {lvl === "vencido" && <AlertCircle className="size-3" />}
                            <strong>{a.label}:</strong>
                            <span>{txt} ({a.date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })})</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="bg-white border border-stone-200 p-6">
            <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
              <div>
                <span className="text-xs font-bold tracking-widest text-gold-low uppercase">Pedido</span>
                <h2 className="font-display text-3xl mt-1">PED-{String(order.number).padStart(6, "0")}</h2>
                <p className="text-xs text-stone-500 mt-1">{order.client_name || "—"} · {fmtDate(order.created_at)} · {brl(Number(order.total))}</p>
              </div>
            </div>

            <h4 className="label-eyebrow mb-3">Etapa atual</h4>
            <div className="flex flex-wrap gap-2 mb-2">
              {STAGES.map((st) => {
                const active = order.status === st.key;
                return (
                  <button key={st.key} onClick={() => changeStatus(st.key)}
                    className={"px-3 py-2 text-xs uppercase tracking-wider font-bold border transition " +
                      (active ? "bg-stone-950 text-white border-stone-950" : "bg-white border-stone-200 hover:border-stone-400")}>
                    {st.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="label-eyebrow mb-2">Vendedor {commercialLocked ? "· protegido" : ""}</h4>
                <select
                  value={data.seller_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || undefined;
                    const nameOf = (idv?: string) => catalog.sellers.find((s) => s.id === idv)?.name ?? "—";
                    const apply = () => updateOrderData({ ...data, seller_id: v });
                    if (!commercialLocked) { apply(); return; }
                    guard.request({
                      label: "Vendedor",
                      changes: [{ field: "seller_id", label: "Vendedor", old_value: nameOf(data.seller_id), new_value: nameOf(v) }],
                      revisionData: { seller_id: v },
                      applyToOriginal: apply,
                    });
                  }}
                  className="w-full border border-stone-300 px-2 py-1.5 text-sm bg-white"
                >
                  <option value="">— Sem vendedor —</option>
                  {catalog.sellers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} {s.kind ? `· ${s.kind}` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <h4 className="label-eyebrow mb-2">Med Técnica {commercialLocked ? "· protegido" : ""}</h4>
                <select
                  value={(data as { tech_measurer_id?: string }).tech_measurer_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || undefined;
                    const nameOf = (idv?: string) => catalog.tech_measurers.find((t) => t.id === idv)?.name ?? "—";
                    const apply = () => updateOrderData({ ...data, tech_measurer_id: v } as typeof data);
                    if (!commercialLocked) { apply(); return; }
                    guard.request({
                      label: "Med Técnica",
                      changes: [{ field: "tech_measurer_id", label: "Med Técnica", old_value: nameOf((data as { tech_measurer_id?: string }).tech_measurer_id), new_value: nameOf(v) }],
                      revisionData: { tech_measurer_id: v },
                      applyToOriginal: apply,
                    });
                  }}
                  className="w-full border border-stone-300 px-2 py-1.5 text-sm bg-white"
                >
                  <option value="">— Sem med técnica —</option>
                  {catalog.tech_measurers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} · {Number(t.commission_pct).toFixed(2)}%</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Proteção do pedido aprovado */}
          <div className="bg-white border border-stone-200 p-6 print:hidden">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h4 className="label-eyebrow mb-1">Pedido aprovado — documento protegido</h4>
                <p className="text-xs text-stone-600 max-w-xl">
                  Os dados comerciais (número, cliente, valores, materiais, comissões, nomes internos e
                  itens aprovados) estão <b>somente leitura</b>. Ajustes técnicos ficam em revisões
                  separadas e não alteram o pedido original.
                </p>
                <p className="text-xs text-stone-500 mt-2">
                  Base aprovada: <b>{brl(approvedBaseTotal(order))}</b>
                  {order.approved_at ? <> · congelada em {fmtDate(order.approved_at)}</> : null}
                  {" · "}Comissão: <b>{commissionLocked ? "bloqueada" : "liberada"}</b>
                </p>
              </div>
              {canSeeMoney ? (
                <button
                  onClick={async () => {
                    const reason = prompt(
                      commissionLocked
                        ? "Autorização administrativa — justifique o desbloqueio da comissão:"
                        : "Justifique o bloqueio da comissão:",
                    );
                    if (!reason || reason.trim().length < 5) return;
                    await setCommissionLock(order.id, !commissionLocked, reason.trim());
                    await loadAll();
                    toast.success(commissionLocked ? "Comissão desbloqueada" : "Comissão bloqueada");
                  }}
                  className="px-3 py-2 text-xs uppercase tracking-widest font-bold border border-stone-300 hover:bg-stone-50"
                >
                  {commissionLocked ? "Desbloquear comissão" : "Bloquear comissão"}
                </button>
              ) : null}
            </div>

            <h5 className="label-eyebrow mt-6 mb-2">Revisões técnicas ({revisions.length})</h5>
            {revisions.length === 0 ? (
              <p className="text-xs text-stone-500">Nenhuma revisão técnica registrada.</p>
            ) : (
              <div className="space-y-2">
                {revisions.map((r) => (
                  <div key={r.id} className="border border-stone-200 p-3 text-xs">
                    <div className="flex justify-between">
                      <b>R{r.seq} · {r.kind}</b>
                      <span className="text-stone-500">
                        {new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {r.created_by_name || "—"}
                      </span>
                    </div>
                    <div className="text-stone-600 mt-1">{r.reason}</div>
                    {(r.changes ?? []).map((c, i) => (
                      <div key={i} className="text-stone-500">
                        {c.label ?? c.field}: {String(c.old_value ?? "—")} → {String(c.new_value ?? "—")}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>


          {/* Forma de pagamento — sincroniza com o financeiro */}
          <div className="bg-white border border-stone-200 p-6">
            <h4 className="label-eyebrow mb-1">Forma de Pagamento</h4>
            <p className="text-xs text-stone-500 mb-4">
              Alterações aqui atualizam automaticamente as parcelas em <strong>Financeiro › A receber</strong>
              {" "}(parcelas já baixadas são preservadas).
            </p>
            <PaymentEditor
              payment={data.payment}
              onChange={(p) => updatePayment(p)}
              totals={{ total: totals.total, entry: totals.entry, balance: totals.balance, methodBreakdown: totals.methodBreakdown }}
            />
            <textarea
              placeholder="Observações sobre o pagamento (opcional)"
              value={data.payment.notes ?? ""}
              onChange={(e) => updatePayment({ ...data.payment, notes: e.target.value })}
              rows={2}
              className="w-full mt-2 bg-white border border-stone-200 p-2 text-sm focus:outline-none focus:border-gold-high"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="label-eyebrow">Projeto</h4>
                <label className={"text-xs uppercase font-bold flex items-center gap-2 cursor-pointer " + (uploading ? "opacity-50" : "text-gold-low hover:text-gold-high")}>
                  <Upload className="size-3" /> Enviar
                  <input type="file" multiple className="hidden" disabled={uploading} onChange={(e) => upload(e, "projeto")} />
                </label>
              </div>
              <AttachmentList items={attachments.filter((a) => a.kind === "projeto")} onOpen={openAttachment} onRemove={removeAttachment} icon={<FileIcon className="size-3" />} />
            </div>
            <div className="bg-white border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="label-eyebrow">Fotos</h4>
                <label className={"text-xs uppercase font-bold flex items-center gap-2 cursor-pointer " + (uploading ? "opacity-50" : "text-gold-low hover:text-gold-high")}>
                  <Upload className="size-3" /> Enviar
                  <input type="file" multiple accept="image/*" className="hidden" disabled={uploading} onChange={(e) => upload(e, "foto")} />
                </label>
              </div>
              <AttachmentList items={attachments.filter((a) => a.kind === "foto")} onOpen={openAttachment} onRemove={removeAttachment} icon={<ImageIcon className="size-3" />} />
            </div>
          </div>

          {/* Liberação Técnica: corrigir medidas por ambiente e mandar para corte */}
          <div className="bg-white border border-stone-200 p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="label-eyebrow">Liberação Técnica</h4>
                <p className="text-xs text-stone-500 mt-1">Ajuste as medidas liberadas para o corte. Estas alterações <strong>não modificam o pedido</strong> — diferenças ≥ 30 cm geram um <strong>orçamento aditivo</strong>, onde você pode aplicar desconto separadamente.</p>
              </div>
              <button onClick={() => changeStatus("corte")}
                className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-stone-950 text-white hover:bg-stone-800 flex items-center gap-2">
                <ArrowRight className="size-3" /> Enviar para Corte
              </button>
            </div>

            <div className="space-y-8">
              {data.environments.map((env) => (
                <div key={env.id} className="border border-stone-200">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-stone-50 border-b border-stone-200 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <input
                        value={env.tech_name ?? env.name}
                        onChange={(e) => updateEnv(env.id, { tech_name: e.target.value })}
                        title="Nome técnico (Ordem de Corte) — não altera o pedido comercial"
                        className="font-display text-lg bg-transparent border-b border-transparent hover:border-stone-300 focus:border-stone-950 focus:outline-none px-1"
                      />
                      <input
                        value={env.tech_material ?? env.material_name}
                        onChange={(e) => updateEnv(env.id, { tech_material: e.target.value })}
                        placeholder="Material"
                        title="Material técnico (Ordem de Corte) — não altera o pedido comercial"
                        className="text-xs text-stone-600 bg-transparent border-b border-transparent hover:border-stone-300 focus:border-stone-950 focus:outline-none px-1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => duplicateEnv(env.id)}
                        className="text-xs uppercase tracking-wider font-bold border border-stone-300 px-3 py-1.5 hover:bg-white flex items-center gap-2">
                        <Plus className="size-3" /> Duplicar ambiente
                      </button>
                      <button onClick={() => printCorte(env.id)}
                        className="text-xs uppercase tracking-wider font-bold border border-stone-300 px-3 py-1.5 hover:bg-white flex items-center gap-2">
                        <Scissors className="size-3" /> Imprimir corte
                      </button>
                    </div>

                  </div>
                  {(() => {
                    const dlv = data.delivery ?? defaultDelivery();
                    const isInstall = (env.tech_logistics ?? suggestedLogistics(data)) === "instalacao";
                    const released = env.released_for_cut_at;
                    const previsao = released && isInstall && env.delivery_days
                      ? addDays(released, env.delivery_days, dlv.days_type)
                      : null;
                    const alloc = allocations.find((a) => a.env_id === env.id);
                    const pct = envCommissionPct(env);
                    const commission = alloc ? +(alloc.effective_net * pct / 100).toFixed(2) : 0;
                    return (
                      <div className="border-b border-stone-200 bg-white">
                        <div className="flex items-center justify-between gap-3 px-4 py-2 flex-wrap">
                          <div className="flex items-center gap-3 text-xs flex-wrap">
                            <label className="flex items-center gap-2">
                              <span className="uppercase tracking-wider text-stone-500 font-bold">Status</span>
                              <select
                                value={env.tech_status ?? (released ? "liberado" : "pendente")}
                                onChange={(e) => updateEnv(env.id, { tech_status: e.target.value as Environment["tech_status"] })}
                                className="border border-stone-300 px-2 py-1 bg-white"
                              >
                                <option value="pendente">Pendente</option>
                                <option value="liberado">Liberado</option>
                                <option value="em_producao">Em produção</option>
                                <option value="concluido">Concluído</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className="uppercase tracking-wider text-stone-500 font-bold">Logística</span>
                              <select
                                value={env.tech_logistics ?? suggestedLogistics(data)}
                                onChange={(e) => updateEnv(env.id, { tech_logistics: e.target.value as Environment["tech_logistics"] })}
                                className="border border-stone-300 px-2 py-1 bg-white"
                              >
                                {Object.entries(LOGISTICS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </label>
                            {isInstall && (
                              <label className="flex items-center gap-2">
                                <span className="uppercase tracking-wider text-stone-500 font-bold">Prazo</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={env.delivery_days ?? ""}
                                  onChange={(e) => updateEnv(env.id, { delivery_days: parseInt(e.target.value) || 0 })}
                                  placeholder="dias"
                                  className="w-20 border border-stone-300 px-2 py-1 text-right font-mono"
                                />
                                <span className="text-stone-500">{dlv.days_type === "uteis" ? "dias úteis" : "dias corridos"}</span>
                              </label>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {released && (
                              <button onClick={() => reopenEnv(env.id)}
                                className="text-xs uppercase tracking-wider font-bold px-3 py-1.5 border border-stone-300 hover:bg-stone-100">
                                Reabrir
                              </button>
                            )}
                            <button onClick={() => releaseEnv(env.id)}
                              className="text-xs uppercase tracking-wider font-bold px-3 py-1.5 border bg-stone-950 text-white border-stone-950 hover:bg-stone-800">
                              {released ? "Reliberar ambiente" : "Liberar ambiente"}
                            </button>
                          </div>
                        </div>
                        <div className="px-4 pb-3 flex items-center gap-3 text-xs flex-wrap">
                          <label className="flex items-center gap-2">
                            <span className="uppercase tracking-wider text-stone-500 font-bold">Data da liberação</span>
                            <input
                              type="date"
                              value={released ? new Date(released).toISOString().slice(0, 10) : ""}
                              onChange={(e) => updateEnv(env.id, { released_for_cut_at: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })}
                              className="border border-stone-300 px-2 py-1 font-mono"
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            <span className="uppercase tracking-wider text-stone-500 font-bold">Responsável</span>
                            <input
                              value={env.tech_responsible ?? ""}
                              placeholder="Bhenda"
                              onChange={(e) => updateEnv(env.id, { tech_responsible: e.target.value })}
                              className="border border-stone-300 px-2 py-1 w-40"
                            />
                          </label>
                          <span className="text-stone-500">
                            {released
                              ? <>Liberado por <strong>{env.released_by_name || "—"}</strong> em <strong className="font-mono">{new Date(released).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong>{previsao && <> · Previsão: <strong className="font-mono">{previsao.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong></>}</>
                              : <span className="text-stone-400">Ambiente ainda não liberado — o prazo de produção começa na liberação.</span>}
                          </span>
                        </div>
                        {alloc && canSeeMoney && (
                          <div className="px-4 pb-3">
                            <div className="border border-stone-200 bg-stone-50/70 p-3 text-xs space-y-2">
                              <div className="uppercase tracking-widest font-bold text-stone-500 text-[10px]">Rateio proporcional e comissão da técnica</div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-stone-600">
                                <span>Bruto {brl(alloc.gross)}</span>
                                <span>({num(alloc.share_pct)}% do pedido)</span>
                                <span>+ insumos {brl(alloc.alloc.quote_supplies)}</span>
                                <span>+ frete {brl(alloc.alloc.freight)}</span>
                                <span>+ coleta {brl(alloc.alloc.mfc_pickup)}</span>
                                <span>+ instalação {brl(alloc.alloc.installation)}</span>
                                <span>+ rodapé {brl(alloc.alloc.baseboard)}</span>
                                <span className="text-red-600">− desconto {brl(alloc.alloc.discount)}</span>
                                <span className="font-bold text-stone-900">= líquido sugerido {brl(alloc.net)}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-2">
                                  <span className="uppercase tracking-wider text-stone-500 font-bold">Líquido manual</span>
                                  <input type="number" step="0.01" value={env.tech_net_override ?? ""}
                                    placeholder={alloc.net.toFixed(2)}
                                    onChange={(e) => updateEnv(env.id, { tech_net_override: parseFloat(e.target.value) || undefined })}
                                    className="w-28 border border-stone-300 px-2 py-1 text-right font-mono" />
                                </label>
                                <label className="flex items-center gap-2">
                                  <span className="uppercase tracking-wider text-stone-500 font-bold">%</span>
                                  <input type="number" step="0.01" value={env.tech_commission_pct ?? ""}
                                    placeholder="2"
                                    onChange={(e) => updateEnv(env.id, { tech_commission_pct: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                                    className="w-20 border border-stone-300 px-2 py-1 text-right font-mono" />
                                </label>
                                <span className="font-bold">Comissão: <span className="font-mono">{brl(commission)}</span></span>
                                <button onClick={() => resyncEnvCommission(env.id)}
                                  disabled={!released}
                                  className="text-[10px] uppercase tracking-wider font-bold border border-stone-300 px-3 py-1.5 hover:bg-white disabled:opacity-40">
                                  Recalcular comissão
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="px-4 pb-3">
                          <label className="block">
                            <span className="uppercase tracking-wider text-stone-500 font-bold text-[10px]">Observações técnicas do ambiente</span>
                            <textarea rows={2} value={env.tech_notes ?? ""}
                              onChange={(e) => updateEnv(env.id, { tech_notes: e.target.value })}
                              placeholder="Usinagens, cuidados de corte, sequência…"
                              className="w-full border border-stone-300 px-2 py-1 text-sm mt-1" />
                          </label>
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const vis = (env as any).visibility ?? { cortador: true, acabador: true, montador: true };
                    const toggle = (k: "cortador" | "acabador" | "montador") =>
                      updateEnv(env.id, { visibility: { ...vis, [k]: !vis[k] } } as any);
                    return (
                      <div className="px-4 py-2 border-b border-stone-100 flex items-center gap-4 flex-wrap bg-[#F2F2F2]">
                        <span className="text-[10px] uppercase tracking-widest text-[#4A4A4A] font-bold">Visibilidade dos desenhos</span>
                        {([
                          ["cortador", "Cortador"],
                          ["acabador", "Acabador"],
                          ["montador", "Montador"],
                        ] as const).map(([k, label]) => (
                          <label key={k} className="flex items-center gap-1.5 text-xs text-[#1A1A1A] cursor-pointer">
                            <input type="checkbox" checked={!!vis[k]} onChange={() => toggle(k)} className="accent-[#1A1A1A]" />
                            {label}
                          </label>
                        ))}
                        <span className="text-[10px] text-[#9B9B9B]">Desmarque para restringir acesso no Portal do Funcionário.</span>
                      </div>
                    );
                  })()}
                  <div className="px-4 py-3 border-b border-stone-100 flex items-center gap-4 flex-wrap bg-stone-50/50">

                    <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">Quantidades (cuba / nicho / divibox)</span>
                    {([
                      ["qtd_cuba", "Cubas", "R$ 60"],
                      ["qtd_nicho", "Nichos", "R$ 40"],
                      ["qtd_divibox", "Diviboxes", "R$ 15"],
                    ] as const).map(([field, label, val]) => (
                      <label key={field} className="flex items-center gap-2 text-xs">
                        <span className="text-stone-600">{label}</span>
                        <input
                          type="number"
                          min={0}
                          value={(env as any)[field] ?? ""}
                          onChange={(e) => updateEnv(env.id, { [field]: parseInt(e.target.value) || 0 } as any)}
                          className="w-16 border border-stone-300 px-2 py-1 text-right font-mono"
                        />
                        {canSeeMoney && <span className="text-[10px] text-stone-400">{val}/un</span>}
                      </label>
                    ))}
                  </div>
                  <div className="px-4 py-4 border-b border-stone-100">
                    {(() => {
                      const released2DItems = releasedItemsFor2D(env);
                      return (
                        <QuickRoomPanel
                          value={env.quick_room ?? emptyQuickRoom()}
                          onChange={(qr) => updateEnv(env.id, { quick_room: qr })}
                          materials={catalog.materials}
                          finishTypes={catalog.finish_types}
                          allowThickness
                          items={released2DItems}
                          quantity={released2DItems.reduce((s, it) => s + relQty(it), 0)}
                          docInfo={{
                            companyName: settings?.company_name,
                            orderNumber: order ? `PED-${String(order.number).padStart(6, "0")}` : undefined,
                            clientName: data.client_name,
                            clientPhone: data.client_phone,
                            address: data.address,
                            city: data.city,
                            envName: env.name,
                            materialName: env.material_name,
                            description: env.items?.map((it: { description?: string }) => it.description).filter(Boolean).join(" · "),
                          }}
                        />
                      );
                    })()}



                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100">
                        <th className="text-left p-2 font-bold">Descrição</th>
                        <th className="text-right p-2 font-bold w-16">Qtde</th>
                        <th className="text-right p-2 font-bold w-24">Comp. (m)</th>
                        <th className="text-right p-2 font-bold w-24">Larg. (m)</th>
                        <th className="text-right p-2 font-bold w-20">m²</th>
                        <th className="text-center p-2 font-bold w-20">Emenda</th>
                        <th className="p-2 w-28"></th>

                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {env.items.map((it, itIdx) => (

                        <tr key={it.id}>
                          <td className="p-2">
                            <input value={it.description}
                              onChange={(e) => updateItem(env.id, it.id, { description: e.target.value })}
                              className="w-full bg-transparent text-sm focus:outline-none" />
                            {it.has_emenda && (
                              <input value={it.emenda_position ?? ""}
                                onChange={(e) => updateItem(env.id, it.id, { emenda_position: e.target.value })}
                                placeholder="Posição da emenda"
                                className="w-full bg-transparent text-xs italic text-stone-500 focus:outline-none" />
                            )}
                            <div className="mt-1">
                              <ItemFinishEditor
                                item={it}
                                finishTypes={catalog.finish_types}
                                onChange={(edges) => updateItem(env.id, it.id, { finish_edges: edges })}
                                onPatch={(patch) => updateItem(env.id, it.id, patch)}
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <input value={it.usinagem ?? ""}
                                onChange={(e) => updateItem(env.id, it.id, { usinagem: e.target.value })}
                                placeholder="Usinagem"
                                className="text-xs border border-stone-200 px-2 py-1 w-40" />
                              <input value={it.released_notes ?? ""}
                                onChange={(e) => updateItem(env.id, it.id, { released_notes: e.target.value })}
                                placeholder="Obs. técnica da peça"
                                className="text-xs border border-stone-200 px-2 py-1 flex-1 min-w-40" />
                            </div>

                          </td>
                          <td className="p-2"><input type="number" min={1} step="1" value={relQty(it)}
                            onChange={(e) => updateItem(env.id, it.id, { released_qty: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full text-right font-mono bg-transparent focus:outline-none" /></td>
                          <td className="p-2"><input type="number" step="0.001" value={relLen(it)}
                            onChange={(e) => updateItem(env.id, it.id, { released_length: parseFloat(e.target.value) || 0 })}
                            className="w-full text-right font-mono bg-transparent focus:outline-none" /></td>
                          <td className="p-2"><input type="number" step="0.001" value={relWid(it)}
                            onChange={(e) => updateItem(env.id, it.id, { released_width: parseFloat(e.target.value) || 0 })}
                            className="w-full text-right font-mono bg-transparent focus:outline-none" /></td>
                          <td className="p-2 text-right font-mono">{numMed(relItemArea(it))}</td>
                          <td className="p-2 text-center">
                            <input type="checkbox" checked={it.has_emenda}
                              onChange={(e) => updateItem(env.id, it.id, { has_emenda: e.target.checked })}
                              className="accent-stone-950" />
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => moveItem(env.id, it.id, -1)} disabled={itIdx === 0}
                                className="text-stone-400 hover:text-stone-900 disabled:opacity-30" title="Mover para cima">
                                <ChevronUp className="size-3" />
                              </button>
                              <button onClick={() => moveItem(env.id, it.id, 1)} disabled={itIdx === env.items.length - 1}
                                className="text-stone-400 hover:text-stone-900 disabled:opacity-30" title="Mover para baixo">
                                <ChevronDown className="size-3" />
                              </button>
                              <button onClick={() => duplicateItem(env.id, it.id)} className="text-stone-400 hover:text-stone-900" title="Duplicar peça">
                                <Copy className="size-3" />
                              </button>
                              <button onClick={() => removeItem(env.id, it.id)} className="text-stone-400 hover:text-red-500" title="Remover peça">
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-stone-200 bg-stone-50">
                        <td colSpan={4} className="p-2 text-right text-[10px] uppercase font-bold text-stone-500">Total liberado do ambiente</td>
                        <td className="p-2 text-right font-mono text-sm font-bold">{numMed(relEnvArea(env))} m²</td>
                        <td colSpan={2}></td>
                      </tr>

                    </tfoot>
                  </table>
                  <div className="px-3 py-3 border-t border-stone-100 bg-stone-50 flex justify-end">
                    <button
                      onClick={() => addItem(env.id)}
                      className="text-xs uppercase tracking-wider font-bold bg-stone-950 text-white px-4 py-2 hover:bg-stone-800 flex items-center gap-2"
                    >
                      <Plus className="size-3" /> Adicionar peça
                    </button>
                  </div>
                  <div className="border-t border-stone-200 bg-amber-50/40">
                    <div className="px-3 py-2 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-amber-800">Peças extras para corte</div>
                        <div className="text-[10px] text-stone-500">Adicionadas manualmente para o corte. Não afetam valores nem geram aditivo.</div>
                      </div>
                      <button
                        onClick={() => addExtra(env.id)}
                        className="text-xs uppercase tracking-wider font-bold border border-amber-700 text-amber-800 px-3 py-1.5 hover:bg-amber-100 flex items-center gap-2"
                      >
                        <Plus className="size-3" /> Peça extra
                      </button>
                    </div>
                    {(env.extra_cut_pieces?.length ?? 0) > 0 && (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[10px] uppercase tracking-wider text-stone-400 border-b border-stone-100">
                            <th className="text-left p-2 font-bold">Descrição (extra)</th>
                            <th className="text-right p-2 font-bold w-16">Qtde</th>
                            <th className="text-right p-2 font-bold w-24">Comp. (m)</th>
                            <th className="text-right p-2 font-bold w-24">Larg. (m)</th>
                            <th className="text-right p-2 font-bold w-20">m²</th>
                            <th className="p-2 w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {(env.extra_cut_pieces ?? []).map((it) => (
                            <tr key={it.id}>
                              <td className="p-2">
                                <input value={it.description}
                                  onChange={(e) => updateExtra(env.id, it.id, { description: e.target.value })}
                                  placeholder="Ex.: rodapé sobra, peça de reposição…"
                                  className="w-full bg-transparent text-sm focus:outline-none" />
                              </td>
                              <td className="p-2"><input type="number" min={1} step="1" value={itemQty(it)}
                                onChange={(e) => updateExtra(env.id, it.id, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                                className="w-full text-right font-mono bg-transparent focus:outline-none" /></td>
                              <td className="p-2"><input type="number" step="0.001" value={it.length}
                                onChange={(e) => updateExtra(env.id, it.id, { length: parseFloat(e.target.value) || 0 })}
                                className="w-full text-right font-mono bg-transparent focus:outline-none" /></td>
                              <td className="p-2"><input type="number" step="0.001" value={it.width}
                                onChange={(e) => updateExtra(env.id, it.id, { width: parseFloat(e.target.value) || 0 })}
                                className="w-full text-right font-mono bg-transparent focus:outline-none" /></td>
                              <td className="p-2 text-right font-mono">{num(itemArea(it), 3)}</td>
                              <td className="p-2 text-center">
                                <button onClick={() => removeExtra(env.id, it.id)} className="text-stone-400 hover:text-red-500" title="Remover peça extra">
                                  <Trash2 className="size-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-stone-200 p-6">
            <h4 className="label-eyebrow mb-3">Linha do tempo</h4>

            {history.length === 0 ? (
              <p className="text-sm text-stone-400">Sem alterações de etapa.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((h, i) => (
                  <li key={i} className="flex items-baseline gap-3 text-sm border-b border-stone-100 pb-2">
                    <span className="font-mono text-xs text-stone-400">{fmtDate(h.created_at)}</span>
                    <span className="uppercase text-xs font-bold tracking-wider">{STAGES.find((s) => s.key === h.status)?.label ?? h.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-stone-200 p-6">
            <h4 className="label-eyebrow mb-3">Histórico da liberação técnica</h4>
            {techLogs.length === 0 ? (
              <p className="text-sm text-stone-400">Nenhuma alteração técnica registrada.</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-auto">
                {techLogs.map((l) => (
                  <li key={l.id} className="text-sm border-b border-stone-100 pb-2">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="font-mono text-xs text-stone-400">{fmtDate(l.created_at)}</span>
                      <span className="uppercase text-[10px] font-bold tracking-wider text-stone-500">{l.field ?? "técnica"}</span>
                      <span className="text-xs text-stone-500">{l.changed_by_name ?? "—"}</span>
                    </div>
                    <div className="text-stone-700">{l.description}</div>
                    {(l.old_value != null || l.new_value != null) && (
                      <div className="text-xs font-mono text-stone-500">
                        {JSON.stringify(l.old_value)} → {JSON.stringify(l.new_value)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      )}

      {mode === "tecnica" && (
        <div className="py-6">
          <TechReleaseSection
            data={data}
            orderNumber={order.number}
            createdAt={order.created_at}
            materials={catalog.materials}
            finishTypes={catalog.finish_types}
            onUpdateEnv={updateEnv}
            onUpdateItem={(envId, itemId, patch) => {
              const isExtra = (data.environments.find((e) => e.id === envId)?.extra_cut_pieces ?? []).some((x) => x.id === itemId);
              (isExtra ? updateExtra : updateItem)(envId, itemId, patch);
            }}
            onAddExtra={addExtra}
            onRemoveExtra={removeExtra}
            onDuplicateItem={duplicateItem}
            onMoveItem={moveItem}
            onRelease={releaseEnv}
            onReopen={reopenEnv}
            onPrint={(envId) => { setCorteEnvId(envId); setMode("tecnica_pdf"); setTimeout(() => doPrint("Liberacao_Tecnica", order.number), 80); }}
          />
        </div>
      )}

      {mode === "tecnica_pdf" && (() => {
        const env = data.environments.find((e) => e.id === corteEnvId) ?? data.environments[0];
        if (!env) return null;
        return (
          <div className="py-6">
            <div className="no-print mb-4 flex items-center gap-2">
              <button onClick={() => setMode("tecnica")} className="px-4 py-2 text-xs uppercase tracking-widest font-bold border border-stone-300 hover:bg-stone-100">Voltar</button>
              <button onClick={() => doPrint("Liberacao_Tecnica", order.number)} className="bg-stone-950 text-white px-4 py-2 text-xs uppercase tracking-widest font-bold">Imprimir / PDF</button>
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-stone-600">
                Escala
                <select value={pdfScale} onChange={(e) => setPdfScale(e.target.value)} className="border border-stone-300 px-2 py-1.5 text-xs">
                  {["auto", "1:1", "1:2", "1:5", "1:10", "1:20", "1:50"].map((s) => <option key={s} value={s}>{s === "auto" ? "Automática" : s}</option>)}
                </select>
              </label>
            </div>
            <TechReleaseSheet
              env={env}
              data={data}
              orderNumber={order.number}
              createdAt={order.created_at}
              materials={catalog.materials}
              finishTypes={catalog.finish_types}
              scale={pdfScale}
            />
          </div>
        );
      })()}

      {mode === "ambientes" && (
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          <OrderEnvironmentsPanel
            data={data}
            canSeeMoney={canSeeMoney}
            envTotal={(e) => envTotal(e)}
            onOpenTech={(envId) => { setCorteEnvId(envId); setMode("tecnica"); }}
            onDuplicateEnv={(envId) => duplicateEnv(envId)}
          />
        </div>
      )}

      {mode === "producao" && (
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          <OrderProductionPanel data={data} />
        </div>
      )}

      {mode === "documentos" && (
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          <OrderDocumentsPanel
            data={data}
            attachments={attachments}
            onOpenDoc={(doc) => { if (doc === "docs_tec") setTechDocPreview(null); setMode(doc); }}
            onOpenTechDocs={(envId: string) => { setCorteEnvId(envId); setTechDocPreview(null); setMode("docs_tec"); }}
            onOpen={openAttachment}
            onRemove={removeAttachment}
          />
        </div>
      )}

      {mode === "docs_tec" && (
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          <div className="no-print">
            <TechDocsPanel
              orderId={order.id}
              orderNumber={order.number}
              orderDate={order.created_at}
              data={data}
              finishTypes={catalog.finish_types}
              initialEnvId={corteEnvId ?? undefined}
              currentUserName={undefined}
              onPreview={(rec) => setTechDocPreview(rec)}
            />
          </div>
          {techDocPreview && (
            <div className="print-area">
              <DocZoomViewer
                toolbarExtra={
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] text-stone-500">
                      {techDocPreview.kind === "corte" ? "Ordem de Corte" : "Ordem de Acabamento"} · V{techDocPreview.version}
                    </span>
                    {techDocPreview.kind !== "corte" && (
                      <>
                        <label className="flex items-center gap-1 text-[11px] text-stone-600 no-print">
                          <input type="checkbox" className="accent-stone-950" checked={hideDocDrawing}
                            onChange={(e) => setHideDocDrawing(e.target.checked)} />
                          Imprimir sem desenho
                        </label>
                        <label className="flex items-center gap-1 text-[11px] text-stone-600 no-print">
                          <input type="checkbox" className="accent-stone-950" checked={hideDocPieces}
                            onChange={(e) => setHideDocPieces(e.target.checked)} />
                          Imprimir sem peças
                        </label>
                      </>
                    )}
                  </span>
                }
              >
                {techDocPreview.kind === "corte"
                  ? <CutOrderSheet snap={techDocPreview.snapshot} />
                  : <FinishOrderSheet snap={techDocPreview.snapshot} hideDrawing={hideDocDrawing} hidePieces={hideDocPieces} />}
              </DocZoomViewer>

            </div>
          )}
        </div>
      )}


      {mode === "historico" && (
        <div className="max-w-4xl mx-auto px-6 py-8">
          <OrderHistoryPanel statusHistory={history} revisions={revisions} techLogs={techLogs} />
        </div>
      )}

      {mode === "financeiro" && (
        <div className="max-w-5xl mx-auto px-6 py-8">
          <OrderFinancialPanel
            orderId={order.id}
            contracted={totals.total}
            approvedTotal={order.approved_total ?? null}
            quoteId={order.quote_id}
            clientName={order.client_name}
            orderNumber={order.number}

            paymentSummary={paymentSummaryText(data.payment, {
              total: totals.total, entry: totals.entry, balance: totals.balance, methodBreakdown: totals.methodBreakdown,
            })}
          />
        </div>
      )}

      {mode === "ficha" && (
        <div className="py-8">
          <OrderInternalSheet
            data={data}
            number={order.number}
            createdAt={order.created_at}
            sellerName={sellerName}
            logoUrl={settings?.logo_url || porcelaneLogo.url}
          />
        </div>
      )}

      {(mode === "pedido" || mode === "romaneio") && (() => {
        const renderEnvs = mode === "romaneio"
          ? data.environments.filter((e) => romaneioEnvs.has(e.id))
          : data.environments;
        type RomSupply = { key: string; line: SupplyLine; from: string };
        const allSupplies: RomSupply[] = [];
        for (const e of data.environments) {
          for (const s of e.supplies) allSupplies.push({ key: `env:${e.id}:${s.id}`, line: s, from: e.name });
        }
        for (const s of data.quote_supplies ?? []) allSupplies.push({ key: `quote:${s.id}`, line: s, from: "Pedido" });
        const selectedSupplies = mode === "romaneio"
          ? [
              ...allSupplies.filter((s) => romaneioSupplies.has(s.key)),
              ...romaneioExtraSupplies
                .filter((x) => x.description.trim())
                .map((x) => ({ key: `extra:${x.id}`, line: { id: x.id, description: x.description, qty: x.qty, unit_value: 0 } as SupplyLine, from: "Adicional" })),
            ]
          : [];
        return (
      <div className="py-8">

        {mode === "romaneio" && (
          <div className="no-print max-w-4xl mx-auto bg-white border border-stone-200 p-6 mb-6 space-y-4">
            <div>
              <h4 className="label-eyebrow mb-2">Ambientes a entregar neste romaneio</h4>
              <p className="text-xs text-stone-500 mb-3">As medidas exibidas seguem o que foi liberado para corte.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.environments.map((e) => {
                  const checked = romaneioEnvs.has(e.id);
                  const released = e.released_for_cut_at;
                  return (
                    <label key={e.id} className="flex items-start gap-2 border border-stone-200 px-3 py-2 cursor-pointer hover:bg-stone-50">
                      <input type="checkbox" checked={checked} className="mt-1 accent-stone-950"
                        onChange={(ev) => {
                          const next = new Set(romaneioEnvs);
                          if (ev.target.checked) next.add(e.id); else next.delete(e.id);
                          setRomaneioEnvs(next);
                        }} />
                      <div className="flex-1 text-sm">
                        <div className="font-bold">{e.name}</div>
                        <div className="text-xs text-stone-500">
                          {e.items.length} peça(s) · {num(envArea(e))} m²
                          {released ? <> · liberado {new Date(released).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</> : <> · <span className="text-amber-600">não liberado</span></>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            {allSupplies.length > 0 && (
              <div>
                <h4 className="label-eyebrow mb-2">Insumos a entregar junto</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allSupplies.map((s) => {
                    const checked = romaneioSupplies.has(s.key);
                    return (
                      <label key={s.key} className="flex items-start gap-2 border border-stone-200 px-3 py-2 cursor-pointer hover:bg-stone-50">
                        <input type="checkbox" checked={checked} className="mt-1 accent-stone-950"
                          onChange={(ev) => {
                            const next = new Set(romaneioSupplies);
                            if (ev.target.checked) next.add(s.key); else next.delete(s.key);
                            setRomaneioSupplies(next);
                          }} />
                        <div className="flex-1 text-sm">
                          <div>{s.line.description || "(sem descrição)"} <span className="text-xs text-stone-500">× {s.line.qty}</span></div>
                          <div className="text-xs text-stone-500">{s.from}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-stone-100">
              <div>
                <h4 className="label-eyebrow mb-2">Data do romaneio</h4>
                <input
                  type="date"
                  value={romaneioDate}
                  onChange={(e) => setRomaneioDate(e.target.value)}
                  className="border border-stone-300 px-3 py-2 text-sm w-full"
                />
                <p className="text-xs text-stone-500 mt-1">Padrão: hoje. Editável a cada impressão.</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="label-eyebrow">Insumos adicionais (livres)</h4>
                <button
                  type="button"
                  onClick={() => setRomaneioExtraSupplies((prev) => [...prev, { id: crypto.randomUUID(), description: "", qty: 1 }])}
                  className="text-xs px-3 py-1 border border-stone-300 hover:bg-stone-50"
                >+ Adicionar insumo</button>
              </div>
              {romaneioExtraSupplies.length === 0 ? (
                <p className="text-xs text-stone-500">Nenhum insumo adicional. Use para incluir itens fora do pedido neste romaneio.</p>
              ) : (
                <div className="space-y-2">
                  {romaneioExtraSupplies.map((x, idx) => (
                    <div key={x.id} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Descrição do insumo"
                        value={x.description}
                        onChange={(e) => setRomaneioExtraSupplies((prev) => prev.map((p, i) => i === idx ? { ...p, description: e.target.value } : p))}
                        className="flex-1 border border-stone-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={x.qty}
                        onKeyDown={(e) => { if (e.key === "." || e.key === ",") e.preventDefault(); }}
                        onChange={(e) => setRomaneioExtraSupplies((prev) => prev.map((p, i) => i === idx ? { ...p, qty: Math.max(1, parseInt(e.target.value) || 1) } : p))}
                        className="w-20 border border-stone-300 px-2 py-2 text-sm text-right"
                      />
                      <button
                        type="button"
                        onClick={() => setRomaneioExtraSupplies((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-xs px-2 py-2 border border-stone-300 hover:bg-stone-50"
                      >Remover</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="a4-page print-page">
          {mode === "pedido" ? (
            <DocTopHeader
              logoUrl={settings?.logo_url || porcelaneLogo.url}
              companyName={settings?.company_name}
              docType="Pedido"
              docNumber={String(order.number).padStart(6, "0")}
              date={fmtDate(order.created_at)}
              client={{ name: data.client_name, phone: data.client_phone, email: data.client_email }}
              work={{ address: data.address, city: data.city }}
              people={[
                { label: "Arquiteto(a)", name: data.architect, phone: data.architect_phone },
                { label: "Consultor(a)", name: sellerName, phone: data.salesperson_phone },
                { label: "Vendedor(a)", name: data.external_salesperson, phone: data.external_salesperson_phone },
                ...(data.contacts ?? []).map((c) => ({ label: c.label || "Contato", name: c.name, phone: c.phone })),
              ]}
            />
          ) : (
            <>
              <header className="grid grid-cols-[1fr_auto] items-center gap-6 border-b-2 border-stone-950 pb-5 mb-6">
                <div className="min-w-0 flex flex-col items-start gap-2">
                  <img
                    src={settings?.logo_url || porcelaneLogo.url}
                    alt={settings?.company_name || "Porcelane"}
                    className="h-20 w-auto max-w-[280px] object-contain object-left"
                  />
                  {settings?.logo_url && settings?.company_name && (
                    <div className="font-display text-lg font-bold text-stone-950 tracking-tight">{settings.company_name}</div>
                  )}
                  <div className="text-[10.5pt] text-stone-600 leading-snug">
                    {settings?.address}
                    {settings?.address && <br />}
                    {[settings?.phone, settings?.email].filter(Boolean).join(" · ")}
                    {settings?.cnpj && <><br />CNPJ: {settings.cnpj}</>}
                  </div>
                </div>

                <div className="text-right shrink-0 min-w-[180px]">
                  <div className="text-[10pt] uppercase tracking-widest text-gold-low font-bold">Romaneio de Entrega</div>
                  <div className="font-display text-3xl font-bold leading-none mt-1">
                    {`ROM-PED${String(order.number).padStart(6, "0")}`}
                  </div>
                  <div className="text-[11pt] text-stone-600 mt-2">
                    {new Date(romaneioDate + "T00:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </div>
                </div>
              </header>

              <section className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12pt] mb-6 border-b border-stone-200 pb-4">
                <PdfField label="Cliente" v={data.client_name} editable />
                <PdfField label="Telefone" v={data.client_phone} editable />
                <PdfField label="Endereço da obra" v={data.address} editable />
                <PdfField label="Cidade" v={data.city} editable />
                <PdfField label="Vendedor" v={sellerName} editable />
                <PdfField label="Arquiteto" v={data.architect ?? ""} editable />
              </section>
            </>
          )}

          {renderEnvs.map((env) => (
            <section key={env.id} className="mb-6">
              <div className="border-b border-stone-300 pb-1 mb-2">
                <div className="font-display text-lg font-bold">{env.name}</div>
                {env.material_name && (
                  <div className="text-[12pt] text-stone-600 mt-0.5">Material: {env.material_name}</div>
                )}
              </div>
              <table className="w-full text-[11pt]">
                <thead>
                  <tr className="text-[10pt] uppercase tracking-wider text-stone-500 border-b border-stone-200">
                    {mode === "romaneio" && <th className="text-center py-1 font-bold w-6">✓</th>}
                    <th className="text-left py-1 font-bold">Descrição</th>
                    <th className="text-right py-1 font-bold w-14">Qtde</th>
                    <th className="text-right py-1 font-bold w-16">Comp.</th>
                    <th className="text-right py-1 font-bold w-16">Larg.</th>
                    {!data.hide_env_m2 && <th className="text-right py-1 font-bold w-14">m²</th>}
                    {mode === "pedido" && <th className="text-right py-1 font-bold w-24">Valor</th>}
                  </tr>
                </thead>
                <tbody>
                  {env.items.map((it) => (
                    <tr key={it.id} className="border-b border-stone-100">
                      {mode === "romaneio" && <td className="text-center"><span className="inline-block size-3 border border-stone-400" /></td>}
                      <td
                        className={`py-1.5 ${mode === "romaneio" ? "no-print-outline print:bg-transparent" : ""}`}
                        contentEditable={mode === "romaneio"}
                        suppressContentEditableWarning
                      >
                        {/L\s*·\s*Lado/i.test(it.description || "") && <span className="inline-block text-[8pt] uppercase tracking-widest font-bold text-stone-500 mr-1.5 border border-stone-300 px-1">L</span>}
                        {it.description}
                        {it.has_emenda && <span className="text-[10pt] text-stone-500 italic"> · com emenda{it.emenda_position ? ` (${it.emenda_position})` : ""}</span>}
                        {data.show_item_finishes !== false && (
                          <ItemFinishInline item={it} env={env} finishTypes={catalog.finish_types} />
                        )}
                      </td>
                      <td
                        className={`text-right font-mono ${mode === "romaneio" ? "no-print-outline print:bg-transparent" : ""}`}
                        contentEditable={mode === "romaneio"}
                        suppressContentEditableWarning
                      >
                        {itemQty(it)}
                      </td>
                      <td className="text-right font-mono">{num(it.length, 3)}</td>
                      <td className="text-right font-mono">{num(it.width, 3)}</td>
                      {!data.hide_env_m2 && <td className="text-right font-mono">{num(itemArea(it), 3)}</td>}
                      {mode === "pedido" && <td className="text-right font-mono">{brl(itemTotal(it, env))}</td>}
                    </tr>
                  ))}
                  {mode === "pedido" && env.services.map((l) => {
                    const descCols = data.hide_env_m2 ? 3 : 4;
                    return (
                      <tr key={l.id} className="border-b border-stone-100">
                        <td className="py-1.5 italic text-stone-700" colSpan={descCols}>{l.description} ({l.qty}×)</td>
                        <td></td>
                        <td className="text-right font-mono">{brl(l.qty * l.unit_value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {mode === "pedido" && (
                  <tfoot>
                    <tr>
                      <td colSpan={data.hide_env_m2 ? 4 : 5} className="text-right text-[10pt] tracking-wider font-bold pt-2">Subtotal {env.name}</td>
                      <td className="text-right font-mono font-bold pt-2">{brl(envTotal(env))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </section>
          ))}

          {data.show_item_finishes !== false && (
            <FinishesLegendSummary environments={renderEnvs} finishTypes={catalog.finish_types} />
          )}


          {mode === "pedido" ? (
            <>
              {(() => {
                const allSupplies = mergeSupplies([
                  ...(data.quote_supplies ?? []),
                  ...renderEnvs.flatMap((e) => e.supplies ?? []),
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
                          <td className="text-right font-mono w-20">{num(l.qty)}×</td>
                          <td className="text-right font-mono w-24">{brl(l.unit_value)}</td>
                          <td className="text-right font-mono w-28 font-bold">{brl(l.qty * l.unit_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="text-right text-[10pt] uppercase tracking-wider font-bold pt-2">Total insumos</td>
                        <td className="text-right font-mono font-bold pt-2">{brl(total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </section>
                );
              })()}

              <DocBottomLayout
                className="mt-8"
                summaryRows={[
                  { label: "Subtotal dos ambientes", value: brl(totals.productsTotal + totals.servicesSum) },
                  ...(totals.freight > 0 ? [{ label: `Frete${data.freight?.qty ? ` (${data.freight.qty}× ${brl(data.freight.unit_value)})` : ""}`, value: brl(totals.freight) }] : []),
                  ...(totals.mfcPickup > 0 ? [{ label: "Valor de coleta", value: brl(totals.mfcPickup) }] : []),
                  ...(totals.installation > 0 ? [{ label: "Instalação", value: brl(totals.installation) }] : []),
                  ...(totals.baseboardInstall > 0 ? [{ label: "Instalação rodapé pós móvel", value: brl(totals.baseboardInstall) }] : []),
                  ...(totals.baseboardFreight > 0 ? [{ label: "Frete rodapé pós móvel", value: brl(totals.baseboardFreight) }] : []),
                  ...(totals.discountValue > 0 && !data.discount?.hide_on_pdf ? [{ label: "Desconto", value: `- ${brl(totals.discountValue)}` }] : []),
                ]}
                total={brl(totals.total)}
                totalHint={(data.delivery?.days ?? 0) > 0 && data.delivery?.mode !== "instalacao"
                  ? `Prazo de entrega: ${data.delivery!.days} ${data.delivery!.days_type === "uteis" ? "dias úteis" : "dias corridos"}`
                  : undefined}
                payment={data.payment}
                totals={{ total: totals.total, entry: totals.entry, balance: totals.balance, methodBreakdown: totals.methodBreakdown }}
                infoLines={[
                  ...clauses.map((c, i) => `${i + 1}. ${c.title ? `${c.title} — ` : ""}${c.content}`),
                  ...((settings?.quote_terms ?? "").split("\n").map((l) => l.trim()).filter(Boolean)),
                ]}
                notes={data.notes}
                clientName={data.client_name}
                consultant={sellerName || data.external_salesperson}
                date={fmtDate(order.created_at)}
                intro="Declaro ter lido e aceito integralmente as condições e os termos deste pedido, autorizando o início do processo."
              />

            </>

          ) : (
            <>
              <section className="mt-8 border-t-2 border-stone-950 pt-4">
                <h4 className="text-[11pt] uppercase tracking-widest font-bold mb-2">Resumo de materiais</h4>
                <table className="w-full text-[11pt]">
                  <thead>
                    <tr className="text-[10pt] uppercase text-stone-500">
                      <th className="text-left">Material</th>
                      <th className="text-right">Área (m²)</th>
                      <th className="text-center">Conferido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialSummary({ ...data, environments: renderEnvs }).map((s) => (
                      <tr key={s.material} className="border-b border-stone-100">
                        <td className="py-1.5">{s.material}</td>
                        <td className="text-right font-mono">{num(s.area)}</td>
                        <td className="text-center"><span className="inline-block size-3 border border-stone-400" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-6 grid grid-cols-2 gap-2 text-[11pt]">
                  <div><strong>Total de peças:</strong> {renderEnvs.reduce((s, e) => s + e.items.reduce((a, i) => a + itemQty(i), 0), 0)}</div>
                  <div><strong>Área total:</strong> {num(renderEnvs.reduce((s, e) => s + envArea(e), 0))} m²</div>
                </div>
              </section>
              {selectedSupplies.length > 0 && (
                <section className="mt-6 pt-4 border-t border-stone-300">
                  <h4 className="text-[11pt] uppercase tracking-widest font-bold mb-2">Insumos a entregar</h4>
                  <table className="w-full text-[11pt]">
                    <thead>
                      <tr className="text-[10pt] uppercase text-stone-500 border-b border-stone-200">
                        <th className="text-center w-6">✓</th>
                        <th className="text-left">Insumo</th>
                        <th className="text-left w-32">Origem</th>
                        <th className="text-right w-16">Qtde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSupplies.map((s) => (
                        <tr key={s.key} className="border-b border-stone-100">
                          <td className="text-center"><span className="inline-block size-3 border border-stone-400" /></td>
                          <td className="py-1.5">{s.line.description}</td>
                          <td className="text-stone-600">{s.from}</td>
                          <td
                            className="text-right font-mono no-print-outline print:bg-transparent"
                            contentEditable
                            suppressContentEditableWarning
                          >{s.line.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
            </>
          )}

          {mode === "romaneio" ? (
            <section className="pdf-sign-block mt-12 text-center text-[11pt]">
              <div className="border-t border-stone-400 pt-2 max-w-xs mx-auto">Recebido por (cliente)</div>
            </section>
          ) : mode !== "pedido" ? (
            <AcceptanceBlock
              className="mt-6 pt-4 border-t border-stone-300"
              clientName={data.client_name}
              consultant={sellerName || data.external_salesperson}
              date={fmtDate(order.created_at)}
            />
          ) : null}



        </div>

        {mode === "pedido" && (
          <div className="a4-page print-page pdf-guia-page pdf-no-footer">
            <img
              src={guiaCuidados.url}
              alt="Guia de Cuidados e Conservação"
            />
          </div>
        )}
      </div>

        );
      })()}

      {mode === "corte" && corteEnvId && (() => {
        const env = data.environments.find((e) => e.id === corteEnvId);
        if (!env) return null;
        const totalPages = 1 + (env.quick_room ? 2 : 0);
        return (
          <>
          {cortePreview && (
            <div className="no-print fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-sm flex flex-col">
              <div className="flex items-center justify-between gap-4 bg-white border-b border-stone-200 px-4 py-2 shadow">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-widest text-stone-500 font-bold">Pré-visualização — Ordem de Corte</span>
                  <span className="text-xs text-stone-600">PED-{String(order.number).padStart(6, "0")} · {env.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs">
                    <button onClick={() => scrollToCortePage(Math.max(1, cortePage - 1))}
                      disabled={cortePage <= 1}
                      className="px-2 py-1 border border-stone-300 rounded hover:bg-stone-50 disabled:opacity-40">‹</button>
                    <span className="px-2 font-mono">{cortePage}/{totalPages}</span>
                    <button onClick={() => scrollToCortePage(Math.min(totalPages, cortePage + 1))}
                      disabled={cortePage >= totalPages}
                      className="px-2 py-1 border border-stone-300 rounded hover:bg-stone-50 disabled:opacity-40">›</button>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button onClick={() => setCorteZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}
                      className="px-2 py-1 border border-stone-300 rounded hover:bg-stone-50">−</button>
                    <span className="font-mono w-12 text-center">{Math.round(corteZoom * 100)}%</span>
                    <button onClick={() => setCorteZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}
                      className="px-2 py-1 border border-stone-300 rounded hover:bg-stone-50">+</button>
                    <button onClick={() => setCorteZoom(0.7)}
                      className="px-2 py-1 border border-stone-300 rounded hover:bg-stone-50">Reset</button>
                  </div>
                  <button onClick={() => setCortePreview(false)}
                    className="px-3 py-1.5 text-xs border border-stone-300 rounded hover:bg-stone-50">Fechar</button>
                  <button onClick={confirmPrintCorte}
                    className="px-3 py-1.5 text-xs bg-stone-950 text-white rounded hover:bg-stone-800 inline-flex items-center gap-1">
                    <Printer className="size-3" /> Imprimir / PDF
                  </button>
                </div>
              </div>
              <div ref={cortePagesRef} className="flex-1 overflow-auto py-6">
                <div style={{ transform: `scale(${corteZoom})`, transformOrigin: "top center" }} className="origin-top mx-auto" >
                  <div className="flex flex-col items-center gap-6">
          <div className="py-8">
            <div className="a4-page print-page">
              <header className="grid grid-cols-[1fr_auto] items-center gap-6 border-b-2 border-stone-950 pb-5 mb-6">
                <div className="min-w-0 flex flex-col items-start gap-2">
                  <img
                    src={settings?.logo_url || porcelaneLogo.url}
                    alt={settings?.company_name || "Porcelane"}
                    className="h-20 w-auto max-w-[280px] object-contain object-left"
                  />
                  {settings?.logo_url && settings?.company_name && (
                    <div className="font-display text-lg font-bold text-stone-950 tracking-tight">{settings.company_name}</div>
                  )}
                  <div className="text-[10.5pt] text-stone-600 leading-snug">
                    {settings?.address && <>{settings.address}<br /></>}
                    {settings?.phone}{settings?.cnpj && ` · CNPJ: ${settings.cnpj}`}
                  </div>
                </div>

                <div className="text-right shrink-0 min-w-[180px]">
                  <div className="text-[10pt] uppercase tracking-widest text-gold-low font-bold">Ordem de Corte</div>
                  <div className="font-display text-3xl font-bold leading-none mt-1">PED-{String(order.number).padStart(6, "0")}</div>
                  <div className="text-[11pt] text-stone-700 mt-2 leading-snug">
                    <div><span className="text-stone-500">Cliente:</span> <b>{data.client_name || "—"}</b></div>
                    <div><span className="text-stone-500">Ambiente:</span> <b>{env.name}</b></div>
                    {env.material_name && <div><span className="text-stone-500">Material:</span> <b>{env.material_name}</b></div>}
                    <div className="text-stone-500 mt-1">{fmtDate(order.created_at)}</div>
                  </div>
                </div>
              </header>

              {(() => {
                const hideSensitive = env.quick_room?.hide_2d_drawing && env.quick_room?.hide_2d_pieces;
                return (
                  <section className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12pt] mb-6 border-b border-stone-200 pb-4">
                    <PdfField label="Cliente" v={data.client_name} />
                    {!hideSensitive && <PdfField label="Endereço" v={data.address} />}
                    {!hideSensitive && <PdfField label="Cidade" v={data.city} />}
                    {!hideSensitive && <PdfField label="Telefone" v={data.client_phone} />}
                  </section>
                );
              })()}

              <section className="mb-6">
                <div className="border-b-2 border-stone-950 pb-1 mb-3">
                  <div className="font-display text-2xl font-bold">{env.name}</div>
                  {env.material_name && (
                    <div className="text-[12pt] text-stone-600 mt-0.5">Material: {env.material_name}</div>
                  )}
                </div>
                <table className="w-full text-[12pt]">
                  <thead>
                    <tr className="text-[11pt] uppercase tracking-wider text-stone-500 border-b border-stone-300">
                      <th className="text-center py-2 font-bold w-6">✓</th>
                      <th className="text-left py-2 font-bold">Peça</th>
                      <th className="text-right py-2 font-bold w-16">Qtde</th>
                      <th className="text-right py-2 font-bold w-24">Comp. (m)</th>
                      <th className="text-right py-2 font-bold w-24">Larg. (m)</th>
                      <th className="text-center py-2 font-bold w-24">Emenda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {env.items.map((it) => (
                      <tr key={it.id} className="border-b border-stone-200">
                        <td className="text-center py-3"><span className="inline-block size-4 border border-stone-500" /></td>
                        <td className="py-3">
                          {it.description}
                          {it.has_emenda && it.emenda_position && <div className="text-[11pt] italic text-stone-600">Emenda: {it.emenda_position}</div>}
                        </td>
                        <td className="text-right font-mono font-bold py-3">{relQty(it)}</td>
                        <td className="text-right font-mono font-bold py-3">{numMed(relLen(it))}</td>
                        <td className="text-right font-mono font-bold py-3">{numMed(relWid(it))}</td>
                        <td className="text-center py-3">{it.has_emenda ? "Sim" : "—"}</td>
                      </tr>
                    ))}
                    {(env.extra_cut_pieces ?? []).map((it) => (
                      <tr key={it.id} className="border-b border-stone-200 bg-amber-50/30">
                        <td className="text-center py-3"><span className="inline-block size-4 border border-stone-500" /></td>
                        <td className="py-3">
                          <span className="text-[10pt] uppercase tracking-wider font-bold text-amber-800 mr-1">Extra</span>
                          {it.description}
                        </td>
                        <td className="text-right font-mono font-bold py-3">{relQty(it)}</td>
                        <td className="text-right font-mono font-bold py-3">{numMed(relLen(it))}</td>
                        <td className="text-right font-mono font-bold py-3">{numMed(relWid(it))}</td>
                        <td className="text-center py-3">—</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-950">
                      <td colSpan={5} className="text-right text-[11pt] uppercase tracking-wider font-bold pt-3">Área total liberada</td>
                      <td className="text-right font-mono font-bold pt-3">{numMed(relEnvArea(env))} m²</td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="text-right text-[11pt] uppercase tracking-wider font-bold pt-1">Total de peças</td>
                      <td className="text-right font-mono font-bold pt-1">{env.items.reduce((s, it) => s + relQty(it), 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </section>


              <section className="mt-12 text-[11pt]">
                <div className="border border-stone-950 p-3 mb-6">
                  <div className="text-[10pt] uppercase tracking-widest text-stone-600 font-bold mb-1">Cortador responsável</div>
                  <div className="h-6 border-b border-stone-950"></div>
                </div>
                <div className="grid grid-cols-2 gap-12 text-center">
                  <div className="border-t border-stone-400 pt-2">Liberação técnica</div>
                  <div className="border-t border-stone-400 pt-2">Conferido — Corte</div>
                </div>
              </section>

            </div>

            {env.quick_room && (
              <QuickRoomPrintPages
                value={env.quick_room}
                materials={catalog.materials}
                finishTypes={catalog.finish_types}
                items={releasedItemsFor2D(env)}
                docInfo={{
                  companyName: settings?.company_name,
                  orderNumber: order ? `PED-${String(order.number).padStart(6, "0")}` : undefined,
                  clientName: data.client_name,
                  clientPhone: data.client_phone,
                  address: data.address,
                  city: data.city,
                  envName: env.name,
                  materialName: env.material_name,
                }}
              />

            )}

          </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {!cortePreview && (
          <div className="py-8">
            <div className="a4-page print-page">
              <header className="grid grid-cols-[1fr_auto] items-center gap-6 border-b-2 border-stone-950 pb-5 mb-6">
                <div className="min-w-0 flex flex-col items-start gap-2">
                  <img
                    src={settings?.logo_url || porcelaneLogo.url}
                    alt={settings?.company_name || "Porcelane"}
                    className="h-20 w-auto max-w-[280px] object-contain object-left"
                  />
                  {settings?.logo_url && settings?.company_name && (
                    <div className="font-display text-lg font-bold text-stone-950 tracking-tight">{settings.company_name}</div>
                  )}
                  <div className="text-[10.5pt] text-stone-600 leading-snug">
                    {settings?.address && <>{settings.address}<br /></>}
                    {settings?.phone}{settings?.cnpj && ` · CNPJ: ${settings.cnpj}`}
                  </div>
                </div>

                <div className="text-right shrink-0 min-w-[180px]">
                  <div className="text-[10pt] uppercase tracking-widest text-gold-low font-bold">Ordem de Corte</div>
                  <div className="font-display text-3xl font-bold leading-none mt-1">PED-{String(order.number).padStart(6, "0")}</div>
                  <div className="text-[11pt] text-stone-600 mt-2">{fmtDate(order.created_at)}</div>
                </div>
              </header>
              {(() => {
                const hideSensitive = env.quick_room?.hide_2d_drawing && env.quick_room?.hide_2d_pieces;
                return (
                  <section className="grid grid-cols-2 gap-x-8 gap-y-2 text-[12pt] mb-6 border-b border-stone-200 pb-4">
                    <PdfField label="Cliente" v={data.client_name} />
                    {!hideSensitive && <PdfField label="Endereço" v={data.address} />}
                    {!hideSensitive && <PdfField label="Cidade" v={data.city} />}
                    {!hideSensitive && <PdfField label="Telefone" v={data.client_phone} />}
                  </section>
                );
              })()}
              <section className="mb-6">
                <div className="border-b-2 border-stone-950 pb-1 mb-3">
                  <div className="font-display text-2xl font-bold">{env.name}</div>
                  {env.material_name && (
                    <div className="text-[12pt] text-stone-600 mt-0.5">Material: {env.material_name}</div>
                  )}
                </div>
                <table className="w-full text-[12pt]">
                  <thead>
                    <tr className="text-[11pt] uppercase tracking-wider text-stone-500 border-b border-stone-300">
                      <th className="text-center py-2 font-bold w-6">✓</th>
                      <th className="text-left py-2 font-bold">Peça</th>
                      <th className="text-right py-2 font-bold w-16">Qtde</th>
                      <th className="text-right py-2 font-bold w-24">Comp. (m)</th>
                      <th className="text-right py-2 font-bold w-24">Larg. (m)</th>
                      <th className="text-center py-2 font-bold w-24">Emenda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {env.items.map((it) => (
                      <tr key={it.id} className="border-b border-stone-200">
                        <td className="text-center py-3"><span className="inline-block size-4 border border-stone-500" /></td>
                        <td className="py-3">
                          {it.description}
                          {it.has_emenda && it.emenda_position && <div className="text-[11pt] italic text-stone-600">Emenda: {it.emenda_position}</div>}
                        </td>
                        <td className="text-right font-mono font-bold py-3">{relQty(it)}</td>
                        <td className="text-right font-mono font-bold py-3">{numMed(relLen(it))}</td>
                        <td className="text-right font-mono font-bold py-3">{numMed(relWid(it))}</td>
                        <td className="text-center py-3">{it.has_emenda ? "Sim" : "—"}</td>
                      </tr>
                    ))}
                    {(env.extra_cut_pieces ?? []).map((it) => (
                      <tr key={it.id} className="border-b border-stone-200 bg-amber-50/30">
                        <td className="text-center py-3"><span className="inline-block size-4 border border-stone-500" /></td>
                        <td className="py-3">
                          <span className="text-[10pt] uppercase tracking-wider font-bold text-amber-800 mr-1">Extra</span>
                          {it.description}
                        </td>
                        <td className="text-right font-mono font-bold py-3">{relQty(it)}</td>
                        <td className="text-right font-mono font-bold py-3">{numMed(relLen(it))}</td>
                        <td className="text-right font-mono font-bold py-3">{numMed(relWid(it))}</td>
                        <td className="text-center py-3">—</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-950">
                      <td colSpan={5} className="text-right text-[11pt] uppercase tracking-wider font-bold pt-3">Área total liberada</td>
                      <td className="text-right font-mono font-bold pt-3">{numMed(relEnvArea(env))} m²</td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="text-right text-[11pt] uppercase tracking-wider font-bold pt-1">Total de peças</td>
                      <td className="text-right font-mono font-bold pt-1">{env.items.reduce((s, it) => s + relQty(it), 0)}</td>
                    </tr>
                  </tfoot>
                </table>
              </section>

              <section className="mt-12 text-[11pt]">
                <div className="border border-stone-950 p-3 mb-6">
                  <div className="text-[10pt] uppercase tracking-widest text-stone-600 font-bold mb-1">Cortador responsável</div>
                  <div className="h-6 border-b border-stone-950"></div>
                </div>
                <div className="grid grid-cols-2 gap-12 text-center">
                  <div className="border-t border-stone-400 pt-2">Liberação técnica</div>
                  <div className="border-t border-stone-400 pt-2">Conferido — Corte</div>
                </div>
              </section>

            </div>
            {env.quick_room && (
              <QuickRoomPrintPages
                value={env.quick_room}
                materials={catalog.materials}
                finishTypes={catalog.finish_types}
                items={releasedItemsFor2D(env)}
                docInfo={{
                  companyName: settings?.company_name,
                  orderNumber: order ? `PED-${String(order.number).padStart(6, "0")}` : undefined,
                  clientName: data.client_name,
                  clientPhone: data.client_phone,
                  address: data.address,
                  city: data.city,
                  envName: env.name,
                  materialName: env.material_name,
                }}
              />

            )}

          </div>
          )}
          </>
        );
      })()}
      {pixOpen && (
        <PixModal
          open={pixOpen}
          onClose={() => setPixOpen(false)}
          chavePix={settings?.pix_key || "porcelane.roxane@gmail.com"}
          beneficiario={settings?.pix_beneficiary_name || settings?.company_name || "PORCELANE"}
          cidade={settings?.pix_city || "RECIFE"}
          valor={totals.entry}
          descricao={`Entrada Pedido ${String(order?.number ?? "").padStart(4, "0")}`}
          txid={pixTxid}
          telefoneCliente={data.client_phone}
          nomeCliente={data.client_name || undefined}
          onPagamentoConfirmado={async (tx) => {
            try {
              const { data: recs } = await supabase
                .from("receivables")
                .select("id, amount, pix_txid, installment_no, status")
                .eq("order_id", order.id)
                .order("installment_no", { ascending: true })
                .limit(1);
              const rec = recs?.[0];
              if (!rec) { toast.error("Parcela de entrada não encontrada."); return; }
              const { error } = await supabase.from("receivables").update({
                status: "recebido",
                paid_amount: rec.amount,
                paid_at: new Date().toISOString(),
                method: "pix",
                pix_txid: rec.pix_txid || tx,
              }).eq("id", rec.id);
              if (error) throw error;
              toast.success("Baixa registrada no financeiro.");
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              toast.error(`Erro ao dar baixa: ${msg}`);
            }
          }}
        />
      )}
      {guard.dialog}
    </div>
  );
}



function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={"px-4 py-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 border " +
        (active ? "bg-stone-950 text-white border-stone-950" : "border-stone-300 hover:bg-stone-100")}>
      {icon} {children}
    </button>
  );
}

function AttachmentList({ items, onOpen, onRemove, icon }: {
  items: Attachment[]; onOpen: (a: Attachment) => void; onRemove: (a: Attachment) => void; icon: React.ReactNode;
}) {
  if (items.length === 0) return <p className="text-sm text-stone-400">Nenhum arquivo.</p>;
  return (
    <ul className="space-y-1">
      {items.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-2 text-sm border-b border-stone-100 py-2">
          <button onClick={() => onOpen(a)} className="flex-1 text-left flex items-center gap-2 hover:text-gold-high">
            {icon}<span className="truncate">{a.name}</span>
          </button>
          <button onClick={() => onRemove(a)} className="text-stone-400 hover:text-red-500"><Trash2 className="size-3" /></button>
        </li>
      ))}
    </ul>
  );
}

function PdfField({ label, v, editable }: { label: string; v: string; editable?: boolean }) {
  return (
    <div>
      <div className="text-[9pt] uppercase tracking-widest text-stone-500 font-bold">{label}</div>
      <div
        contentEditable={editable || undefined}
        suppressContentEditableWarning
        className={editable ? "no-print-outline outline-none focus:bg-amber-50 print:bg-transparent" : undefined}
      >
        {v || "—"}
      </div>
    </div>
  );
}
