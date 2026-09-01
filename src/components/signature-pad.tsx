import { useEffect, useRef, useState } from "react";
import { Eraser, Check } from "lucide-react";

type Props = {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  height?: number;
  label?: string;
};

/**
 * Assinatura digital em canvas — mouse e toque.
 * Retorna PNG data URL ou null quando limpa.
 */
export function SignaturePad({ value, onChange, height = 180, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(!!value);

  // Render valor inicial (data URL) no canvas quando montar.
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !value) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
      setHasInk(true);
    };
    img.src = value;
  }, [value]);

  // Ajusta densidade para telas retina.
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = cvs.getBoundingClientRect();
    cvs.width = Math.floor(rect.width * dpr);
    cvs.height = Math.floor(rect.height * dpr);
    const ctx = cvs.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, []);

  const pos = (e: PointerEvent | React.PointerEvent) => {
    const cvs = canvasRef.current!;
    const rect = cvs.getBoundingClientRect();
    return { x: (e as PointerEvent).clientX - rect.left, y: (e as PointerEvent).clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    lastRef.current = pos(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    const last = lastRef.current!;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    setHasInk(true);
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    const cvs = canvasRef.current;
    if (!cvs) return;
    onChange(cvs.toDataURL("image/png"));
  };

  const clear = () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    ctx?.clearRect(0, 0, cvs.width, cvs.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {label && <div className="label-eyebrow">{label}</div>}
      <div className="relative border border-stone-300 bg-white" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-stone-400 text-sm">
            Assine no espaço acima
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 uppercase tracking-wider text-stone-500 hover:text-red-700 font-bold"
        >
          <Eraser className="size-3" /> Limpar
        </button>
        {hasInk && (
          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
            <Check className="size-3" /> assinatura registrada
          </span>
        )}
      </div>
    </div>
  );
}
