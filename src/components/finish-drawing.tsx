/**
 * DESENHO TÉCNICO PARAMÉTRICO (padrão CAD) — preto e branco.
 *
 * Ponto único de renderização dos acabamentos: usado tanto na Biblioteca
 * (Configurações) quanto na Liberação Técnica. Nenhuma cópia do desenho é
 * criada; a Liberação apenas referencia o item da Biblioteca.
 *
 * Convenção gráfica:
 *  · contorno .......... linha contínua
 *  · elemento oculto ... linha tracejada
 *  · corte ............. hachura
 *  · cota .............. linha + seta + medida
 */
import React, { useId } from "react";
import type { FinishTemplate } from "@/lib/finish-library";

const INK = "#000";
const THIN = 0.7;
const BOLD = 1.4;

/* ------------------------- primitivas CAD ------------------------- */

function Hatch({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="6" stroke={INK} strokeWidth="0.5" />
      </pattern>
      <marker id={`${id}-a`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,1 L10,5 L0,9 z" fill={INK} />
      </marker>
    </defs>
  );
}

function Dim(p: {
  mid: string; x1: number; y1: number; x2: number; y2: number; text: string; off?: number; vertical?: boolean;
}) {
  const off = p.off ?? 14;
  const vx = p.vertical ? off : 0;
  const vy = p.vertical ? 0 : off;
  const ax = p.x1 + vx, ay = p.y1 + vy, bx = p.x2 + vx, by = p.y2 + vy;
  const tx = (ax + bx) / 2, ty = (ay + by) / 2;
  return (
    <g stroke={INK} strokeWidth={THIN}>
      <line x1={p.x1} y1={p.y1} x2={ax + (p.vertical ? 4 : 0)} y2={ay + (p.vertical ? 0 : 4)} />
      <line x1={p.x2} y1={p.y2} x2={bx + (p.vertical ? 4 : 0)} y2={by + (p.vertical ? 0 : 4)} />
      <line x1={ax} y1={ay} x2={bx} y2={by} markerStart={`url(#${p.mid}-a)`} markerEnd={`url(#${p.mid}-a)`} />
      <text
        x={p.vertical ? tx + 5 : tx}
        y={p.vertical ? ty : ty - 4}
        fill={INK} stroke="none" fontSize="9" textAnchor={p.vertical ? "start" : "middle"}
        fontFamily="ui-monospace, monospace"
      >
        {p.text}
      </text>
    </g>
  );
}

function Tag({ x, y, text, anchor = "start" }: { x: number; y: number; text: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} fontSize="8.5" fill={INK} textAnchor={anchor} letterSpacing="0.5"
      fontFamily="ui-monospace, monospace">{text}</text>
  );
}

const mm = (n: number) => `${Math.round(n)}`;

/* --------------------------- templates --------------------------- */

type Ctx = { p: Record<string, number>; uid: string; s: number };

function CorteBorda({ p, uid, s }: Ctx) {
  const esp = p.esp * s, raio = Math.min(p.raio * s, esp / 2), perfil = Math.max(p.perfil * s, esp);
  const x = 60, y = 60, w = 200;
  const d = `M${x},${y} H${x + w} V${y + esp - raio} Q${x + w},${y + esp} ${x + w - raio},${y + esp} H${x} Z`;
  return (
    <>
      <path d={d} fill={`url(#${uid})`} stroke={INK} strokeWidth={BOLD} />
      <Dim mid={uid} x1={x + w} y1={y} x2={x + w} y2={y + esp} text={`${mm(p.esp)}`} vertical off={26} />
      {p.raio > 0 && <Tag x={x + w - 60} y={y + esp + 18} text={`R ${mm(p.raio)}`} />}
      <Tag x={x} y={y - 12} text={`PERFIL ${mm(p.perfil)}`} />
      <line x1={x} y1={y} x2={x} y2={y + perfil} stroke={INK} strokeWidth={THIN} strokeDasharray="6 3" />
    </>
  );
}

