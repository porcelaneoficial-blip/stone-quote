import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarPlus, ChevronLeft, ChevronRight, Trash2, MapPin, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/medicoes")({
  component: Page,
});

type Measurement = {
  id: string;
  client_name: string | null;
  address: string | null;
  scheduled_at: string;
  status: string;
  notes: string | null;
  order_id: string | null;
};

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

function Page() {
  const [items, setItems] = useState<Measurement[]>([]);
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(new Date());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ client_name: "", address: "", time: "09:00", notes: "" });

  const load = async () => {
    const start = new Date(cursor);
    const end = addMonths(cursor, 1);
    const { data, error } = await supabase
      .from("measurements")
      .select("*")
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString())
      .order("scheduled_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    setItems(data as Measurement[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cursor]);

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

  const save = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [hh, mm] = form.time.split(":").map(Number);
    const dt = new Date(selected);
    dt.setHours(hh, mm, 0, 0);
    const { error } = await supabase.from("measurements").insert({
      user_id: u.user.id,
      client_name: form.client_name,
      address: form.address,
      scheduled_at: dt.toISOString(),
      notes: form.notes,
      status: "agendada",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Medição agendada");
    setShowForm(false);
    setForm({ client_name: "", address: "", time: "09:00", notes: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("measurements").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("measurements").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow">Liberação técnica · Bhenda</p>
          <h1 className="font-display text-4xl mt-1">Medições</h1>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-stone-950 text-white px-5 py-2.5 text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:bg-stone-800">
          <CalendarPlus className="size-3" /> Nova medição
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCursor(addMonths(cursor, -1))} className="p-2 hover:bg-stone-100"><ChevronLeft className="size-4" /></button>
            <div className="font-display text-lg capitalize">{monthLabel}</div>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="p-2 hover:bg-stone-100"><ChevronRight className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wider text-stone-400 mb-2">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <div key={i} className="text-center font-bold">{d}</div>)}
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
                  className={"aspect-square p-1 text-xs border flex flex-col items-start justify-start transition-colors " +
                    (isSel ? "bg-stone-950 text-white border-stone-950"
                      : isToday ? "border-gold-low" : "border-stone-100 hover:bg-stone-50")}
                >
                  <span className="font-mono">{d.getDate()}</span>
                  {dayItems.length > 0 && (
                    <span className={"mt-auto self-end text-[9px] px-1 rounded " + (isSel ? "bg-white text-stone-950" : "bg-gold-low text-stone-950")}>
                      {dayItems.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-6">
          <h3 className="font-display text-lg mb-1">{selected.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</h3>
          <p className="text-xs text-stone-400 mb-4">{selectedItems.length} medição{selectedItems.length === 1 ? "" : "ões"}</p>
          <div className="space-y-3">
            {selectedItems.length === 0 && <p className="text-sm text-stone-400">Nenhuma medição neste dia.</p>}
            {selectedItems.map((m) => (
              <div key={m.id} className="border border-stone-100 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{m.client_name || "(sem nome)"}</div>
                    <div className="text-xs text-stone-500 flex items-center gap-1 mt-1"><Clock className="size-3" />{new Date(m.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                    {m.address && <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5"><MapPin className="size-3" />{m.address}</div>}
                    {m.notes && <p className="text-xs text-stone-500 mt-1 italic">{m.notes}</p>}
                  </div>
                  <button onClick={() => remove(m.id)} className="text-stone-400 hover:text-red-500"><Trash2 className="size-3" /></button>
                </div>
                <select value={m.status} onChange={(e) => updateStatus(m.id, e.target.value)} className="mt-2 text-xs border border-stone-200 px-2 py-1 bg-white w-full">
                  <option value="agendada">Agendada</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-stone-950/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl mb-4">Nova medição — {selected.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</h3>
            <div className="space-y-3">
              <Field label="Cliente" value={form.client_name} onChange={(v) => setForm({ ...form, client_name: v })} />
              <Field label="Endereço" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
              <div className="space-y-1">
                <label className="label-eyebrow">Horário</label>
                <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full border border-stone-200 p-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="label-eyebrow">Observações</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full border border-stone-200 p-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-xs uppercase font-bold border border-stone-200 hover:bg-stone-50">Cancelar</button>
              <button onClick={save} className="px-4 py-2 text-xs uppercase font-bold bg-stone-950 text-white hover:bg-stone-800">Agendar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="label-eyebrow">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full border border-stone-200 p-2 text-sm" />
    </div>
  );
}
