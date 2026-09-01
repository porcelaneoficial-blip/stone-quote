import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAppearance, DEFAULT_APPEARANCE, FONT_SIZES, type AppearanceSettings } from "@/lib/appearance";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes/aparencia")({
  component: AparenciaPage,
});

function AparenciaPage() {
  const { settings, setSettings, preview } = useAppearance();
  const [draft, setDraft] = useState<AppearanceSettings>(settings);

  const update = (patch: Partial<AppearanceSettings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    preview(next);
  };
  const updateColor = (key: keyof AppearanceSettings["colors"], value: string) => {
    const next = { ...draft, colors: { ...draft.colors, [key]: value } };
    setDraft(next);
    preview(next);
  };

  const onLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => update({ logoUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const salvar = () => {
    setSettings(draft);
    toast.success("Aparência salva");
  };
  const restaurar = () => {
    setDraft(DEFAULT_APPEARANCE);
    setSettings(DEFAULT_APPEARANCE);
    toast.success("Padrão restaurado");
  };

  const colorFields: { key: keyof AppearanceSettings["colors"]; label: string }[] = [
    { key: "background", label: "Fundo geral" },
    { key: "foreground", label: "Texto principal" },
    { key: "accent", label: "Destaques" },
    { key: "muted", label: "Texto secundário" },
    { key: "card", label: "Cards / Sidebar" },
    { key: "border", label: "Bordas" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="label-eyebrow">Configurações</p>
        <h1 className="font-display text-4xl mt-1">Aparência</h1>
        <p className="text-sm text-stone-500 mt-2">
          Ajustes aplicados em toda a plataforma. Prévia em tempo real; salve para persistir.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <section className="card-premium card-pad">
            <h2 className="section-title mb-4">Tamanho da fonte</h2>
            <div className="flex flex-wrap gap-2">
              {FONT_SIZES.map((sz) => (
                <button key={sz.key} onClick={() => update({ fontSize: sz.key })}
                  className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                    draft.fontSize === sz.key ? "bg-stone-950 text-white border-stone-950" : "bg-white border-stone-200 hover:border-stone-300"
                  }`}>
                  {sz.label}
                </button>
              ))}
            </div>
          </section>


          <section className="bg-white border border-stone-200 rounded-md p-5">
            <h2 className="text-xs uppercase tracking-widest font-bold mb-4">Paleta</h2>
            <div className="space-y-3">
              {colorFields.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <label className="text-sm flex-1">{f.label}</label>
                  <input type="color" value={draft.colors[f.key]}
                    onChange={(e) => updateColor(f.key, e.target.value)}
                    className="w-10 h-10 rounded border border-stone-200 cursor-pointer" />
                  <input type="text" value={draft.colors[f.key]}
                    onChange={(e) => updateColor(f.key, e.target.value)}
                    className="w-24 border border-stone-200 rounded px-2 py-1 text-xs font-mono" />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-stone-200 rounded-md p-5">
            <h2 className="text-xs uppercase tracking-widest font-bold mb-4">Logotipo</h2>
            <input type="file" accept="image/*"
              onChange={(e) => e.target.files?.[0] && onLogo(e.target.files[0])}
              className="text-sm mb-3" />
            {draft.logoUrl && (
              <div className="bg-stone-100 p-4 rounded border border-stone-200 flex justify-center">
                <img src={draft.logoUrl} alt="Logo" className="max-h-24 object-contain" />
              </div>
            )}
          </section>

          <div className="flex gap-2">
            <button onClick={salvar} className="bg-stone-950 text-white px-6 py-2.5 rounded text-sm font-medium">
              Salvar aparência
            </button>
            <button onClick={restaurar} className="border border-stone-200 px-6 py-2.5 rounded text-sm">
              Restaurar padrão
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-xs uppercase tracking-widest font-bold mb-4">Prévia</h2>
          <div className="bg-white border border-stone-200 rounded-md p-6 space-y-4">
            {draft.logoUrl && <img src={draft.logoUrl} alt="Logo" className="max-h-16 object-contain" />}
            <h3 className="font-display text-3xl">Porcelane</h3>
            <p className="text-sm text-stone-500">Materiais nobres — mármore, granito, quartzo e quartzito.</p>
            <div className="flex gap-2">
              <button className="bg-stone-950 text-white px-4 py-2 rounded text-sm">Botão primário</button>
              <button className="border border-stone-200 px-4 py-2 rounded text-sm">Secundário</button>
            </div>
            <div className="border border-stone-200 rounded p-3 text-sm">
              Exemplo de card com bordas discretas e tipografia Inter no corpo.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