function CorteRebaixo({ p, uid, s }: Ctx) {
  const esp = p.esp * s, prof = p.prof * s, larg = Math.min(p.larg * s, 240), borda = p.borda * s;
  const x = 50, y = 60, w = borda * 2 + larg;
  const rx = x + borda, rw = larg;
  const d =
    `M${x},${y} H${rx} L${rx},${y + prof} H${rx + rw} L${rx + rw},${y} H${x + w} ` +
    `V${y + esp} H${x} Z`;
  return (
    <>
      <path d={d} fill={`url(#${uid})`} stroke={INK} strokeWidth={BOLD} />
      <line x1={x} y1={y} x2={x + w} y2={y} stroke={INK} strokeWidth={THIN} strokeDasharray="7 3" />
      <Dim mid={uid} x1={rx} y1={y + prof} x2={rx + rw} y2={y + prof} text={mm(p.larg)} off={-20} />
      <Dim mid={uid} x1={rx} y1={y} x2={rx} y2={y + prof} text={mm(p.prof)} vertical off={-22} />
      <Dim mid={uid} x1={x + w} y1={y} x2={x + w} y2={y + esp} text={mm(p.esp)} vertical off={26} />
      <Dim mid={uid} x1={x} y1={y + esp} x2={rx} y2={y + esp} text={mm(p.borda)} off={26} />
      <Tag x={rx + rw / 2} y={y + prof + 16} text="ÁREA MOLHADA" anchor="middle" />
      <Tag x={x} y={y - 14} text={`SUPERFÍCIE DA BANCADA · R ${mm(p.raio)}`} />
    </>
  );
}

function CorteCuba({ p, uid, s }: Ctx) {
  const esp = p.esp * s, eng = p.engaste * s, vao = Math.min(p.vao * s, 210), alt = Math.min(p.alt_cuba * s, 110);
  const prof = p.prof * s;
  const x = 55, y = 60, w = vao + 180;
  const cx = x + 90;
  const d =
    `M${x},${y} H${cx} L${cx},${y + prof} H${cx + vao} L${cx + vao},${y} H${x + w} V${y + esp} ` +
    `H${cx + vao + 2} V${y + esp} H${x} Z`;
  return (
    <>
      <path d={d} fill={`url(#${uid})`} stroke={INK} strokeWidth={BOLD} />
      <line x1={x} y1={y} x2={x + w} y2={y} stroke={INK} strokeWidth={THIN} strokeDasharray="7 3" />
      {/* cuba engastada por baixo — elemento oculto */}
      <path
        d={`M${cx - eng},${y + esp} V${y + esp + alt - 12} Q${cx - eng},${y + esp + alt} ${cx - eng + 14},${y + esp + alt} ` +
          `H${cx + vao + eng - 14} Q${cx + vao + eng},${y + esp + alt} ${cx + vao + eng},${y + esp + alt - 12} V${y + esp}`}
        fill="none" stroke={INK} strokeWidth={THIN} strokeDasharray="6 3"
      />
      {eng > 0 && (
        <>
          <rect x={cx - eng} y={y + esp} width={eng} height={6} fill={INK} opacity={0.85} />
          <rect x={cx + vao} y={y + esp} width={eng} height={6} fill={INK} opacity={0.85} />
          <Tag x={cx - eng - 6} y={y + esp + 22} text={`ENGASTE ${mm(p.engaste)}`} anchor="end" />
        </>
      )}
      <Dim mid={uid} x1={cx} y1={y + prof} x2={cx + vao} y2={y + prof} text={mm(p.vao)} off={-20} />
      <Dim mid={uid} x1={x + w} y1={y} x2={x + w} y2={y + esp} text={mm(p.esp)} vertical off={26} />
      <Dim mid={uid} x1={cx + vao + eng} y1={y + esp} x2={cx + vao + eng} y2={y + esp + alt} text={mm(p.alt_cuba)} vertical off={40} />
      {prof > 0 && <Tag x={cx + vao / 2} y={y + prof + 16} text="ÁREA MOLHADA" anchor="middle" />}
      <Tag x={x} y={y - 14} text="BANCADA" />
    </>
  );
}

