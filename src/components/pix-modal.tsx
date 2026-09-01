import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, MessageCircle, X, Check } from "lucide-react";
import { toast } from "sonner";
import { gerarPixCopiaECola, novoTxid, type PixPayload } from "@/lib/pix";

interface Props {
  open: boolean;
  onClose: () => void;
  chavePix: string;
  beneficiario: string;
  cidade: string;
  valor: number;
  descricao?: string;
  telefoneCliente?: string;
  nomeCliente?: string;
  /** Se fornecido, o txid é reutilizado (para casar com uma parcela já criada). */
  txid?: string;
  /** Chamado quando o usuário confirma que o pagamento foi feito. */
  onPagamentoConfirmado?: (txid: string) => void | Promise<void>;
}

export function PixModal({
  open,
  onClose,
  chavePix,
  beneficiario,
  cidade,
  valor,
  descricao,
  telefoneCliente,
  nomeCliente,
  txid: txidProp,
  onPagamentoConfirmado,
}: Props) {
  const [copied, setCopied] = useState(false);

  const txid = useMemo(() => txidProp || novoTxid(), [txidProp, open]);
  const copiaECola = useMemo(() => {
    if (!chavePix) return "";
    const p: PixPayload = {
      chave: chavePix,
      nome: beneficiario,
      cidade,
      valor,
      txid,
      descricao,
    };
    return gerarPixCopiaECola(p);
  }, [chavePix, beneficiario, cidade, valor, txid, descricao]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const chaveInvalida = !chavePix;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(copiaECola);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const enviarWhatsapp = () => {
    if (!telefoneCliente) {
      toast.error("Cliente sem telefone cadastrado.");
      return;
    }
    const fone = telefoneCliente.replace(/\D/g, "");
    const msg =
      `Olá${nomeCliente ? " " + nomeCliente : ""}! 👋\n` +
      `Segue o PIX para a entrada:\n\n` +
      `💰 *Valor:* R$ ${valor.toFixed(2).replace(".", ",")}\n` +
      `🏢 *Beneficiário:* ${beneficiario}\n` +
      `🔑 *Chave PIX:* ${chavePix}\n\n` +
      `*Copia e Cola:*\n\`\`\`${copiaECola}\`\`\`\n\n` +
      `Basta abrir o app do banco → PIX → Copia e Cola.`;
    const url = `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Pagamento via PIX
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {chaveInvalida ? (
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              Configure a <strong>Chave PIX</strong>,{" "}
              <strong>Nome do beneficiário</strong> e <strong>Cidade</strong> em{" "}
              <em>Configurações → Empresa</em> para gerar o código.
            </div>
          ) : (
            <>
              <div className="mb-3 text-center">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Valor da entrada
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  R$ {valor.toFixed(2).replace(".", ",")}
                </div>
              </div>

              <div className="mx-auto flex w-fit rounded-xl border-4 border-purple-600 bg-white p-3">
                <QRCodeSVG value={copiaECola} size={220} level="M" />
              </div>

              <div className="mt-4">
                <label className="text-xs font-medium text-gray-600">
                  Copia e Cola
                </label>
                <div className="mt-1 flex gap-2">
                  <textarea
                    readOnly
                    value={copiaECola}
                    className="h-20 flex-1 rounded-lg border bg-gray-50 p-2 text-[11px] font-mono text-gray-800"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <button
                  onClick={copiar}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-700 py-3 font-semibold text-white transition hover:bg-purple-800"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar código PIX"}
                </button>

                {telefoneCliente && (
                  <button
                    onClick={enviarWhatsapp}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-3 font-semibold text-white transition hover:bg-green-700"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Enviar para o cliente no WhatsApp
                  </button>
                )}

                {onPagamentoConfirmado && (
                  <button
                    onClick={async () => {
                      await onPagamentoConfirmado(txid);
                      onClose();
                    }}
                    className="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Já recebi — dar baixa manualmente
                  </button>
                )}
              </div>

              <p className="mt-3 text-center text-[11px] text-gray-500">
                Ref.: <span className="font-mono">{txid}</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
