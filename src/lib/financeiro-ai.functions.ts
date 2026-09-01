import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Rec = {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  client_name?: string | null;
  description?: string | null;
};
type Pay = {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  supplier?: string | null;
  description?: string | null;
  category?: string | null;
};

export const analyzeFinancials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Carrega dados dos últimos 90 dias e próximos 60 dias
    const today = new Date();
    const from = new Date(today); from.setDate(from.getDate() - 90);
    const to = new Date(today); to.setDate(to.getDate() + 60);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const [{ data: recs }, { data: pays }] = await Promise.all([
      context.supabase
        .from("receivables")
        .select("id, amount, due_date, status, client_name, description")
        .gte("due_date", fmt(from))
        .lte("due_date", fmt(to))
        .limit(500),
      context.supabase
        .from("payables")
        .select("id, amount, due_date, status, supplier, description, category")
        .gte("due_date", fmt(from))
        .lte("due_date", fmt(to))
        .limit(500),
    ]);

    const receivables = (recs ?? []) as Rec[];
    const payables = (pays ?? []) as Pay[];

    // KPIs
    const isPaid = (s: string) => ["pago", "paga", "liquidado", "recebido"].includes((s || "").toLowerCase());
    const todayStr = fmt(today);
    const sum = (rows: { amount: number }[]) => rows.reduce((a, b) => a + Number(b.amount || 0), 0);

    const recOverdue = receivables.filter((r) => !isPaid(r.status) && r.due_date < todayStr);
    const recNext30 = receivables.filter((r) => !isPaid(r.status) && r.due_date >= todayStr && r.due_date <= fmt(new Date(today.getTime() + 30 * 864e5)));
    const payOverdue = payables.filter((p) => !isPaid(p.status) && p.due_date < todayStr);
    const payNext30 = payables.filter((p) => !isPaid(p.status) && p.due_date >= todayStr && p.due_date <= fmt(new Date(today.getTime() + 30 * 864e5)));

    const kpis = {
      recebido_ultimos_30: sum(receivables.filter((r) => isPaid(r.status) && r.due_date >= fmt(new Date(today.getTime() - 30 * 864e5)))),
      pago_ultimos_30: sum(payables.filter((p) => isPaid(p.status) && p.due_date >= fmt(new Date(today.getTime() - 30 * 864e5)))),
      inadimplencia_valor: sum(recOverdue),
      inadimplencia_qtd: recOverdue.length,
      a_receber_30: sum(recNext30),
      a_pagar_30: sum(payNext30),
      contas_vencidas_valor: sum(payOverdue),
      contas_vencidas_qtd: payOverdue.length,
      saldo_projetado_30: sum(recNext30) - sum(payNext30),
    };

    // Top 5 devedores
    const byClient: Record<string, number> = {};
    recOverdue.forEach((r) => {
      const k = r.client_name || "—";
      byClient[k] = (byClient[k] || 0) + Number(r.amount || 0);
    });
    const topDevedores = Object.entries(byClient)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([client, value]) => ({ client, value }));

    // IA (Gemini via Lovable AI Gateway)
    const key = process.env.LOVABLE_API_KEY;
    let insights = "";
    if (key) {
      try {
        const prompt = `Você é um assistente financeiro de uma marmoraria brasileira. Analise os KPIs abaixo e escreva um resumo executivo em português com:
1) Diagnóstico curto (2-3 linhas) do fluxo de caixa dos próximos 30 dias
2) Riscos identificados (inadimplência, contas vencidas, sazonalidade)
3) Até 4 ações concretas priorizadas por urgência
Seja direto, use bullets e valores em R$. Não invente dados fora dos números fornecidos.

KPIs:
${JSON.stringify(kpis, null, 2)}

Top 5 devedores (a receber vencidos):
${JSON.stringify(topDevedores, null, 2)}

Amostra de contas a pagar dos próximos 30 dias (até 20):
${JSON.stringify(payNext30.slice(0, 20).map(p => ({ desc: p.description, cat: p.category, valor: p.amount, venc: p.due_date })), null, 2)}
`;
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            messages: [
              { role: "system", content: "Você é um consultor financeiro objetivo e prático." },
              { role: "user", content: prompt },
            ],
          }),
        });
        if (r.ok) {
          const j: any = await r.json();
          insights = j?.choices?.[0]?.message?.content ?? "";
        } else if (r.status === 429) {
          insights = "_IA temporariamente ocupada (limite de requisições). Tente novamente em alguns minutos._";
        } else if (r.status === 402) {
          insights = "_Créditos de IA esgotados no workspace. Adicione créditos em Configurações → Cobrança para reativar as análises._";
        }
      } catch (e: any) {
        insights = "";
      }
    }

    return { kpis, topDevedores, insights, generated_at: new Date().toISOString() };
  });
