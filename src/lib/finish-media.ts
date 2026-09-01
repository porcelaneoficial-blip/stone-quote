/**
 * Imagens, vistas técnicas e medidas manuais dos acabamentos já cadastrados
 * em `library_finishes`. Camada aditiva: nenhum cadastro paralelo.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const FINISH_BUCKET = "library-finishes";

export type FinishViewType =
  | "superior" | "frontal" | "lateral" | "corte" | "detalhe" | "aplicacao" | "3d";

export const VIEW_TYPE_LABEL: Record<FinishViewType, string> = {
  superior: "Vista superior",
  frontal: "Vista frontal",
  lateral: "Vista lateral",
  corte: "Corte",
  detalhe: "Detalhe",
  aplicacao: "Aplicação",
  "3d": "3D",
};

export type FinishView = {
  id: string;
  user_id: string;
  finish_id: string;
  view_type: FinishViewType;
  title: string | null;
  image_url: string | null;
  storage_path: string | null;
  position: number;
  notes: string | null;
};

export type FinishMeasure = {
  id: string;
  user_id: string;
  finish_id: string;
  name: string;
  value: number | null;
  unit: string;
  notes: string | null;
  position: number;
};

/** Medidas comuns — apenas sugestão de nome; o valor é sempre manual. */
export const MEASURE_PRESETS = [
  "Comprimento", "Largura", "Altura", "Profundidade", "Espessura",
  "Raio", "Ângulo", "Largura do rebaixo", "Profundidade do rebaixo",
  "Posição do ralo", "Distância do ralo", "Inclinação",
];

export const MEASURE_UNITS = ["mm", "cm", "m", "°", "%"];

/** "CUBA_ESCULPIDA_REBAIXO-ITALIANO.jpg" → "Cuba Esculpida Rebaixo Italiano" */
export function suggestNameFromFile(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const words = base
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()));
  return words.join(" ");
}

export async function uploadFinishImage(file: File, userId: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(FINISH_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Resolve caminhos internos do storage em URLs assinadas (mantém http externo). */
export function useSignedFinishUrls(paths: (string | null | undefined)[]) {
  const key = paths.filter(Boolean).join("|");
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const internal = Array.from(new Set(paths.filter((p): p is string => !!p && !/^https?:\/\//.test(p))));
    if (internal.length === 0) { setMap({}); return; }
    let alive = true;
    supabase.storage.from(FINISH_BUCKET).createSignedUrls(internal, 60 * 60).then(({ data }) => {
      if (!alive || !data) return;
      const next: Record<string, string> = {};
      data.forEach((d, i) => { if (d.signedUrl) next[internal[i]] = d.signedUrl; });
      setMap(next);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (p?: string | null) => (!p ? null : /^https?:\/\//.test(p) ? p : map[p] ?? null);
}
