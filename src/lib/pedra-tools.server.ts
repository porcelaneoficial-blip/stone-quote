import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient<any, any, any>;

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));

const today = () => new Date().toISOString().slice(0, 10);

function ok<T>(data: T) {
  return { ok: true as const, data };
}
function fail(message: string) {
  return { ok: false as const, error: message };
}

/** Ferramentas de consulta e ação da Pedra Assistente. */
export function buildPedraTools(supabase: DB, can: (m: string) => boolean) {
  const guard = (mod: string) => (can(mod) ? null : fail(`Sem permissão para acessar ${mod}.`));

  return {
    // ---------- CONSULTAS ----------
    listar_pedidos: tool({
      description:
        "Lista pedidos com filtros opcionais por status, nome do cliente ou número. Use para perguntas sobre pedidos e produção.",
      inputSchema: z.object({
        status: z.string().nullable().describe("Status do pedido, ou null para todos"),
        cliente: z.string().nullable().describe("Parte do nome do cliente, ou null"),
        numero: z.number().nullable().describe("Número do pedido, ou null"),
        limite: z.number().describe("Quantidade máxima de resultados, por exemplo 10"),
      }),
      execute: async ({ status, cliente, numero, limite }) => {
        const g = guard("pedidos");
        if (g) return g;
        let q = supabase
          .from("orders")
          .select("id, number, status, client_name, total, received, created_at, delivery_kind")
          .order("number", { ascending: false })
          .limit(Math.min(Math.max(limite || 10, 1), 50));
        if (status) q = q.eq("status", status);
        if (cliente) q = q.ilike("client_name", `%${cliente}%`);
        if (numero) q = q.eq("number", numero);
        const { data, error } = await q;
        if (error) return fail(error.message);
        return ok(
          (data ?? []).map((o: any) => ({
            numero: o.number,
            cliente: o.client_name,
            status: o.status,
            valor: brl(o.total ?? 0),
            recebido: brl(o.received ?? 0),
            abertura: o.created_at?.slice(0, 10),
          })),
        );
      },
    }),

    detalhe_pedido: tool({
      description: "Mostra o resumo completo de um pedido pelo número: ambientes, valores e histórico de status.",
      inputSchema: z.object({ numero: z.number() }),
      execute: async ({ numero }) => {
        const g = guard("pedidos");
        if (g) return g;
        const { data, error } = await supabase
          .from("orders")
          .select("id, number, status, client_name, total, received, data, created_at, commercial_locked")
          .eq("number", numero)
          .maybeSingle();
        if (error) return fail(error.message);
        if (!data) return fail(`Pedido ${numero} não encontrado.`);
        const envs = Array.isArray((data as any).data?.environments)
          ? (data as any).data.environments.map((e: any) => ({
              ambiente: e.name ?? e.nome,
              material: e.material,
              pecas: Array.isArray(e.pieces) ? e.pieces.length : undefined,
            }))
          : [];
        return ok({
          numero: data.number,
          cliente: data.client_name,
          status: data.status,
          valor: brl(data.total ?? 0),
          recebido: brl(data.received ?? 0),
          abertura: data.created_at?.slice(0, 10),
          bloqueado_comercialmente: data.commercial_locked,
          ambientes: envs,
        });
      },
    }),

    listar_orcamentos: tool({
      description: "Lista orçamentos, com filtro opcional por status ou cliente.",
      inputSchema: z.object({
        status: z.string().nullable(),
        cliente: z.string().nullable(),
        limite: z.number(),
      }),
      execute: async ({ status, cliente, limite }) => {
        const g = guard("orcamentos");
        if (g) return g;
        let q = supabase
          .from("quotes")
          .select("number, type, status, client_name, total, created_at")
          .order("number", { ascending: false })
          .limit(Math.min(Math.max(limite || 10, 1), 50));
        if (status) q = q.eq("status", status);
        if (cliente) q = q.ilike("client_name", `%${cliente}%`);
        const { data, error } = await q;
        if (error) return fail(error.message);
        return ok(
          (data ?? []).map((o: any) => ({
            numero: o.number,
            tipo: o.type,
            cliente: o.client_name,
            status: o.status,
            valor: brl(o.total ?? 0),
            criado: o.created_at?.slice(0, 10),
          })),
        );
      },
    }),

    listar_medicoes: tool({
      description: "Lista medições agendadas em um período (datas no formato AAAA-MM-DD).",
      inputSchema: z.object({
        de: z.string().nullable(),
        ate: z.string().nullable(),
        status: z.string().nullable(),
      }),
      execute: async ({ de, ate, status }) => {
        const g = guard("medicoes");
        if (g) return g;
        let q = supabase
          .from("measurements")
          .select("id, client_name, address, scheduled_at, status, notes")
          .order("scheduled_at", { ascending: true })
          .limit(50);
        if (de) q = q.gte("scheduled_at", `${de}T00:00:00Z`);
        if (ate) q = q.lte("scheduled_at", `${ate}T23:59:59Z`);
        if (status) q = q.eq("status", status);
        const { data, error } = await q;
        if (error) return fail(error.message);
        return ok(data ?? []);
      },
    }),

    resumo_financeiro: tool({
      description:
        "Resumo financeiro: total a receber, a pagar, vencidos e recebimentos do período informado (datas AAAA-MM-DD).",
      inputSchema: z.object({ de: z.string(), ate: z.string() }),
      execute: async ({ de, ate }) => {
        const g = guard("financeiro");
        if (g) return g;
        const [{ data: recs, error: e1 }, { data: pays, error: e2 }] = await Promise.all([
          supabase
            .from("receivables")
            .select("amount, paid_amount, due_date, status, client_name")
            .gte("due_date", de)
            .lte("due_date", ate)
            .limit(500),
          supabase
            .from("payables")
            .select("amount, paid_amount, due_date, status, supplier")
            .gte("due_date", de)
            .lte("due_date", ate)
            .limit(500),
        ]);
        if (e1 || e2) return fail(e1?.message ?? e2?.message ?? "erro");
        const pend = (r: any) => Number(r.amount || 0) - Number(r.paid_amount || 0);
        const sum = (rows: any[]) => rows.reduce((a, b) => a + pend(b), 0);
        const t = today();
        const recPend = (recs ?? []).filter((r: any) => pend(r) > 0.009);
        const payPend = (pays ?? []).filter((r: any) => pend(r) > 0.009);
        return ok({
          periodo: `${de} a ${ate}`,
          a_receber: brl(sum(recPend)),
          a_receber_vencido: brl(sum(recPend.filter((r: any) => r.due_date < t))),
          a_pagar: brl(sum(payPend)),
          a_pagar_vencido: brl(sum(payPend.filter((r: any) => r.due_date < t))),
          titulos_a_receber: recPend.length,
          titulos_a_pagar: payPend.length,
        });
      },
    }),

    listar_contas: tool({
      description: "Lista contas a receber ou a pagar em aberto, em um período (AAAA-MM-DD).",
      inputSchema: z.object({
        tipo: z.enum(["receber", "pagar"]),
        de: z.string(),
        ate: z.string(),
      }),
      execute: async ({ tipo, de, ate }) => {
        const g = guard("financeiro");
        if (g) return g;
        const table = tipo === "receber" ? "receivables" : "payables";
        const { data, error } = await supabase
          .from(table)
          .select("id, description, due_date, amount, paid_amount, status")
          .gte("due_date", de)
          .lte("due_date", ate)
          .order("due_date")
          .limit(100);
        if (error) return fail(error.message);
        return ok(
          (data ?? [])
            .filter((r: any) => Number(r.amount) - Number(r.paid_amount) > 0.009)
            .map((r: any) => ({
              id: r.id,
              descricao: r.description,
              vencimento: r.due_date,
              valor: brl(r.amount),
              pago: brl(r.paid_amount),
              status: r.status,
            })),
        );
      },
    }),

    buscar_cliente: tool({
      description: "Busca clientes pelo nome, documento ou telefone.",
      inputSchema: z.object({ termo: z.string() }),
      execute: async ({ termo }) => {
        const g = guard("clientes");
        if (g) return g;
        const { data, error } = await supabase
          .from("clients")
          .select("id, name, phone, email, city, state, address")
          .or(`name.ilike.%${termo}%,doc.ilike.%${termo}%,phone.ilike.%${termo}%`)
          .limit(20);
        if (error) return fail(error.message);
        return ok(data ?? []);
      },
    }),

    // ---------- AÇÕES (exigem confirmação) ----------
    alterar_status_pedido: tool({
      description:
        "Altera o status de um pedido e registra no histórico. Exige confirmação do usuário.",
      inputSchema: z.object({
        numero: z.number(),
        novo_status: z.string(),
        observacao: z.string().nullable(),
      }),
      needsApproval: true,
      execute: async ({ numero, novo_status, observacao }) => {
        const g = guard("pedidos");
        if (g) return g;
        const { data: order, error: e0 } = await supabase
          .from("orders")
          .select("id, number, status, commercial_locked")
          .eq("number", numero)
          .maybeSingle();
        if (e0) return fail(e0.message);
        if (!order) return fail(`Pedido ${numero} não encontrado.`);
        const { error } = await supabase
          .from("orders")
          .update({ status: novo_status })
          .eq("id", order.id);
        if (error) return fail(error.message);
        await supabase.from("order_status_history").insert({
          order_id: order.id,
          user_id: (order as any).user_id ?? undefined,
          status: novo_status,
          notes: observacao ?? null,
        } as any);
        return ok({ numero, de: order.status, para: novo_status });
      },
    }),

    agendar_medicao: tool({
      description:
        "Agenda ou remarca uma medição. Horário sempre comercial (08:00 às 18:00). Exige confirmação.",
      inputSchema: z.object({
        medicao_id: z.string().nullable().describe("ID da medição para remarcar, ou null para criar"),
        cliente: z.string().nullable(),
        endereco: z.string().nullable(),
        data_hora: z.string().describe("Data e hora no formato AAAA-MM-DDTHH:MM"),
        observacao: z.string().nullable(),
      }),
      needsApproval: true,
      execute: async ({ medicao_id, cliente, endereco, data_hora, observacao }) => {
        const g = guard("medicoes");
        if (g) return g;
        const hour = Number(data_hora.slice(11, 13));
        if (!(hour >= 8 && hour <= 18)) {
          return fail("Agendamento permitido somente em horário comercial (08:00 às 18:00).");
        }
        if (medicao_id) {
          const { error } = await supabase
            .from("measurements")
            .update({ scheduled_at: new Date(data_hora).toISOString(), notes: observacao ?? undefined })
            .eq("id", medicao_id);
          if (error) return fail(error.message);
          return ok({ acao: "remarcada", medicao_id, data_hora });
        }
        const { data: me } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("measurements")
          .insert({
            user_id: me?.user?.id,
            client_name: cliente,
            address: endereco,
            scheduled_at: new Date(data_hora).toISOString(),
            status: "agendada",
            notes: observacao ?? null,
          } as any)
          .select("id")
          .maybeSingle();
        if (error) return fail(error.message);
        return ok({ acao: "agendada", medicao_id: data?.id, cliente, data_hora });
      },
    }),

    registrar_pagamento: tool({
      description:
        "Registra recebimento (conta a receber) ou pagamento (conta a pagar) de um título. Exige confirmação.",
      inputSchema: z.object({
        tipo: z.enum(["receber", "pagar"]),
        titulo_id: z.string(),
        valor: z.number(),
        metodo: z.string().nullable(),
      }),
      needsApproval: true,
      execute: async ({ tipo, titulo_id, valor, metodo }) => {
        const g = guard("financeiro");
        if (g) return g;
        const table = tipo === "receber" ? "receivables" : "payables";
        const { data: row, error: e0 } = await supabase
          .from(table)
          .select("id, amount, paid_amount")
          .eq("id", titulo_id)
          .maybeSingle();
        if (e0) return fail(e0.message);
        if (!row) return fail("Título não encontrado.");
        const novoPago = Number(row.paid_amount || 0) + Number(valor || 0);
        const quitado = novoPago >= Number(row.amount) - 0.009;
        const { error } = await supabase
          .from(table)
          .update({
            paid_amount: novoPago,
            paid_at: new Date().toISOString(),
            method: metodo ?? null,
            status: quitado ? "pago" : "parcial",
          })
          .eq("id", titulo_id);
        if (error) return fail(error.message);
        return ok({ titulo_id, pago_total: brl(novoPago), quitado });
      },
    }),

    criar_cliente: tool({
      description: "Cadastra um novo cliente. Exige confirmação.",
      inputSchema: z.object({
        nome: z.string(),
        telefone: z.string().nullable(),
        email: z.string().nullable(),
        cidade: z.string().nullable(),
        endereco: z.string().nullable(),
      }),
      needsApproval: true,
      execute: async ({ nome, telefone, email, cidade, endereco }) => {
        const g = guard("clientes");
        if (g) return g;
        const { data: me } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("clients")
          .insert({
            user_id: me?.user?.id,
            name: nome,
            phone: telefone,
            email,
            city: cidade,
            address: endereco,
            active: true,
          } as any)
          .select("id, name")
          .maybeSingle();
        if (error) return fail(error.message);
        return ok({ cliente_id: data?.id, nome: data?.name });
      },
    }),

    criar_orcamento: tool({
      description:
        "Cria um orçamento em rascunho com os ambientes descritos. Exige confirmação. O valor final é conferido na tela de orçamento.",
      inputSchema: z.object({
        cliente: z.string(),
        tipo: z.enum(["convencional", "mfc"]),
        ambientes: z.array(
          z.object({
            nome: z.string(),
            material: z.string().nullable(),
            descricao: z.string().nullable(),
            valor: z.number().nullable(),
          }),
        ),
      }),
      needsApproval: true,
      execute: async ({ cliente, tipo, ambientes }) => {
        const g = guard("orcamentos");
        if (g) return g;
        const { data: me } = await supabase.auth.getUser();
        const total = ambientes.reduce((a, b) => a + Number(b.valor || 0), 0);
        const { data, error } = await supabase
          .from("quotes")
          .insert({
            user_id: me?.user?.id,
            type: tipo,
            status: "rascunho",
            client_name: cliente,
            total,
            data: {
              origem: "pedra-assistente",
              environments: ambientes.map((a) => ({
                name: a.nome,
                material: a.material,
                description: a.descricao,
                total: a.valor ?? 0,
                pieces: [],
              })),
            },
          } as any)
          .select("id, number")
          .maybeSingle();
        if (error) return fail(error.message);
        return ok({ orcamento_id: data?.id, numero: data?.number, total: brl(total) });
      },
    }),
  };
}
