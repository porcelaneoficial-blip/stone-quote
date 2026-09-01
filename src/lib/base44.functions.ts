import { createServerFn } from "@tanstack/react-start";

type Payload = {
  tipo: "Orçamento" | "Pedido";
  numero: string | number;
  data: string;
  cliente: string;
  valor_total: number | string;
  status: string;
  vendedor_interno?: string;
  vendedor_externo?: string;
  arquiteto?: string;
  forma_pagamento?: string;
};

export const sendBase44Registro = createServerFn({ method: "POST" })
  .inputValidator((i: Payload) => i)
  .handler(async ({ data }) => {
    const token = process.env.BASE44_TOKEN;
    const url = process.env.BASE44_URL || "https://app.base44.com/api/v1/registros";
    if (!token) return { ok: false, skipped: true, reason: "missing_token" };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const text = await res.text();
      return { ok: res.ok, status: res.status, body: text.slice(0, 500) };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
