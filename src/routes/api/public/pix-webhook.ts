import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook público para baixa automática de PIX.
 *
 * Como funciona
 *   POST /api/public/pix-webhook
 *   Header:  x-pix-secret: <PIX_WEBHOOK_SECRET>
 *   Body:    { "txid": "PORCXXXX", "valor": 1500.00, "endToEndId": "E..." }
 *
 * Ao receber, procura em `receivables` a parcela com `pix_txid = txid` e a marca como paga.
 *
 * Pode ser chamado por:
 *  - Um proxy próprio (Node/VPS) que fala mTLS com o Nubank PJ.
 *  - Um PSP terceiro (Efí, Asaas, Mercado Pago) configurado para chamar essa URL.
 *  - Manualmente por curl para testes.
 */
export const Route = createFileRoute("/api/public/pix-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.PIX_WEBHOOK_SECRET;
        if (!expected) {
          return new Response("Webhook secret not configured", { status: 500 });
        }
        const provided = request.headers.get("x-pix-secret");
        if (!provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { txid?: string; valor?: number; endToEndId?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const txid = (body.txid || "").trim();
        if (!txid) return new Response("Missing txid", { status: 400 });

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: rows, error: findErr } = await supabaseAdmin
          .from("receivables")
          .select("id, amount, paid_amount, status")
          .eq("pix_txid", txid)
          .limit(1);

        if (findErr) {
          return new Response(`DB error: ${findErr.message}`, { status: 500 });
        }
        if (!rows || rows.length === 0) {
          return Response.json(
            { ok: false, reason: "receivable_not_found", txid },
            { status: 404 },
          );
        }

        const rec = rows[0];
        const valorRecebido =
          typeof body.valor === "number" ? body.valor : Number(rec.amount);

        const { error: updErr } = await supabaseAdmin
          .from("receivables")
          .update({
            status: "pago",
            paid_at: new Date().toISOString(),
            paid_amount: valorRecebido,
            method: "PIX",
            notes: body.endToEndId
              ? `PIX auto — E2E ${body.endToEndId}`
              : "PIX auto",
          })
          .eq("id", rec.id);


        if (updErr) {
          return new Response(`Update error: ${updErr.message}`, { status: 500 });
        }

        return Response.json({ ok: true, id: rec.id, txid });
      },

      // Handshake / health-check
      GET: async () =>
        Response.json({ ok: true, service: "pix-webhook", version: 1 }),
    },
  },
});
