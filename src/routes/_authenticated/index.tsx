import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, GripVertical, Clock, User as UserIcon } from "lucide-react";
import { emptyQuoteData, type QuoteData, type Environment } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

type KanbanOrder = { id: string; number: number; client_name: string; data: QuoteData };
type KanbanCard = { orderId: string; orderNumber: number; clientName: string; envId: string; envName: string; material: string };

const KANBAN_COLS: {
  key: NonNullable<Environment["production_status"]>;
  label: string;
  badge: string;
  dot: string;
}[] = [
  { key: "liberado",       label: "Liberado",       badge: "kanban-badge-neutro",     dot: "bg-stone-300" },
  { key: "em_corte",       label: "Em corte",       badge: "kanban-badge-andamento",  dot: "bg-gold-low" },
  { key: "em_acabamento",  label: "Em acabamento",  badge: "kanban-badge-andamento",  dot: "bg-gold-high" },
  { key: "concluido",      label: "Concluído",      badge: "kanban-badge-positivo",   dot: "bg-stone-950" },
];


function elapsedShort(from?: string, to?: string) {
  if (!from) return null;
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [me, setMe] = useState<string>("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", u.user.id)
        .maybeSingle();
      setMe((p?.full_name || p?.email || u.user.email || "").split("@")[0]);
    })();
  }, []);

  // Atualização em tempo real (broadcast das mudanças em orders)
  useEffect(() => {
    const ch = supabase
      .channel("kanban-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => qc.invalidateQueries({ queryKey: ["dashboard-kanban"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  // Tick a cada 60s para atualizar os cronômetros exibidos
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const { data: orders } = useQuery({
    queryKey: ["dashboard-kanban"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, client_name, data")
        .not("status", "in", '("finalizado","cancelado")')
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as KanbanOrder[];
    },
    refetchInterval: 15000,
  });
  void tick;

  const newQuote = async (type: "convencional" | "mfc") => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from("quotes")
      .insert({
        user_id: u.user.id, number: 0, type, status: "rascunho",
        client_name: "", total: 0, data: emptyQuoteData() as never,
      })
      .select("id")
      .single();
    if (error) { toast.error(error.message); return; }
    navigate({ to: "/orcamentos/$id", params: { id: data.id } });
  };

  const allCards: KanbanCard[] = useMemo(() => {
    const list: KanbanCard[] = [];
    for (const o of orders ?? []) {
      for (const env of o.data?.environments ?? []) {
        list.push({
          orderId: o.id, orderNumber: o.number, clientName: o.client_name,
          envId: env.id, envName: env.name, material: env.material_name || "—",
        });
      }
    }
    return list;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCards;
    return allCards.filter((c) =>
      String(c.orderNumber).includes(q) ||
      `ped-${String(c.orderNumber).padStart(6, "0")}`.toLowerCase().includes(q) ||
      c.clientName.toLowerCase().includes(q) ||
      c.envName.toLowerCase().includes(q) ||
      c.material.toLowerCase().includes(q),
    );
  }, [allCards, search]);

  const findCardEnv = (orderId: string, envId: string) => {
    const order = (orders ?? []).find((o) => o.id === orderId);
    if (!order) return null;
    const envs = order.data?.environments ?? [];
    const idx = envs.findIndex((e) => e.id === envId);
    if (idx < 0) return null;
    return { order, envs, idx };
  };

  const onDrop = async (target: NonNullable<Environment["production_status"]>, payload: string) => {
    setDragId(null); setOverCol(null);
    const [orderId, envId] = payload.split("::");
    const found = findCardEnv(orderId, envId);
    if (!found) return;
    const env = found.envs[found.idx];
    if ((env.production_status ?? "liberado") === target) return;

    const now = new Date().toISOString();
    const patch: Partial<Environment> = {
      production_status: target,
      moved_by_name: me || undefined,
      moved_by_at: now,
    };
    if (target === "em_corte") {
      if (!env.cut_started_at) patch.cut_started_at = now;
      if (me && !env.cut_by_name) patch.cut_by_name = me;
    }
    if (target === "em_acabamento") {
      if (!env.cut_done_at) patch.cut_done_at = now;
      if (!env.finish_started_at) patch.finish_started_at = now;
      if (me && !env.finish_by_name) patch.finish_by_name = me;
    }
    if (target === "concluido") {
      if (!env.finish_done_at) patch.finish_done_at = now;
      if (!env.cut_done_at) patch.cut_done_at = now;
    }

    const newEnvs = [...found.envs];
    newEnvs[found.idx] = { ...env, ...patch };
    const newData = { ...found.order.data, environments: newEnvs };

    // Optimistic
    qc.setQueryData<KanbanOrder[]>(["dashboard-kanban"], (prev) =>
      (prev ?? []).map((o) => (o.id === orderId ? { ...o, data: newData } : o)),
    );

    const { error } = await supabase.from("orders").update({ data: newData }).eq("id", orderId);
    if (error) {
      toast.error("Falha ao mover: " + error.message);
      qc.invalidateQueries({ queryKey: ["dashboard-kanban"] });
    } else {
      toast.success(`${env.name} → ${KANBAN_COLS.find((c) => c.key === target)?.label}`);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="label-eyebrow">Porcelane Leyalt</p>
          <h1 className="font-display text-4xl mt-1">Produção</h1>
          <p className="text-xs text-stone-500 mt-1">Arraste os cartões entre as colunas para atualizar a etapa.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => newQuote("convencional")}
            className="bg-stone-950 text-white px-4 py-2.5 flex items-center gap-2 hover:bg-stone-800 text-sm">
            <Plus className="size-4" /> Orçamento
          </button>
          <button onClick={() => newQuote("mfc")}
            className="bg-white border border-stone-300 text-stone-950 px-4 py-2.5 flex items-center gap-2 hover:bg-stone-50 text-sm">
            <Plus className="size-4" /> MFC
          </button>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          autoFocus
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nº do pedido, código ou cliente…"
          className="w-full bg-white border border-stone-300 pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-stone-950"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
            {filtered.length} resultado{filtered.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {KANBAN_COLS.map((col) => {
          const list = filtered.filter((c) => {
            const order = orders?.find((o) => o.id === c.orderId);
            const env = order?.data?.environments?.find((e) => e.id === c.envId);
            return (env?.production_status ?? "liberado") === col.key;
          });
          const isOver = overCol === col.key;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={() => setOverCol((v) => (v === col.key ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) onDrop(col.key, id);
              }}
              className={`kanban-col kanban-col-tecnica min-h-[400px] ${isOver ? "ring-2 ring-gold-low/60 ring-offset-2 ring-offset-background" : ""}`}
            >
              <div className="kanban-col-head">
                <p className="flex items-center gap-2 truncate">
                  <span className={`size-2 rounded-full ${col.dot}`} />
                  {col.label}
                </p>
                <span className="kanban-count">{list.length}</span>
              </div>

              <div className="space-y-2">
                {list.length === 0 && (
                  <p className="text-[11px] text-stone-400 italic text-center py-8">
                    {search ? "Sem resultados" : "vazio"}
                  </p>
                )}
                {list.map((c) => {
                  const dragKey = `${c.orderId}::${c.envId}`;
                  const isDragging = dragId === dragKey;
                  const order = orders?.find((o) => o.id === c.orderId);
                  const env = order?.data?.environments?.find((e) => e.id === c.envId);
                  const status = (env?.production_status ?? "liberado") as NonNullable<Environment["production_status"]>;

                  // Etapa atual: quem é responsável + tempo
                  let respName: string | undefined;
                  let respLabel = "";
                  let startedAt: string | undefined;
                  let finishedAt: string | undefined;
                  if (status === "em_corte") {
                    respName = env?.cut_by_name; respLabel = "Cortador";
                    startedAt = env?.cut_started_at;
                  } else if (status === "em_acabamento") {
                    respName = env?.finish_by_name; respLabel = "Acabador";
                    startedAt = env?.finish_started_at;
                  } else if (status === "concluido") {
                    respName = env?.finish_by_name || env?.cut_by_name; respLabel = "Finalizado por";
                    startedAt = env?.cut_started_at;
                    finishedAt = env?.finish_done_at;
                  } else {
                    respName = env?.moved_by_name; respLabel = "Liberado por";
                  }
                  const elapsed = elapsedShort(startedAt, finishedAt);

                  return (
                    <div
                      key={dragKey}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", dragKey);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(dragKey);
                      }}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      className={`kanban-card cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="size-3 text-stone-300 mt-1 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              to="/pedidos/$id" params={{ id: c.orderId }}
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="kanban-order hover:text-gold-high truncate"
                            >
                              PED-{String(c.orderNumber).padStart(6, "0")}
                            </Link>
                            <span className={`kanban-badge ${col.badge}`}>{col.label}</span>
                          </div>
                          <p className="text-xs font-semibold truncate mt-1">
                            <span>{c.clientName || "—"}</span>
                            <span className="text-stone-400 font-normal"> — </span>
                            <span>{c.envName}</span>
                          </p>
                          <p className="kanban-meta truncate">{c.material}</p>



                          {(respName || elapsed) && (
                            <div className="mt-2 pt-2 border-t border-stone-100 space-y-0.5">
                              {respName && (
                                <p className="text-[10px] flex items-center gap-1 text-stone-600 truncate">
                                  <UserIcon className="size-2.5 shrink-0" />
                                  <span className="font-medium">{respLabel}:</span> {respName}
                                </p>
                              )}
                              {startedAt && (
                                <p className="text-[10px] flex items-center gap-1 text-stone-500 truncate">
                                  <Clock className="size-2.5 shrink-0" />
                                  {status === "concluido" && finishedAt
                                    ? `Concluído ${fmtDateTime(finishedAt)}`
                                    : `Início ${fmtDateTime(startedAt)}${elapsed ? ` · ${elapsed}` : ""}`}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
