import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trello, RefreshCw, AlertTriangle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  getTrelloIntegration,
  syncOrderToTrelloOnClose,
  orderEligibleForTrello,
  type TrelloIntegration,
} from "@/lib/trello-sync";
import type { QuoteData } from "@/lib/types";

const LABEL: Record<string, string> = {
  pendente: "Trello: pendente",
  criando: "Trello: criando…",
  criado: "Trello: card criado",
  erro: "Trello: erro",
};

/**
 * Estado da integração com o Trello.
 * O card é criado automaticamente no fechamento do pedido (somente instalação).
 */
export function TrelloOrderStatus({ orderId, orderData }: { orderId: string; orderData: QuoteData }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data, isFetched } = useQuery<TrelloIntegration | null>({
    queryKey: ["trello-integration", orderId],
    queryFn: () => getTrelloIntegration(orderId),
  });

  const eligible = orderEligibleForTrello(orderData);
  const status = data?.status ?? "pendente";
  const hasCard = !!data?.card_id;
  const autoDone = useRef(false);

  // Automático: pedido elegível sem card → cria o card assim que a tela abre.
  // Não repete quando o erro anterior foi de credencial (401/config) — evita loop.
  const credError = /401|invalid key|não configurado/i.test(data?.error ?? "");
  useEffect(() => {
    if (!eligible || !isFetched || hasCard || autoDone.current || credError) return;
    if (status === "criando") return;
    autoDone.current = true;

    (async () => {
      const r = await syncOrderToTrelloOnClose(orderId, { triggeredByName: "Automação" });
      if (r.ok && !r.skipped) toast.success("Card criado no Trello");
      qc.invalidateQueries({ queryKey: ["trello-integration", orderId] });
    })();
  }, [eligible, isFetched, hasCard, status, orderId, qc, credError]);


  // Sem ENTREGA + INSTALAÇÃO: nenhuma integração com o Trello.
  if (!eligible) return null;


  const retry = async () => {
    setBusy(true);
    const tid = toast.loading("Registrando no Trello…");
    const r = await syncOrderToTrelloOnClose(orderId);
    setBusy(false);
    if (r.ok && r.skipped && r.reason === "atualizado") toast.info("Card já existe — informações atualizadas", { id: tid });
    else if (r.ok) toast.success("Card criado no Trello", { id: tid });
    else toast.error(r.error || "Não foi possível registrar a instalação no Trello.", { id: tid });
    qc.invalidateQueries({ queryKey: ["trello-integration", orderId] });
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 border px-3 py-2 text-[10px] uppercase tracking-widest font-bold ${
          status === "erro"
            ? "border-red-300 text-red-700"
            : status === "criado"
              ? "border-[#0079BF] text-[#0079BF]"
              : "border-stone-300 text-stone-500"
        }`}
      >
        <Trello className="size-3" /> {LABEL[status]}
      </span>
      {data?.card_url && (
        <a
          href={data.card_url}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] uppercase tracking-widest underline text-[#0079BF]"
        >
          abrir cartão
        </a>
      )}
      {status === "erro" && !hasCard && (
        <span className="inline-flex items-center gap-1.5 text-[10px] text-red-700">
          <AlertTriangle className="size-3" /> Não foi possível registrar a instalação no Trello.
        </span>
      )}
      {(!hasCard || status === "criado") && (
        <button
          disabled={busy}
          onClick={retry}
          className="border border-[#0079BF] text-[#0079BF] px-4 py-2 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5 hover:bg-[#0079BF]/10 disabled:opacity-50"
        >
          <RefreshCw className="size-3" /> {hasCard ? "Atualizar card" : "Tentar novamente"}
        </button>
      )}
    </div>
  );
}
