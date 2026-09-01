import { useEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Plus, Maximize2, Move } from "lucide-react";

const MIN = 0.4;
const MAX = 6;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Visualizador com zoom (roda do mouse ancorada no cursor) e arraste. Apenas visual. */
export function DrawingZoom({ children, className = "" }: { children: ReactNode; className?: string }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom: z, offset: off } = stateRef.current;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const next = clamp(z * Math.exp(-dy * 0.0018), MIN, MAX);
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = next / z;
      setOffset({ x: px - (px - off.x) * k, y: py - (py - off.y) * k });
      setZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomAtCenter = (factor: number) => {
    const el = boxRef.current;
    const { zoom: z, offset: off } = stateRef.current;
    const next = clamp(z * factor, MIN, MAX);
    const rect = el?.getBoundingClientRect();
    const px = (rect?.width ?? 0) / 2;
    const py = (rect?.height ?? 0) / 2;
    const k = next / z;
    setOffset({ x: px - (px - off.x) * k, y: py - (py - off.y) * k });
    setZoom(next);
  };

  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  return (
    <div className={"relative " + className}>
      <div className="no-print absolute right-2 top-2 z-10 flex items-center gap-1 bg-white/90 backdrop-blur border border-stone-200 rounded-md px-1 py-1">
        <button onClick={() => zoomAtCenter(1 / 1.2)} title="Diminuir" className="size-6 grid place-items-center text-stone-500 hover:text-stone-950"><Minus className="size-3.5" /></button>
        <span className="text-[10px] tabular-nums text-stone-500 w-9 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => zoomAtCenter(1.2)} title="Aumentar" className="size-6 grid place-items-center text-stone-500 hover:text-stone-950"><Plus className="size-3.5" /></button>
        <button onClick={reset} title="Ajustar à tela" className="size-6 grid place-items-center text-stone-500 hover:text-stone-950"><Maximize2 className="size-3.5" /></button>
        <span className="text-[9px] text-stone-400 px-1" title="Segure Shift e arraste para mover">shift+arrastar</span>
        <Move className="size-3 text-stone-300" />
      </div>
      <div
        ref={boxRef}
        onPointerDown={(e) => {
          if (!(e.button === 1 || e.shiftKey || e.altKey)) return;
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        className="overflow-hidden touch-none cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
      >
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
