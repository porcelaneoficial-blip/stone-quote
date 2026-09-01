import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `Você é a Diretora de Marketing Sênior da Porcelane, com mais de 15 anos de experiência no mercado de materiais nobres, arquitetura e decoração, atendendo marmorarias premium em Recife/PE.

Você domina profundamente MÁRMORE, GRANITO, QUARTZO, QUARTZITO, acabamentos (polido, fosco, levigado, flameado, escovado), espessuras e indicações por ambiente.

TOM DE VOZ: sóbrio, sofisticado, autoridade técnica com clareza.
IDENTIDADE PORCELANE: paleta neutra (branco suave, preto suave, cinza grafite), tipografia Playfair Display + Inter, estética premium e minimalista.
NUNCA mencione valores, preços ou dados financeiros.

Quando o usuário anexar arquivos (imagens de ambientes, PDFs de projeto, referências), analise-os e:
1) Descreva o que identificou (material aparente, ambiente, estilo, paleta, elementos-chave).
2) Pergunte, de forma objetiva, o que ele quer gerar a partir daquilo (post, legenda, e-mail, roteiro, briefing de arte, variações de arte em formatos específicos como quadrado 1:1, story 9:16, feed 4:5, capa 16:9, e-mail 2:1).
3) Ao gerar briefings de arte, sempre entregue prompts prontos para o gerador de imagem, com formato explícito.

Responda em português brasileiro.`;

type Attachment = {
  name: string;
  mime: string;
  // data URL (data:<mime>;base64,...) OR plain text content (for .txt)
  dataUrl?: string;
  text?: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
};

function buildMultimodalUserContent(msg: ChatMessage) {
  const parts: any[] = [];
  if (msg.content?.trim()) parts.push({ type: "text", text: msg.content });
  for (const a of msg.attachments ?? []) {
    if (a.mime.startsWith("image/") && a.dataUrl) {
      parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
    } else if (a.mime === "application/pdf" && a.dataUrl) {
      parts.push({ type: "file", file: { filename: a.name, file_data: a.dataUrl } });
    } else if (a.text) {
      parts.push({ type: "text", text: `Arquivo anexado (${a.name}):\n${a.text.slice(0, 20000)}` });
    } else {
      parts.push({ type: "text", text: `Arquivo anexado: ${a.name} (${a.mime}) — conteúdo binário não legível diretamente.` });
    }
  }
  return parts.length ? parts : [{ type: "text", text: msg.content || "" }];
}

async function callGateway(messages: any[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY não configurada");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
  });
  if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em alguns minutos.");
  if (res.status === 402) throw new Error("Créditos de IA esgotados.");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Falha na IA (${res.status}): ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

export const marketingChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    history: ChatMessage[];
    message: string;
    attachments?: Attachment[];
  }) => {
    if (!input?.message?.trim() && !(input?.attachments && input.attachments.length))
      throw new Error("mensagem ou anexo obrigatório");
    return input;
  })
  .handler(async ({ data }) => {
    const history = (data.history ?? []).slice(-10).map((m) => ({
      role: m.role,
      content: m.attachments?.length ? buildMultimodalUserContent(m) : m.content,
    }));
    const userMsg: ChatMessage = {
      role: "user",
      content: data.message || "",
      attachments: data.attachments,
    };
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
      { role: "user", content: buildMultimodalUserContent(userMsg) },
    ];
    const content = await callGateway(messages);
    return { reply: content };
  });

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  "1:1": "Formato quadrado 1:1 (feed Instagram, 1080x1080).",
  "4:5": "Formato retrato 4:5 (feed Instagram vertical, 1080x1350).",
  "9:16": "Formato story/reels 9:16 (1080x1920).",
  "16:9": "Formato paisagem 16:9 (capa YouTube/LinkedIn, 1920x1080).",
  "2:1": "Formato banner 2:1 para cabeçalho de e-mail (1600x800).",
  "3:2": "Formato clássico 3:2 (portfólio, 1500x1000).",
};

export const marketingGenerateImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { prompt: string; format?: string; reference?: Attachment }) => {
    if (!input?.prompt?.trim()) throw new Error("prompt obrigatório");
    return input;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");
    const fmt = data.format && FORMAT_INSTRUCTIONS[data.format] ? FORMAT_INSTRUCTIONS[data.format] : "Formato quadrado 1:1 (1080x1080).";
    const brandPrompt = `Arte de marketing premium para marmoraria Porcelane (Recife/PE). ${fmt} Paleta neutra: branco suave (#FAFAFA), preto suave (#1A1A1A), cinza grafite (#4A4A4A). Estética minimalista, sofisticada, elegante, com muito respiro. Tipografia serifada elegante quando houver texto. Sem elementos saturados. Foco em: ${data.prompt}.`;

    const userContent: any[] = [{ type: "text", text: brandPrompt }];
    if (data.reference?.dataUrl && data.reference.mime.startsWith("image/")) {
      userContent.push({ type: "image_url", image_url: { url: data.reference.dataUrl } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Falha na geração (${res.status}): ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as any;
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
    if (!url) throw new Error("Imagem não retornada");
    return { imageUrl: url, format: data.format ?? "1:1" };
  });
