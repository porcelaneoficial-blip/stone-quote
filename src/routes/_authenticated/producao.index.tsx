import { todayISO } from "@/lib/format";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMyRoles } from "@/lib/roles";
import { useAuth } from "@/lib/auth-context";

import type { Environment, QuoteData, KanbanStage } from "@/lib/types";
import {
  ChevronRight,
  ChevronLeft,
  PackageCheck,
  Truck,
  Camera,
  X,
  Upload,
  ShieldCheck,
  Scissors,
  Sparkles,
  ClipboardList,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/producao/")({
  head: () => ({
    meta: [
      { title: "Produção — Kanban Porcelane" },
      { name: "description", content: "Quadro Kanban: autorização da diretoria, corte, acabamento, entrega/retirada e instalação." },
    ],
  }),
  component: ProducaoKanban,
});

type Order = {
  id: string;
  number: number;
  client_name: string;
  status: string;
  data: QuoteData & Record<string, unknown> & {
    diretoria_autorizado_at?: string | null;
    diretoria_autorizado_by?: string | null;
  };
  diretoria_autorizado_at?: string | null;
  diretoria_autorizado_by?: string | null;
};

type Employee = { id: string; name: string; role: string; active: boolean };

type Photo = {
  id: string;
  order_id: string;
  url: string;
  description: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

// 5 colunas de exibição (identidade Porcelane, sem cores fortes)
type ColKey = "aguardando" | "corte" | "acabamento" | "concluido" | "instalacao";

const COLS: {
  key: ColKey;
  label: string;
  icon: typeof Truck;
  desc: string;
}[] = [
  { key: "aguardando", label: "Aguardando autorização", icon: ShieldCheck, desc: "Diretoria precisa autorizar" },
  { key: "corte", label: "Em corte", icon: Scissors, desc: "Fila e execução de corte" },
  { key: "acabamento", label: "Em acabamento", icon: Sparkles, desc: "Polimento e acabamentos" },
  { key: "concluido", label: "Concluído / Frete / Entrega / Retirada", icon: PackageCheck, desc: "Pronto para expedição" },
  { key: "instalacao", label: "Instalação", icon: Camera, desc: "Registro fotográfico obrigatório" },
];

function deliveryMode(o: Order): string | null {
  return (o.data?.delivery_mode as string) ?? null;
}

const STAGE_TO_COL: Record<string, ColKey | null> = {
  aguardando_diretoria: "aguardando",
  em_corte: "corte",
  em_acabamento: "acabamento",
  pronto_instalacao: "concluido",
  instalacao: "instalacao",
  finalizado: null,
};

const COL_TO_STAGE: Record<ColKey, KanbanStage> = {
  aguardando: "aguardando_diretoria" as KanbanStage,
  corte: "em_corte" as KanbanStage,
  acabamento: "em_acabamento" as KanbanStage,
  concluido: "pronto_instalacao" as KanbanStage,
  instalacao: "instalacao" as KanbanStage,
};

function envLatestTs(envs: Environment[]): number {
  let max = 0;
  for (const e of envs) {
    for (const iso of [e.released_for_cut_at, e.cut_done_at, e.finish_done_at]) {
      if (!iso) continue;
      const t = new Date(iso as string).getTime();
      if (t > max) max = t;
    }
  }
  return max;
}

function displayCol(o: Order): ColKey | null {
  // Pedido concluído/entregue/cancelado sai do quadro
  if (["finalizado", "concluido", "entregue", "cancelado"].includes(o.status)) return null;

  const authorized = !!(o.diretoria_autorizado_at ?? o.data?.diretoria_autorizado_at);
  const envs: Environment[] = (o.data?.environments as Environment[]) ?? [];
  const releasable = envs.filter((e) => e.released_for_cut_at);

  const explicit = o.data?.kanban_stage as KanbanStage | undefined;

  // Sai do quadro quando finalizado (obra concluída)
  if (explicit === "finalizado" || o.data?.fulfillment_done_at) return null;

  // Movimentação manual (arrastar) prevalece enquanto for mais recente que a produção
  const movedAt = o.data?.kanban_moved_at ? new Date(o.data.kanban_moved_at as string).getTime() : 0;
  if (explicit && movedAt && movedAt >= envLatestTs(envs)) {
    const manual = STAGE_TO_COL[explicit as string];
    if (manual !== undefined) return manual;
  }

  // Sem autorização E sem release formal → fora do quadro
  if (!authorized && releasable.length === 0) return null;

  // Autorizado mas sem release ainda → aguardando
  if (!authorized) return "aguardando";
  if (releasable.length === 0) return "aguardando";

  if (explicit === "instalacao") return "instalacao";
  if (explicit === "pronto_instalacao") return "concluido";

  const allDone = releasable.every((e) => e.production_status === "concluido");
  if (allDone) return "concluido";
  if (releasable.some((e) => e.production_status === "em_acabamento")) return "acabamento";
  if (releasable.some((e) => e.production_status === "em_corte" || e.production_status === "liberado")) return "corte";
  return "corte";
}


function deadlineBadge(o: Order): { label: string; className: string } | null {
  const iso = (o.data?.delivery_date as string) ?? (o.data?.installation_date as string) ?? null;
  if (!iso) return null;
  const target = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  const diffMs = target.getTime() - Date.now();
  const days = Math.floor(diffMs / (24 * 3600 * 1000));
  if (days < 0) return { label: `atrasado ${Math.abs(days)}d`, className: "kanban-badge-alerta" };
  if (days === 0) return { label: "hoje", className: "kanban-badge-andamento" };
  if (days === 1) return { label: "1 dia", className: "kanban-badge-andamento" };
  if (days <= 3) return { label: `${days} dias`, className: "kanban-badge-neutro" };
  return null;
}


function ProducaoKanban() {
  const qc = useQueryClient();
  const { isAdmin } = useMyRoles();
  const { user } = useAuth();

  const [from, setFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => todayISO());
  const [installOrderId, setInstallOrderId] = useState<string | null>(null);

  const { data: orders } = useQuery({
    queryKey: ["producao-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, number, client_name, status, data, diretoria_autorizado_at, diretoria_autorizado_by")
        .not("status", "in", '("cancelado")')
        .order("number", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-producao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, role, active")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
  });

  const { data: photos } = useQuery({
    queryKey: ["install-photos-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installation_photos" as never)
        .select("id, order_id, url, description, uploaded_by_name, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Photo[];
    },
  });

  const photoCountByOrder = useMemo(() => {
    const m = new Map<string, number>();
    (photos ?? []).forEach((p) => m.set(p.order_id, (m.get(p.order_id) ?? 0) + 1));
    return m;
  }, [photos]);

  const empNameById = useMemo(() => {
    const m = new Map<string, string>();
    (employees ?? []).forEach((e) => m.set(e.id, e.name));
    return m;
  }, [employees]);

  const cardsByCol = useMemo(() => {
    const map: Record<ColKey, Order[]> = { aguardando: [], corte: [], acabamento: [], concluido: [], instalacao: [] };
    for (const o of orders ?? []) {
      const c = displayCol(o);
      if (!c) continue;
      map[c].push(o);
    }
    return map;
  }, [orders]);

  const authorize = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders")
        .update({
          diretoria_autorizado_at: new Date().toISOString(),
          diretoria_autorizado_by: "Diretoria",
        } as never)
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["producao-orders"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeAuth = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ diretoria_autorizado_at: null, diretoria_autorizado_by: null } as never)
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["producao-orders"] }),
  });

  const setKanban = useMutation({
    mutationFn: async ({ orderId, stage }: { orderId: string; stage: KanbanStage }) => {
      const order = (orders ?? []).find((o) => o.id === orderId);
      if (!order) throw new Error("Pedido não encontrado");
      const prevStage = order.data?.kanban_stage as KanbanStage | undefined;
      const newData: Record<string, unknown> = {
        ...order.data,
        kanban_stage: stage,
        kanban_moved_at: new Date().toISOString(),
      };

      if (stage === "finalizado" && !order.data?.fulfillment_done_at) {
        newData.fulfillment_done_at = new Date().toISOString();
      }
      if (stage !== "finalizado" && order.data?.fulfillment_done_at) {
        delete (newData as { fulfillment_done_at?: string }).fulfillment_done_at;
      }
      const patch: Record<string, unknown> = { data: newData };
      if (stage === "finalizado") patch.status = "finalizado";
      const { error } = await supabase.from("orders").update(patch as never).eq("id", orderId);
      if (error) throw error;

      // Entrada real na etapa INSTALAÇÃO → apenas histórico (Trello é criado no fechamento).
      if (stage === "instalacao" && prevStage !== "instalacao") {
        const who = user?.email ?? "Sistema";
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          await supabase.from("order_status_history").insert({
            user_id: u.user.id,
            order_id: orderId,
            status: "instalacao",
            notes: `Entrada na etapa Instalação por ${who} em ${new Date().toLocaleString("pt-BR")}`,
          });
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["producao-orders"] }),
    onError: (e: Error) => toast.error(e.message),
  });


  const advance = (o: Order, col: ColKey) => {
    const mode = deliveryMode(o);
    if (col === "concluido") {
      if (mode === "instalacao") {
        setKanban.mutate({ orderId: o.id, stage: "instalacao" });
      } else {
        if (!confirm(`Finalizar pedido PED-${String(o.number).padStart(6, "0")}? Ele sai do Kanban.`)) return;
        setKanban.mutate({ orderId: o.id, stage: "finalizado" });
      }
      return;
    }
    if (col === "instalacao") {
      if ((photoCountByOrder.get(o.id) ?? 0) === 0) {
        toast.error("Adicione ao menos 1 foto do local instalado antes de finalizar.");
        setInstallOrderId(o.id);
        return;
      }
      if (!confirm(`Finalizar obra do pedido PED-${String(o.number).padStart(6, "0")}?`)) return;
      setKanban.mutate({ orderId: o.id, stage: "finalizado" });
    }
  };

  const goBack = (o: Order, col: ColKey) => {
    const back: Record<ColKey, KanbanStage | null> = {
      aguardando: null,
      corte: "aguardando_diretoria",
      acabamento: "em_corte",
      concluido: "em_acabamento",
      instalacao: "pronto_instalacao",
    };
    const target = back[col];
    if (!target) return;
    setKanban.mutate({ orderId: o.id, stage: target });
  };

  // ---- Arrastar e soltar (mouse) ----
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<ColKey | null>(null);

  const dropOn = (col: ColKey) => {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    const o = (orders ?? []).find((x) => x.id === id);
    if (!o) return;
    if (displayCol(o) === col) return;
    if (col === "instalacao" && deliveryMode(o) !== "instalacao" && !confirm("Este pedido não é de instalação. Mover mesmo assim?")) return;
    setKanban.mutate({ orderId: id, stage: COL_TO_STAGE[col] });
  };

  const removeFromBoard = (o: Order) => {
    if (!confirm(`Remover PED-${String(o.number).padStart(6, "0")} do quadro? Ele será marcado como finalizado.`)) return;
    setKanban.mutate({ orderId: o.id, stage: "finalizado" as KanbanStage });
  };



  const productivity = useMemo(() => {
    const map = new Map<string, { name: string; role: string; envs: number; m2: number }>();
    for (const e of employees ?? []) map.set(e.id, { name: e.name, role: e.role, envs: 0, m2: 0 });
    const f = new Date(from + "T00:00:00").getTime();
    const t = new Date(to + "T23:59:59").getTime();
    for (const o of orders ?? []) {
      const envs: Environment[] = (o.data?.environments as Environment[]) ?? [];
      for (const env of envs) {
        if (env.production_status !== "concluido") continue;
        const done = env.finish_done_at ? new Date(env.finish_done_at).getTime() : 0;
        if (done < f || done > t) continue;
        const area = (env.items ?? []).reduce((s, it) => s + (Number(it.length) || 0) * (Number(it.width) || 0), 0);
        if (env.cutter_id && map.has(env.cutter_id)) {
          const r = map.get(env.cutter_id)!; r.envs += 1; r.m2 += area;
        }
        if (env.finisher_id && map.has(env.finisher_id)) {
          const r = map.get(env.finisher_id)!; r.envs += 1; r.m2 += area;
        }
      }
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v })).filter((r) => r.envs > 0);
  }, [orders, employees, from, to]);

  return (
    <div className="max-w-[1800px] mx-auto px-6 py-10 bg-[#FAFAFA] min-h-screen">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl mb-1 text-[#1A1A1A]">Produção</h1>
          <p className="text-[11px] uppercase tracking-widest text-[#4A4A4A]">
            Somente pedidos com liberação formal e autorização da diretoria
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#9B9B9B] mb-1">De</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-[#D9D9D9] px-2 py-1.5 text-sm bg-white" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#9B9B9B] mb-1">Até</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-[#D9D9D9] px-2 py-1.5 text-sm bg-white" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-12">
        {COLS.map((col) => {
          const list = cardsByCol[col.key];
          const Icon = col.icon;
          return (
            <div
              key={col.key}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => { e.preventDefault(); dropOn(col.key); }}
              className={`kanban-col kanban-col-producao min-h-[420px] transition-colors ${
                overCol === col.key ? "ring-2 ring-gold-high/60 bg-[#F4F1EC]" : ""
              }`}
            >

              <div className="kanban-col-head">
                <p className="flex items-center gap-1.5 truncate">
                  <Icon className="size-3.5 text-gold-high" />
                  <span className="truncate">{col.label}</span>
                </p>
                <span className="kanban-count">{list.length}</span>
              </div>

              <div className="space-y-2.5">
                {list.length === 0 && <p className="kanban-meta italic">vazio</p>}

                {list.map((o) => {
                  const envs = ((o.data?.environments as Environment[]) ?? []);
                  const materials = Array.from(new Set(envs.map((e) => e.material_name).filter(Boolean))).slice(0, 2).join(" · ");
                  const mode = deliveryMode(o);
                  const bad = deadlineBadge(o);
                  const releasedBy = (o.data?.released_by as string) ?? (o.data?.tecnica_nome as string) ?? "—";
                  const responsibles = Array.from(new Set(
                    envs.flatMap((e) => [e.cutter_id, e.finisher_id])
                      .filter(Boolean)
                      .map((id) => empNameById.get(id as string) ?? "")
                      .filter(Boolean),
                  )).slice(0, 2).join(", ") || "—";
                  const started = envs.map((e) => e.cut_done_at || e.finish_done_at).filter(Boolean).sort()[0];
                  const finished = envs.map((e) => e.finish_done_at).filter(Boolean).sort().slice(-1)[0];
                  const authorized = !!(o.diretoria_autorizado_at ?? o.data?.diretoria_autorizado_at);
                  const photoCount = photoCountByOrder.get(o.id) ?? 0;
                  const isInstall = col.key === "instalacao";
                  return (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={(e) => { setDragId(o.id); e.dataTransfer.effectAllowed = "move"; }}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      className={`kanban-card text-xs space-y-1.5 cursor-grab active:cursor-grabbing ${
                        dragId === o.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Link to="/pedidos/$id" params={{ id: o.id }} className="kanban-order hover:text-gold-high">
                          PED-{String(o.number).padStart(6, "0")}
                        </Link>
                        <div className="flex items-center gap-1">
                          {bad && <span className={`kanban-badge ${bad.className}`}>{bad.label}</span>}
                          <button
                            onClick={() => removeFromBoard(o)}
                            title="Remover do quadro"
                            className="text-stone-300 hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      </div>

                      <p className="font-semibold truncate text-stone-950">{o.client_name || "—"}</p>
                      {materials && <p className="kanban-meta truncate">{materials}</p>}
                      {mode && (
                        <span className="kanban-badge kanban-badge-neutro">
                          {mode === "instalacao" ? "Instalação" : mode === "entrega" ? "Entrega" : "Retirada"}
                        </span>
                      )}
                      <div className="text-[10px] text-stone-400 space-y-0.5 pt-1.5 border-t border-stone-200">
                        <div>Liberado por: <span className="text-stone-700">{releasedBy}</span></div>
                        <div>Responsável: <span className="text-stone-700">{responsibles}</span></div>
                        {started && <div>Início: {new Date(started).toLocaleString("pt-BR")}</div>}
                        {finished && <div>Fim: {new Date(finished).toLocaleString("pt-BR")}</div>}
                      </div>

                      {col.key === "aguardando" && (
                        <div className="pt-1.5 border-t border-stone-200">
                          {!authorized ? (
                            isAdmin ? (
                              <button onClick={() => authorize.mutate(o.id)} className="kanban-btn-solid w-full">
                                Autorizar produção
                              </button>
                            ) : (
                              <span className="kanban-badge kanban-badge-neutro">aguardando ADM</span>
                            )
                          ) : (
                            <span className="flex items-center gap-1">
                              <span className="kanban-badge kanban-badge-positivo">
                                <ShieldCheck className="size-2.5" /> autorizado
                              </span>
                              {isAdmin && (
                                <button onClick={() => revokeAuth.mutate(o.id)} className="ml-auto text-[9px] text-stone-400 hover:text-destructive underline">
                                  revogar
                                </button>
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      {isInstall && (
                        <button
                          onClick={() => setInstallOrderId(o.id)}
                          className={`kanban-btn w-full flex items-center justify-center gap-1 ${
                            photoCount > 0 ? "" : "kanban-badge-alerta"
                          }`}
                        >
                          <Camera className="size-3" /> {photoCount} foto{photoCount === 1 ? "" : "s"}
                        </button>
                      )}

                      {(col.key === "concluido" || col.key === "instalacao") && (
                        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-stone-200">
                          <button
                            onClick={() => goBack(o, col.key)}
                            className="text-[10px] text-stone-400 hover:text-stone-950 flex items-center"
                            title="Voltar"
                          >
                            <ChevronLeft className="size-3" /> voltar
                          </button>
                          <button onClick={() => advance(o, col.key)} className="kanban-btn flex items-center gap-0.5">
                            {col.key === "concluido" && mode === "instalacao" ? "ir p/ instalação" : "finalizar"}
                            <ChevronRight className="size-3" />
                          </button>
                        </div>
                      )}
                    </div>

                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Produtividade */}
      <div className="bg-white border border-[#D9D9D9]">
        <div className="p-5 border-b border-[#D9D9D9] flex items-center justify-between">
          <h2 className="font-display text-2xl text-[#1A1A1A]">Produtividade — {from} a {to}</h2>
        </div>
        {productivity.length === 0 ? (
          <p className="p-5 text-sm text-[#9B9B9B]">Nenhum ambiente concluído no período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F2F2F2] text-[11px] uppercase tracking-widest text-[#4A4A4A]">
              <tr>
                <th className="text-left p-3">Funcionário</th>
                <th className="text-left p-3">Função</th>
                <th className="text-right p-3">Ambientes</th>
                <th className="text-right p-3">m²</th>
                <th className="text-right p-3 w-32">Relatório</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D9D9]">
              {productivity.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 font-medium text-[#1A1A1A]">{r.name}</td>
                  <td className="p-3 text-[#4A4A4A] capitalize">{r.role}</td>
                  <td className="p-3 text-right font-mono">{r.envs}</td>
                  <td className="p-3 text-right font-mono">{r.m2.toFixed(2)}</td>
                  <td className="p-3 text-right">
                    <Link
                      to="/producao/relatorio/$employeeId"
                      params={{ employeeId: r.id }}
                      search={{ from, to }}
                      className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-[#1A1A1A] hover:text-[#4A4A4A]"
                    >
                      Ver relatório <ChevronRight className="size-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {installOrderId && (
        <InstallPhotosModal
          orderId={installOrderId}
          onClose={() => setInstallOrderId(null)}
        />
      )}
    </div>
  );
}

function InstallPhotosModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: photos } = useQuery({
    queryKey: ["install-photos", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("installation_photos" as never)
        .select("id, order_id, url, description, uploaded_by_name, created_at")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Photo[];
    },
  });

  const upload = async () => {
    if (!file) { toast.error("Escolha uma foto."); return; }
    if (!description.trim()) { toast.error("Descreva o local instalado."); return; }
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Não autenticado");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${u.user.id}/${orderId}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("installation-photos").upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const signed = await supabase.storage.from("installation-photos").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signed.error) throw signed.error;
      const { error } = await supabase.from("installation_photos" as never).insert({
        order_id: orderId,
        user_id: u.user.id,
        url: signed.data.signedUrl,
        description: description.trim(),
        uploaded_by_name: u.user.email ?? null,
      } as never);
      if (error) throw error;
      toast.success("Foto enviada.");
      setFile(null);
      setDescription("");
      qc.invalidateQueries({ queryKey: ["install-photos", orderId] });
      qc.invalidateQueries({ queryKey: ["install-photos-summary"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta foto?")) return;
    const { error } = await supabase.from("installation_photos" as never).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["install-photos", orderId] });
    qc.invalidateQueries({ queryKey: ["install-photos-summary"] });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1A1A1A]/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#D9D9D9] p-4">
          <h3 className="font-display text-xl flex items-center gap-2 text-[#1A1A1A]">
            <Camera className="size-5" /> Fotos da instalação
          </h3>
          <button onClick={onClose} className="text-[#9B9B9B] hover:text-[#1A1A1A]"><X className="size-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="border border-dashed border-[#D9D9D9] p-4 space-y-3">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o local instalado (obrigatório)"
              rows={2}
              className="w-full border border-[#D9D9D9] px-2 py-1.5 text-sm"
            />
            <button
              onClick={upload}
              disabled={uploading}
              className="w-full bg-[#1A1A1A] text-white py-2 text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-[#4A4A4A] disabled:opacity-50"
            >
              <Upload className="size-4" /> {uploading ? "Enviando…" : "Enviar foto"}
            </button>
          </div>

          <div className="space-y-3">
            {(photos ?? []).length === 0 && <p className="text-sm text-[#9B9B9B] italic">Nenhuma foto ainda.</p>}
            {(photos ?? []).map((p) => (
              <div key={p.id} className="border border-[#D9D9D9] p-2 flex gap-3">
                <img src={p.url} alt={p.description ?? ""} className="w-24 h-24 object-cover" />
                <div className="flex-1 text-xs">
                  <p className="font-medium text-[#1A1A1A]">{p.description}</p>
                  <p className="text-[#4A4A4A] mt-1">{p.uploaded_by_name}</p>
                  <p className="text-[#9B9B9B]">{new Date(p.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <button onClick={() => remove(p.id)} className="text-red-500 hover:text-red-700 self-start">
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
