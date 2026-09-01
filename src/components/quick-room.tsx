import { useMemo, Suspense, useRef, useState, useCallback, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, DragControls } from "@react-three/drei";
import * as THREE from "three";
import { Plus, Trash2, Printer, Box } from "lucide-react";
import type {
  QuickRoom, FinishSide, Material, FinishType, RoomAccessory, AccessoryKind,
  RoomFinishEdge, CubaSubKind, CooktopSubKind, ChurrasqueiraSubKind, EdgeStyle, TampoShape, EnvItem,
  TechTranspasse,
} from "@/lib/types";
import { num } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { EDGE_STYLE_LABEL, detectStoneColor } from "@/lib/piece-recognition";


const SIDE_LABEL: Record<FinishSide, string> = {
  direito: "Direito", esquerdo: "Esquerdo", frente: "Frente", fundo: "Fundo",
  ambos: "Ambos os lados", superior: "Superior (topo)", inferior: "Inferior (base)",
};
const EDGE_SIDES: FinishSide[] = ["frente", "fundo", "esquerdo", "direito"];
const EDGE_SIDES_6: FinishSide[] = ["frente", "fundo", "esquerdo", "direito", "superior", "inferior"];

const ACC_LABEL: Record<AccessoryKind, string> = {
  cuba: "Cuba", cooktop: "Cooktop", torre_tomada: "Torre de tomada",
  churrasqueira: "Churrasqueira",
  torneira: "Torneira", valvula: "Válvula", ralo: "Ralo",
  coifa: "Coifa", forno: "Forno", microondas: "Micro-ondas",
  dispenser: "Dispenser", ponto_gas: "Ponto de gás", ponto_eletrico: "Ponto elétrico",
  vaso_sanitario: "Vaso sanitário", bide: "Bidê",
  lava_louca: "Lava-louça", lava_roupa: "Lava-roupa", geladeira: "Geladeira",
  adega: "Adega", lixeira: "Lixeira embutida",
  tabua: "Tábua embutida", escorredor: "Escorredor", porta_temperos: "Porta-temperos",
  sifao: "Sifão",
  outro: "Outro",
};
const ACC_COLOR: Record<AccessoryKind, string> = {
  cuba: "#0ea5e9", cooktop: "#ef4444", torre_tomada: "#f59e0b",
  churrasqueira: "#7c2d12",
  torneira: "#0284c7", valvula: "#64748b", ralo: "#475569",
  coifa: "#334155", forno: "#b91c1c", microondas: "#7c3aed",
  dispenser: "#059669", ponto_gas: "#f97316", ponto_eletrico: "#eab308",
  vaso_sanitario: "#94a3b8", bide: "#a3a3a3",
  lava_louca: "#0d9488", lava_roupa: "#0891b2", geladeira: "#1e293b",
  adega: "#701a75", lixeira: "#525252",
  tabua: "#a16207", escorredor: "#78716c", porta_temperos: "#ca8a04",
  sifao: "#6b7280",
  outro: "#6b7280",
};

const CUBA_SUBKINDS: { v: CubaSubKind; label: string; w: number; l: number }[] = [
  { v: "embutir_ret", label: "Cozinha · embutir retangular 50x40", w: 0.50, l: 0.40 },
  { v: "embutir_red", label: "Cozinha · embutir redonda Ø40", w: 0.40, l: 0.40 },
  { v: "apoio", label: "Cozinha · apoio (sobrepor) 45x35", w: 0.45, l: 0.35 },
  { v: "semi_encaixe", label: "Cozinha · semi encaixe 50x40", w: 0.50, l: 0.40 },
  { v: "gourmet_grande", label: "Gourmet · retangular 60x40", w: 0.60, l: 0.40 },
  { v: "gourmet_dupla", label: "Gourmet · dupla 80x40", w: 0.80, l: 0.40 },
  { v: "inox_simples", label: "Inox · simples 56x34", w: 0.56, l: 0.34 },
  { v: "inox_dupla", label: "Inox · dupla 86x40", w: 0.86, l: 0.40 },
  { v: "granito_esculpida_ret", label: "Esculpida em granito · retangular", w: 0.55, l: 0.38 },
  { v: "granito_esculpida_red", label: "Esculpida em granito · redonda", w: 0.42, l: 0.42 },
  { v: "banheiro_oval", label: "Banheiro · oval 45x32", w: 0.45, l: 0.32 },
  { v: "banheiro_ret", label: "Banheiro · retangular 40x28", w: 0.40, l: 0.28 },
  { v: "banheiro_red", label: "Banheiro · redonda Ø35", w: 0.35, l: 0.35 },
  { v: "salao_beleza", label: "Salão de beleza · lavatório", w: 0.55, l: 0.45 },
  { v: "tanque", label: "Tanque (área de serviço) 55x45", w: 0.55, l: 0.45 },
  { v: "utilidade", label: "Utilidade · pequena 30x30", w: 0.30, l: 0.30 },
];
const COOKTOP_SUBKINDS: { v: CooktopSubKind; label: string; w: number; l: number }[] = [
  { v: "2_bocas", label: "2 bocas", w: 0.30, l: 0.51 },
  { v: "4_bocas", label: "4 bocas", w: 0.58, l: 0.51 },
  { v: "5_bocas", label: "5 bocas", w: 0.72, l: 0.51 },
  { v: "6_bocas", label: "6 bocas", w: 0.90, l: 0.51 },
  { v: "gas_embutido", label: "A gás embutido", w: 0.75, l: 0.45 },
  { v: "inducao", label: "Indução", w: 0.60, l: 0.52 },
  { v: "inducao_4", label: "Indução 4 zonas", w: 0.60, l: 0.52 },
  { v: "inducao_5", label: "Indução 5 zonas", w: 0.75, l: 0.52 },
  { v: "eletrico", label: "Elétrico", w: 0.58, l: 0.51 },
  { v: "domino", label: "Dominó", w: 0.30, l: 0.52 },
];
const CHURRASQUEIRA_SUBKINDS: { v: ChurrasqueiraSubKind; label: string; w: number; l: number }[] = [
  { v: "gas", label: "A gás", w: 0.80, l: 0.55 },
  { v: "carvao", label: "A carvão", w: 0.90, l: 0.60 },
  { v: "eletrica", label: "Elétrica", w: 0.70, l: 0.50 },
  { v: "pre_moldada", label: "Pré-moldada", w: 1.00, l: 0.60 },
  { v: "bafo", label: "Bafo", w: 0.80, l: 0.60 },
];

const ACC_DEFAULT_SIZE: Record<AccessoryKind, { w: number; l: number }> = {
  cuba: { w: 0.5, l: 0.4 }, cooktop: { w: 0.6, l: 0.5 },
  torre_tomada: { w: 0.12, l: 0.12 },
  churrasqueira: { w: 0.85, l: 0.55 },
  torneira: { w: 0.08, l: 0.08 }, valvula: { w: 0.09, l: 0.09 }, ralo: { w: 0.10, l: 0.10 },
  coifa: { w: 0.90, l: 0.50 }, forno: { w: 0.60, l: 0.55 }, microondas: { w: 0.50, l: 0.35 },
  dispenser: { w: 0.08, l: 0.08 }, ponto_gas: { w: 0.06, l: 0.06 }, ponto_eletrico: { w: 0.10, l: 0.06 },
  vaso_sanitario: { w: 0.40, l: 0.65 }, bide: { w: 0.38, l: 0.55 },
  lava_louca: { w: 0.60, l: 0.60 }, lava_roupa: { w: 0.60, l: 0.60 }, geladeira: { w: 0.70, l: 0.70 },
  adega: { w: 0.45, l: 0.55 }, lixeira: { w: 0.25, l: 0.35 },
  tabua: { w: 0.40, l: 0.30 }, escorredor: { w: 0.40, l: 0.30 }, porta_temperos: { w: 0.30, l: 0.20 },
  sifao: { w: 0.15, l: 0.15 },
  outro: { w: 0.3, l: 0.3 },
};

const DEFAULTS = {
  width: 3, length: 4, height: 2.7, finish_side: "frente" as FinishSide,
  tile_w: 1.2, tile_l: 0.6, show_2d: true, show_3d: true, thickness_mm: 20,
  shape: "retangular" as TampoShape, diameter: 1.2,
};

export function emptyQuickRoom(): QuickRoom { return { ...DEFAULTS }; }

function normalize(r?: QuickRoom) {
  return {
    width: r?.width ?? DEFAULTS.width,
    length: r?.length ?? DEFAULTS.length,
    height: r?.height ?? DEFAULTS.height,
    thickness_mm: r?.thickness_mm ?? DEFAULTS.thickness_mm,
    shape: (r?.shape ?? DEFAULTS.shape) as TampoShape,
    diameter: r?.diameter ?? DEFAULTS.diameter,
    finish_side: r?.finish_side ?? DEFAULTS.finish_side,
    tile_w: r?.tile_w ?? DEFAULTS.tile_w,
    tile_l: r?.tile_l ?? DEFAULTS.tile_l,
    show_2d: r?.show_2d ?? DEFAULTS.show_2d,
    show_3d: r?.show_3d ?? DEFAULTS.show_3d,
    hide_2d_drawing: r?.hide_2d_drawing ?? false,
    hide_2d_pieces: r?.hide_2d_pieces ?? false,
    material_id: r?.material_id,
    material_color: r?.material_color,
    finish_edges: r?.finish_edges ?? [],
    accessories: r?.accessories ?? [],
    extra_dims_2d: r?.extra_dims_2d ?? [],
    extra_dims_3d: r?.extra_dims_3d ?? [],
  };
}

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const palette = ["#e8e4dd", "#d8d4cc", "#c8b9a6", "#a89c8f", "#6e6a64", "#3b3b3b", "#f4eee4", "#bfae95"];
  return palette[h % palette.length];
}

export function computeQuickRoom(r: QuickRoom, pricePerM2 = 0) {
  const n = normalize(r);
  const area = n.shape === "redondo" ? Math.PI * (n.diameter / 2) ** 2 : n.width * n.length;
  const tileArea = Math.max(0.01, n.tile_w * n.tile_l);
  const pieces = Math.ceil(area / tileArea);
  const piecesWaste = Math.ceil(pieces * 1.1);
  const edges = n.finish_edges.length > 0 ? n.finish_edges.map((e) => e.side) : [n.finish_side];
  let finish_m = 0;
  if (n.shape === "redondo") finish_m = Math.PI * n.diameter;
  else for (const s of edges) finish_m += finishLinear(n.width, n.length, s);
  const value = area * (pricePerM2 || 0);
  return { area, pieces, piecesWaste, finish_m, value };
}

function finishLinear(w: number, l: number, side: FinishSide): number {
  switch (side) {
    case "frente": case "fundo": return w;
    case "direito": case "esquerdo": return l;
    case "ambos": return 2 * l;
    case "superior": case "inferior": return 0;
  }
}

