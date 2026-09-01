import { Minus, Plus, RotateCcw } from "lucide-react";
import { useAppearance, FONT_SIZES } from "@/lib/appearance";

/** Controle global de zoom/fonte da interface (barra superior). */
export function ZoomControls() {
  const { settings, setSettings } = useAppearance();
  const zoom = settings.zoom ?? 1;

  const setZoom = (z: number) =>
    setSettings({ ...settings, zoom: Math.min(1.4, Math.max(0.75, +z.toFixed(2))) });

  return (
    <div className="flex items-center gap-1 no-print">
      <button
        onClick={() => setZoom(zoom - 0.05)}
        title="Diminuir zoom"
        className="size-7 grid place-items-center rounded-md border border-stone-200 bg-card text-stone-500 hover:text-stone-950"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="text-[11px] tabular-nums text-stone-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
      <button
        onClick={() => setZoom(zoom + 0.05)}
        title="Aumentar zoom"
        className="size-7 grid place-items-center rounded-md border border-stone-200 bg-card text-stone-500 hover:text-stone-950"
      >
        <Plus className="size-3.5" />
      </button>
      <button
        onClick={() => setSettings({ ...settings, zoom: 1, fontSize: "padrao" })}
        title="Resetar zoom e fonte"
        className="size-7 grid place-items-center rounded-md border border-stone-200 bg-card text-stone-500 hover:text-stone-950"
      >
        <RotateCcw className="size-3.5" />
      </button>
      <select
        value={settings.fontSize}
        onChange={(e) => setSettings({ ...settings, fontSize: e.target.value as any })}
        title="Tamanho da fonte"
        className="h-7 rounded-md border border-stone-200 bg-card text-[11px] px-1.5 text-stone-500"
      >
        {FONT_SIZES.map((f) => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>
    </div>
  );
}
