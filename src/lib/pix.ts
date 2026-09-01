/**
 * Gerador de "PIX Copia e Cola" (BR Code / EMV) — puro cliente, sem dependências.
 * Baseado no Manual do BR Code (BACEN) — payload EMV com CRC16-CCITT (0x1021, init 0xFFFF).
 */

export interface PixPayload {
  chave: string;             // e-mail, cpf/cnpj, telefone ou chave aleatória
  nome: string;              // beneficiário (até 25 chars)
  cidade: string;            // até 15 chars
  valor?: number;            // opcional, em reais
  txid?: string;             // até 25 chars alfanuméricos, sem espaço; default "***"
  descricao?: string;        // opcional, até ~40 chars
}

const sanitize = (s: string, max: number) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .toUpperCase()
    .slice(0, max);

const tlv = (id: string, value: string) =>
  `${id}${value.length.toString().padStart(2, "0")}${value}`;

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function gerarPixCopiaECola(p: PixPayload): string {
  const chave = p.chave.trim();
  const nome = sanitize(p.nome || "PORCELANE", 25);
  const cidade = sanitize(p.cidade || "RECIFE", 15);
  const txid = (p.txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  // Merchant Account Information (id 26)
  let mai = tlv("00", "br.gov.bcb.pix") + tlv("01", chave);
  if (p.descricao) mai += tlv("02", sanitize(p.descricao, 40));

  const payload =
    tlv("00", "01") +                       // Payload Format Indicator
    tlv("26", mai) +                        // MAI PIX
    tlv("52", "0000") +                     // Merchant Category Code
    tlv("53", "986") +                      // Moeda (BRL)
    (p.valor && p.valor > 0
      ? tlv("54", p.valor.toFixed(2))
      : "") +
    tlv("58", "BR") +                       // País
    tlv("59", nome) +                       // Nome beneficiário
    tlv("60", cidade) +                     // Cidade
    tlv("62", tlv("05", txid));             // Additional data — txid

  const toCrc = payload + "6304";
  return toCrc + crc16(toCrc);
}

/** Gera um txid curto e único (alfanumérico ≤ 25 chars). */
export function novoTxid(prefix = "PORC"): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  return `${prefix}${stamp}${rand}`.slice(0, 25);
}
