import { supabase } from "@/integrations/supabase/client";
import type { UIMessage } from "ai";

export type PedraThread = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export async function listarConversas(): Promise<PedraThread[]> {
  const { data, error } = await supabase
    .from("pedra_threads")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as PedraThread[];
}

export async function criarConversa(title = "Nova conversa"): Promise<PedraThread> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão não encontrada.");
  const { data, error } = await supabase
    .from("pedra_threads")
    .insert({ user_id: u.user.id, title })
    .select("id, title, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as PedraThread;
}

export async function renomearConversa(id: string, title: string) {
  const limpo = title.trim().slice(0, 60);
  if (!limpo) return;
  await supabase.from("pedra_threads").update({ title: limpo }).eq("id", id);
}

export async function excluirConversa(id: string) {
  const { error } = await supabase.from("pedra_threads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function carregarMensagens(threadId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("pedra_messages")
    .select("message, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => r.message as unknown as UIMessage)
    .filter((m) => m && Array.isArray((m as any).parts));
}

/** Grava a mensagem uma única vez por id do chat (evita duplicar ao re-renderizar). */
export async function salvarMensagem(threadId: string, message: UIMessage) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const clientId = String((message as any).id ?? "");
  if (clientId) {
    const { data: existente } = await supabase
      .from("pedra_messages")
      .select("id")
      .eq("thread_id", threadId)
      .eq("client_message_id", clientId)
      .maybeSingle();
    if (existente) {
      await supabase
        .from("pedra_messages")
        .update({ message: message as any })
        .eq("id", existente.id);
      return;
    }
  }
  await supabase.from("pedra_messages").insert({
    thread_id: threadId,
    user_id: u.user.id,
    role: message.role,
    message: message as any,
    client_message_id: clientId || null,
  });
  await supabase
    .from("pedra_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);
}

export function tituloDaMensagem(message: UIMessage): string {
  const texto = (message.parts ?? [])
    .map((p: any) => (p?.type === "text" ? p.text : ""))
    .join(" ")
    .trim();
  return texto.slice(0, 60) || "Nova conversa";
}
