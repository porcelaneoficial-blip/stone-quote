import type { EnvItem, PieceKind, PieceShape, CubaInstall, EdgeStyle } from "./types";

const KIND_MAP: { kw: RegExp; kind: PieceKind }[] = [
  { kw: /(balc[aã]o).*(seca)/i, kind: "balcao_seca" },
  { kw: /(balc[aã]o).*(molhad)/i, kind: "balcao_molhada" },
  { kw: /testeira/i, kind: "testeira" },
  { kw: /respaldo|frontao|frontão|encosto/i, kind: "respaldo" },
  { kw: /rodap[eé]/i, kind: "rodape" },
  { kw: /montante|lateral/i, kind: "montante" },
  { kw: /cuba/i, kind: "cuba" },
  { kw: /tampo|bancad|mesa/i, kind: "tampo" },
];

const CUBA_INSTALL_MAP: { kw: RegExp; v: CubaInstall }[] = [
  { kw: /embut/i, v: "embutir" },
  { kw: /sobrepor|sobre.?por|apoio/i, v: "sobrepor" },
  { kw: /semi.?encaix/i, v: "semi_encaixe" },
];

const EDGE_STYLE_MAP: { kw: RegExp; v: EdgeStyle }[] = [
  { kw: /45|quarenta.?e.?cinco|meia.?esquadria/i, v: "bisel_45" },
  { kw: /chanfr/i, v: "chanfrado" },
  { kw: /bolead|arredond/i, v: "boleado" },
  { kw: /reto/i, v: "reto" },
];

const SHAPE_KW: { kw: RegExp; v: PieceShape }[] = [
  { kw: /redond|circular|c[ií]rcul/i, v: "redondo" },
];

export function detectPieceKind(description: string): PieceKind | undefined {
  if (!description) return undefined;
  for (const m of KIND_MAP) if (m.kw.test(description)) return m.kind;
  return undefined;
}
export function detectCubaInstall(description: string): CubaInstall | undefined {
  if (!description) return undefined;
  for (const m of CUBA_INSTALL_MAP) if (m.kw.test(description)) return m.v;
  return undefined;
}
export function detectEdgeStyle(description: string): EdgeStyle | undefined {
  if (!description) return undefined;
  for (const m of EDGE_STYLE_MAP) if (m.kw.test(description)) return m.v;
  return undefined;
}

/** Determina formato a partir de medidas em metros. tolerância 1cm. */
export function detectShape(length: number, width: number, diameter?: number, description?: string): PieceShape {
  if (description) {
    for (const m of SHAPE_KW) if (m.kw.test(description)) return m.v;
  }
  if (diameter && diameter > 0) return "redondo";
  const L = Number(length) || 0;
  const W = Number(width) || 0;
  if (L > 0 && W > 0 && Math.abs(L - W) <= 0.01) return "quadrado";
  return "retangular";
}

export function applyAutoRecognition(item: EnvItem): EnvItem {
  const out = { ...item };
  if (!out.shape) out.shape = detectShape(out.length, out.width, out.diameter, out.description);
  if (!out.piece_kind) {
    const k = detectPieceKind(out.description);
    if (k) out.piece_kind = k;
  }
  if (out.piece_kind === "cuba" && !out.cuba_install) {
    const ci = detectCubaInstall(out.description);
    if (ci) out.cuba_install = ci;
  }
  return out;
}

export const PIECE_KIND_LABEL: Record<PieceKind, string> = {
  balcao_seca: "Balcão área seca",
  balcao_molhada: "Balcão área molhada",
  testeira: "Testeira",
  respaldo: "Respaldo",
  rodape: "Rodapé",
  montante: "Montante",
  cuba: "Cuba",
  tampo: "Tampo",
  outro: "Outro",
};

export const SHAPE_LABEL: Record<PieceShape, string> = {
  retangular: "Retangular",
  quadrado: "Quadrado",
  redondo: "Redondo",
};

export const CUBA_INSTALL_LABEL: Record<CubaInstall, string> = {
  embutir: "Embutir",
  sobrepor: "Sobrepor",
  semi_encaixe: "Semi encaixe",
};

