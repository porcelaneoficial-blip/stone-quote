import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Package, Boxes, Save } from "lucide-react";
import { toast } from "sonner";

type Item = {
  id: string;
  name: string;
  category: string | null;
  stock_quantity: number | null;
  _origem: "material" | "insumo";
};

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque · Petra" },
      { name: "description", content: "Controle de estoque de materiais e insumos da Porcelane." },
      { property: "og:title", content: "Estoque · Petra" },
      { property: "og:description", content: "Controle de estoque de materiais e insumos da Porcelane." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EstoquePage,
});

function EstoquePage() {
  const [itens, setItens] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<Record<string, string>>({});

  const carregar = async () => {
    setLoading(true);
    const [mat, sup] = await Promise.all([
      supabase.from("materials").select("id,name,category,stock_quantity").eq("active", true).order("category").order("name"),
      supabase.from("supplies").select("id,name,category,stock_quantity").eq("active", true).order("category").order("name"),
    ]);
    const lista: Item[] = [
      ...((mat.data ?? []) as any[]).map((m) => ({ ...m, _origem: "material" as const })),
      ...((sup.data ?? []) as any[]).map((s) => ({ ...s, _origem: "insumo" as const })),
    ];
    setItens(lista);
    setLoading(false);
  };

  useEffect(() => {
    void carregar();
  }, []);

  const grupos = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of itens) {
      const cat = it.category?.trim() || "Sem categoria";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    }
    return Array.from(map.entries());
  }, [itens]);

  const salvar = async (item: Item) => {
    const bruto = (editando[item.id] ?? "").replace(",", ".");
    const qtd = Number(bruto);
    if (bruto === "" || Number.isNaN(qtd) || qtd < 0) {
      toast.error("Informe uma quantidade válida.");
      return;
    }
    const tabela = item._origem === "material" ? "materials" : "supplies";
    const { error } = await supabase.from(tabela).update({ stock_quantity: qtd }).eq("id", item.id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success(`✅ Estoque de ${item.name} atualizado.`);
    setEditando((e) => {
      const n = { ...e };
      delete n[item.id];
      return n;
    });
    void carregar();
  };

  const zerados = itens.filter((i) => (i.stock_quantity ?? 0) <= 0).length;

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Boxes className="size-6" /> Estoque
        </h1>
        <p className="text-sm text-stone-500 mt-1">
          Materiais e insumos cadastrados na biblioteca, com a quantidade disponível.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border border-stone-200 p-4 shadow-[var(--shadow-card)]">
          <div className="text-xs text-stone-400">Itens cadastrados</div>
          <div className="text-2xl font-bold mt-1">{itens.length}</div>
        </div>
        <div className="rounded-2xl bg-white border border-stone-200 p-4 shadow-[var(--shadow-card)]">
          <div className="text-xs text-stone-400">Categorias</div>
          <div className="text-2xl font-bold mt-1">{grupos.length}</div>
        </div>
        <div className="rounded-2xl bg-white border border-stone-200 p-4 shadow-[var(--shadow-card)]">
          <div className="text-xs text-stone-400">Sem estoque</div>
          <div className="text-2xl font-bold mt-1">{zerados > 0 ? `🔴 ${zerados}` : "✅ 0"}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-stone-400">Carregando estoque…</div>
      ) : grupos.length === 0 ? (
        <div className="rounded-2xl bg-white border border-stone-200 p-8 text-center text-sm text-stone-500">
          Nenhum material ou insumo cadastrado ainda. Cadastre em Configurações → Biblioteca.
        </div>
      ) : (
        grupos.map(([categoria, lista]) => (
          <div key={categoria} className="space-y-2">
            <div className="label-eyebrow px-1">{categoria}</div>
            <div className="grid gap-2 md:grid-cols-2">
              {lista.map((item) => {
                const qtd = item.stock_quantity ?? 0;
                const valor = editando[item.id];
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-white border border-stone-200 p-4 shadow-[var(--shadow-card)] flex items-center gap-3"
                  >
                    <div className="size-10 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
                      <Package className="size-4 text-stone-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{item.name}</div>
                      <div className="text-xs text-stone-400">
                        {item._origem === "material" ? "🪨 Material" : "🧴 Insumo"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valor ?? String(qtd)}
                        onChange={(e) => setEditando((p) => ({ ...p, [item.id]: e.target.value }))}
                        className="w-20 rounded-lg border border-stone-200 px-2 py-1.5 text-right text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-stone-400"
                      />
                      {valor !== undefined && valor !== String(qtd) && (
                        <button
                          onClick={() => salvar(item)}
                          title="Salvar quantidade"
                          className="p-2 rounded-lg bg-stone-950 text-white hover:bg-stone-800 transition-colors"
                        >
                          <Save className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
