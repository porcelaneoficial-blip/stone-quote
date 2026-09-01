import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Printer, Trash2, ArrowLeft, Truck, Search } from "lucide-react";
import { DocHeader } from "@/components/doc-header";
import { todayISO } from "@/lib/format";
import { PIECE_TERMS } from "@/lib/piece-terms";
import { SignaturePad } from "@/components/signature-pad";


export const Route = createFileRoute("/_authenticated/romaneios")({
  component: RomaneiosPage,
});

type RomaneioItem = {
  id: string;
  environment?: string;
  description: string;
  material?: string;
  qty: number;
  length?: number;
  width?: number;
  notes?: string;
  glued?: boolean; // fornecido colado/montado (uso interno; não sai no PDF)
};


type RomaneioSupply = { id: string; description: string; qty: number };

type Romaneio = {
  id: string;
  number: number;
  romaneio_date: string;
  client_name: string;
  client_phone: string;
  address: string;
  city: string;
  salesperson: string;
  architect: string;
  notes: string;
  order_id: string | null;
  items: RomaneioItem[];
  supplies: RomaneioSupply[];
  receiver_signature: string | null;
  receiver_name: string | null;
  receiver_signed_at: string | null;
  created_at: string;
  updated_at: string;
};

const uid = () => crypto.randomUUID();

function emptyRomaneio(): Omit<Romaneio, "id" | "number" | "created_at" | "updated_at"> {
  return {
    romaneio_date: todayISO(),
    client_name: "",
    client_phone: "",
    address: "",
    city: "",
    salesperson: "",
    architect: "",
    notes: "",
    order_id: null,
    items: [{ id: uid(), description: "", qty: 1 }],
    supplies: [],
    receiver_signature: null,
    receiver_name: null,
    receiver_signed_at: null,
  };
}

