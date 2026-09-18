import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessagesSquare, X } from "lucide-react";
import { PedraChat } from "@/components/pedra-chat";

export function PedraFab() {
  const [aberto, setAberto] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname.startsWith("/pedra")) return null;

  return (
    <>
      {aberto && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[min(34rem,75vh)] w-[min(26rem,92vw)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <p className="text-sm font-bold text-black">Pedra Assistente</p>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setAberto(false)}
              className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <PedraChat compact contexto={`tela ${pathname}`} />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="Abrir a Pedra Assistente"
        className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:opacity-90"
      >
        <MessagesSquare className="size-6" />
      </button>
    </>
  );
}
