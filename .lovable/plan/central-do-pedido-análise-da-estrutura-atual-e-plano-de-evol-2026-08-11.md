# Central do Pedido — análise da estrutura atual e plano de evolução

## Parte 1 — Estrutura atual (análise antes de implementar)

**1. Pedidos** — tabela `orders` (número, cliente, status, total, recebido, `data` jsonb, snapshot aprovado, travas comercial/comissão). A tela `pedidos/$id` já é um workspace único com 8 modos internos: Gestão, Pedido, Romaneio, Liberação técnica, Financeiro, Ficha interna, Ordem de Corte e PDF técnico.

**2. Clientes** — tabela `clients` (dados cadastrais + endereço da obra). O pedido guarda nome/telefone/endereço dentro do `data`, alimentado a partir do orçamento.

**3. Ambientes** — não existe tabela; são o array `environments` dentro de `orders.data`. Cada ambiente já tem nome, material, status de produção, cortador/acabador, datas, liberação técnica, revisão, quick_room (2D/3D) e visibilidade por cargo.

**4. Peças** — array `items` dentro de cada ambiente, com medidas comerciais (comprimento, largura, qtd) e campos técnicos separados (`released_*`, usinagem, acabamentos, recortes, furos). Essa separação já garante que a técnica não altera o valor comercial.

**5. Financeiro** — tabelas `receivables`, `payables`, `commissions`, `productivity_entries`, `value_change_log`. O painel `order-financial-panel` já lê tudo isso ao vivo por pedido (contratado, recebido, pendente, atraso, parcelas, custos, margem, histórico).

**6. Produção** — Kanban de 5 colunas em `producao`, alimentado por `production_status` de cada ambiente e por `kanban_stage` do pedido. Ordens de corte/acabamento e produtividade já existem.

**7. Documentos** — tabela `order_attachments` (arquivos enviados) + documentos gerados em tela (Pedido, Romaneio, Ficha interna, Ordem de Corte, Liberação Técnica) usando o kit de PDF já padronizado.

**8. Relacionamentos existentes** — cliente → orçamento → pedido → ambientes → peças; pedido → recebíveis, comissões, produtividade, anexos, histórico de status, revisões técnicas, romaneios, Trello.

**9. O que será reutilizado** — absolutamente tudo acima: nenhuma tabela nova de pedido, cliente, ambiente, peça ou financeiro.

**10. O que precisa ser criado** — apenas camada de organização visual: uma central de abas no pedido, painéis de Ambientes/Produção/Documentos/Histórico que leem os dados existentes, checklist técnico e versões guardados dentro do próprio ambiente/registro de revisão já existente, e controles de zoom/fonte.

**11. Componentes modificados** — tela do pedido (abas + cabeçalho resumo), painel de liberação técnica (checklist, status, versões), desenho 2D (zoom/pan), cabeçalho das ordens de corte/acabamento, menu lateral, tokens visuais.

**12. Tabelas modificadas** — nenhuma alteração destrutiva. Uso das já existentes (`order_revisions` para versionamento, `audit_log`/`order_status_history`/`value_change_log` para histórico, `order_attachments` para documentos). Se algo faltar, será só um campo dentro do jsonb do ambiente (checklist), sem migração.

**13. Versionamento** — cada liberação gera uma revisão nova em `order_revisions` (V1, V2, V3) com data, responsável, peças, medidas e status; nunca sobrescreve a anterior.

**14. Vínculo dos documentos** — todo documento passa a carregar pedido + ambiente + versão; os gerados em tela usam esses dados na origem, os enviados ficam marcados com o ambiente.

**15. Extração automática** — cabeçalhos e tabelas dos documentos leem cliente, ambiente, material, acabamento, número, data, itens e responsáveis direto do pedido. Nada é redigitado.

**16. Zoom da interface** — evolução do sistema de aparência já existente (que hoje só ajusta fonte): passa a ter Zoom +, Zoom −, Resetar e tamanho de fonte, aplicados via escala da raiz, com layout fluido para não cortar tabelas. Preferência salva localmente.

**17. Zoom dos desenhos** — controles próprios no visualizador 2D: +, −, ajustar à tela, tamanho original, centralizar e arrastar, com roda do mouse ancorada no cursor. Puramente visual.

**18. Escala do PDF** — seletor 1:1, 1:2, 1:5, 1:10, 1:20, 1:50 e automático, aplicado na geração; escala impressa no rodapé do desenho, com aviso e paginação quando não couber.

**19. Medidas reais preservadas** — zoom e escala nunca gravam nada; são apenas transformação visual sobre os valores cadastrados, que continuam a única fonte.

**20. Proporção na impressão** — escala sempre uniforme nos dois eixos; nunca esticar um lado só.

## Parte 2 — Implementação proposta

**Etapa A — Central do Pedido**
Reorganizar a tela do pedido em 6 abas: Resumo, Ambientes, Financeiro, Produção, Documentos, Histórico (modos atuais de impressão viram ações dentro das abas). Cabeçalho fixo com número, cliente, data, responsável, status, valor total, status financeiro, nº de ambientes, status de produção e de liberação.

**Etapa B — Aba Ambientes**
Lista de ambientes do pedido com status próprio e ações: novo, editar, duplicar (só a estrutura do ambiente), visualizar, liberar, enviar para revisão. Ao abrir um ambiente: Peças, Insumos, Ordem de Corte, Ordem de Acabamento, 2D, Liberação Técnica e Documentos — tudo apontando para os componentes já existentes.

**Etapa C — Liberação Técnica**
Checklist de conferência (15 itens) por ambiente, status Pendente / Em análise / Em revisão / Aguardando correção / Liberado / Bloqueado, botão Liberar Ambiente gerando versão, e histórico de liberações. Solicitação de alteração continua passando pelo fluxo de revisão atual, sem alterar o pedido silenciosamente.

**Etapa D — Documentos**
Cabeçalho padronizado das ordens: PORCELANE MARMORARIA / título / Pedido nº, Data, Página, e faixa CLIENTE → AMBIENTE → MATERIAL → ACABAMENTO logo abaixo (cliente sai do canto direito). Aba Documentos lista tudo do pedido agrupado por ambiente.

**Etapa E — Histórico**
Linha do tempo unificando status, revisões, alterações de valor e auditoria, com quem, data, hora e ação.

**Etapa F — Zoom e acessibilidade**
Controles de zoom/fonte na barra superior, zoom + pan nos desenhos 2D e nas pré-visualizações de documento, seletor de escala/papel/orientação na geração de PDF, preferências memorizadas.

**Etapa G — Layout**
Paleta branco/cinza claro, texto preto/grafite, elementos grafite e azul-marinho escuro, bordas cinza claro, status verde/azul/amarelo/vermelho/cinza. Padronização de cabeçalhos de tela, botões (primário grafite, secundário branco), tabelas (cabeçalho grafite, linhas brancas) e formulários agrupados. Menu lateral reagrupado em Início, Comercial, Produção, Financeiro, Documentos, RH, Relatórios, Configurações — apenas reorganização visual dos acessos existentes.

## Observações
- Nenhum dado é apagado ou duplicado; nenhuma segunda estrutura de pedido, cliente, financeiro, ambiente ou peça é criada.
- É um volume grande: sugiro executar por etapas (A+B primeiro, depois C-E, depois F-G), validando cada bloco.