function formatCm(meters: number): string {
  const cm = (Number.isFinite(meters) ? meters : 0) * 100;
  return cm.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export type QuickRoomDocInfo = {
  companyName?: string;
  orderNumber?: string;
  clientName?: string;
  clientPhone?: string;
  address?: string;
  city?: string;
  envName?: string;
  materialName?: string;
  description?: string;
};

export function QuickRoomPanel(props: {
  value?: QuickRoom;
  onChange: (next: QuickRoom) => void;
  materials: Material[];
  finishTypes?: FinishType[];
  allowThickness?: boolean;
  docInfo?: QuickRoomDocInfo;
  quantity?: number;
  items?: EnvItem[];
  showPieceNumbers?: boolean;
  transpasses?: TechTranspasse[];
  transpasseMode?: boolean;
  onAddTranspasse?: (pieceIndex: number, side: "top" | "bottom" | "left" | "right") => void;
}) {


  const r = normalize(props.value);
  const mat = props.materials.find((m) => m.id === r.material_id);
  const autoStone = !mat && !r.material_color
    ? detectStoneColor(`${props.docInfo?.materialName ?? ""} ${props.docInfo?.description ?? ""}`)
    : undefined;
  const color = r.material_color || (mat ? hashColor(mat.name) : autoStone?.color || "#d8d4cc");
  const calc = computeQuickRoom(r, mat?.price_m2 ?? 0);
  const [extraFinishTypes, setExtraFinishTypes] = useState<FinishType[]>([]);
  const finishTypes = [...(props.finishTypes ?? []), ...extraFinishTypes];
  const [scale2D, setScale2D] = useState(70);
  const [legendScale, setLegendScale] = useState(100);
  const [addingFinish, setAddingFinish] = useState(false);
  const [newFinishName, setNewFinishName] = useState("");
  const [newFinishColor, setNewFinishColor] = useState("#b8860b");
  const [pieceFinishIds, setPieceFinishIds] = useState<string[]>([]);
  const addFinishType = async () => {
    const name = newFinishName.trim();
    if (!name) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase.from("finish_types")
      .insert({ name, color: newFinishColor, active: true, user_id: u.user.id }).select().single();
    if (!error && data) {
      setExtraFinishTypes((p) => [...p, data as FinishType]);
      setNewFinishName(""); setAddingFinish(false);
    }
  };

  const set = (patch: Partial<QuickRoom>) => props.onChange({ ...r, ...patch });

  const edgeFor = (side: FinishSide): RoomFinishEdge | undefined =>
    r.finish_edges.find((e) => e.side === side);
  const setEdge = (side: FinishSide, patch: Partial<RoomFinishEdge>) => {
    const cur = edgeFor(side);
    const list = r.finish_edges.filter((e) => e.side !== side);
    const next: RoomFinishEdge = { side, finish_type_id: cur?.finish_type_id, style: cur?.style, ...patch };
    if (next.finish_type_id || next.style) list.push(next);
    set({ finish_edges: list });
  };
  const cycleEdge = (side: FinishSide) => {
    if (finishTypes.length === 0) return;
    const cur = edgeFor(side);
    const idx = cur?.finish_type_id ? finishTypes.findIndex((f) => f.id === cur.finish_type_id) : -1;
    const next = idx + 1;
    if (next >= finishTypes.length) setEdge(side, { finish_type_id: undefined });
    else setEdge(side, { finish_type_id: finishTypes[next].id });
  };


  const addAccessory = (kind: AccessoryKind) => {
    let sz = ACC_DEFAULT_SIZE[kind];
    let subkind: RoomAccessory["subkind"];
    if (kind === "cuba") { const s = CUBA_SUBKINDS[0]; sz = { w: s.w, l: s.l }; subkind = s.v; }
    if (kind === "cooktop") { const s = COOKTOP_SUBKINDS[0]; sz = { w: s.w, l: s.l }; subkind = s.v; }
    if (kind === "churrasqueira") { const s = CHURRASQUEIRA_SUBKINDS[0]; sz = { w: s.w, l: s.l }; subkind = s.v; }
    const acc: RoomAccessory = {
      id: crypto.randomUUID(), kind, subkind,
      x: Math.max(0, r.width / 2 - sz.w / 2),
      y: Math.max(0, r.length / 2 - sz.l / 2),
      w: sz.w, l: sz.l, color: ACC_COLOR[kind],
    };
    set({ accessories: [...r.accessories, acc] });
  };
  const updateAccessory = (id: string, patch: Partial<RoomAccessory>) => {
    set({ accessories: r.accessories.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  };
  const removeAccessory = (id: string) => set({ accessories: r.accessories.filter((a) => a.id !== id) });

  const svgWrapRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const docHeaderHtml = (scalePct = 100, hideSensitive = false) => {
    const d = props.docInfo ?? {};
    const s = Math.max(80, Math.min(300, scalePct)) / 100;
    const px = (n: number) => Math.round(n * s);
    const parts: string[] = [];
    parts.push(`<div style="border-bottom:2px solid #111;padding-bottom:4mm;margin-bottom:4mm;display:flex;justify-content:space-between;gap:10mm">
      <div><div style="font-size:${px(16)}px;font-weight:bold">${d.companyName ?? ""}</div>
      <div style="font-size:${px(11)}px;margin-top:2mm;line-height:1.5">
        ${d.clientName ? `<div>Cliente: <strong>${d.clientName}</strong>${!hideSensitive && d.clientPhone ? ` · ${d.clientPhone}` : ""}</div>` : ""}
        ${!hideSensitive && d.address ? `<div>Obra: ${d.address}${d.city ? ` — ${d.city}` : ""}</div>` : ""}
        ${d.envName ? `<div>Ambiente: <strong>${d.envName}</strong></div>` : ""}
        ${d.materialName ? `<div>Material: <strong>${d.materialName}</strong></div>` : ""}
      </div></div>
      <div style="text-align:right">
        ${d.orderNumber ? `<div style="font-size:${px(11)}px;text-transform:uppercase;letter-spacing:.1em;color:#666">Pedido</div>
        <div style="font-size:${px(20)}px;font-weight:bold">${d.orderNumber}</div>` : ""}
        <div style="font-size:${px(11)}px;margin-top:2mm">${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
      </div>
    </div>`);
    return parts.join("");
  };

  const printSvg2D = useCallback(() => {
    const svg = svgWrapRef.current?.querySelector("svg");
    if (!svg) return;
    const hideSensitive = r.hide_2d_drawing && r.hide_2d_pieces;
    const header = docHeaderHtml(legendScale, hideSensitive);
    // Legenda de acabamentos (mesma lógica do <Legend/> em tela)
    const chips: { color: string; label: string }[] = [];
    const seenChip = new Set<string>();
    const pushChip = (e: RoomFinishEdge) => {
      const ft = finishTypes.find((f) => f.id === e.finish_type_id);
      const styleLabel = e.style ? EDGE_STYLE_LABEL[e.style] : undefined;
      if (!ft && !styleLabel) return; // sem tipo nem estilo = apenas lado default
      const name = ft?.name ?? styleLabel ?? "Acabamento";
      const label = ft?.name && styleLabel ? `${ft.name} · ${styleLabel}` : name;
      const color = ft?.color ?? "#b8860b";
      const key = `${color}::${label}`;
      if (seenChip.has(key)) return;
      seenChip.add(key);
      chips.push({ color, label });
    };
    for (const e of r.finish_edges ?? []) pushChip(e);
    for (const it of props.items ?? []) for (const e of it.finish_edges ?? []) pushChip(e);
    for (const id of pieceFinishIds) pushChip({ side: "frente", finish_type_id: id } as RoomFinishEdge);

    // Acessórios (cuba, cooktop, torre de tomada) — mostrar na legenda
    const accChips: { color: string; label: string }[] = [];
    const seenAcc = new Set<string>();
    for (const a of r.accessories ?? []) {
      const color = a.color ?? ACC_COLOR[a.kind];
      const sub = a.subkind ? ` · ${a.subkind.replace(/_/g, " ")}` : "";
      const extra = a.label ? ` · ${a.label}` : "";
      const label = `${ACC_LABEL[a.kind]}${sub}${extra}`;
      const key = `${color}::${label}`;
      if (seenAcc.has(key)) continue;
      seenAcc.add(key);
      accChips.push({ color, label });
    }

    const allChips = [...chips, ...accChips];
    const legendFontPx = Math.round(11 * (legendScale / 100));
    const legendLabelPx = Math.round(10 * (legendScale / 100));
    const legendSwatchPx = Math.round(12 * (legendScale / 100));
    const legendGapMm = Math.max(3, Math.round(5 * (legendScale / 100)));
    const legendHtml = allChips.length
      ? `<div class="legend-footer" style="margin-top:auto;border-top:1px solid #111;padding-top:3mm;display:flex;flex-wrap:wrap;gap:${legendGapMm}mm;font-size:${legendFontPx}px;align-items:center">
          <span style="font-size:${legendLabelPx}px;text-transform:uppercase;letter-spacing:.08em;color:#111;font-weight:700">Legenda de acabamentos:</span>
          ${allChips.map((c) => `<span style="display:inline-flex;align-items:center;gap:4px"><span style="display:inline-block;width:${legendSwatchPx}px;height:${legendSwatchPx}px;border:1px solid #111;background:${c.color};-webkit-print-color-adjust:exact;print-color-adjust:exact"></span>${c.label}</span>`).join("")}
        </div>`
      : "";

    // Garante namespace no SVG serializado (necessário para cores impressas em algumas janelas).
    const svgClone = svg.cloneNode(true) as SVGSVGElement;
    if (!svgClone.getAttribute("xmlns")) svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!svgClone.getAttribute("xmlns:xlink")) svgClone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    const svgMarkup = svgClone.outerHTML;

    const drawScalePct = Math.max(30, Math.min(400, scale2D));

    const html = `<!doctype html><html><head><title>Planta 2D</title>


      <style>@page{size:A4 landscape;margin:0}
      html,body{margin:0;padding:0;font-family:monospace;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{-webkit-print-color-adjust:exact;print-color-adjust:exact;display:flex;flex-direction:column;width:297mm;height:210mm;padding:6mm;overflow:hidden;box-sizing:border-box}
      .doc-header{flex:0 0 auto}
      h2{font-size:${Math.round(13 * (legendScale/100))}px;margin:1mm 0 2mm 0;flex:0 0 auto}
      /* 2D preto e branco — mantém a cor apenas nas bordas de acabamento */
      .drawing svg rect,.drawing svg circle{fill:#ffffff !important;stroke:#111 !important}
      .drawing svg line:not(.finish-edge){stroke:#111 !important}
      .drawing svg line.finish-edge{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .drawing svg text{fill:#111 !important;font-weight:600}
      .drawing svg .piece-name{transform-box:fill-box;transform-origin:center;transform:translateY(-${Math.max(0, Math.round((drawScalePct - 100) * 0.16))}px)}
      .drawing svg text[font-size="9"]{font-size:${(9 * (drawScalePct/100)).toFixed(2)}px !important}
      .drawing svg text[font-size="10"]{font-size:${(10 * (drawScalePct/100)).toFixed(2)}px !important}
      .drawing svg text[font-size="11"]{font-size:${(11 * (drawScalePct/100)).toFixed(2)}px !important}
      .drawing svg text[font-size="12"]{font-size:${(12 * (drawScalePct/100)).toFixed(2)}px !important}
      .drawing{flex:1 1 auto;width:100%;min-height:0;display:flex;justify-content:center;align-items:center;overflow:hidden;page-break-inside:avoid;break-inside:avoid}
      .drawing svg{width:100%;height:100%;display:block}
      .legend-footer{flex:0 0 auto}
      </style>
      </head><body>${header}<h2>Planta 2D</h2>
      <div class="drawing">${svgMarkup}</div>
      ${legendHtml}</body></html>`;


    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 250);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.shape, r.diameter, r.width, r.length, r.finish_edges, r.accessories, finishTypes, props.items, props.docInfo, pieceFinishIds, scale2D, legendScale]);



  const printSnapshot3D = useCallback(() => {
    const canvas = canvasWrapRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const hideSensitive = r.hide_2d_drawing && r.hide_2d_pieces;
    const header = docHeaderHtml(legendScale, hideSensitive);
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Visualização 3D</title>
      <style>@page{size:A4 landscape;margin:0}body{margin:0;padding:5mm;font-family:monospace}
      h2{font-size:${Math.round(13 * (legendScale/100))}px;margin:0 0 4mm}img{width:100%;height:auto;border:1px solid #ccc}</style>
      </head><body>${header}<h2>Visualização 3D</h2>
      <img src="${url}" alt="3D"/></body></html>`);

    w.document.close(); setTimeout(() => w.print(), 350);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.docInfo, legendScale]);

  return (
    <div className="border border-stone-200 bg-stone-50 px-4 py-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="label-eyebrow text-stone-700">Confirmação rápida (sem projeto)</p>
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-stone-950" checked={r.show_2d}
              onChange={(e) => set({ show_2d: e.target.checked })} />
            Mostrar Desenho 2D
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-stone-950" checked={r.show_3d}
              onChange={(e) => set({ show_3d: e.target.checked })} />
            Mostrar Visualização 3D
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-stone-950" checked={!!r.hide_2d_drawing}
              onChange={(e) => set({ hide_2d_drawing: e.target.checked })} />
            Imprimir 2D sem desenho
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-stone-950" checked={!!r.hide_2d_pieces}
              onChange={(e) => set({ hide_2d_pieces: e.target.checked })} />
            Imprimir 2D sem peças
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-700 bg-white border border-stone-200 px-3 py-2 font-mono">
        {typeof props.quantity === "number" && props.quantity > 0 && (
          <span><span className="text-stone-500">Qtd:</span> <b>{props.quantity}</b></span>
        )}
        <span>
          <span className="text-stone-500">{r.shape === "redondo" ? "Ø:" : "Larg × Comp:"}</span>{" "}
          <b>{r.shape === "redondo" ? `${num(r.diameter)} m` : `${num(r.width)} × ${num(r.length)} m`}</b>
        </span>
        <span><span className="text-stone-500">Espessura:</span> <b>{r.thickness_mm} mm</b></span>
        <span>
          <span className="text-stone-500">Cor / Modelo:</span>{" "}
          <b>{mat?.name ?? autoStone?.label ?? props.docInfo?.materialName ?? "—"}</b>
          {mat?.finish ? ` · ${mat.finish}` : ""}
        </span>
        <span><span className="text-stone-500">Formato:</span> <b>{r.shape === "redondo" ? "Redondo" : "Retangular"}</b></span>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Formato">
          <select value={r.shape} onChange={(e) => set({ shape: e.target.value as TampoShape })}
            className="w-full border border-stone-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-stone-950">
            <option value="retangular">Retangular</option>
            <option value="redondo">Redondo / Orgânico</option>
          </select>
        </Field>
        {r.shape === "redondo" ? (
          <Field label="Diâmetro (m)"><NumInput value={r.diameter} step={0.01} onChange={(v) => set({ diameter: v })} /></Field>
        ) : (
          <>
            <Field label="Largura (m)"><NumInput value={r.width} step={0.01} onChange={(v) => set({ width: v })} /></Field>
            <Field label="Comprimento (m)"><NumInput value={r.length} step={0.01} onChange={(v) => set({ length: v })} /></Field>
          </>
        )}
        {props.allowThickness ? (
          <Field label="Espessura (mm) ★">
            <NumInput value={r.thickness_mm} step={1} onChange={(v) => set({ thickness_mm: v })} />
          </Field>
        ) : (
          <Field label="Espessura (mm)">
            <input value={r.thickness_mm} disabled
              className="w-full border border-stone-200 bg-stone-100 px-2 py-1.5 text-sm font-mono text-right text-stone-400" />
          </Field>
        )}
      </div>

      {/* Acabamentos por face agora são definidos diretamente no 2D (clique na borda) ou no painel contextual da peça — sincroniza automaticamente com o 3D. */}



      {r.shape === "redondo" && (
        <div className="border border-stone-200 bg-white p-3">
          <Field label="Estilo da borda (perímetro)">
            <select value={edgeFor("frente")?.style ?? "boleado"} onChange={(ev) => setEdge("frente", { style: ev.target.value as EdgeStyle })}
              className="w-full border border-stone-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:border-stone-950">
              {(Object.keys(EDGE_STYLE_LABEL) as EdgeStyle[]).map((k) => (
                <option key={k} value={k}>{EDGE_STYLE_LABEL[k]}</option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {/* Acessórios */}
      <div className="border border-stone-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">
            Acessórios (arraste no 2D ou 3D)
          </p>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(ACC_LABEL) as AccessoryKind[]).map((k) => (
              <button key={k} type="button" onClick={() => addAccessory(k)}
                className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 border border-stone-300 hover:bg-stone-50 flex items-center gap-1">
                <span className="inline-block w-2 h-2" style={{ background: ACC_COLOR[k] }} /> <Plus className="size-3" /> {ACC_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
        {r.accessories.length > 0 && (
          <div className="space-y-1">
            {r.accessories.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs border-b border-stone-100 py-1 flex-wrap">
                <span className="inline-block w-3 h-3" style={{ background: a.color ?? ACC_COLOR[a.kind] }} />
                <span className="w-24 font-medium">{ACC_LABEL[a.kind]}</span>
                {a.kind === "cuba" && (
                  <select value={a.subkind ?? "embutir_ret"}
                    onChange={(e) => {
                      const s = CUBA_SUBKINDS.find((x) => x.v === e.target.value)!;
                      updateAccessory(a.id, { subkind: s.v as CubaSubKind, w: s.w, l: s.l });
                    }}
                    className="border border-stone-200 px-1.5 py-1 text-xs bg-white">
                    {CUBA_SUBKINDS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </select>
                )}
                {a.kind === "cooktop" && (
                  <select value={a.subkind ?? "4_bocas"}
                    onChange={(e) => {
                      const s = COOKTOP_SUBKINDS.find((x) => x.v === e.target.value)!;
                      updateAccessory(a.id, { subkind: s.v as CooktopSubKind, w: s.w, l: s.l });
                    }}
                    className="border border-stone-200 px-1.5 py-1 text-xs bg-white">
                    {COOKTOP_SUBKINDS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </select>
                )}
                {a.kind === "churrasqueira" && (
                  <select value={a.subkind ?? "gas"}
                    onChange={(e) => {
                      const s = CHURRASQUEIRA_SUBKINDS.find((x) => x.v === e.target.value)!;
                      updateAccessory(a.id, { subkind: s.v as ChurrasqueiraSubKind, w: s.w, l: s.l });
                    }}
                    className="border border-stone-200 px-1.5 py-1 text-xs bg-white">
                    {CHURRASQUEIRA_SUBKINDS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </select>
                )}
                <input value={a.label ?? ""} placeholder="Rótulo (opcional)" onChange={(e) => updateAccessory(a.id, { label: e.target.value })}
                  className="flex-1 min-w-[120px] border border-stone-200 px-1.5 py-1 text-xs bg-white" />
                <span className="text-stone-400">L</span>
                <NumInput value={a.w} step={0.01} onChange={(v) => updateAccessory(a.id, { w: v })} />
                <span className="text-stone-400">C</span>
                <NumInput value={a.l} step={0.01} onChange={(v) => updateAccessory(a.id, { l: v })} />
                <span className="text-stone-400 ml-1">X</span>
                <NumInput value={a.x} step={0.01} onChange={(v) => updateAccessory(a.id, { x: Math.max(0, Math.min(r.width - a.w, v)) })} />
                <span className="text-stone-400">Y</span>
                <NumInput value={a.y} step={0.01} onChange={(v) => updateAccessory(a.id, { y: Math.max(0, Math.min(r.length - a.l, v)) })} />
                <div className="flex gap-0.5">
                  <button type="button" title="Esquerda" onClick={() => updateAccessory(a.id, { x: 0.05 })}
                    className="text-[10px] px-1.5 py-0.5 border border-stone-200 hover:bg-stone-50">←</button>
                  <button type="button" title="Centro" onClick={() => updateAccessory(a.id, { x: Math.max(0, r.width / 2 - a.w / 2), y: Math.max(0, r.length / 2 - a.l / 2) })}
                    className="text-[10px] px-1.5 py-0.5 border border-stone-200 hover:bg-stone-50">•</button>
                  <button type="button" title="Direita" onClick={() => updateAccessory(a.id, { x: Math.max(0, r.width - a.w - 0.05) })}
                    className="text-[10px] px-1.5 py-0.5 border border-stone-200 hover:bg-stone-50">→</button>
                  <button type="button" title="Frente" onClick={() => updateAccessory(a.id, { y: Math.max(0, r.length - a.l - 0.05) })}
                    className="text-[10px] px-1.5 py-0.5 border border-stone-200 hover:bg-stone-50">↓</button>
                  <button type="button" title="Fundo" onClick={() => updateAccessory(a.id, { y: 0.05 })}
                    className="text-[10px] px-1.5 py-0.5 border border-stone-200 hover:bg-stone-50">↑</button>
                </div>
                <button type="button" onClick={() => removeAccessory(a.id)} className="text-stone-300 hover:text-red-600"><Trash2 className="size-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <Metric label="Área total" value={`${num(calc.area)} m²`} />
        <Metric label="Peças" value={String(calc.pieces)} />
        <Metric label="Peças (+10%)" value={String(calc.piecesWaste)} />
        <Metric label="Acabamento" value={`${num(calc.finish_m)} m`} />
        <Metric label="Valor estimado" value={mat ? `R$ ${num(calc.value)}` : "—"} />
      </div>

      <ArchitectAIPanel room={r} materialName={mat?.name ?? props.docInfo?.materialName} envName={props.docInfo?.envName} items={props.items} />

      {r.show_2d && (
        <div className="border border-stone-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <p className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Desenho 2D · planta</p>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-stone-500 font-bold">
                Desenho
                <input type="range" min={30} max={400} step={5} value={scale2D}
                  onChange={(e) => setScale2D(parseInt(e.target.value))}
                  className="accent-stone-950 w-28" />
                <span className="font-mono text-stone-700 normal-case w-12 text-right">{scale2D}%</span>
              </label>
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-stone-500 font-bold">
                Legenda
                <input type="range" min={80} max={250} step={10} value={legendScale}
                  onChange={(e) => setLegendScale(parseInt(e.target.value))}
                  className="accent-stone-950 w-24" />
                <span className="font-mono text-stone-700 normal-case w-12 text-right">{legendScale}%</span>
              </label>
              <button type="button" onClick={printSvg2D}
                className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 border border-stone-300 hover:bg-stone-50 flex items-center gap-1">
                <Printer className="size-3" /> Gerar PDF 2D
              </button>
            </div>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mr-1">Acabamentos:</span>
            {finishTypes.length === 0 && (
              <span className="text-[10px] text-stone-400">nenhum cadastrado —</span>
            )}
            {finishTypes.map((ft) => (
              <span key={ft.id} className="inline-flex items-center gap-1 border border-stone-300 px-1.5 py-0.5 text-[10px]">
                <span className="inline-block w-3 h-3 border border-stone-400" style={{ background: ft.color ?? "#b8860b" }} />
                {ft.name}
              </span>
            ))}
            {!addingFinish ? (
              <button type="button" onClick={() => setAddingFinish(true)}
                className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 border border-stone-300 hover:bg-stone-50">
                + Adicionar tipo
              </button>
            ) : (
              <span className="inline-flex items-center gap-1">
                <input autoFocus value={newFinishName} onChange={(e) => setNewFinishName(e.target.value)}
                  placeholder="Nome (ex: Reto polido)"
                  className="text-[11px] border border-stone-300 px-2 py-0.5 w-40" />
                <input type="color" value={newFinishColor} onChange={(e) => setNewFinishColor(e.target.value)}
                  className="w-7 h-6 border border-stone-300 p-0" />
                <button type="button" onClick={addFinishType}
                  className="text-[10px] uppercase font-bold px-2 py-0.5 bg-stone-900 text-white">Salvar</button>
                <button type="button" onClick={() => { setAddingFinish(false); setNewFinishName(""); }}
                  className="text-[10px] uppercase font-bold px-2 py-0.5 border border-stone-300">Cancelar</button>
              </span>
            )}
          </div>
          <div ref={svgWrapRef} style={{ width: `${scale2D}%`, margin: "0 auto" }}>
            <FloorPlan2D
              shape={r.shape} diameter={r.diameter}
              width={r.width} length={r.length}
              tileW={r.tile_w} tileL={r.tile_l}
              side={r.finish_side}
              edges={r.finish_edges} finishTypes={finishTypes}
              color={color}
              accessories={r.accessories}
              items={props.items}
              onMoveAccessory={(id, x, y) => updateAccessory(id, { x, y })}
              onRemoveAccessory={removeAccessory}
              onCycleEdge={cycleEdge}
              onPieceEdgesChange={setPieceFinishIds}
              showPieceNumbers={props.showPieceNumbers}
              transpasses={props.transpasses}
              transpasseMode={props.transpasseMode}
              onAddTranspasse={props.onAddTranspasse}
            />

          </div>
          <p className="mt-2 text-[10px] text-stone-500">Dica: clique <b>na peça</b>, perto da borda desejada, para aplicar/alternar o tipo de acabamento naquele lado.</p>
          <div className="mt-2" style={{ fontSize: `${legendScale}%` }}><Legend edges={resolveEdges(r.finish_edges, r.finish_side)} finishTypes={finishTypes} accessories={r.accessories} items={props.items} extraFinishIds={pieceFinishIds} /></div>

        </div>
      )}

      {r.show_3d && (
        <div className="border border-stone-200 bg-white p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Visualização 3D · arraste peças e a câmera</p>
            <button type="button" onClick={printSnapshot3D}
              className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 border border-stone-300 hover:bg-stone-50 flex items-center gap-1">
              <Box className="size-3" /> Gerar PDF 3D (snapshot)
            </button>
          </div>
          <div ref={canvasWrapRef} className="h-96 w-full bg-stone-100">
            <Suspense fallback={<div className="h-full grid place-items-center text-xs text-stone-400">Carregando 3D…</div>}>
              <Room3D
                shape={r.shape} diameter={r.diameter}
                width={r.width} length={r.length} height={r.height}
                thicknessMm={r.thickness_mm}
                side={r.finish_side}
                edges={r.finish_edges} finishTypes={finishTypes}
                color={color}
                textureUrl={mat?.texture_url ?? undefined}
                accessories={r.accessories}
                items={props.items}
                onMoveAccessory={(id, x, y) => updateAccessory(id, { x, y })}
              />
            </Suspense>
          </div>
          <Legend edges={resolveEdges(r.finish_edges, r.finish_side)} finishTypes={finishTypes} accessories={r.accessories} items={props.items} />
        </div>
      )}

    </div>
  );
}

// ExtraDimsEditor removido — cotagem agora mostra apenas medidas da peça.


function Field(p: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="block text-[10px] uppercase tracking-wider text-stone-500 font-bold">{p.label}</span>
      {p.children}
    </label>
  );
}
function NumInput(p: { value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <input type="number" step={p.step ?? 1} value={Number.isFinite(p.value) ? p.value : 0}
      onChange={(e) => p.onChange(parseFloat(e.target.value) || 0)}
      className="w-20 border border-stone-300 bg-white px-2 py-1.5 text-sm font-mono text-right focus:outline-none focus:border-stone-950" />
  );
}
function Metric(p: { label: string; value: string }) {
  return (
    <div className="border border-stone-200 bg-white px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">{p.label}</div>
      <div className="font-mono text-sm">{p.value}</div>
    </div>
  );
}

function resolveEdges(edges: RoomFinishEdge[], simple: FinishSide): RoomFinishEdge[] {
  if (edges && edges.length > 0) return edges;
  return [{ side: simple }];
}

export function Legend({ edges, finishTypes, accessories, items, extraFinishIds }: { edges: RoomFinishEdge[]; finishTypes: FinishType[]; accessories: RoomAccessory[]; items?: EnvItem[]; extraFinishIds?: string[] }) {
  // Agrega acabamentos do ambiente + acabamentos por item (dedup por cor+nome)
  const allEdges: RoomFinishEdge[] = [...edges];
  for (const it of items ?? []) {
    for (const e of it.finish_edges ?? []) allEdges.push(e);
  }
  for (const id of extraFinishIds ?? []) {
    allEdges.push({ side: "frente", finish_type_id: id } as RoomFinishEdge);
  }
  const seen = new Set<string>();
  const items2: { color: string; label: string }[] = [];
  for (const e of allEdges) {
    const ft = finishTypes.find((f) => f.id === e.finish_type_id);
    const styleLabel = e.style ? EDGE_STYLE_LABEL[e.style] : undefined;
    if (!ft && !styleLabel) continue;
    const name = ft?.name ?? styleLabel ?? "Acabamento";
    const label = ft?.name && styleLabel ? `${ft.name} · ${styleLabel}` : name;
    const color = ft?.color ?? "#b8860b";
    const key = `${color}::${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items2.push({ color, label });
  }
  if (items2.length === 0 && accessories.length === 0) return null;
  return (
    <div className="border border-stone-200 bg-stone-50 p-2 flex flex-wrap gap-3" style={{ fontSize: "0.75em" }}>
      <span className="uppercase tracking-wider text-stone-500 font-bold mr-1" style={{ fontSize: "0.85em" }}>Legenda:</span>
      {items2.map((it, i) => (
        <span key={`e${i}`} className="flex items-center gap-1.5">
          <span className="inline-block" style={{ background: it.color, width: "1em", height: "1em" }} />
          {it.label}
        </span>
      ))}
      {accessories.map((a) => (
        <span key={a.id} className="flex items-center gap-1.5">
          <span className="inline-block" style={{ background: a.color ?? ACC_COLOR[a.kind], width: "1em", height: "1em" }} />
          {ACC_LABEL[a.kind]}{a.subkind ? ` · ${a.subkind.replace(/_/g, " ")}` : ""}{a.label ? ` · ${a.label}` : ""}
        </span>
      ))}
    </div>
  );
}


/* ---------- Print Pages (2D + 3D) ---------- */
export function QuickRoomPrintPages(props: {
  value?: QuickRoom;
  materials: Material[];
  finishTypes: FinishType[];
  items?: EnvItem[];
  docInfo?: QuickRoomDocInfo;
}) {

  const r = normalize(props.value);
  const mat = props.materials.find((m) => m.id === r.material_id);
  const autoStone = !mat && !r.material_color ? detectStoneColor("") : undefined;
  const color = r.material_color || (mat ? hashColor(mat.name) : autoStone?.color || "#d8d4cc");
  const edges = resolveEdges(r.finish_edges, r.finish_side);
  const noop = () => {};
  const d = props.docInfo ?? {};
  const hideSensitive = r.hide_2d_drawing && r.hide_2d_pieces;
  const Header = () => (
    <div style={{ borderBottom: "2px solid #111", paddingBottom: "3mm", marginBottom: "4mm", display: "flex", justifyContent: "space-between", gap: "10mm", fontSize: "10pt" }}>
      <div>
        <div style={{ fontWeight: "bold", fontSize: "13pt" }}>{d.companyName ?? ""}</div>
        {d.orderNumber ? <div>Pedido: <b>{d.orderNumber}</b></div> : null}
        {d.envName ? <div>Ambiente: <b>{d.envName}</b></div> : null}
      </div>
      <div style={{ textAlign: "right" }}>
        {d.clientName ? <div><b>{d.clientName}</b></div> : null}
        {!hideSensitive && d.clientPhone ? <div>{d.clientPhone}</div> : null}
        {!hideSensitive && d.address ? <div>{d.address}{d.city ? ` · ${d.city}` : ""}</div> : null}
        {d.materialName ? <div>Pedra: {d.materialName}</div> : null}
      </div>
    </div>
  );
  return (
    <>
      {hideSensitive ? null : (
      <div className="a4-page print-page" style={{ pageBreakAfter: "always" }}>
        <Header />
        <h3 className="font-display text-xl font-bold mb-2">Planta 2D — cotas e acabamentos</h3>

        <div className="text-[11pt] text-stone-600 mb-3">
          {mat?.name ? mat.name : ""}
          {` · Espessura ${r.thickness_mm} mm`}
        </div>
        {r.hide_2d_drawing ? (
          <div className="mt-2 text-[11pt] text-stone-700 space-y-1">
            <div>Dimensões: <b>{r.shape === "redondo" ? `Ø ${r.diameter} m` : `${r.width} × ${r.length} m`}</b></div>
            <div>Espessura: <b>{r.thickness_mm} mm</b></div>
            {mat?.name && <div>Material: <b>{mat.name}</b></div>}
          </div>
        ) : (
          <>
            <div className="border border-stone-300 p-2 bg-white">
              <FloorPlan2D
                shape={r.shape} diameter={r.diameter}
                width={r.width} length={r.length}
                tileW={r.tile_w} tileL={r.tile_l}
                side={r.finish_side}
                edges={r.finish_edges} finishTypes={props.finishTypes}
                color={color}
                accessories={r.accessories}
                items={r.hide_2d_pieces ? undefined : props.items}
                onMoveAccessory={noop}
              />
            </div>
            <div className="mt-3">
              <Legend edges={edges} finishTypes={props.finishTypes} accessories={r.accessories} items={r.hide_2d_pieces ? undefined : props.items} />
            </div>
            <div className="mt-1 text-[9pt] text-stone-400 italic">Escala visual — não altera medidas reais.</div>
            <div className="mt-3 text-[10pt] text-stone-600">
              Eixos: largura no eixo X · comprimento no eixo Y. Acabamentos coloridos indicam o lado e o estilo de borda.
            </div>
          </>
        )}
      </div>
      )}


      <div className="a4-page print-page">
        <Header />
        <h3 className="font-display text-xl font-bold mb-2">Vista 3D — projeto</h3>

        <div className="text-[11pt] text-stone-600 mb-3">
          {mat?.name ? `Granito/Pedra: ${mat.name}` : "Pedra"}
        </div>
        <div className="border border-stone-300 bg-stone-100 h-[18cm] w-full print-canvas-area">
          <Suspense fallback={<div className="h-full grid place-items-center text-xs text-stone-400">Carregando 3D…</div>}>
            <Room3D
              shape={r.shape} diameter={r.diameter}
              width={r.width} length={r.length} height={r.height}
              thicknessMm={r.thickness_mm}
              side={r.finish_side}
              edges={r.finish_edges} finishTypes={props.finishTypes}
              color={color}
              textureUrl={mat?.texture_url ?? undefined}
              accessories={r.accessories}
              onMoveAccessory={noop}
            />
          </Suspense>
        </div>
        <div className="mt-3">
          <Legend edges={edges} finishTypes={props.finishTypes} accessories={r.accessories} items={props.items} />
        </div>
        <div className="mt-1 text-[9pt] text-stone-400 italic">Escala visual — não altera medidas reais.</div>
      </div>
    </>
  );
}


/* ---------- 2D ---------- */
export function FloorPlan2D(p: {
  shape: TampoShape; diameter: number;
  width: number; length: number; tileW: number; tileL: number;
  side: FinishSide; edges: RoomFinishEdge[]; finishTypes: FinishType[];
  color: string;
  accessories: RoomAccessory[];
  items?: EnvItem[];
  onMoveAccessory: (id: string, x: number, y: number) => void;
  onRemoveAccessory?: (id: string) => void;
  onCycleEdge?: (side: FinishSide) => void;
  onPieceEdgesChange?: (finishTypeIds: string[]) => void;
  /** Numeração das peças (Ordem de Corte). */
  showPieceNumbers?: boolean;
  /** Transpasses definidos manualmente na Liberação Técnica. */
  transpasses?: TechTranspasse[];
  /** Quando ativo, clicar numa borda cria um transpasse em vez de abrir o acabamento. */
  transpasseMode?: boolean;
  onAddTranspasse?: (pieceIndex: number, side: "top" | "bottom" | "left" | "right") => void;
}) {

  const isRound = p.shape === "redondo";
  const hasItems = !isRound && Array.isArray(p.items) && p.items.length > 0;

  // Build pieces from items (expanding qty) when provided; otherwise from tile grid.
  type PieceEdges = { top?: string; bottom?: string; left?: string; right?: string };
  type Piece = { id: string; x: number; y: number; w: number; l: number; label?: string; qty?: number; edges?: PieceEdges };
  const cols = Math.max(1, Math.ceil(Math.max(0.1, p.width) / p.tileW));
  const rows = Math.max(1, Math.ceil(Math.max(0.1, p.length) / p.tileL));

  const itemsKey = hasItems
    ? p.items!.map((it) => {
      const edgeKey = (it.finish_edges ?? []).map((e) => `${e.side}:${e.finish_type_id ?? ""}:${e.style ?? ""}`).join(",");
      return `${it.id}:${it.length}x${it.width}x${it.qty ?? 1}:${it.description ?? ""}:${edgeKey}`;
    }).join("|")
    : `grid:${cols}x${rows}-${p.tileW}x${p.tileL}`;

  const [pieces, setPieces] = useState<Piece[]>([]);
  const [lastKey, setLastKey] = useState<string>("");
  const SIDE_TO_PIECE: Partial<Record<FinishSide, keyof PieceEdges>> = {
    fundo: "top", frente: "bottom", esquerdo: "left", direito: "right",
  };
  const buildPieceEdges = (it: EnvItem): PieceEdges => {
    const eds: PieceEdges = {};
    for (const e of it.finish_edges ?? []) {
      const k = SIDE_TO_PIECE[e.side];
      if (k && e.finish_type_id) eds[k] = e.finish_type_id;
    }
    return eds;
  };
  if (itemsKey !== lastKey) {
    const next: Piece[] = [];
    if (hasItems) {
      // shelf packer (left-to-right, wrap)
      const GAP = 0.05;
      let x = 0, y = 0, rowH = 0;
      const maxRowW = Math.max(p.width, 2.4);
      for (const it of p.items!) {
        const q = it.qty && it.qty > 0 ? Math.round(it.qty) : 1;
        const pw = Math.max(0.05, it.length);
        const pl = Math.max(0.05, it.width);
        const eds = buildPieceEdges(it);
        for (let i = 0; i < q; i++) {
          if (x + pw > maxRowW && x > 0) { x = 0; y += rowH + GAP; rowH = 0; }
          next.push({ id: `it-${it.id}-${i}`, x, y, w: pw, l: pl, label: it.description, qty: q, edges: { ...eds } });
          x += pw + GAP;
          rowH = Math.max(rowH, pl);
        }
      }
    } else {
      for (let rr = 0; rr < rows; rr++) {
        for (let cc = 0; cc < cols; cc++) {
          next.push({ id: `p-${rr}-${cc}`, x: cc * p.tileW, y: rr * p.tileL, w: p.tileW, l: p.tileL, edges: {} });
        }
      }
    }
    setPieces(next);
    setLastKey(itemsKey);
  }

  // Notifica o pai com os finish_type_ids atualmente aplicados nas peças (para legenda do PDF/tela)
  const pieceEdgeIds = useMemo(() => {
    const s = new Set<string>();
    for (const pc of pieces) {
      const e = pc.edges ?? {};
      if (e.top) s.add(e.top);
      if (e.bottom) s.add(e.bottom);
      if (e.left) s.add(e.left);
      if (e.right) s.add(e.right);
    }
    return Array.from(s);
  }, [pieces]);
  const pieceEdgeKey = pieceEdgeIds.slice().sort().join("|");
  const onPieceEdgesChange = p.onPieceEdgesChange;
  useEffect(() => {
    onPieceEdgesChange?.(pieceEdgeIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceEdgeKey]);


  const cyclePieceEdge = (pieceId: string, side: keyof PieceEdges) => {
    if (p.finishTypes.length === 0) return;
    setPieces((prev) => prev.map((pc) => {
      if (pc.id !== pieceId) return pc;
      const cur = pc.edges?.[side];
      const idx = cur ? p.finishTypes.findIndex((f) => f.id === cur) : -1;
      const nx = idx + 1;
      const nextId = nx >= p.finishTypes.length ? undefined : p.finishTypes[nx].id;
      return { ...pc, edges: { ...(pc.edges ?? {}), [side]: nextId } };
    }));
  };


  // Working canvas dimensions in world units
  const bboxW = hasItems ? Math.max(0.5, ...pieces.map((pc) => pc.x + pc.w), p.width) : Math.max(0.1, p.width);
  const bboxL = hasItems ? Math.max(0.5, ...pieces.map((pc) => pc.y + pc.l), p.length) : Math.max(0.1, p.length);
  const W = isRound ? Math.max(0.1, p.diameter) : bboxW;
  const L = isRound ? Math.max(0.1, p.diameter) : bboxL;
  const MAXW = 1400, MAXH = 990;
  const PAD_X = hasItems ? 44 : 42;
  const PAD_Y = hasItems ? 146 : 52;
  const scale = Math.min((MAXW - 2 * PAD_X) / W, (MAXH - 2 * PAD_Y) / L);
  const w = W * scale, h = L * scale;
  const ox = (MAXW - w) / 2, oy = (MAXH - h) / 2;


  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const clickStart = useRef<{ sx: number; sy: number; pcId?: string } | null>(null);
  type PieceEdgeSide = "top" | "bottom" | "left" | "right";
  const [edgeMenu, setEdgeMenu] = useState<{ pieceId: string; side: PieceEdgeSide; sx: number; sy: number } | null>(null);
  const setPieceEdgeType = (pieceId: string, side: PieceEdgeSide, ftId?: string) => {
    setPieces((prev) => prev.map((pc) => pc.id === pieceId
      ? { ...pc, edges: { ...(pc.edges ?? {}), [side]: ftId } } : pc));
  };


  const edges = p.edges.length > 0 ? p.edges : [{ side: p.side } as RoomFinishEdge];

  const sideToCoords = (s: FinishSide): { x1: number; y1: number; x2: number; y2: number }[] => {
    const top = { x1: ox, y1: oy, x2: ox + w, y2: oy };
    const bottom = { x1: ox, y1: oy + h, x2: ox + w, y2: oy + h };
    const left = { x1: ox, y1: oy, x2: ox, y2: oy + h };
    const right = { x1: ox + w, y1: oy, x2: ox + w, y2: oy + h };
    if (s === "fundo") return [top];
    if (s === "frente") return [bottom];
    if (s === "esquerdo") return [left];
    if (s === "direito") return [right];
    return [left, right];
  };

  const clientToWorld = (e: React.PointerEvent) => {
    const svg = svgRef.current; if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (MAXW / rect.width);
    const sy = (e.clientY - rect.top) * (MAXH / rect.height);
    return { wx: (sx - ox) / scale, wy: (sy - oy) / scale };
  };
  const nearestEdge = (wx: number, wy: number): FinishSide => {
    const dTop = Math.max(0, wy), dBot = Math.max(0, L - wy);
    const dLef = Math.max(0, wx), dRig = Math.max(0, W - wx);
    const m = Math.min(dTop, dBot, dLef, dRig);
    if (m === dTop) return "fundo";
    if (m === dBot) return "frente";
    if (m === dLef) return "esquerdo";
    return "direito";
  };
  const onPointerDownAcc = (e: React.PointerEvent, acc: RoomAccessory) => {
    const pt = clientToWorld(e); if (!pt) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({ id: acc.id, dx: pt.wx - acc.x, dy: pt.wy - acc.y });
  };
  const onPointerDownPiece = (e: React.PointerEvent, pc: { id: string; x: number; y: number }) => {
    const pt = clientToWorld(e); if (!pt) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({ id: pc.id, dx: pt.wx - pc.x, dy: pt.wy - pc.y });
    clickStart.current = { sx: e.clientX, sy: e.clientY, pcId: pc.id };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const pt = clientToWorld(e); if (!pt) return;
    if (drag.id.startsWith("p-") || drag.id.startsWith("it-")) {
      setPieces((prev) => prev.map((pc) => pc.id === drag.id
        ? { ...pc, x: pt.wx - drag.dx, y: pt.wy - drag.dy } : pc));
      return;
    }

    const acc = p.accessories.find((a) => a.id === drag.id); if (!acc) return;
    let nx = pt.wx - drag.dx, ny = pt.wy - drag.dy;
    nx = Math.max(0, Math.min(W - acc.w, nx));
    ny = Math.max(0, Math.min(L - acc.l, ny));
    p.onMoveAccessory(drag.id, nx, ny);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    // Clique (sem drag) numa peça → abre menu de acabamento no lado mais próximo DA PEÇA
    if (clickStart.current) {
      const ddx = e.clientX - clickStart.current.sx;
      const ddy = e.clientY - clickStart.current.sy;
      const moved = ddx * ddx + ddy * ddy;
      const pcId = clickStart.current.pcId;
      if (moved < 25 && pcId) {
        const pc = pieces.find((z) => z.id === pcId);
        const pt = clientToWorld(e);
        const svg = svgRef.current;
        if (pc && pt && svg) {
          const localX = pt.wx - pc.x, localY = pt.wy - pc.y;
          const dT = Math.max(0, localY), dB = Math.max(0, pc.l - localY);
          const dL = Math.max(0, localX), dR = Math.max(0, pc.w - localX);
          const m = Math.min(dT, dB, dL, dR);
          const side: PieceEdgeSide = m === dT ? "top" : m === dB ? "bottom" : m === dL ? "left" : "right";
          if (p.transpasseMode && p.onAddTranspasse) {
            p.onAddTranspasse(pieces.findIndex((z) => z.id === pc.id), side);
          } else {
            const rect = svg.getBoundingClientRect();
            const sx = (e.clientX - rect.left) * (MAXW / rect.width);
            const sy = (e.clientY - rect.top) * (MAXH / rect.height);
            setEdgeMenu({ pieceId: pc.id, side, sx, sy });
          }
        }
      } else if (moved < 25 && !pcId && p.onCycleEdge) {
        const pt = clientToWorld(e);
        if (pt) p.onCycleEdge(nearestEdge(pt.wx, pt.wy));
      }
    }
    clickStart.current = null;
    setDrag(null);
  };

  const onDoubleClickSvg = () => setLastKey("");

  return (
    <svg ref={svgRef} viewBox={`0 0 ${MAXW} ${MAXH}`} className="w-full h-auto touch-none"
      onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={onDoubleClickSvg}>

      {isRound ? (() => {
        const perim = p.edges.find((e) => e.finish_type_id) ?? edges[0];
        const ft = p.finishTypes.find((f) => f.id === perim?.finish_type_id);
        const ringCol = ft?.color;
        const cx = ox + w / 2, cy = oy + h / 2, rad = w / 2;
        const cmD = formatCm(p.diameter);
        return (
          <g style={{ cursor: p.onCycleEdge ? "pointer" : "default" }}
            onClick={(ev) => { ev.stopPropagation(); p.onCycleEdge?.("ambos"); }}>
            <circle cx={cx} cy={cy} r={rad} fill={p.color} stroke="#3b3b3b" strokeWidth={1.5} />
            {ringCol && (
              <circle cx={cx} cy={cy} r={rad - 2} fill="none" stroke={ringCol} strokeWidth={5} pointerEvents="none" />
            )}
            {/* Cota diâmetro */}
            <line x1={cx - rad} y1={cy} x2={cx + rad} y2={cy} stroke="#3b3b3b" strokeWidth={0.8} strokeDasharray="4 3" pointerEvents="none" />
            <line x1={cx - rad} y1={cy - 6} x2={cx - rad} y2={cy + 6} stroke="#3b3b3b" strokeWidth={1} pointerEvents="none" />
            <line x1={cx + rad} y1={cy - 6} x2={cx + rad} y2={cy + 6} stroke="#3b3b3b" strokeWidth={1} pointerEvents="none" />
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize={12} fill="#111827" fontFamily="monospace" fontWeight="bold" pointerEvents="none">
              Ø {cmD} cm
            </text>
            {p.onCycleEdge && (
              <title>Clique para alternar acabamento do perímetro</title>
            )}
          </g>
        );
      })() : (
        <>
          {!hasItems && (
            <rect x={ox} y={oy} width={w} height={h} fill="#f5f5f4" stroke="#3b3b3b" strokeWidth={1} strokeDasharray="4 3" />
          )}
          {pieces.map((pc, pcIdx) => {
            const px = ox + pc.x * scale;
            const py = oy + pc.y * scale;
            const pw = pc.w * scale;
            const pl = pc.l * scale;
            const labelFs = 11;
            const edgeColor = (id?: string) => {
              if (!id) return null;
              return p.finishTypes.find((f) => f.id === id)?.color ?? "#b8860b";
            };
            const eT = edgeColor(pc.edges?.top);
            const eB = edgeColor(pc.edges?.bottom);
            const eL = edgeColor(pc.edges?.left);
            const eR = edgeColor(pc.edges?.right);
            const nameText = pc.label ? (pc.label.length > 26 ? pc.label.slice(0, 26) + "…" : pc.label) : "";
            const COTA_OFF = 38;
            const COTA_LABEL_GAP = 18;
            const NAME_OFF = COTA_OFF + COTA_LABEL_GAP + 50;
            const cotaWLabel = `${formatCm(pc.w)} cm`;
            const cotaLLabel = `${formatCm(pc.l)} cm`;
            const pieceTps = (p.transpasses ?? []).filter((t) => t.piece_index === pcIdx);
            return (
              <g key={pc.id} style={{ cursor: "move" }} onPointerDown={(e) => onPointerDownPiece(e, pc)}>
                <rect x={px} y={py} width={pw} height={pl}
                  fill={p.color} stroke="#3b3b3b" strokeWidth={1.2} />
                {eT && <line className="finish-edge" x1={px} y1={py} x2={px + pw} y2={py} stroke={eT} strokeWidth={4} pointerEvents="none" />}
                {eB && <line className="finish-edge" x1={px} y1={py + pl} x2={px + pw} y2={py + pl} stroke={eB} strokeWidth={4} pointerEvents="none" />}
                {eL && <line className="finish-edge" x1={px} y1={py} x2={px} y2={py + pl} stroke={eL} strokeWidth={4} pointerEvents="none" />}
                {eR && <line className="finish-edge" x1={px + pw} y1={py} x2={px + pw} y2={py + pl} stroke={eR} strokeWidth={4} pointerEvents="none" />}
                {/* Transpasses: somente o trecho definido aparece tracejado */}
                {pieceTps.map((t) => {
                  const d = Math.max(0, t.value_m) * scale;
                  const label = t.value_m.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                  const dash = { stroke: "#c0392b", strokeWidth: 1.6, strokeDasharray: "10 7", pointerEvents: "none" as const };
                  if (t.side === "left" || t.side === "right") {
                    const x = t.side === "left" ? px + d : px + pw - d;
                    return (
                      <g key={t.id} pointerEvents="none">
                        <line x1={x} y1={py} x2={x} y2={py + pl} {...dash} />
                        <text x={x} y={py - 6} textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#c0392b">{label}</text>
                      </g>
                    );
                  }
                  const y = t.side === "top" ? py + d : py + pl - d;
                  return (
                    <g key={t.id} pointerEvents="none">
                      <line x1={px} y1={y} x2={px + pw} y2={y} {...dash} />
                      <text x={px + pw / 2} y={y - 5} textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#c0392b">{label}</text>
                    </g>
                  );
                })}
                {p.showPieceNumbers && (
                  <g pointerEvents="none">
                    <circle cx={px + pw / 2} cy={py + pl / 2} r={13} fill="#ffffff" stroke="#1a1a1a" strokeWidth={1.2} />
                    <text x={px + pw / 2} y={py + pl / 2 + 4} textAnchor="middle" fontSize={12} fontFamily="monospace" fill="#1a1a1a">{pcIdx + 1}</text>
                  </g>
                )}
                {/* Nome da peça removido a pedido — apenas cotas visíveis */}
                {/* Cota largura (topo) — texto acima da linha (não sobrepõe) */}
                <line x1={px} y1={py - COTA_OFF} x2={px + pw} y2={py - COTA_OFF} stroke="#3b3b3b" strokeWidth={0.8} pointerEvents="none" />
                <line x1={px} y1={py - COTA_OFF - 4} x2={px} y2={py - COTA_OFF + 4} stroke="#3b3b3b" strokeWidth={1} pointerEvents="none" />
                <line x1={px + pw} y1={py - COTA_OFF - 4} x2={px + pw} y2={py - COTA_OFF + 4} stroke="#3b3b3b" strokeWidth={1} pointerEvents="none" />
                <line x1={px} y1={py - COTA_OFF} x2={px} y2={py - 2} stroke="#9ca3af" strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />
                <line x1={px + pw} y1={py - COTA_OFF} x2={px + pw} y2={py - 2} stroke="#9ca3af" strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />
                {(() => {
                  const label = cotaWLabel;
                  const tx = px + pw / 2;
                  const ty = py - COTA_OFF - COTA_LABEL_GAP;
                  return (
                    <>
                      
                      <text className="dimension-label dimension-label-width" x={tx} y={ty} textAnchor="middle" fontSize={10} fill="#111827" fontFamily="monospace" pointerEvents="none">{label}</text>
                    </>
                  );
                })()}
                {/* Cota comprimento (direita) — texto deslocado ao lado da linha */}
                <line x1={px + pw + COTA_OFF} y1={py} x2={px + pw + COTA_OFF} y2={py + pl} stroke="#3b3b3b" strokeWidth={0.8} pointerEvents="none" />
                <line x1={px + pw + COTA_OFF - 4} y1={py} x2={px + pw + COTA_OFF + 4} y2={py} stroke="#3b3b3b" strokeWidth={1} pointerEvents="none" />
                <line x1={px + pw + COTA_OFF - 4} y1={py + pl} x2={px + pw + COTA_OFF + 4} y2={py + pl} stroke="#3b3b3b" strokeWidth={1} pointerEvents="none" />
                <line x1={px + pw + 2} y1={py} x2={px + pw + COTA_OFF} y2={py} stroke="#9ca3af" strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />
                <line x1={px + pw + 2} y1={py + pl} x2={px + pw + COTA_OFF} y2={py + pl} stroke="#9ca3af" strokeWidth={0.5} strokeDasharray="2 2" pointerEvents="none" />
                {(() => {
                  const label = cotaLLabel;
                  const tx = px + pw + COTA_OFF + COTA_LABEL_GAP;
                  const ty = py + pl / 2;
                  return (
                    <g transform={`rotate(-90 ${tx} ${ty})`} pointerEvents="none">
                      
                      <text className="dimension-label dimension-label-length" x={tx} y={ty} textAnchor="middle" fontSize={10} fill="#111827" fontFamily="monospace">{label}</text>
                    </g>
                  );
                })()}
              </g>
            );

          })}



          {!hasItems && edges.map((e, i) => {
            const ft = p.finishTypes.find((f) => f.id === e.finish_type_id);
            const col = ft?.color ?? "#b8860b";
            const dash = e.style === "bisel_45" ? "6 3" : e.style === "chanfrado" ? "3 2" : e.style === "boleado" ? "1 2" : undefined;
            return sideToCoords(e.side).map((s, j) => (
              <line className="finish-edge" key={`fe${i}-${j}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                stroke={col} strokeWidth={5} strokeLinecap="round" strokeDasharray={dash} pointerEvents="none" />

            ));
          })}
          {!hasItems && p.onCycleEdge && EDGE_SIDES.map((s) =>
            sideToCoords(s).map((c, j) => (
              <line key={`hit-${s}-${j}`} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                stroke="transparent" strokeWidth={20} style={{ cursor: "pointer" }}
                onClick={(ev) => { ev.stopPropagation(); p.onCycleEdge!(s); }}>
                <title>Clique para alternar acabamento ({SIDE_LABEL[s]})</title>
              </line>
            ))
          )}

        </>
      )}


      {p.accessories.map((a) => {
        const x = ox + a.x * scale;
        const y = oy + a.y * scale;
        const aw = a.w * scale, al = a.l * scale;
        const fill = a.color ?? ACC_COLOR[a.kind];
        const round = a.kind === "cuba" && a.subkind === "embutir_red";
        return (
          <g key={a.id} style={{ cursor: "move" }} onPointerDown={(e) => onPointerDownAcc(e, a)}>
            <AccessoryIcon a={a} x={x} y={y} aw={aw} al={al} fill={fill} round={round} />

            <text x={x + aw / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#111" fontFamily="monospace">
              {a.label || ACC_LABEL[a.kind]}
            </text>
            {p.onRemoveAccessory && (
              <g style={{ cursor: "pointer" }}
                onPointerDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); p.onRemoveAccessory!(a.id); }}>
                <circle cx={x + aw - 2} cy={y + 2} r={7} fill="#fff" stroke="#dc2626" strokeWidth={1.2} />
                <text x={x + aw - 2} y={y + 5} textAnchor="middle" fontSize="10" fill="#dc2626" fontFamily="sans-serif" fontWeight="bold">×</text>
              </g>
            )}
          </g>
        );
      })}

      {/* Cotas externas gerais (largura/comprimento do bbox) ocultas por padrão
          quando há peças individuais — medidas ficam por peça, no formato "CxL cm". */}
      {!hasItems && (
        <>
          <text x={ox + w / 2} y={oy - 14} textAnchor="middle" fontSize="11" fill="#3b3b3b" fontFamily="monospace">
            {isRound ? `Ø ${W.toFixed(2)} m` : `${W.toFixed(2)} m`}
          </text>
          {!isRound && (
            <text x={ox - 14} y={oy + h / 2} textAnchor="middle" fontSize="11" fill="#3b3b3b" fontFamily="monospace" transform={`rotate(-90 ${ox - 14} ${oy + h / 2})`}>{L.toFixed(2)} m</text>
          )}
        </>
      )}

      {edgeMenu && (() => {
        const MW = 190;
        const rowH = 26;
        const rows = p.finishTypes.length + 2; // + "Nenhum" + header
        const MH = 34 + rows * rowH;
        let mx = edgeMenu.sx + 8;
        let my = edgeMenu.sy + 8;
        if (mx + MW > MAXW) mx = MAXW - MW - 4;
        if (my + MH > MAXH) my = MAXH - MH - 4;
        const SIDE_PT: Record<PieceEdgeSide, string> = { top: "Fundo", bottom: "Frente", left: "Esquerdo", right: "Direito" };
        return (
          <>
            <rect x={0} y={0} width={MAXW} height={MAXH} fill="transparent"
              onPointerDown={() => setEdgeMenu(null)} />
            <foreignObject x={mx} y={my} width={MW} height={MH}>
              <div
                style={{
                  background: "#fff", border: "1px solid #78716c",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: 12,
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div style={{ padding: "6px 8px", background: "#f5f5f4", borderBottom: "1px solid #e7e5e4", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, color: "#57534e" }}>
                  Acabamento · {SIDE_PT[edgeMenu.side]}
                </div>
                <button type="button"
                  onClick={() => { setPieceEdgeType(edgeMenu.pieceId, edgeMenu.side, undefined); setEdgeMenu(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 8px", background: "#fff", border: "none", borderBottom: "1px solid #f5f5f4", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ display: "inline-block", width: 14, height: 14, border: "1px dashed #a8a29e", background: "#fff" }} />
                  <span>Nenhum (remover)</span>
                </button>
                {p.finishTypes.map((ft) => (
                  <button key={ft.id} type="button"
                    onClick={() => { setPieceEdgeType(edgeMenu.pieceId, edgeMenu.side, ft.id); setEdgeMenu(null); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 8px", background: "#fff", border: "none", borderBottom: "1px solid #f5f5f4", cursor: "pointer", textAlign: "left" }}
                  >
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "1px solid #78716c", background: ft.color ?? "#b8860b" }} />
                    <span>{ft.name}</span>
                  </button>
                ))}
                {p.finishTypes.length === 0 && (
                  <div style={{ padding: "8px", color: "#a8a29e", fontSize: 11 }}>
                    Nenhum tipo cadastrado. Use "+ Adicionar tipo" acima.
                  </div>
                )}
              </div>
            </foreignObject>
          </>
        );
      })()}
    </svg>
  );
}

/* ---------- 3D ---------- */
export function Room3D(p: {
  shape: TampoShape; diameter: number;
  width: number; length: number; height: number; thicknessMm: number;
  side: FinishSide; edges: RoomFinishEdge[]; finishTypes: FinishType[];
  color: string; textureUrl?: string;
  accessories: RoomAccessory[];
  items?: EnvItem[];
  onMoveAccessory: (id: string, x: number, y: number) => void;
}) {
  const isRound = p.shape === "redondo";
  const hasItems = !isRound && Array.isArray(p.items) && p.items.length > 0;

  // Pack pieces (mesma lógica do 2D) para desenhar múltiplas peças
  type Piece3 = { id: string; x: number; y: number; w: number; l: number; itemId: string; thickness: number };
  const packed: Piece3[] = [];
  let bboxW = Math.max(0.1, p.width);
  let bboxL = Math.max(0.1, p.length);
  const defaultT = Math.max(0.005, (p.thicknessMm || 20) / 1000);
  if (hasItems) {
    const GAP = 0.05;
    let x = 0, y = 0, rowH = 0;
    const maxRowW = Math.max(p.width, 2.4);
    for (const it of p.items!) {
      const q = it.qty && it.qty > 0 ? Math.round(it.qty) : 1;
      const pw = Math.max(0.05, it.length);
      const pl = Math.max(0.05, it.width);
      const itT = it.thickness_mm;
      const pieceT = Math.max(0.005, (itT && itT > 0 ? itT : (p.thicknessMm || 20)) / 1000);

      for (let i = 0; i < q; i++) {
        if (x + pw > maxRowW && x > 0) { x = 0; y += rowH + GAP; rowH = 0; }
        packed.push({ id: `it-${it.id}-${i}`, x, y, w: pw, l: pl, itemId: it.id, thickness: pieceT });
        x += pw + GAP;
        rowH = Math.max(rowH, pl);
      }
    }
    bboxW = Math.max(bboxW, ...packed.map((pc) => pc.x + pc.w));
    bboxL = Math.max(bboxL, ...packed.map((pc) => pc.y + pc.l));
  }
  const W = isRound ? Math.max(0.1, p.diameter) : bboxW;
  const L = isRound ? Math.max(0.1, p.diameter) : bboxL;
  const T = defaultT;

  // Per-item finish edges lookup
  const itemEdges = useMemo(() => {
    const map = new Map<string, RoomFinishEdge[]>();
    for (const it of p.items ?? []) {
      if (Array.isArray(it.finish_edges) && it.finish_edges.length > 0) {
        map.set(it.id, it.finish_edges);
      }
    }
    return map;
  }, [p.items]);
  const edgeInfoFor = (edges: RoomFinishEdge[] | undefined, s: FinishSide) => {
    const list = edges && edges.length > 0 ? edges : (p.edges.length > 0 ? p.edges : [{ side: p.side }]);
    const e = list.find((x) => x.side === s || x.side === "ambos");
    if (!e) return { color: undefined as string | undefined, style: undefined as EdgeStyle | undefined };
    const ft = p.finishTypes.find((f) => f.id === e.finish_type_id);
    return { color: ft?.color, style: e.style };
  };


  const edgeColor = (s: FinishSide): string | undefined => {
    const e = (p.edges.length > 0 ? p.edges : [{ side: p.side }]).find((x) => x.side === s || x.side === "ambos");
    if (!e) return undefined;
    const ft = p.finishTypes.find((f) => f.id === e.finish_type_id);
    return ft?.color ?? "#b8860b";
  };
  const edgeStyle = (s: FinishSide): EdgeStyle | undefined => {
    const e = (p.edges.length > 0 ? p.edges : [{ side: p.side }]).find((x) => x.side === s || x.side === "ambos");
    return e?.style;
  };
  const isHL = useMemo(() => ({
    fundo: { color: edgeColor("fundo"), style: edgeStyle("fundo") },
    frente: { color: edgeColor("frente"), style: edgeStyle("frente") },
    esquerdo: { color: edgeColor("esquerdo"), style: edgeStyle("esquerdo") },
    direito: { color: edgeColor("direito"), style: edgeStyle("direito") },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [p.edges, p.finishTypes, p.side]);

  const camDist = Math.max(W, L) * 1.4;

  return (
    <Canvas shadows gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: [camDist, camDist * 0.7, camDist], fov: 40 }}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[5, 8, 5]} intensity={0.7} castShadow />
      <directionalLight position={[-5, 4, -5]} intensity={0.3} />

      {/* Tampo(s) */}
      {isRound ? (
        <mesh position={[0, T / 2, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[W / 2, W / 2, T, 64]} />
          <TampoMaterial color={p.color} textureUrl={p.textureUrl} />
        </mesh>
      ) : hasItems ? (
        packed.map((pc) => (
          <mesh key={pc.id}
            position={[-W / 2 + pc.x + pc.w / 2, pc.thickness / 2, -L / 2 + pc.y + pc.l / 2]}
            receiveShadow castShadow>
            <boxGeometry args={[pc.w, pc.thickness, pc.l]} />
            <TampoMaterial color={p.color} textureUrl={p.textureUrl} />
          </mesh>
        ))
      ) : (
        <mesh position={[0, T / 2, 0]} receiveShadow castShadow>
          <boxGeometry args={[W, T, L]} />
          <TampoMaterial color={p.color} textureUrl={p.textureUrl} />
        </mesh>
      )}

      {/* Bordas / acabamento — por peça quando há itens, senão pelo bbox do ambiente */}
      {!isRound && hasItems && packed.map((pc) => {
        const edges = itemEdges.get(pc.itemId);
        const sides: FinishSide[] = ["fundo", "frente", "esquerdo", "direito"];
        return (
          <group key={`edges-${pc.id}`} position={[-W / 2 + pc.x + pc.w / 2, 0, -L / 2 + pc.y + pc.l / 2]}>
            {sides.map((s) => {
              const info = edgeInfoFor(edges, s);
              if (!info.color && !info.style) return null;
              return <EdgeBand key={s} side={s} W={pc.w} L={pc.l} T={pc.thickness} info={info} />;
            })}
          </group>
        );
      })}
      {!isRound && !hasItems && (<>
        <EdgeBand side="fundo" W={W} L={L} T={T} info={isHL.fundo} />
        <EdgeBand side="frente" W={W} L={L} T={T} info={isHL.frente} />
        <EdgeBand side="esquerdo" W={W} L={L} T={T} info={isHL.esquerdo} />
        <EdgeBand side="direito" W={W} L={L} T={T} info={isHL.direito} />
      </>)}


      {/* Acessórios draggable */}
      {p.accessories.map((a) => (
        <Accessory3D key={a.id} a={a} W={W} L={L} T={T}
          onMove={(x, y) => p.onMoveAccessory(a.id, x, y)} />
      ))}

      <OrbitControlsAware />
    </Canvas>
  );
}

function OrbitControlsAware() {
  // Allow Drag controls to disable orbiting during a drag (simple: always on)
  return <OrbitControls makeDefault enablePan enableZoom enableRotate />;
}

function TampoMaterial({ color, textureUrl }: { color: string; textureUrl?: string }) {
  const tex = useMemo(() => {
    if (!textureUrl) return null;
    const t = new THREE.TextureLoader().load(textureUrl);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
  }, [textureUrl]);
  return <meshStandardMaterial color={color} map={tex ?? undefined} roughness={0.6} metalness={0.05} />;
}

function EdgeBand({ side, W, L, T, info }: {
  side: FinishSide; W: number; L: number; T: number;
  info: { color?: string; style?: EdgeStyle };
}) {
  if (!info.color && !info.style) return null;
  const col = info.color ?? "#b8860b";
  // Largura visual da faixa cresce conforme estilo
  const thick = info.style === "bisel_45" ? T * 1.4
    : info.style === "chanfrado" ? T * 1.15
    : info.style === "boleado" ? T * 1.05
    : T * 1.02;
  // Pequena inclinação visual no 45°
  const tilt = info.style === "bisel_45" ? Math.PI / 6 : info.style === "chanfrado" ? Math.PI / 12 : 0;
  if (side === "fundo") return (
    <mesh position={[0, T / 2, -L / 2 - 0.002]} rotation={[tilt, 0, 0]}>
      <planeGeometry args={[W, thick]} />
      <meshStandardMaterial color={col} side={THREE.DoubleSide} />
    </mesh>
  );
  if (side === "frente") return (
    <mesh position={[0, T / 2, L / 2 + 0.002]} rotation={[-tilt, Math.PI, 0]}>
      <planeGeometry args={[W, thick]} />
      <meshStandardMaterial color={col} side={THREE.DoubleSide} />
    </mesh>
  );
  if (side === "esquerdo") return (
    <mesh position={[-W / 2 - 0.002, T / 2, 0]} rotation={[0, Math.PI / 2, -tilt]}>
      <planeGeometry args={[L, thick]} />
      <meshStandardMaterial color={col} side={THREE.DoubleSide} />
    </mesh>
  );
  return (
    <mesh position={[W / 2 + 0.002, T / 2, 0]} rotation={[0, -Math.PI / 2, tilt]}>
      <planeGeometry args={[L, thick]} />
      <meshStandardMaterial color={col} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Accessory3D({ a, W, L, T, onMove }: {
  a: RoomAccessory; W: number; L: number; T: number;
  onMove: (x: number, y: number) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { invalidate } = useThree();
  const cx = -W / 2 + a.x + a.w / 2;
  const cz = -L / 2 + a.y + a.l / 2;

  const handleDrag = useCallback((_local: THREE.Matrix4, deltaLocal: THREE.Matrix4) => {
    if (!groupRef.current) return;
    const pos = new THREE.Vector3();
    pos.setFromMatrixPosition(deltaLocal);
    const g = groupRef.current;
    g.position.x += pos.x;
    g.position.z += pos.z;
    // clamp
    const minX = -W / 2 + a.w / 2, maxX = W / 2 - a.w / 2;
    const minZ = -L / 2 + a.l / 2, maxZ = L / 2 - a.l / 2;
    g.position.x = Math.max(minX, Math.min(maxX, g.position.x));
    g.position.z = Math.max(minZ, Math.min(maxZ, g.position.z));
    invalidate();
  }, [W, L, a.w, a.l, invalidate]);

  const handleEnd = useCallback(() => {
    if (!groupRef.current) return;
    const nx = groupRef.current.position.x + W / 2 - a.w / 2;
    const ny = groupRef.current.position.z + L / 2 - a.l / 2;
    onMove(nx, ny);
  }, [W, L, a.w, a.l, onMove]);

  return (
    <DragControls axisLock="y" onDrag={handleDrag} onDragEnd={handleEnd}>
      <group ref={groupRef} position={[cx, 0, cz]}>
        <AccessoryMesh a={a} T={T} />
      </group>
    </DragControls>
  );
}

function AccessoryMesh({ a, T }: { a: RoomAccessory; T: number }) {
  const col = a.color ?? ACC_COLOR[a.kind];
  if (a.kind === "torre_tomada") {
    const r = Math.max(a.w, a.l) / 2;
    return (
      <group>
        <mesh position={[0, T + 0.06, 0]}>
          <cylinderGeometry args={[r, r, 0.12, 24]} />
          <meshStandardMaterial color="#222" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, T + 0.13, 0]}>
          <cylinderGeometry args={[r * 0.9, r * 0.9, 0.01, 24]} />
          <meshStandardMaterial color={col} />
        </mesh>
      </group>
    );
  }
  if (a.kind === "cuba") {
    const sub = a.subkind as CubaSubKind | undefined;
    if (sub === "apoio") {
      // bowl above the top
      return (
        <group>
          <mesh position={[0, T + 0.07, 0]}>
            <cylinderGeometry args={[Math.min(a.w, a.l) / 2, Math.min(a.w, a.l) / 2 * 0.85, 0.14, 24]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.25} />
          </mesh>
          <mesh position={[0, T + 0.135, 0]}>
            <cylinderGeometry args={[Math.min(a.w, a.l) / 2 * 0.92, Math.min(a.w, a.l) / 2 * 0.92, 0.005, 24]} />
            <meshStandardMaterial color="#0ea5e9" transparent opacity={0.5} />
          </mesh>
        </group>
      );
    }
    if (sub === "embutir_red") {
      return (
        <mesh position={[0, T - 0.05, 0]}>
          <cylinderGeometry args={[Math.min(a.w, a.l) / 2, Math.min(a.w, a.l) / 2 * 0.85, 0.12, 24]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.55} roughness={0.3} />
        </mesh>
      );
    }
    if (sub === "semi_encaixe") {
      return (
        <group>
          <mesh position={[0, T + 0.02, 0]}>
            <boxGeometry args={[a.w, 0.04, a.l]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, T - 0.05, 0]}>
            <boxGeometry args={[a.w * 0.9, 0.1, a.l * 0.9]} />
            <meshStandardMaterial color={col} transparent opacity={0.7} />
          </mesh>
        </group>
      );
    }
    // embutir_ret (default)
    return (
      <mesh position={[0, T - 0.05, 0]}>
        <boxGeometry args={[a.w, 0.12, a.l]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.55} roughness={0.3} />
      </mesh>
    );
  }
  if (a.kind === "cooktop") {
    const sub = a.subkind as CooktopSubKind | undefined;
    if (sub === "inducao") {
      return (
        <group>
          <mesh position={[0, T + 0.005, 0]}>
            <boxGeometry args={[a.w, 0.01, a.l]} />
            <meshStandardMaterial color="#0a0a0a" metalness={0.3} roughness={0.2} />
          </mesh>
          {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sz], i) => (
            <mesh key={i} position={[sx * a.w * 0.22, T + 0.012, sz * a.l * 0.22]}>
              <ringGeometry args={[a.w * 0.08, a.w * 0.11, 32]} />
              <meshStandardMaterial color="#374151" />
            </mesh>
          ))}
        </group>
      );
    }
    const burners = sub === "5_bocas" ? 5 : 4;
    return (
      <group>
        <mesh position={[0, T + 0.01, 0]}>
          <boxGeometry args={[a.w, 0.02, a.l]} />
          <meshStandardMaterial color="#111827" metalness={0.5} roughness={0.4} />
        </mesh>
        {Array.from({ length: burners }).map((_, i) => {
          const isCenter = burners === 5 && i === 4;
          const col = isCenter ? 0 : (i % 2) * 2 - 1;
          const row = isCenter ? 0 : Math.floor(i / 2) * 2 - 1;
          const cx = isCenter ? 0 : col * a.w * 0.22;
          const cz = isCenter ? 0 : row * a.l * 0.22;
          return (
            <mesh key={i} position={[cx, T + 0.03, cz]}>
              <cylinderGeometry args={[Math.min(a.w, a.l) * 0.08, Math.min(a.w, a.l) * 0.08, 0.02, 16]} />
              <meshStandardMaterial color="#6b7280" metalness={0.7} />
            </mesh>
          );
        })}
      </group>
    );
  }
  return (
    <mesh position={[0, T + 0.01, 0]}>
      <boxGeometry args={[a.w, 0.02, a.l]} />
      <meshStandardMaterial color={col} />
    </mesh>
  );
}


function ArchitectAIPanel(props: {
  room: ReturnType<typeof normalize>;
  materialName?: string;
  envName?: string;
  items?: EnvItem[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const buildContext = () => {
    const r = props.room;
    const dim = r.shape === "redondo" ? `redondo Ø ${r.diameter} m` : `${r.width} × ${r.length} m`;
    const accs = (r.accessories ?? []).map((a) =>
      `${ACC_LABEL[a.kind]}${a.subkind ? ` (${a.subkind})` : ""} em (${a.x.toFixed(2)}, ${a.y.toFixed(2)}) tam ${a.w.toFixed(2)}×${a.l.toFixed(2)}`
    ).join("; ") || "nenhum";
    const its = (props.items ?? []).slice(0, 20).map((it) =>
      `${it.description || "peça"} ${it.length}×${it.width} m qtd ${it.qty ?? 1}${it.piece_kind ? ` [${it.piece_kind}]` : ""}`
    ).join("; ") || "nenhum";
    return [
      `Ambiente: ${props.envName ?? "—"}`,
      `Material: ${props.materialName ?? "—"}`,
      `Tampo: ${dim}, espessura ${r.thickness_mm} mm`,
      `Acessórios: ${accs}`,
      `Peças: ${its}`,
    ].join("\n");
  };

  const ask = async (text: string) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setErr(null);
    setLoading(true);
    const next = [...messages, { role: "user" as const, content: msg }];
    setMessages(next);
    setInput("");
    try {
      const { quickRoomChat } = await import("@/lib/quick-room-ai.functions");
      const res = await quickRoomChat({
        data: { context: buildContext(), history: messages, message: msg },
      });
      setMessages([...next, { role: "assistant", content: res.reply || "(sem resposta)" }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao consultar IA");
    } finally {
      setLoading(false);
    }
  };

  const quickPrompts = [
    "Analise o projeto e aponte riscos técnicos.",
    "Sugira o melhor acabamento de borda para este ambiente.",
    "Recomende a espessura ideal e justifique.",
    "Sugira posicionamento ideal da cuba e do cooktop.",
  ];

  return (
    <div className="border border-stone-200 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-stone-50">
        <span className="text-[10px] uppercase tracking-wider text-stone-700 font-bold">
          🏛️ Arquiteta IA — assistente de liberação técnica
        </span>
        <span className="text-[10px] text-stone-400">{open ? "▲ fechar" : "▼ abrir"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex flex-wrap gap-1">
            {quickPrompts.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)} disabled={loading}
                className="text-[10px] px-2 py-1 border border-stone-300 hover:bg-stone-50 disabled:opacity-50">
                {q}
              </button>
            ))}
          </div>
          <div className="border border-stone-200 bg-stone-50 p-2 space-y-2 max-h-64 overflow-y-auto text-xs">
            {messages.length === 0 && (
              <p className="text-stone-500 italic">Faça uma pergunta ou escolha um atalho acima. A IA usa as medidas, acessórios e peças atuais como contexto.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-stone-900" : "text-stone-700"}>
                <span className="font-bold uppercase text-[9px] tracking-wider mr-1">
                  {m.role === "user" ? "Você" : "IA"}:
                </span>
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            ))}
            {loading && <p className="text-stone-500 italic">Pensando…</p>}
            {err && <p className="text-red-600">{err}</p>}
          </div>
          <div className="flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ask(input); } }}
              placeholder="Pergunte à arquiteta IA…"
              disabled={loading}
              className="flex-1 border border-stone-300 px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-stone-950" />
            <button type="button" onClick={() => ask(input)} disabled={loading || !input.trim()}
              className="text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 border border-stone-950 bg-stone-950 text-white disabled:opacity-40">
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pictograma vetorial de cada acessório na vista 2D. */
function AccessoryIcon({
  a, x, y, aw, al, fill, round,
}: {
  a: RoomAccessory; x: number; y: number; aw: number; al: number; fill: string; round: boolean;
}) {
  const cx = x + aw / 2, cy = y + al / 2;
  const stroke = "#1f2937", sw = 1.2;
  const inner = (i: number, n: number) => {
    const cols = n <= 2 ? n : n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const col = i % cols, row = Math.floor(i / cols);
    return {
      cx: x + (aw / cols) * (col + 0.5),
      cy: y + (al / rows) * (row + 0.5),
      r: Math.min(aw / cols, al / rows) * 0.32,
    };
  };

  switch (a.kind) {
    case "cuba": {
      const sub = a.subkind;
      const isRound = sub === "embutir_red" || sub === "banheiro_red" || sub === "granito_esculpida_red";
      const isDouble = sub === "gourmet_dupla" || sub === "inox_dupla";
      const isOval = sub === "banheiro_oval";
      return (
        <>
          <rect x={x} y={y} width={aw} height={al} rx={2} fill="#fff" stroke={stroke} strokeWidth={sw} />
          {isRound ? (
            <circle cx={cx} cy={cy} r={Math.min(aw, al) / 2 - 3} fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={sw} />
          ) : isOval ? (
            <ellipse cx={cx} cy={cy} rx={aw / 2 - 3} ry={al / 2 - 3} fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={sw} />
          ) : isDouble ? (
            <>
              <rect x={x + 3} y={y + 3} width={aw / 2 - 4} height={al - 6} rx={aw * 0.06} fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={sw} />
              <rect x={x + aw / 2 + 1} y={y + 3} width={aw / 2 - 4} height={al - 6} rx={aw * 0.06} fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={sw} />
            </>
          ) : (
            <rect x={x + 3} y={y + 3} width={aw - 6} height={al - 6} rx={Math.min(aw, al) * 0.12} fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={sw} />
          )}
          {/* ralo */}
          <circle cx={cx} cy={cy} r={Math.min(aw, al) * 0.06} fill="#111" />
          {round && null}
        </>
      );
    }
    case "cooktop": {
      const n = a.subkind === "6_bocas" ? 6 : a.subkind === "5_bocas" ? 5 : a.subkind === "2_bocas" ? 2 : 4;
      const induction = a.subkind === "inducao" || a.subkind === "inducao_4" || a.subkind === "inducao_5" || a.subkind === "domino";
      return (
        <>
          <rect x={x} y={y} width={aw} height={al} rx={3} fill="#111827" stroke={stroke} strokeWidth={sw} />
          {induction
            ? Array.from({ length: a.subkind === "inducao_5" ? 5 : a.subkind === "domino" ? 2 : 4 }).map((_, i) => {
                const p = inner(i, a.subkind === "inducao_5" ? 5 : a.subkind === "domino" ? 2 : 4);
                return <rect key={i} x={p.cx - p.r} y={p.cy - p.r} width={p.r * 2} height={p.r * 2} rx={2} fill="#374151" stroke="#9ca3af" strokeWidth={0.6} />;
              })
            : Array.from({ length: n }).map((_, i) => {
                const p = inner(i, n);
                return (
                  <g key={i}>
                    <circle cx={p.cx} cy={p.cy} r={p.r} fill="#1f2937" stroke="#9ca3af" strokeWidth={0.6} />
                    <circle cx={p.cx} cy={p.cy} r={p.r * 0.35} fill="#4b5563" />
                  </g>
                );
              })}
        </>
      );
    }
    case "torre_tomada": {
      const r = Math.min(aw, al) / 2;
      return (
        <>
          <circle cx={cx} cy={cy} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
          <circle cx={cx} cy={cy} r={r * 0.55} fill="#fff" stroke={stroke} strokeWidth={0.8} />
          <circle cx={cx - r * 0.22} cy={cy} r={r * 0.09} fill="#111" />
          <circle cx={cx + r * 0.22} cy={cy} r={r * 0.09} fill="#111" />
        </>
      );
    }
    case "churrasqueira": {
      return (
        <>
          <rect x={x} y={y} width={aw} height={al} rx={3} fill="#7c2d12" stroke={stroke} strokeWidth={sw} />
          <rect x={x + 4} y={y + 4} width={aw - 8} height={al * 0.55} fill="#111" stroke="#4b5563" strokeWidth={0.6} />
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={i} x1={x + 6 + ((aw - 12) / 5) * i} y1={y + 6} x2={x + 6 + ((aw - 12) / 5) * i} y2={y + 4 + al * 0.55 - 2} stroke="#f59e0b" strokeWidth={0.8} />
          ))}
          <rect x={x + aw * 0.15} y={y + al * 0.7} width={aw * 0.7} height={al * 0.18} fill="#fbbf24" opacity={0.7} />
        </>
      );
    }
    case "torneira": {
      const r = Math.min(aw, al) / 2;
      return (
        <>
          <rect x={cx - r * 0.3} y={cy - r} width={r * 0.6} height={r * 1.5} fill="#9ca3af" stroke={stroke} strokeWidth={sw} />
          <rect x={cx - r} y={cy - r * 0.2} width={r * 2} height={r * 0.4} rx={r * 0.15} fill="#d1d5db" stroke={stroke} strokeWidth={sw} />
          <circle cx={cx} cy={cy + r * 0.6} r={r * 0.2} fill="#6b7280" />
        </>
      );
    }
    case "valvula":
    case "sifao":
    case "ralo": {
      const r = Math.min(aw, al) / 2;
      return (
        <>
          <circle cx={cx} cy={cy} r={r} fill="#e5e7eb" stroke={stroke} strokeWidth={sw} />
          <circle cx={cx} cy={cy} r={r * 0.65} fill="#9ca3af" />
          {[0, 45, 90, 135].map((deg) => (
            <line key={deg} x1={cx - r * 0.5 * Math.cos((deg * Math.PI) / 180)} y1={cy - r * 0.5 * Math.sin((deg * Math.PI) / 180)}
              x2={cx + r * 0.5 * Math.cos((deg * Math.PI) / 180)} y2={cy + r * 0.5 * Math.sin((deg * Math.PI) / 180)}
              stroke="#111" strokeWidth={0.6} />
          ))}
        </>
      );
    }
    case "coifa": {
      return (
        <>
          <path d={`M ${x} ${y + al * 0.4} L ${x + aw * 0.15} ${y} L ${x + aw * 0.85} ${y} L ${x + aw} ${y + al * 0.4} L ${x + aw} ${y + al} L ${x} ${y + al} Z`}
            fill="#e5e7eb" stroke={stroke} strokeWidth={sw} />
          <rect x={x + aw * 0.1} y={y + al * 0.55} width={aw * 0.8} height={al * 0.15} fill="#9ca3af" />
        </>
      );
    }
    case "forno":
    case "microondas": {
      const isMicro = a.kind === "microondas";
      return (
        <>
          <rect x={x} y={y} width={aw} height={al} rx={3} fill="#1f2937" stroke={stroke} strokeWidth={sw} />
          <rect x={x + 4} y={y + 4} width={aw - 8} height={al * (isMicro ? 0.65 : 0.7)} fill="#111" stroke="#4b5563" strokeWidth={0.6} />
          <rect x={x + 4} y={y + al * (isMicro ? 0.72 : 0.78)} width={aw - 8} height={al * 0.15} fill="#374151" />
          <circle cx={x + aw - 8} cy={y + al * (isMicro ? 0.8 : 0.87)} r={2} fill="#9ca3af" />
        </>
      );
    }
    case "dispenser": {
      const r = Math.min(aw, al) / 2;
      return (
        <>
          <rect x={cx - r * 0.4} y={y} width={r * 0.8} height={al * 0.5} fill="#9ca3af" stroke={stroke} strokeWidth={sw} />
          <path d={`M ${cx - r * 0.3} ${y + al * 0.5} Q ${cx} ${y + al * 0.85} ${cx + r * 0.3} ${y + al * 0.5}`} fill="none" stroke={stroke} strokeWidth={sw} />
        </>
      );
    }
    case "ponto_gas":
    case "ponto_eletrico": {
      const r = Math.min(aw, al) / 2;
      const isGas = a.kind === "ponto_gas";
      return (
        <>
          <rect x={x} y={y} width={aw} height={al} rx={2} fill={isGas ? "#f97316" : "#eab308"} stroke={stroke} strokeWidth={sw} />
          <text x={cx} y={cy + r * 0.35} textAnchor="middle" fontSize={Math.min(aw, al) * 0.6} fill="#111" fontWeight="bold">
            {isGas ? "G" : "E"}
          </text>
        </>
      );
    }
    case "vaso_sanitario": {
      return (
        <>
          <ellipse cx={cx} cy={y + al * 0.4} rx={aw / 2 - 2} ry={al * 0.35} fill="#fff" stroke={stroke} strokeWidth={sw} />
          <rect x={x + aw * 0.15} y={y + al * 0.7} width={aw * 0.7} height={al * 0.3} fill="#f3f4f6" stroke={stroke} strokeWidth={sw} />
        </>
      );
    }
    case "bide": {
      return (
        <>
          <ellipse cx={cx} cy={cy} rx={aw / 2 - 2} ry={al / 2 - 2} fill="#fff" stroke={stroke} strokeWidth={sw} />
          <circle cx={cx} cy={cy} r={Math.min(aw, al) * 0.15} fill="#9ca3af" />
        </>
      );
    }
    case "lava_louca":
    case "lava_roupa": {
      return (
        <>
          <rect x={x} y={y} width={aw} height={al} rx={3} fill="#f9fafb" stroke={stroke} strokeWidth={sw} />
          <circle cx={cx} cy={cy} r={Math.min(aw, al) * 0.32} fill="#e5e7eb" stroke={stroke} strokeWidth={sw} />
          <circle cx={cx} cy={cy} r={Math.min(aw, al) * 0.18} fill="#9ca3af" />
        </>
      );
    }
    case "geladeira": {
      return (
        <>
          <rect x={x} y={y} width={aw} height={al} rx={3} fill="#f3f4f6" stroke={stroke} strokeWidth={sw} />
          <line x1={x} y1={y + al * 0.35} x2={x + aw} y2={y + al * 0.35} stroke={stroke} strokeWidth={sw} />
          <rect x={x + aw * 0.85} y={y + al * 0.1} width={4} height={al * 0.15} fill="#6b7280" />
          <rect x={x + aw * 0.85} y={y + al * 0.5} width={4} height={al * 0.35} fill="#6b7280" />
        </>
      );
    }
    case "adega": {
      return (
        <>
          <rect x={x} y={y} width={aw} height={al} rx={2} fill="#1f2937" stroke={stroke} strokeWidth={sw} />
          {Array.from({ length: 3 }).map((_, i) => (
            <line key={i} x1={x + 2} y1={y + (al / 4) * (i + 1)} x2={x + aw - 2} y2={y + (al / 4) * (i + 1)} stroke="#7c2d12" strokeWidth={1} />
          ))}
        </>
      );
    }
    case "lixeira": {
      return (
        <>
          <rect x={x + 2} y={y + al * 0.15} width={aw - 4} height={al * 0.85} rx={2} fill="#e5e7eb" stroke={stroke} strokeWidth={sw} />
          <rect x={x} y={y} width={aw} height={al * 0.15} fill="#9ca3af" stroke={stroke} strokeWidth={sw} />
        </>
      );
    }
    case "tabua": {
      return (
        <>
          <rect x={x} y={y} width={aw} height={al} rx={aw * 0.06} fill="#d97706" stroke={stroke} strokeWidth={sw} />
          <line x1={x + aw * 0.2} y1={y + 2} x2={x + aw * 0.2} y2={y + al - 2} stroke="#78350f" strokeWidth={0.5} />
          <line x1={x + aw * 0.5} y1={y + 2} x2={x + aw * 0.5} y2={y + al - 2} stroke="#78350f" strokeWidth={0.5} />
          <line x1={x + aw * 0.8} y1={y + 2} x2={x + aw * 0.8} y2={y + al - 2} stroke="#78350f" strokeWidth={0.5} />
        </>
      );
    }
    case "escorredor": {
      return (
        <>
          <rect x={x} y={y} width={aw} height={al} fill="#e5e7eb" stroke={stroke} strokeWidth={sw} />
          {Array.from({ length: 4 }).map((_, i) => (
            <line key={i} x1={x + (aw / 4) * (i + 0.5)} y1={y + 2} x2={x + (aw / 4) * (i + 0.5)} y2={y + al - 2} stroke="#6b7280" strokeWidth={0.8} />
          ))}
        </>
      );
    }
    case "porta_temperos": {
      return (
        <>
          <rect x={x} y={y} width={aw} height={al} fill="#fef3c7" stroke={stroke} strokeWidth={sw} />
          {Array.from({ length: 3 }).map((_, i) => (
            <rect key={i} x={x + 3 + (aw / 3) * i + 2} y={y + al * 0.2} width={aw / 3 - 6} height={al * 0.6} fill="#fbbf24" stroke="#92400e" strokeWidth={0.5} />
          ))}
        </>
      );
    }
    default:
      return <rect x={x} y={y} width={aw} height={al} fill={fill} fillOpacity={0.55} stroke={stroke} strokeWidth={sw} />;
  }
}

