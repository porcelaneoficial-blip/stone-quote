import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/** Captura um elemento DOM (A4) e devolve o PDF em base64 (sem prefixo data:). */
export async function elementToPdfBase64(el: HTMLElement): Promise<string> {
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  const img = canvas.toDataURL("image/jpeg", 0.92);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pageW) / canvas.width;

  if (imgH <= pageH) {
    pdf.addImage(img, "JPEG", 0, 0, pageW, imgH);
  } else {
    // Pagina o conteúdo se for maior que 1 A4
    let remaining = imgH;
    let position = 0;
    while (remaining > 0) {
      pdf.addImage(img, "JPEG", 0, position, pageW, imgH);
      remaining -= pageH;
      if (remaining > 0) {
        position -= pageH;
        pdf.addPage();
      }
    }
  }

  const dataUri = pdf.output("datauristring");
  return dataUri.split(",")[1] ?? dataUri;
}

/** Captura vários elementos A4 (uma página por elemento) e devolve o PDF em base64. */
export async function elementsToPdfBase64(els: HTMLElement[]): Promise<string> {
  if (els.length === 1) return elementToPdfBase64(els[0]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < els.length; i++) {
    const canvas = await html2canvas(els[i], { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
    const img = canvas.toDataURL("image/jpeg", 0.92);
    const imgH = Math.min((canvas.height * pageW) / canvas.width, pageH);
    if (i > 0) pdf.addPage();
    pdf.addImage(img, "JPEG", 0, 0, pageW, imgH);
  }
  const dataUri = pdf.output("datauristring");
  return dataUri.split(",")[1] ?? dataUri;
}


export interface EnviarWhatsappArgs {
  telefone: string;
  nomeCliente: string;
  valor?: string | number;
  pdfBase64: string;
  fileName?: string;
  caption?: string;
}

/** Envia o PDF (base64) via API interna -> Z-API. */
export async function enviarPdfWhatsapp(args: EnviarWhatsappArgs) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
  const res = await fetch("/api/zapi-enviar-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(args),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.erro || json?.error || "Falha ao enviar");
  return json;
}

/** Normaliza telefone p/ formato Z-API: 55 + DDD + número. */
export function normalizePhoneBR(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}
