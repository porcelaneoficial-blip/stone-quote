export const brl = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const num = (n: number, d = 2) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });

/** Medida da liberação técnica: mín. 2 decimais, máx. 3, removendo zeros à direita além do 2º. */
export const numMed = (n: number) => {
  const s = (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  const [intPart, decPart = ""] = s.split(",");
  let dec = decPart;
  while (dec.length > 2 && dec.endsWith("0")) dec = dec.slice(0, -1);
  return dec ? `${intPart},${dec}` : intPart;
};

export const parseNum = (v: string | number | null | undefined): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

export const BR_TZ = "America/Recife";

/** Data de hoje formatada no padrão pt-BR (fuso de Brasília). */
export const todayBR = () => new Date().toLocaleDateString("pt-BR", { timeZone: BR_TZ });

/** Data de hoje em ISO YYYY-MM-DD considerando o fuso de Brasília. */
export const todayISO = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
};

/** Formata uma data ISO/Date em pt-BR no fuso de Brasília. */
export const fmtDate = (iso: string | Date) => {
  try {
    // Para strings YYYY-MM-DD, formata direto sem conversão de fuso (evita voltar 1 dia).
    if (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y}`;
    }
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: BR_TZ });
  } catch { return String(iso); }
};

/** Formata data + hora em pt-BR no fuso de Brasília. */
export const fmtDateTime = (iso: string | Date) => {
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: BR_TZ, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return String(iso); }
};