function CorteTesteira({ p, uid, s }: Ctx) {
  const esp = p.esp * s, alt = p.alt * s, aba = p.aba * s, raio = Math.min(Math.abs(p.raio) * s, esp / 2);
  const x = 80, y = 50, base = y + alt;
  return (
    <>
      {/* testeira vertical */}
      <path d={`M${x},${y + raio} Q${x},${y} ${x + raio},${y} H${x + esp} V${base} H${x} Z`}
        fill={`url(#${uid})`} stroke={INK} strokeWidth={BOLD} />
      {/* tampo */}
      <rect x={x} y={base} width={200} height={esp} fill={`url(#${uid})`} stroke={INK} strokeWidth={BOLD} />
      {aba !== 0 && (
        <path d={`M${x + esp},${y} h${aba} v${esp} h${-aba}`} fill={`url(#${uid})`} stroke={INK} strokeWidth={BOLD} />
      )}
      <Dim mid={uid} x1={x} y1={y} x2={x} y2={base} text={mm(p.alt)} vertical off={-24} />
      <Dim mid={uid} x1={x} y1={base + esp} x2={x + esp} y2={base + esp} text={mm(p.esp)} off={26} />
      {aba !== 0 && <Dim mid={uid} x1={x + esp} y1={y} x2={x + esp + aba} y2={y} text={mm(Math.abs(p.aba))} off={-18} />}
      {p.raio > 0 && <Tag x={x + esp + 8} y={y + 10} text={`R ${mm(p.raio)}`} />}
    </>
  );
}

function CortePingadeira({ p, uid, s }: Ctx) {
  const esp = p.esp * s, dist = p.dist * s, lc = Math.max(p.larg_canal * s, 3), pc = Math.max(p.prof * s, 3);
  const x = 60, y = 70, w = 220;
  const cxp = x + w - dist - lc;
  return (
    <>
      <path
        d={`M${x},${y} H${x + w} V${y + esp} H${cxp + lc} V${y + esp - pc} H${cxp} V${y + esp} H${x} Z`}
        fill={`url(#${uid})`} stroke={INK} strokeWidth={BOLD}
      />
      <Dim mid={uid} x1={cxp + lc} y1={y + esp} x2={x + w} y2={y + esp} text={mm(p.dist)} off={30} />
      <Dim mid={uid} x1={cxp} y1={y + esp} x2={cxp + lc} y2={y + esp} text={mm(p.larg_canal)} off={16} />
      <Dim mid={uid} x1={x + w} y1={y} x2={x + w} y2={y + esp} text={mm(p.esp)} vertical off={26} />
      <Tag x={cxp - 10} y={y + esp + 34} text={`CANAL PROF. ${mm(p.prof)}`} anchor="end" />
    </>
  );
}

function CorteEncaixe({ p, uid, s }: Ctx) {
  const esp = p.esp * s, reb = p.rebaixo * s;
  const x = 60, y = 60, w = 120;
  const ang = p.angulo;
  const bevel = ang === 45 ? esp : 0;
  return (
    <>
      <path d={`M${x},${y} H${x + w} L${x + w - bevel},${y + esp} H${x} Z`} fill={`url(#${uid})`} stroke={INK} strokeWidth={BOLD} />
      <path
        d={ang === 45
          ? `M${x + w + 6},${y} H${x + w + 6 + w} V${y + esp} H${x + w + 6 + bevel} Z`
          : `M${x + w + 6},${y} H${x + w + 6 + w} V${y + esp} H${x + w + 6} V${y + esp - reb} H${x + w + 6 - reb} V${y} Z`}
        fill={`url(#${uid})`} stroke={INK} strokeWidth={BOLD}
      />
      <line x1={x + w + 3} y1={y - 10} x2={x + w + 3} y2={y + esp + 14} stroke={INK} strokeWidth={THIN} strokeDasharray="5 3" />
      <Dim mid={uid} x1={x} y1={y} x2={x} y2={y + esp} text={mm(p.esp)} vertical off={-24} />
      <Tag x={x + w + 8} y={y - 14} text={`${mm(p.angulo)}° · FOLGA ${mm(p.folga)}`} />
      {reb > 0 && <Tag x={x + w + 8} y={y + esp + 26} text={`REBAIXO ${mm(p.rebaixo)}`} />}
    </>
  );
}

