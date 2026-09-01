/**
 * Visualizador de documentos — zoom apenas visual.
 * Nunca altera medidas reais: só aplica transform de escala na pré-visualização.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Crosshair, Expand } from "lucide-react";

const MIN = 0.25;
const MAX = 4;
const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n));

export function DocZoomViewer({ children, toolbarExtra }: { children: ReactNode; toolbarExtra?: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.8);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [full, setFull] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };

  const fit = () => {
    const wrap = wrapRef.current;
    const el = contentRef.current?.firstElementChild as HTMLElement | undefined;
    if (!wrap || !el) return;
    const z = clamp((wrap.clientWidth - 32) / el.offsetWidth);
    setZoom(z);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    const t = setTimeout(fit, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const cur = stateRef.current;
      const next = clamp(cur.zoom * Math.exp(-dy * 0.0015));
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const k = next / cur.zoom;
      setOffset({ x: px - (px - cur.offset.x) * k, y: py - (py - cur.offset.y) * k });
      setZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  };
  const endDrag = () => { drag.current = null; };

  return (
    <div className={full ? "fixed inset-0 z-50 bg-stone-100 flex flex-col" : "flex flex-col"}>
      <div className="no-print flex items-center gap-2 flex-wrap p-2 bg-white border border-stone-200">
        <button onClick={() => setZoom((z) => clamp(z * 1.2))} className="kanban-btn flex items-center gap-1" title="Ampliar"><ZoomIn className="size-3" /> Zoom +</button>
        <button onClick={() => setZoom((z) => clamp(z / 1.2))} className="kanban-btn flex items-center gap-1" title="Reduzir"><ZoomOut className="size-3" /> Zoom −</button>
        <button onClick={fit} className="kanban-btn flex items-center gap-1"><Minimize2 className="size-3" /> Ajustar à tela</button>
        <button onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} className="kanban-btn flex items-center gap-1"><Expand className="size-3" /> Tamanho original</button>
        <button onClick={() => setOffset({ x: 0, y: 0 })} className="kanban-btn flex items-center gap-1"><Crosshair className="size-3" /> Centralizar</button>
        <button onClick={() => setFull((v) => !v)} className="kanban-btn flex items-center gap-1"><Maximize2 className="size-3" /> {full ? "Sair da tela cheia" : "Tela cheia"}</button>
        <span className="text-[11px] text-stone-500 font-mono">{Math.round(zoom * 100)}%</span>
        {toolbarExtra}
      </div>

      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="doc-viewer-surface flex-1 overflow-hidden bg-stone-200 p-4 cursor-grab active:cursor-grabbing"
        style={{ minHeight: full ? undefined : "70vh" }}
      >
        <div
          ref={contentRef}
          className="doc-viewer-content origin-top-left"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, width: "fit-content" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