export const EDGE_STYLE_LABEL: Record<EdgeStyle, string> = {
  reto: "Reto",
  bisel_45: "45° (meia esquadria)",
  chanfrado: "Chanfrado",
  boleado: "Boleado",
  meia_esquadria: "Meia esquadria",
};

/* ------- Reconhecimento de cor/textura da pedra a partir da descrição ------- */
type StoneEntry = { kw: RegExp; color: string; label: string };
const STONE_PALETTE: StoneEntry[] = [
  { kw: /calacatta|calacata/i, color: "#f3efe6", label: "Calacatta" },
  { kw: /carrara/i, color: "#ece9e2", label: "Carrara" },
  { kw: /statuari?o|statuario/i, color: "#f5f2ec", label: "Statuário" },
  { kw: /nero|marquina|preto\s*absoluto|absolute\s*black/i, color: "#1a1a1a", label: "Nero / Preto" },
  { kw: /preto\s*s[aã]o\s*gabriel|s[aã]o\s*gabriel/i, color: "#2b2b2b", label: "Preto São Gabriel" },
  { kw: /verde\s*ubatuba|ubatuba/i, color: "#2f4a2f", label: "Verde Ubatuba" },
  { kw: /verde/i, color: "#3d5a3d", label: "Verde" },
  { kw: /amarelo\s*ic[aá]ra|ic[aá]ra/i, color: "#d6b56b", label: "Amarelo Icaraí" },
  { kw: /amarelo\s*ornamental|ornamental/i, color: "#caa974", label: "Amarelo Ornamental" },
  { kw: /amarelo/i, color: "#d4b06a", label: "Amarelo" },
  { kw: /branco\s*ceara|cear[aá]/i, color: "#ece6d8", label: "Branco Ceará" },
  { kw: /branco\s*siena|siena/i, color: "#eee7d6", label: "Branco Siena" },
  { kw: /branco\s*itaunas|ita[uú]nas/i, color: "#ebe5d4", label: "Branco Itaúnas" },
  { kw: /branco\s*piracema/i, color: "#e8e3d6", label: "Branco Piracema" },
  { kw: /branco\s*prime/i, color: "#efece3", label: "Branco Prime" },
  { kw: /branco/i, color: "#ece8df", label: "Branco" },
  { kw: /cinza\s*corumb[aá]|corumb[aá]/i, color: "#9a9a98", label: "Cinza Corumbá" },
  { kw: /cinza\s*andorinha|andorinha/i, color: "#7d7d7b", label: "Cinza Andorinha" },
  { kw: /cinza/i, color: "#9e9e9b", label: "Cinza" },
  { kw: /marrom\s*absoluto/i, color: "#3b2a20", label: "Marrom Absoluto" },
  { kw: /marrom\s*imperial|imperial/i, color: "#5a3a2a", label: "Marrom Imperial" },
  { kw: /marrom/i, color: "#5b4030", label: "Marrom" },
  { kw: /travertino/i, color: "#d8c6a2", label: "Travertino" },
  { kw: /granito\s*ouro|ouro\s*brasil/i, color: "#bd9b5a", label: "Ouro Brasil" },
  { kw: /quartzo\s*branco|branco\s*absoluto/i, color: "#f3f2ed", label: "Quartzo Branco" },
  { kw: /quartzo\s*preto/i, color: "#1d1d1d", label: "Quartzo Preto" },
  { kw: /quartzo/i, color: "#e6e3da", label: "Quartzo" },
  { kw: /porcelanato\s*preto/i, color: "#1c1c1c", label: "Porcelanato Preto" },
  { kw: /porcelanato/i, color: "#ecebe6", label: "Porcelanato" },
  { kw: /m[aá]rmore/i, color: "#ece9e0", label: "Mármore" },
  { kw: /granito/i, color: "#7a6d5e", label: "Granito" },
];

export function detectStoneColor(text?: string): { color: string; label: string } | undefined {
  if (!text) return undefined;
  for (const s of STONE_PALETTE) if (s.kw.test(text)) return { color: s.color, label: s.label };
  return undefined;
}

