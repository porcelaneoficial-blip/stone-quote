# Pedra Assistente dentro do Petra

A Pedra passa a ser uma parte do próprio sistema — não um aplicativo separado. Ela consulta os dados reais e executa ações do dia a dia, sempre pedindo sua confirmação antes de mudar qualquer coisa.

## Onde ela fica

- **Página própria** — novo item "Pedra Assistente" no menu lateral, no topo (grupo Início), com a conversa em tela cheia.
- **Botão flutuante** — presente em todas as telas do sistema; abre a Pedra por cima da tela atual e já informa a ela em que página você está (por exemplo, "estou no pedido 128"), para que as perguntas tenham contexto.

Visual seguindo o padrão Porcelane: fundo branco, texto preto, cartões arredondados, destaque em negrito e emojis, dourado só nos botões principais.

## O que ela consulta

- Orçamentos, pedidos e clientes
- Medições agendadas e realizadas
- Produção e romaneios
- Financeiro: contas a receber, a pagar e comissões
- Colaboradores e configurações da empresa

Exemplos: "quanto tenho a receber esse mês?", "quais medições da semana?", "resumo do pedido 128", "quais pedidos estão parados na produção?".

## O que ela executa (sempre com confirmação)

Antes de qualquer alteração, a Pedra mostra um resumo do que vai fazer e só age depois que você toca em **Confirmar**:

- Mudar o status de um pedido ou de uma etapa da produção
- Agendar ou remarcar uma medição
- Registrar recebimento ou baixa de uma conta
- Criar cliente
- Criar orçamento a partir de uma descrição

Regras do Petra são respeitadas: nada é apagado, pedido fechado exige revisão/aditivo, instalação só em horário comercial, e ela nunca expõe o preço interno do m².

## Permissões

A Pedra só enxerga e só age no que o usuário logado já pode acessar — usa exatamente as mesmas permissões do menu (orçamentos, pedidos, financeiro, RH, etc.). Quem não tem acesso ao financeiro não recebe dados financeiros dela.

## Etapas

1. Tela de conversa da Pedra + botão flutuante no sistema inteiro.
2. Consultas (leitura) de todos os módulos acima.
3. Ações com confirmação.
4. Histórico das conversas salvo por usuário, para retomar depois.

## Detalhes técnicos

- Rota de chat em `src/routes/api/chat.ts` com streaming (AI SDK + Lovable AI, modelo `openai/gpt-6-astra` na Responses API), UI com AI Elements em `src/routes/_authenticated/pedra.tsx` e componente flutuante montado no `app-shell.tsx`.
- Ferramentas do agente implementadas no servidor com o cliente autenticado (`requireSupabaseAuth`), lendo/escrevendo via RLS nas tabelas existentes: `quotes`, `orders`, `clients`, `measurements`, `receivables`, `payables`, `commissions`, `employees`, `company_settings`.
- Ações de escrita marcadas com `needsApproval`, renderizadas como cartão de confirmação no chat.
- Permissões reaproveitadas de `useMyRoles`/`roles.ts`; o filtro é aplicado no servidor, não só na tela.
- Histórico em novas tabelas `pedra_threads` e `pedra_messages` com RLS por usuário e GRANTs.