function PlantaRecorte({ p, uid, s }: Ctx) {
  const comp = Math.min(p.comp * s, 240), larg = Math.min(p.larg * s, 150);
  const borda = p.borda * s, raio = Math.min(p.raio * s, Math.min(comp, larg) / 3), oc = p.oculto * s;
  const x = 60, y = 55;
  const W = comp + borda * 2, H = larg + borda * 2;
  return (
    <>
      <rect x={x} y={y} width={W} height={H} fill="none" stroke={INK} strokeWidth={BOLD} />
      <rect x={x + borda} y={y + borda} width={comp} height={larg} rx={raio} fill="none" stroke={INK} strokeWidth={THIN} />
      {oc > 0 && (
        <rect x={x + borda - oc} y={y + borda - oc} width={comp + oc * 2} height={larg + oc * 2}
          rx={raio + oc} fill="none" stroke={INK} strokeWidth={THIN} strokeDasharray="6 3" />
      )}
      <Dim mid={uid} x1={x + borda} y1={y + borda + larg} x2={x + borda + comp} y2={y + borda + larg} text={mm(p.comp)} off={30} />
      <Dim mid={uid} x1={x + borda + comp} y1={y + borda} x2={x + borda + comp} y2={y + borda + larg} text={mm(p.larg)} vertical off={34} />
      <Dim mid={uid} x1={x} y1={y} x2={x + borda} y2={y} text={mm(p.borda)} off={-16} />
      {p.raio > 0 && <Tag x={x + borda + 6} y={y + borda + 14} text={`R ${mm(p.raio)}`} />}
      <Tag x={x} y={y + H + 28} text="PLANTA — ELEMENTO OCULTO EM LINHA TRACEJADA" />
    </>
  );
}

function Superficie({ p, uid }: Ctx) {
  const x = 60, y = 60, w = 220, h = 90;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${uid})`} stroke={INK} strokeWidth={BOLD} />
      <Dim mid={uid} x1={x} y1={y + h} x2={x + w} y2={y + h} text={`ESP. ${mm(p.esp)}`} off={26} />
      <Tag x={x} y={y - 12} text="AMOSTRA DE SUPERFÍCIE" />
    </>
  );
}

const RENDERERS: Record<FinishTemplate, ((c: Ctx) => React.ReactElement) | null> = {
  corte_borda: CorteBorda,
  corte_rebaixo: CorteRebaixo,
  corte_cuba: CorteCuba,
  corte_testeira: CorteTesteira,
  corte_pingadeira: CortePingadeira,
  corte_encaixe: CorteEncaixe,
  planta_recorte: PlantaRecorte,
  superficie: Superficie,
  custom: null,
};

/* ------------------------- componente ------------------------- */

export function FinishDrawing(props: {
  template: FinishTemplate;
  params: Record<string, number>;
  /** SVG próprio enviado pelo usuário (template "custom" ou substituição). */
  svg?: string | null;
  title?: string;
  /** Chamada de detalhe, ex.: "A-A". */
  callout?: string;
  height?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const h = props.height ?? 220;

  if (props.svg) {
    return (
      <div className={props.className} style={{ height: h, background: "#fff" }}
        dangerouslySetInnerHTML={{ __html: props.svg }} />
    );
  }

  const R = RENDERERS[props.template];
  const scale = props.template === "planta_recorte" ? 0.32 : 1.6;

  return (
    <svg viewBox="0 0 400 240" style={{ width: "100%", height: h, background: "#fff" }}
      className={props.className} role="img" aria-label={props.title ?? "Desenho técnico"}>
      <Hatch id={uid} />
      {R ? R({ p: props.params, uid, s: scale }) : (
        <text x="200" y="120" textAnchor="middle" fontSize="10" fill={INK}>Sem desenho cadastrado</text>
      )}
      {props.title && <Tag x={12} y={228} text={props.title.toUpperCase()} />}
      {props.callout && <Tag x={388} y={228} text={`CORTE ${props.callout}`} anchor="end" />}
      <rect x="4" y="4" width="392" height="232" fill="none" stroke={INK} strokeWidth={THIN} />
    </svg>
  );
}
