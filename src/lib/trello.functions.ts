import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const API = "https://api.trello.com/1";

type Creds = { key: string; token: string; boardName: string };

function creds(): Creds {
  const key = process.env["TRELLO_API_KEY"];
  const token = process.env["TRELLO_TOKEN"];
  if (!key || !token) throw new Error("Trello não configurado: faltam TRELLO_API_KEY e TRELLO_TOKEN.");
  return { key, token, boardName: process.env["TRELLO_BOARD_NAME"] || "Porcelane" };
}

async function trello<T>(path: string, c: Creds, init?: RequestInit): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${API}${path}${sep}key=${c.key}&token=${c.token}`, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`Trello [${res.status}]: ${text}`);
  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

type Board = { id: string; name: string; closed: boolean };
type List = { id: string; name: string };

async function resolveList(c: Creds, listName: string): Promise<{ boardId: string; listId: string }> {
  const boards = await trello<Board[]>("/members/me/boards?fields=id,name,closed", c);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const board =
    boards.find((b) => !b.closed && norm(b.name) === norm(c.boardName)) ??
    boards.find((b) => !b.closed && norm(b.name).includes(norm(c.boardName)));
  if (!board) throw new Error(`Quadro "${c.boardName}" não encontrado no Trello.`);
  const lists = await trello<List[]>(`/boards/${board.id}/lists?fields=id,name`, c);
  const list =
    lists.find((l) => norm(l.name) === norm(listName)) ??
    lists.find((l) => norm(l.name).startsWith(norm(listName)));
  if (!list) throw new Error(`Lista "${listName}" não encontrada no quadro ${board.name}.`);
  return { boardId: board.id, listId: list.id };
}

/** Verifica se a integração está configurada e se o quadro/lista existem. */
export const trelloStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const c = creds();
      const { listId } = await resolveList(c, process.env["TRELLO_LIST_NAME"] || "PEDIDO");
      return { configured: true as const, listId, board: c.boardName };
    } catch (e) {
      return { configured: false as const, error: (e as Error).message };
    }
  });

export type TrelloCardInput = {
  title: string;
  description: string;
  listName?: string;
  /** PDF do pedido em base64 (sem prefixo data:). */
  pdfBase64?: string;
  pdfFileName?: string;
  /** Anexos e fotos do pedido (URLs assinadas/públicas). */
  urls?: { name: string; url: string }[];
  /** Itens de checklist (etapas). */
  checklist?: string[];
};

/** Cria um card no Trello com o PDF do pedido e as informações/fotos. */
export const createOrderCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TrelloCardInput) => {
    if (!input?.title) throw new Error("Título obrigatório");
    return input;
  })
  .handler(async ({ data }) => {
    try {
    const c = creds();
    const listName = data.listName || process.env["TRELLO_LIST_NAME"] || "PEDIDO";
    const { listId } = await resolveList(c, listName);

    const card = await trello<{ id: string; shortUrl: string }>(
      `/cards?idList=${listId}&pos=top&name=${encodeURIComponent(data.title)}&desc=${encodeURIComponent(data.description.slice(0, 16000))}`,
      c,
      { method: "POST" },
    );

    const warnings: string[] = [];

    if (data.pdfBase64) {
      try {
        const bin = Uint8Array.from(atob(data.pdfBase64), (ch) => ch.charCodeAt(0));
        const form = new FormData();
        form.append("file", new Blob([bin], { type: "application/pdf" }), data.pdfFileName || "pedido.pdf");
        form.append("name", data.pdfFileName || "pedido.pdf");
        await trello(`/cards/${card.id}/attachments`, c, { method: "POST", body: form });
      } catch (e) {
        warnings.push(`PDF: ${(e as Error).message}`);
      }
    }

    for (const a of data.urls ?? []) {
      try {
        await trello(
          `/cards/${card.id}/attachments?url=${encodeURIComponent(a.url)}&name=${encodeURIComponent(a.name)}`,
          c,
          { method: "POST" },
        );
      } catch (e) {
        warnings.push(`${a.name}: ${(e as Error).message}`);
      }
    }

    if (data.checklist?.length) {
      try {
        const cl = await trello<{ id: string }>(
          `/checklists?idCard=${card.id}&name=${encodeURIComponent("Etapas")}`,
          c,
          { method: "POST" },
        );
        for (const item of data.checklist) {
          await trello(`/checklists/${cl.id}/checkItems?name=${encodeURIComponent(item)}`, c, { method: "POST" });
        }
      } catch (e) {
        warnings.push(`Checklist: ${(e as Error).message}`);
      }
    }

    return { id: card.id, url: card.shortUrl, listId, warnings, error: null as string | null };
    } catch (e) {
      return { id: null, url: null, listId: null, warnings: [] as string[], error: (e as Error).message };
    }
  });

/**
 * Atualiza um card existente (nome/descrição) e anexa apenas os arquivos que
 * ainda não estão no card — garante idempotência, nunca cria um segundo card.
 */
export const updateOrderCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { cardId: string } & Omit<TrelloCardInput, "listName" | "checklist">) => {
    if (!input?.cardId) throw new Error("cardId obrigatório");
    return input;
  })
  .handler(async ({ data }) => {
    try {
    const c = creds();
    const warnings: string[] = [];

    const card = await trello<{ id: string; shortUrl: string; closed: boolean }>(
      `/cards/${data.cardId}?name=${encodeURIComponent(data.title)}&desc=${encodeURIComponent(data.description.slice(0, 16000))}`,
      c,
      { method: "PUT" },
    );

    let existing: { name: string }[] = [];
    try {
      existing = await trello<{ name: string }[]>(`/cards/${data.cardId}/attachments?fields=name`, c);
    } catch (e) {
      warnings.push(`Anexos existentes: ${(e as Error).message}`);
    }
    const has = new Set(existing.map((a) => a.name));

    for (const a of data.urls ?? []) {
      if (has.has(a.name)) continue;
      try {
        await trello(
          `/cards/${data.cardId}/attachments?url=${encodeURIComponent(a.url)}&name=${encodeURIComponent(a.name)}`,
          c,
          { method: "POST" },
        );
      } catch (e) {
        warnings.push(`${a.name}: ${(e as Error).message}`);
      }
    }

    if (data.pdfBase64 && !has.has(data.pdfFileName || "pedido.pdf")) {
      try {
        const bin = Uint8Array.from(atob(data.pdfBase64), (ch) => ch.charCodeAt(0));
        const form = new FormData();
        form.append("file", new Blob([bin], { type: "application/pdf" }), data.pdfFileName || "pedido.pdf");
        form.append("name", data.pdfFileName || "pedido.pdf");
        await trello(`/cards/${data.cardId}/attachments`, c, { method: "POST", body: form });
      } catch (e) {
        warnings.push(`PDF: ${(e as Error).message}`);
      }
    }

    return { id: card.id, url: card.shortUrl, warnings, error: null as string | null };
    } catch (e) {
      return { id: null, url: null, warnings: [] as string[], error: (e as Error).message };
    }
  });
