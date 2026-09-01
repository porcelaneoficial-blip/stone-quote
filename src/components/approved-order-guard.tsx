import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Lock, GitBranch, ShieldAlert } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { createTechnicalRevision, logOrderChange, type RevisionChange } from "@/lib/order-lock";

export type GuardRequest = {
  /** Rótulo curto do que está sendo alterado (ex.: "Vendedor"). */
  label: string;
  /** Lista de campos alterados, para o histórico e para a revisão técnica. */
  changes: RevisionChange[];
  /** Executa a alteração no pedido comercial original. */
  applyToOriginal: () => Promise<void> | void;
  /** Payload técnico opcional guardado na revisão separada. */
  revisionData?: Record<string, unknown>;
};

type Step = "closed" | "choose" | "confirm";

/**
 * Dupla confirmação obrigatória para alterar um pedido já aprovado.
 * Opções: manter original · criar revisão técnica separada · alterar o original.
 */
export function useApprovedOrderGuard(orderId: string | undefined, opts?: { onRevisionCreated?: () => void; onChanged?: () => void }) {
  const [step, setStep] = useState<Step>("closed");
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const req = useRef<GuardRequest | null>(null);

  const request = useCallback((r: GuardRequest) => {
    req.current = r;
    setReason("");
    setAck(false);
    setStep("choose");
  }, []);

  const close = () => { req.current = null; setStep("closed"); setBusy(false); };

  const doRevision = async () => {
    const r = req.current;
    if (!r || !orderId) return;
    if (reason.trim().length < 5) { toast.error("Descreva a justificativa da revisão técnica"); return; }
    setBusy(true);
    try {
      const rev = await createTechnicalRevision({
        order_id: orderId,
        reason: reason.trim(),
        changes: r.changes,
        data: r.revisionData,
      });
      toast.success(`Revisão técnica R${rev?.seq ?? ""} criada — pedido original preservado`);
      opts?.onRevisionCreated?.();
      close();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao criar revisão";
      toast.error(msg);
      setBusy(false);
    }
  };

  const doApplyOriginal = async () => {
    const r = req.current;
    if (!r || !orderId) return;
    if (!ack) { toast.error("Marque a confirmação para prosseguir"); return; }
    if (reason.trim().length < 5) { toast.error("Informe a justificativa da alteração"); return; }
    setBusy(true);
    try {
      await r.applyToOriginal();
      for (const c of r.changes) {
        await logOrderChange({
          order_id: orderId,
          field: c.field,
          description: `${r.label}: ${c.label ?? c.field} alterado no pedido aprovado`,
          old_value: c.old_value,
          new_value: c.new_value,
          reason: reason.trim(),
        });
      }
      toast.success("Alteração aplicada e registrada no histórico");
      opts?.onChanged?.();
      close();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao alterar";
      toast.error(msg);
      setBusy(false);
    }
  };

  const dialog = (
    <Dialog open={step !== "closed"} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-lg">
        {step === "choose" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-xl">
                <AlertTriangle className="size-5 text-amber-600" /> Pedido aprovado
              </DialogTitle>
              <DialogDescription className="text-sm text-stone-600">
                Você está prestes a alterar um pedido já aprovado. Esta alteração poderá impactar
                valores, produção, documentos comerciais e comissões. Deseja realmente continuar?
              </DialogDescription>
            </DialogHeader>

            {req.current?.changes?.length ? (
              <ul className="text-xs bg-stone-50 border border-stone-200 p-3 space-y-1">
                {req.current.changes.map((c, i) => (
                  <li key={i}>
                    <b>{c.label ?? c.field}</b>: <span className="text-stone-500">{String(c.old_value ?? "—")}</span>
                    {" → "}<span className="text-stone-900">{String(c.new_value ?? "—")}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <label className="block text-xs uppercase tracking-widest font-bold text-stone-500 mt-2">Justificativa</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Motivo da alteração (obrigatório)"
              className="w-full border border-stone-300 px-3 py-2 text-sm"
            />

            <div className="grid gap-2 mt-2">
              <button
                onClick={close}
                className="w-full px-4 py-3 text-xs uppercase tracking-widest font-bold border border-stone-900 bg-stone-900 text-white flex items-center justify-center gap-2"
              >
                <Lock className="size-3" /> Manter pedido original
              </button>
              <button
                disabled={busy}
                onClick={doRevision}
                className="w-full px-4 py-3 text-xs uppercase tracking-widest font-bold border border-stone-300 hover:bg-stone-50 flex items-center justify-center gap-2"
              >
                <GitBranch className="size-3" /> Criar revisão técnica separada
              </button>
              <button
                disabled={busy}
                onClick={() => setStep("confirm")}
                className="w-full px-4 py-3 text-xs uppercase tracking-widest font-bold border border-red-300 text-red-700 hover:bg-red-50 flex items-center justify-center gap-2"
              >
                <ShieldAlert className="size-3" /> Alterar o pedido original
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-xl text-red-700">
                <ShieldAlert className="size-5" /> Confirmação final
              </DialogTitle>
              <DialogDescription className="text-sm text-stone-600">
                Confirmo que estou ciente de que esta alteração modificará permanentemente um
                pedido aprovado pelo cliente.
              </DialogDescription>
            </DialogHeader>

            <label className="flex items-start gap-2 text-sm bg-red-50 border border-red-200 p-3">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
              <span>Estou ciente e assumo a responsabilidade por esta alteração.</span>
            </label>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setStep("choose")}
                className="flex-1 px-4 py-3 text-xs uppercase tracking-widest font-bold border border-stone-300 hover:bg-stone-50"
              >
                Voltar
              </button>
              <button
                disabled={busy || !ack}
                onClick={doApplyOriginal}
                className="flex-1 px-4 py-3 text-xs uppercase tracking-widest font-bold border border-red-600 bg-red-600 text-white disabled:opacity-40"
              >
                Confirmar alteração
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  return { request, dialog };
}
