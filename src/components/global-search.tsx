import { useEffect, useRef, useState } from "react";
import { Search, X, FileText, ShoppingCart, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

type Hit =
  | { kind: "pedido"; id: string; number: number; client_name: string }
  | { kind: "orcamento"; id: string; number: number; client_name: string }
  | { kind: "cliente"; id: string; name: string; doc: string | null };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits([]); return; }
    const handle = setTimeout(async () => {
      setLoading(true);
      const asNum = Number(term.replace(/\D/g, ""));
      const [orders, quotes, clients] = await Promise.all([
        supabase.from("orders").select("id, number, client_name")
          .or(`client_name.ilike.%${term}%${Number.isFinite(asNum) && asNum > 0 ? `,number.eq.${asNum}` : ""}`)
          .order("number", { ascending: false }).limit(6),
        supabase.from("quotes").select("id, number, client_name")
          .or(`client_name.ilike.%${term}%${Number.isFinite(asNum) && asNum > 0 ? `,number.eq.${asNum}` : ""}`)
          .order("number", { ascending: false }).limit(6),
        supabase.from("clients").select("id, name, doc")
          .or(`name.ilike.%${term}%,doc.ilike.%${term}%`)
          .order("name").limit(6),
      ]);
      const out: Hit[] = [];
      (orders.data ?? []).forEach((r: any) => out.push({ kind: "pedido", ...r }));
      (quotes.data ?? []).forEach((r: any) => out.push({ kind: "orcamento", ...r }));
      (clients.data ?? []).forEach((r: any) => out.push({ kind: "cliente", ...r }));
      setHits(out);
      setLoading(false);
    }, 220);
    return () => clearTimeout(handle);
  }, [q]);

  const go = (h: Hit) => {
    setOpen(false); setQ("");
    if (h.kind === "pedido") navigate({ to: "/pedidos/$id", params: { id: h.id } });
    else if (h.kind === "orcamento") navigate({ to: "/orcamentos/$id", params: { id: h.id } });
    else navigate({ to: "/clientes" });
  };

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <div className="flex items-center gap-2 bg-white border border-stone-200 px-3 py-2 focus-within:border-stone-950">
        <Search className="size-4 text-stone-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar nº pedido, orçamento ou nome do cliente…"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
        {q && (
          <button onClick={() => { setQ(""); setHits([]); }} className="text-stone-300 hover:text-stone-600">
            <X className="size-4" />
          </button>
        )}
      </div>
      {open && q && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-stone-200 shadow-lg z-50 max-h-96 overflow-y-auto">
          {loading && <div className="p-4 text-xs text-stone-400">Buscando…</div>}
          {!loading && hits.length === 0 && <div className="p-4 text-xs text-stone-400">Nenhum resultado</div>}
          {hits.map((h, i) => (
            <button
              key={i}
              onClick={() => go(h)}
              className="w-full text-left px-4 py-2 hover:bg-stone-50 flex items-center gap-3 text-sm border-b border-stone-100 last:border-0"
            >
              {h.kind === "pedido" && <ShoppingCart className="size-4 text-stone-500" />}
              {h.kind === "orcamento" && <FileText className="size-4 text-stone-500" />}
              {h.kind === "cliente" && <User className="size-4 text-stone-500" />}
              <div className="flex-1 min-w-0">
                {h.kind === "cliente" ? (
                  <>
                    <div className="truncate font-medium">{h.name}</div>
                    <div className="text-[11px] text-stone-500">Cliente {h.doc ? `• ${h.doc}` : ""}</div>
                  </>
                ) : (
                  <>
                    <div className="truncate font-medium">
                      {h.kind === "pedido" ? "PED" : "ORC"}-{String(h.number).padStart(6, "0")} — {h.client_name}
                    </div>
                    <div className="text-[11px] text-stone-500 uppercase tracking-wider">{h.kind}</div>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
