import { useMemo, useRef, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { X, Download, MessageCircle } from "lucide-react";
import type { Environment, Material } from "@/lib/types";
import { detectStoneColor } from "@/lib/piece-recognition";

type Props = {
  open: boolean;
  onClose: () => void;
  env: Environment;
  material?: Material;
  clientName?: string;
  clientPhone?: string;
};

/**
 * Prévia 3D rápida do ambiente do orçamento.
 * Renderiza cada item como uma bancada em pedra usando a textura do material
 * (quando cadastrada). Não substitui o QuickRoom da Liberação Técnica.
 */
export function Quote3DPreview({ open, onClose, env, material, clientName, clientPhone }: Props) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const stoneColor = useMemo(
    () => detectStoneColor(env.material_name || material?.name || "")?.color ?? "#e8e4dd",
    [env.material_name, material?.name],
  );

  // Layout simples: itens dispostos lado a lado numa "sala virtual".
  const pieces = useMemo(() => {
    const arr: { w: number; l: number; t: number; x: number; z: number; label: string }[] = [];
    let cursorX = 0;
    const thickness = 0.02;
    for (const it of env.items) {
      const qty = Math.max(1, it.qty ?? 1);
      for (let q = 0; q < qty; q++) {
        const w = Math.max(0.2, Number(it.length) || 0.6);
        const l = Math.max(0.2, Number(it.width) || 0.4);
        const t = (it.thickness_mm ? it.thickness_mm / 1000 : thickness);
        arr.push({ w, l, t, x: cursorX + w / 2, z: 0, label: it.description || "peça" });
        cursorX += w + 0.06;
      }
    }
    return arr;
  }, [env.items]);

  const totalWidth = pieces.reduce((s, p) => s + p.w + 0.06, 0) || 2;

  const exportPng = async () => {
    const canvas = canvasWrapRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    setBusy(true);
    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `previa-${(env.name || "ambiente").replace(/\s+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setBusy(false);
    }
  };

  const sendWhatsapp = () => {
    const phone = (clientPhone || "").replace(/\D/g, "");
    const text = encodeURIComponent(
      `Olá${clientName ? ` ${clientName}` : ""}! Segue a prévia 3D do ambiente ${env.name}${material?.name ? ` em ${material.name}` : ""}.`,
    );
    // Baixa a imagem antes para o usuário anexar manualmente (WhatsApp Web não aceita imagem via URL simples).
    void exportPng();
    const base = phone
      ? `https://wa.me/${phone.length === 11 ? "55" + phone : phone}?text=${text}`
      : `https://web.whatsapp.com/send?text=${text}`;
    window.open(base, "_blank", "noopener");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border border-stone-300 w-full max-w-4xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200 p-4">
          <div>
            <div className="label-eyebrow">Prévia 3D</div>
            <div className="font-display text-xl">
              {env.name}
              {material?.name && <span className="text-stone-500 text-sm ml-2">· {material.name}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-950" aria-label="Fechar">
            <X className="size-5" />
          </button>
        </div>

        <div ref={canvasWrapRef} className="h-[420px] w-full bg-stone-100">
          {pieces.length === 0 ? (
            <div className="h-full flex items-center justify-center text-stone-500 text-sm">
              Adicione ao menos um item com comprimento e largura para gerar a prévia.
            </div>
          ) : (
            <Canvas
              camera={{ position: [totalWidth * 0.9, 1.6, 2.2], fov: 42 }}
              gl={{ preserveDrawingBuffer: true, antialias: true }}
              shadows
            >
              <color attach="background" args={["#eaeaea"]} />
              <ambientLight intensity={0.55} />
              <directionalLight position={[3, 5, 4]} intensity={0.8} castShadow />
              <Suspense fallback={null}>
                {/* Chão */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[totalWidth / 2 - 0.06, -0.9, 0]} receiveShadow>
                  <planeGeometry args={[totalWidth * 2.2, 6]} />
                  <meshStandardMaterial color="#dcdcdc" />
                </mesh>
                {pieces.map((p, i) => (
                  <group key={i} position={[p.x - totalWidth / 2, 0, p.z]}>
                    {/* Base do móvel (representa o gabinete) */}
                    <mesh position={[0, -0.45, 0]}>
                      <boxGeometry args={[p.w, 0.9, p.l]} />
                      <meshStandardMaterial color="#f4f1ec" />
                    </mesh>
                    {/* Bancada (pedra) */}
                    <mesh position={[0, 0 + p.t / 2, 0]} castShadow>
                      <boxGeometry args={[p.w, p.t, p.l]} />
                      <TampoMaterial color={stoneColor} textureUrl={material?.texture_url ?? undefined} />
                    </mesh>
                  </group>
                ))}
                <OrbitControls makeDefault enablePan enableZoom enableRotate target={[0, 0, 0]} />
              </Suspense>
            </Canvas>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-stone-200 flex-wrap">
          <div className="text-xs text-stone-500">
            Arraste para girar · Scroll para aproximar · A imagem exportada é fiel ao que aparece na tela.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportPng}
              disabled={busy || pieces.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider font-bold border border-stone-300 hover:bg-stone-50 disabled:opacity-50"
            >
              <Download className="size-4" /> Baixar PNG
            </button>
            <button
              onClick={sendWhatsapp}
              disabled={pieces.length === 0}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider font-bold bg-stone-950 text-white hover:bg-stone-800 disabled:opacity-50"
            >
              <MessageCircle className="size-4" /> Enviar por WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TampoMaterial({ color, textureUrl }: { color: string; textureUrl?: string }) {
  const tex = useMemo(() => {
    if (!textureUrl) return null;
    const t = new THREE.TextureLoader().load(textureUrl);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
  }, [textureUrl]);
  return <meshStandardMaterial color={color} map={tex ?? undefined} roughness={0.55} metalness={0.05} />;
}
