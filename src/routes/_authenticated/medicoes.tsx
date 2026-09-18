import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Pencil,
  History,
  CheckCircle2,
  Link2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/medicoes")({
  head: () => ({
    meta: [
      { title: "Agenda de Medições · Petra" },
      {
        name: "description",
        content:
          "Agende, edite e conclua medições vinculadas ao pedido do cliente, com histórico e cálculo automático de metragem.",
      },
      { property: "og:title", content: "Agenda de Medições · Petra" },
      {
        property: "og:description",
        content: "Agenda de medições da Porcelane com vínculo ao pedido, histórico e cálculo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Measurement = {
  id: string;
  client_name: string | null;
  address: string | null;
  phone: string | null;
  scheduled_at: string;
  status: string;
  notes: string | null;
  order_id: string | null;
  measured_m2: number | null;
  price_m2: number | null;
  measured_total: number | null;
  realized_at: string | null;
  measurer_name: string | null;
};

type OrderLite = { id: string; number: number; client_name: string | null; data: any };
type HistoryRow = {
  id: string;
  kind: string;
  description: string | null;
  created_at: string;
  changed_by_name: string | null;
};

const HORA_MIN = 8;
const HORA_MAX = 18;

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}
function statusEmoji(s: string) {
  if (s === "realizada") return "✅";
  if (s === "cancelada") return "🔴";
  if (s === "remarcada") return "🔄";
  return "⏳";
}

const emptyForm = {
  id: "",
  client_name: "",
  phone: "",
  address: "",
  date: "",
  time: "09:00",
  notes: "",
  order_id: "",
};

function Page() {
  const [items, setItems] = useState<Measurement[]>([]);
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(new Date());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [realizar, setRealizar] = useState<Measurement | null>(null);
  const [realForm, setRealForm] = useState({ m2: "", preco: "", medidor: "", obs: "" });
  const [historyOf, setHistoryOf] = useState<Measurement | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const load = async () => {
    const start = new Date(cursor);
    const end = addMonths(cursor, 1);
    const { data, error } = await supabase
      .from("measurements")
      .select("*")
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((data ?? []) as unknown as Measurement[]);
  };

  const loadOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, number, client_name, data")
      .order("number", { ascending: false })
      .limit(200);
    setOrders((data ?? []) as OrderLite[]);
  };

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [cursor]);
  useEffect(() => {
    loadOrders();
  }, []);

  const registrarHistorico = async (
    m: { id: string },
    kind: string,
    description: string,
    campo?: string,
    antes?: any,
    depois?: any,
  ) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("audit_log").insert({
      user_id: u.user.id,
      kind,
      entity_type: "measurement",
      entity_id: m.id,
      field: campo ?? null,
      old_value: antes ?? null,
      new_value: depois ?? null,
      description,
      changed_by_id: u.user.id,
      changed_by_name: u.user.email ?? null,
    } as any);
  };

  const abrirNova = () => {
    const d = selected;
    setForm({
      ...emptyForm,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    });
    setShowForm(true);
  };

  const abrirEdicao = (m: Measurement) => {
    const d = new Date(m.scheduled_at);
    setForm({
      id: m.id,
      client_name: m.client_name ?? "",
      phone: m.phone ?? "",
      address: m.address ?? "",
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      time: d.toTimeString().slice(0, 5),
      notes: m.notes ?? "",
      order_id: m.order_id ?? "",
    });
    setShowForm(true);
  };

  const escolherPedido = (orderId: string) => {
    const o = orders.find((x) => x.id === orderId);
    const end = o?.data?.client?.site_address ?? o?.data?.client?.address ?? "";
    setForm((f) => ({
      ...f,
      order_id: orderId,
      client_name: o?.client_name ?? f.client_name,
      address: end || f.address,
      phone: o?.data?.client?.phone ?? f.phone,
    }));
  };

  const salvar = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Sessão não encontrada.");
      return;
    }
    if (!form.date) {
      toast.error("Informe a data.");
      return;
    }
    const [hh, mm] = form.time.split(":").map(Number);
    if (hh < HORA_MIN || hh > HORA_MAX) {
      toast.error("Medição somente em horário comercial (08:00 às 18:00).");
      return;
    }
    const [y, mo, d] = form.date.split("-").map(Number);
    const dt = new Date(y, mo - 1, d, hh, mm, 0, 0);

    const payload = {
      client_name: form.client_name || null,
      phone: form.phone || null,
      address: form.address || null,
      scheduled_at: dt.toISOString(),
      notes: form.notes || null,
      order_id: form.order_id || null,
    };

    if (form.id) {
      const anterior = items.find((i) => i.id === form.id);
      const remarcada = anterior && anterior.scheduled_at !== dt.toISOString();
      const { error } = await supabase
        .from("measurements")
        .update({ ...payload, ...(remarcada ? { status: "remarcada" } : {}) } as any)
        .eq("id", form.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await registrarHistorico(
        { id: form.id },
        remarcada ? "remarcacao" : "edicao",
        remarcada
          ? `Remarcada de ${new Date(anterior!.scheduled_at).toLocaleString("pt-BR")} para ${dt.toLocaleString("pt-BR")}`
          : "Dados da medição atualizados",
        "scheduled_at",
        anterior?.scheduled_at ?? null,
        dt.toISOString(),
      );
      toast.success("Medição atualizada");
    } else {
      const { data: criada, error } = await supabase
        .from("measurements")
        .insert({ user_id: u.user.id, status: "agendada", ...payload } as any)
        .select("id")
        .maybeSingle();
      if (error) {
        toast.error(error.message);
        return;
      }
      if (criada?.id) {
        await registrarHistorico(
          { id: criada.id },
          "agendamento",
          `Medição agendada para ${dt.toLocaleString("pt-BR")}`,
        );
      }
      toast.success("Medição agendada");
    }
    setShowForm(false);
    setForm({ ...emptyForm });
    load();
  };

  const abrirRealizar = (m: Measurement) => {
    setRealizar(m);
    setRealForm({
      m2: m.measured_m2 ? String(m.measured_m2) : "",
      preco: m.price_m2 ? String(m.price_m2) : "",
      medidor: m.measurer_name ?? "",
      obs: "",
    });
  };

  const totalPrevisto = useMemo(() => {
    const m2 = Number(String(realForm.m2).replace(",", "."));
    const p = Number(String(realForm.preco).replace(",", "."));
    if (!m2 || !p) return 0;
    return m2 * p;
  }, [realForm.m2, realForm.preco]);

  const confirmarRealizacao = async () => {
    if (!realizar) return;
    const m2 = Number(String(realForm.m2).replace(",", "."));
    if (!m2 || m2 <= 0) {
      toast.error("Informe os metros quadrados medidos.");
      return;
    }
    const preco = Number(String(realForm.preco).replace(",", ".")) || 0;
    const total = m2 * preco;
    const agora = new Date().toISOString();
    const { error } = await supabase
      .from("measurements")
      .update({
        status: "realizada",
        measured_m2: m2,
        price_m2: preco || null,
        measured_total: total || null,
        realized_at: agora,
        measurer_name: realForm.medidor || null,
        notes: realForm.obs ? `${realizar.notes ? realizar.notes + " · " : ""}${realForm.obs}` : realizar.notes,
      } as any)
      .eq("id", realizar.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await registrarHistorico(
      realizar,
      "realizacao",
      `Medição realizada: ${m2.toLocaleString("pt-BR")} m²${preco ? ` × ${brl(preco)} = ${brl(total)}` : ""}`,
      "measured_m2",
      null,
      m2 as any,
    );
    toast.success(`Medição concluída — ${m2.toLocaleString("pt-BR")} m²`);
    setRealizar(null);
    load();
  };

  const cancelar = async (m: Measurement) => {
    const { error } = await supabase.from("measurements").update({ status: "cancelada" }).eq("id", m.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await registrarHistorico(m, "cancelamento", "Medição cancelada");
    load();
  };

  const verHistorico = async (m: Measurement) => {
    setHistoryOf(m);
    const { data } = await supabase
      .from("audit_log")
      .select("id, kind, description, created_at, changed_by_name")
      .eq("entity_type", "measurement")
      .eq("entity_id", m.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory((data ?? []) as HistoryRow[]);
  };

  const monthDays = useMemo(() => {
    const first = startOfMonth(cursor);
    const offset = first.getDay();
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= last; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, Measurement[]>();
    for (const m of items) {
      const d = new Date(m.scheduled_at);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return map;
  }, [items]);

  const selectedItems = items.filter((m) => sameDay(new Date(m.scheduled_at), selected));
  const numeroPedido = (id: string | null) => orders.find((o) => o.id === id)?.number;
  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow">Liberação técnica</p>
          <h1 className="font-display text-4xl mt-1">Medições</h1>
          <p className="text-sm text-stone-500 mt-1">
            Agende pelo pedido do cliente, edite quando precisar e conclua com a metragem medida.
          </p>
        </div>
        <button
          onClick={abrirNova}
          className="bg-stone-950 text-white px-5 py-2.5 text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:bg-stone-800 rounded-xl"
        >
          <CalendarPlus className="size-3" /> Nova medição
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-stone-200 p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCursor(addMonths(cursor, -1))} className="p-2 hover:bg-stone-100 rounded-lg">
              <ChevronLeft className="size-4" />
            </button>
            <div className="font-display text-lg capitalize">{monthLabel}</div>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="p-2 hover:bg-stone-100 rounded-lg">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-stone-400 mb-2">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <div key={i} className="text-center font-bold">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((d, i) => {
              if (!d) return <div key={i} className="aspect-square" />;
              const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
              const dayItems = itemsByDay.get(k) || [];
              const isSel = sameDay(d, selected);
              const isToday = sameDay(d, new Date());
              return (
                <button
                  key={i}
                  onClick={() => setSelected(d)}
                  className={
                    "aspect-square p-1 text-xs border rounded-lg flex flex-col items-start justify-start transition-colors " +
                    (isSel
                      ? "bg-stone-950 text-white border-stone-950"
                      : isToday
                        ? "border-gold-low"
                        : "border-stone-100 hover:bg-stone-50")
                  }
                >
                  <span className="font-mono">{d.getDate()}</span>
                  {dayItems.length > 0 && (
                    <span
                      className={
                        "mt-auto self-end text-[9px] px-1 rounded " +
                        (isSel ? "bg-white text-stone-950" : "bg-gold-low text-stone-950")
                      }
                    >
                      {dayItems.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-6 rounded-2xl">
          <h3 className="font-display text-lg mb-1">
            {selected.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </h3>
          <p className="text-xs text-stone-400 mb-4">
            {selectedItems.length} medição{selectedItems.length === 1 ? "" : "ões"}
          </p>
          <div className="space-y-3">
            {selectedItems.length === 0 && <p className="text-sm text-stone-400">Nenhuma medição neste dia.</p>}
            {selectedItems.map((m) => (
              <div key={m.id} className="border border-stone-200 p-3 text-sm rounded-2xl">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-bold text-black">
                      {statusEmoji(m.status)} {m.client_name || "(sem nome)"}
                    </div>
                    {m.order_id && (
                      <div className="text-xs text-stone-600 flex items-center gap-1 mt-1">
                        <Link2 className="size-3" /> Pedido <b>{numeroPedido(m.order_id) ?? "—"}</b>
                      </div>
                    )}
                    <div className="text-xs text-stone-500 flex items-center gap-1 mt-1">
                      <Clock className="size-3" />
                      <b>
                        {new Date(m.scheduled_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </b>
                    </div>
                    {m.address && (
                      <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3" />
                        {m.address}
                      </div>
                    )}
                    {m.status === "realizada" && (
                      <div className="text-xs text-stone-700 mt-1">
                        📐 <b>{Number(m.measured_m2 ?? 0).toLocaleString("pt-BR")} m²</b>
                        {m.measured_total ? (
                          <>
                            {" "}
                            · 💰 <b>{brl(m.measured_total)}</b>
                          </>
                        ) : null}
                      </div>
                    )}
                    {m.notes && <p className="text-xs text-stone-500 mt-1 italic">{m.notes}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => abrirEdicao(m)}
                    className="text-xs border border-stone-200 rounded-lg px-2 py-1 hover:bg-stone-50 flex items-center gap-1"
                  >
                    <Pencil className="size-3" /> Editar
                  </button>
                  {m.status !== "realizada" && (
                    <button
                      onClick={() => abrirRealizar(m)}
                      className="text-xs bg-stone-950 text-white rounded-lg px-2 py-1 hover:bg-stone-800 flex items-center gap-1"
                    >
                      <CheckCircle2 className="size-3" /> Realizada
                    </button>
                  )}
                  <button
                    onClick={() => verHistorico(m)}
                    className="text-xs border border-stone-200 rounded-lg px-2 py-1 hover:bg-stone-50 flex items-center gap-1"
                  >
                    <History className="size-3" /> Histórico
                  </button>
                  {m.status !== "cancelada" && m.status !== "realizada" && (
                    <button
                      onClick={() => cancelar(m)}
                      className="text-xs border border-stone-200 rounded-lg px-2 py-1 text-red-600 hover:bg-red-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title={form.id ? "Editar medição" : "Nova medição"}>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="label-eyebrow">Pedido do cliente</label>
              <select
                value={form.order_id}
                onChange={(e) => escolherPedido(e.target.value)}
                className="w-full border border-stone-200 p-2 text-sm rounded-lg bg-white"
              >
                <option value="">Sem vínculo com pedido</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    Pedido {o.number} — {o.client_name ?? "sem nome"}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Cliente" value={form.client_name} onChange={(v) => setForm({ ...form, client_name: v })} />
            <Field label="Telefone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <Field label="Endereço" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="label-eyebrow">Data</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-stone-200 p-2 text-sm rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="label-eyebrow">Horário (08h–18h)</label>
                <input
                  type="time"
                  min="08:00"
                  max="18:00"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="w-full border border-stone-200 p-2 text-sm rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="label-eyebrow">Observações</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="w-full border border-stone-200 p-2 text-sm rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs uppercase font-bold border border-stone-200 rounded-lg hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              className="px-4 py-2 text-xs uppercase font-bold bg-stone-950 text-white rounded-lg hover:bg-stone-800"
            >
              {form.id ? "Salvar" : "Agendar"}
            </button>
          </div>
        </Modal>
      )}

      {realizar && (
        <Modal onClose={() => setRealizar(null)} title="Concluir medição">
          <p className="text-sm text-stone-600 mb-3">
            {realizar.client_name}
            {realizar.order_id ? ` · Pedido ${numeroPedido(realizar.order_id) ?? "—"}` : ""}
          </p>
          <div className="space-y-3">
            <Field label="Metros quadrados medidos" value={realForm.m2} onChange={(v) => setRealForm({ ...realForm, m2: v })} />
            <Field label="Valor por m² (opcional)" value={realForm.preco} onChange={(v) => setRealForm({ ...realForm, preco: v })} />
            <Field label="Quem mediu" value={realForm.medidor} onChange={(v) => setRealForm({ ...realForm, medidor: v })} />
            <div className="space-y-1">
              <label className="label-eyebrow">Observações da medição</label>
              <textarea
                value={realForm.obs}
                onChange={(e) => setRealForm({ ...realForm, obs: e.target.value })}
                rows={2}
                className="w-full border border-stone-200 p-2 text-sm rounded-lg"
              />
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-3 text-sm">
              Total calculado: <b>{brl(totalPrevisto)}</b>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setRealizar(null)}
              className="px-4 py-2 text-xs uppercase font-bold border border-stone-200 rounded-lg hover:bg-stone-50"
            >
              Voltar
            </button>
            <button
              onClick={confirmarRealizacao}
              className="px-4 py-2 text-xs uppercase font-bold bg-stone-950 text-white rounded-lg hover:bg-stone-800"
            >
              Confirmar medição
            </button>
          </div>
        </Modal>
      )}

      {historyOf && (
        <Modal onClose={() => setHistoryOf(null)} title="Histórico da medição">
          <div className="space-y-2">
            {history.length === 0 && <p className="text-sm text-stone-400">Sem registros ainda.</p>}
            {history.map((h) => (
              <div key={h.id} className="rounded-2xl border border-stone-200 p-3 text-sm">
                <div className="font-bold text-black">{h.description ?? h.kind}</div>
                <div className="text-xs text-stone-500 mt-1">
                  {new Date(h.created_at).toLocaleString("pt-BR")}
                  {h.changed_by_name ? ` · ${h.changed_by_name}` : ""}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 bg-stone-950/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white max-w-md w-full max-h-[85vh] overflow-y-auto p-6 rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="label-eyebrow">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-stone-200 p-2 text-sm rounded-lg"
      />
    </div>
  );
}