function RomaneiosPage() {
  const [list, setList] = useState<Romaneio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Romaneio | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("manual_romaneios")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setList((data ?? []) as unknown as Romaneio[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        String(r.number).includes(q) ||
        r.city.toLowerCase().includes(q),
    );
  }, [list, search]);

  const createNew = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = { user_id: u.user.id, ...emptyRomaneio() };
    const { data, error } = await supabase
      .from("manual_romaneios")
      .insert(payload as never)
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setList((prev) => [data as unknown as Romaneio, ...prev]);
    setEditing(data as unknown as Romaneio);
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este romaneio?")) return;
    const { error } = await supabase.from("manual_romaneios").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setList((prev) => prev.filter((r) => r.id !== id));
    if (editing?.id === id) setEditing(null);
    toast.success("Romaneio excluído");
  };

  if (editing) {
    return (
      <RomaneioEditor
        value={editing}
        onClose={() => setEditing(null)}
        onSaved={(r) => {
          setEditing(r);
          setList((prev) => prev.map((x) => (x.id === r.id ? r : x)));
        }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Truck className="size-6" /> Romaneios manuais
          </h1>
          <p className="text-sm text-stone-500">Crie romaneios avulsos sem precisar vincular a um pedido.</p>
        </div>
        <button
          onClick={createNew}
          className="bg-gold-low text-stone-950 px-4 py-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="size-4" /> Novo romaneio
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, número ou cidade"
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Carregando…</p>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-dashed border-stone-300 rounded p-10 text-center">
          <p className="text-stone-500 text-sm">Nenhum romaneio manual criado ainda.</p>
        </div>
      ) : (
        <div className="border border-stone-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-100 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left p-3">Nº</th>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Cidade</th>
                <th className="text-left p-3">Itens</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-stone-200 hover:bg-stone-50">
                  <td className="p-3 font-mono">{String(r.number).padStart(4, "0")}</td>
                  <td className="p-3">{new Date(r.romaneio_date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 font-medium">
                    <button className="hover:underline" onClick={() => setEditing(r)}>
                      {r.client_name || "(sem cliente)"}
                    </button>
                  </td>
                  <td className="p-3 text-stone-600">{r.city}</td>
                  <td className="p-3 text-stone-600">{r.items?.length ?? 0}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => remove(r.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RomaneioEditor({
  value,
  onClose,
  onSaved,
}: {
  value: Romaneio;
  onClose: () => void;
  onSaved: (r: Romaneio) => void;
}) {
  const [r, setR] = useState<Romaneio>(value);
  const [saving, setSaving] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [importing, setImporting] = useState(false);

  const importFromOrder = async () => {
    const n = parseInt(orderNumber.replace(/\D/g, ""), 10);
    if (!n) return toast.error("Informe o número do pedido");
    setImporting(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, number, client_name, data")
      .eq("number", n)
      .maybeSingle();
    setImporting(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error(`Pedido PED-${String(n).padStart(6, "0")} não encontrado`);
    const od = (data.data ?? {}) as {
      environments?: Array<{
        name?: string;
        material?: string;
        items?: Array<{ description?: string; qty?: number; length?: number; width?: number; material?: string }>;
      }>;
    };
    const items: RomaneioItem[] = [];
    for (const env of od.environments ?? []) {
      for (const it of env.items ?? []) {
        items.push({
          id: uid(),
          environment: env.name ?? "",
          description: it.description ?? "",
          material: it.material ?? env.material ?? "",
          qty: it.qty ?? 1,
          length: it.length,
          width: it.width,
        });
      }
    }
    if (items.length === 0) return toast.error("Pedido sem itens");
    setR((prev) => ({
      ...prev,
      order_id: data.id,
      items,
      notes: prev.notes || `Importado de PED-${String(data.number).padStart(6, "0")}`,
    }));
    toast.success(`${items.length} itens importados de PED-${String(data.number).padStart(6, "0")}`);
  };

  const patch = (p: Partial<Romaneio>) => setR((prev) => ({ ...prev, ...p }));
  const patchItem = (id: string, p: Partial<RomaneioItem>) =>
    setR((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === id ? { ...it, ...p } : it)) }));
  const addItem = () =>
    setR((prev) => ({ ...prev, items: [...prev.items, { id: uid(), description: "", qty: 1 }] }));
  const removeItem = (id: string) =>
    setR((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== id) }));

  const addSupply = () =>
    setR((prev) => ({ ...prev, supplies: [...(prev.supplies ?? []), { id: uid(), description: "", qty: 1 }] }));
  const patchSupply = (id: string, p: Partial<RomaneioSupply>) =>
    setR((prev) => ({
      ...prev,
      supplies: (prev.supplies ?? []).map((s) => (s.id === id ? { ...s, ...p } : s)),
    }));
  const removeSupply = (id: string) =>
    setR((prev) => ({ ...prev, supplies: (prev.supplies ?? []).filter((s) => s.id !== id) }));

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from("manual_romaneios")
      .update({
        romaneio_date: r.romaneio_date,
        client_name: r.client_name,
        client_phone: r.client_phone,
        address: r.address,
        city: r.city,
        salesperson: r.salesperson,
        architect: r.architect,
        notes: r.notes,
        order_id: r.order_id,
        items: r.items as never,
        supplies: (r.supplies ?? []) as never,
        receiver_signature: r.receiver_signature,
        receiver_name: r.receiver_name,
        receiver_signed_at: r.receiver_signed_at,
      } as never)
      .eq("id", r.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    onSaved(data as unknown as Romaneio);
  };

  const doPrint = async () => {
    await save();
    setTimeout(() => window.print(), 200);
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <button onClick={onClose} className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-900">
          <ArrowLeft className="size-4" /> Voltar
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-xs uppercase tracking-widest font-bold border border-stone-300 hover:bg-stone-50 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
          <button
            onClick={doPrint}
            className="bg-gold-low text-stone-950 px-4 py-2 text-xs uppercase tracking-widest font-bold flex items-center gap-2 hover:opacity-90"
          >
            <Printer className="size-4" /> Imprimir
          </button>
        </div>
      </div>

      {/* Form (não imprime) */}
      <div className="grid gap-4 print:hidden">
        <div className="border border-stone-300 bg-stone-50 p-3 rounded flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-40">
            <div className="text-[10px] uppercase tracking-widest text-stone-600 mb-1">Puxar itens do pedido</div>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Nº do pedido (ex: 42 ou PED-000042)"
              className="input"
            />
          </div>
          <button
            onClick={importFromOrder}
            disabled={importing}
            className="px-4 py-2 text-xs uppercase tracking-widest font-bold border border-stone-400 bg-white hover:bg-stone-100 disabled:opacity-50 flex items-center gap-2"
          >
            <Search className="size-4" /> {importing ? "Buscando…" : "Buscar pedido"}
          </button>
          {r.order_id && (
            <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
              Vinculado a pedido
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Data">
            <input
              type="date"
              value={r.romaneio_date}
              onChange={(e) => patch({ romaneio_date: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Cliente">
            <input value={r.client_name} onChange={(e) => patch({ client_name: e.target.value })} className="input" />
          </Field>
          <Field label="Telefone">
            <input value={r.client_phone} onChange={(e) => patch({ client_phone: e.target.value })} className="input" />
          </Field>
          <Field label="Cidade">
            <input value={r.city} onChange={(e) => patch({ city: e.target.value })} className="input" />
          </Field>
          <Field label="Endereço da obra" className="sm:col-span-2">
            <input value={r.address} onChange={(e) => patch({ address: e.target.value })} className="input" />
          </Field>
          <Field label="Vendedor">
            <input value={r.salesperson} onChange={(e) => patch({ salesperson: e.target.value })} className="input" />
          </Field>
          <Field label="Arquiteto">
            <input value={r.architect} onChange={(e) => patch({ architect: e.target.value })} className="input" />
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="label-eyebrow">Itens</h3>
            <button onClick={addItem} className="text-xs flex items-center gap-1 hover:underline">
              <Plus className="size-3" /> Adicionar item
            </button>
          </div>
          <div className="border border-stone-200 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-stone-100 text-xs uppercase">
                <tr>
                  <th className="text-left p-2 w-10">Nº</th>
                  <th className="text-left p-2">Ambiente</th>
                  <th className="text-left p-2">Termo / Descrição</th>
                  <th className="text-left p-2">Material</th>
                  <th className="text-right p-2 w-20">Qtd</th>
                  <th className="text-right p-2 w-24">Larg (m)</th>
                  <th className="text-right p-2 w-24">Comp (m)</th>
                  <th className="text-center p-2 w-24" title="Fornecido colado/montado">Colado</th>
                  <th className="p-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {r.items.map((it, idx) => (
                  <tr key={it.id} className="border-t border-stone-200">
                    <td className="p-1 text-center font-mono text-stone-500">{idx + 1}</td>
                    <td className="p-1">
                      <input
                        value={it.environment ?? ""}
                        onChange={(e) => patchItem(it.id, { environment: e.target.value })}
                        className="input-cell"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        list="piece-terms-datalist"
                        value={it.description}
                        onChange={(e) => patchItem(it.id, { description: e.target.value })}
                        className="input-cell"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        value={it.material ?? ""}
                        onChange={(e) => patchItem(it.id, { material: e.target.value })}
                        className="input-cell"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        min={1}
                        value={it.qty}
                        onChange={(e) => patchItem(it.id, { qty: parseInt(e.target.value) || 1 })}
                        className="input-cell text-right"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        step="0.001"
                        value={it.width ?? ""}
                        onChange={(e) => patchItem(it.id, { width: parseFloat(e.target.value) || 0 })}
                        className="input-cell text-right"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="number"
                        step="0.001"
                        value={it.length ?? ""}
                        onChange={(e) => patchItem(it.id, { length: parseFloat(e.target.value) || 0 })}
                        className="input-cell text-right"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <input
                        type="checkbox"
                        checked={!!it.glued}
                        onChange={(e) => patchItem(it.id, { glued: e.target.checked })}
                        className="accent-stone-950"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button onClick={() => removeItem(it.id)} className="text-red-600 hover:bg-red-50 p-1 rounded">
                        <Trash2 className="size-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="piece-terms-datalist">
            {PIECE_TERMS.map((t) => <option key={t} value={t} />)}
          </datalist>

        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="label-eyebrow">Insumos / Acessórios</h3>
            <button onClick={addSupply} className="text-xs flex items-center gap-1 hover:underline">
              <Plus className="size-3" /> Adicionar
            </button>
          </div>
          {(r.supplies ?? []).length === 0 ? (
            <p className="text-xs text-stone-500">Nenhum insumo.</p>
          ) : (
            <div className="space-y-1">
              {(r.supplies ?? []).map((s) => (
                <div key={s.id} className="flex gap-2 items-center">
                  <input
                    value={s.description}
                    onChange={(e) => patchSupply(s.id, { description: e.target.value })}
                    placeholder="Descrição"
                    className="input flex-1"
                  />
                  <input
                    type="number"
                    min={1}
                    value={s.qty}
                    onChange={(e) => patchSupply(s.id, { qty: parseInt(e.target.value) || 1 })}
                    className="input w-24 text-right"
                  />
                  <button onClick={() => removeSupply(s.id)} className="text-red-600 hover:bg-red-50 p-2 rounded">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Field label="Observações">
          <textarea
            value={r.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            className="input min-h-24"
          />
        </Field>

        <div className="border border-stone-200 p-4 bg-stone-50/50 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <Field label="Recebido por (nome)">
              <input
                value={r.receiver_name ?? ""}
                onChange={(e) => patch({ receiver_name: e.target.value || null })}
                className="input"
                placeholder="Nome de quem recebeu"
              />
            </Field>
            <div className="text-xs text-stone-500 self-end">
              {r.receiver_signed_at
                ? `Assinado em ${new Date(r.receiver_signed_at).toLocaleString("pt-BR")}`
                : "Assinatura ainda não registrada"}
            </div>
          </div>
          <SignaturePad
            label="Assinatura de recebimento"
            value={r.receiver_signature}
            onChange={(dataUrl) =>
              patch({
                receiver_signature: dataUrl,
                receiver_signed_at: dataUrl ? new Date().toISOString() : null,
              })
            }
          />
        </div>
      </div>


      {/* Área de impressão */}
      <div className="hidden print:block">
        <DocHeader title="Romaneio de Entrega" badge={`ROM ${String(r.number).padStart(4, "0")}`} />
        <div className="grid grid-cols-2 gap-4 text-xs mb-4">
          <div><b>Data:</b> {new Date(r.romaneio_date + "T00:00:00").toLocaleDateString("pt-BR")}</div>
          <div><b>Cliente:</b> {r.client_name}</div>
          <div><b>Telefone:</b> {r.client_phone}</div>
          <div><b>Cidade:</b> {r.city}</div>
          <div className="col-span-2"><b>Endereço:</b> {r.address}</div>
          {r.salesperson && <div><b>Vendedor:</b> {r.salesperson}</div>}
          {r.architect && <div><b>Arquiteto:</b> {r.architect}</div>}
        </div>
        <table className="w-full text-xs border border-stone-950 mb-4">
          <thead className="bg-stone-100">
            <tr>
              <th className="border border-stone-950 p-1 text-left w-12">Nº</th>
              <th className="border border-stone-950 p-1 text-left">Termo</th>
              <th className="border border-stone-950 p-1 text-right w-40">Medida</th>
            </tr>
          </thead>
          <tbody>
            {r.items.map((it, idx) => (
              <tr key={it.id}>
                <td className="border border-stone-950 p-1 font-mono">{String(idx + 1).padStart(2, "0")}</td>
                <td className="border border-stone-950 p-1">
                  {it.description}
                  {it.qty > 1 ? ` (${it.qty}×)` : ""}
                </td>
                <td className="border border-stone-950 p-1 text-right font-mono">
                  {it.width && it.length ? `${it.width.toFixed(3)} × ${it.length.toFixed(3)} m` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(r.supplies ?? []).length > 0 && (
          <>
            <h4 className="text-xs font-bold uppercase mb-1">Insumos / Acessórios</h4>
            <table className="w-full text-xs border border-stone-950 mb-4">
              <thead className="bg-stone-100">
                <tr>
                  <th className="border border-stone-950 p-1 text-left">Descrição</th>
                  <th className="border border-stone-950 p-1 text-right w-24">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {(r.supplies ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className="border border-stone-950 p-1">{s.description}</td>
                    <td className="border border-stone-950 p-1 text-right">{s.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {r.notes && (
          <div className="text-xs mb-8">
            <b>Observações:</b>
            <div className="whitespace-pre-wrap mt-1">{r.notes}</div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-8 mt-16 text-xs">
          <div className="text-center border-t border-stone-950 pt-1">Entregue por</div>
          <div className="text-center">
            {r.receiver_signature && (
              <img src={r.receiver_signature} alt="Assinatura" className="mx-auto h-16 object-contain" />
            )}
            <div className="border-t border-stone-950 pt-1">
              Recebido por{r.receiver_name ? ` — ${r.receiver_name}` : ""}
              {r.receiver_signed_at ? ` (${new Date(r.receiver_signed_at).toLocaleDateString("pt-BR")})` : ""}
            </div>
          </div>
        </div>

      </div>

      <style>{`
        .input { width: 100%; padding: 6px 10px; font-size: 13px; border: 1px solid #d6d3d1; border-radius: 4px; background: white; }
        .input:focus { outline: none; border-color: #a8a29e; }
        .input-cell { width: 100%; padding: 4px 6px; font-size: 13px; border: 1px solid transparent; background: transparent; }
        .input-cell:focus { outline: none; border-color: #a8a29e; background: white; }
        @media print { @page { size: A4; margin: 0; } body { background: white !important; padding: 12mm; } }
      `}</style>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label-eyebrow block mb-1">{label}</span>
      {children}
    </label>
  );
}
