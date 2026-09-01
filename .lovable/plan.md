# Auditoria técnica e plano de reestruturação — Porcelane Flow

Nenhuma alteração foi feita. Isto é apenas o diagnóstico e o plano.

## 1. Mapa atual (o que existe hoje)

**Rotas** (`src/routes/_authenticated/`): índice, orçamentos (lista, detalhe 1585 linhas, importar), pedidos (lista, detalhe 2559 linhas), produção (kanban + relatório por funcionário), financeiro (receber, pagar, comissões, insights), relatórios (diário, vendas), RH, romaneios, clientes, medições, marketing, configurações (7 subtelas). Fora do portão: `/auth` e `/funcionario`.

**Componentes maiores**: `quick-room.tsx` (2077 linhas, editor 2D/3D), `tech-release-panel.tsx` (686), `finishes-library-tab.tsx` (500), painéis do pedido (resumo, ambientes, produção, documentos, histórico, financeiro), kit de PDF.

**Banco**: 45+ tabelas. O núcleo é `quotes` → `orders` (com `data` jsonb) → `receivables`/`commissions`/`productivity_entries`/`order_attachments`/`order_revisions`/`order_status_history`/`tech_documents`/`manual_romaneios`/`trello_integrations`. Ambientes e peças **não têm tabela**: vivem em `orders.data.environments[].items[]`.

## 2. Problemas encontrados, por gravidade

### Graves (risco de dado errado ou divergência)
1. **`orders.received` é uma coluna morta e enganosa.** Verificado: 139 pedidos, **nenhum** com `received > 0`. A verdade do recebido está em `receivables.paid_amount`. Qualquer tela que ler `received` mostra zero. Hoje só `order-hub-header` a lê.
2. **Duas fontes de total financeiro**: `orders.total` (coluna) e `calcTotals(order.data)` (cálculo). Verificado: **10 pedidos** com `total` diferente de `approved_total`, e **3 pedidos sem `approved_snapshot`**. Sem regra escrita de qual vale, cada tela pode mostrar um número.
3. **Ambientes/peças em JSONB sem validação.** Toda gravação é "objeto inteiro"; duas pessoas editando o mesmo pedido sobrescrevem uma à outra (last write wins). É o maior risco estrutural do sistema.

### Médios (manutenção e confusão de uso)
4. **`pedidos.$id.tsx` com 13 modos numa variável só** (`gestao | pedido | romaneio | corte | ficha | tecnica | tecnica_pdf | financeiro | ambientes | producao | documentos | historico | docs_tec`). Modos de tela e modos de impressão dividem o mesmo estado, o mesmo JSX e o mesmo cabeçalho — daí o excesso visual e as 2559 linhas.
5. **Ordem de corte alcançável por 4 caminhos** (Ambientes, Documentos, Documentos técnicos, Liberação técnica), cada um com um `setTimeout(doPrint)` repetido.
6. **Status/progresso do ambiente**: já existe `src/lib/order-view.ts` como módulo único (bom), mas `tech-docs-panel`, `tech-release-panel` e a própria rota ainda recalculam rótulo/material em alguns pontos.
7. **Poluição visual**: uma barra de abas com 13 botões, cabeçalho repetido em cada modo, sem hierarquia de leitura.

### Baixos (duplicidade legítima — são snapshots)
8. `productivity_entries.env_name/env_material`, `manual_romaneios` com dados do cliente, `orders.client_name`, `quotes.client_name/total`, `approved_snapshot`: **isto é correto**. São registros históricos que precisam continuar mostrando o que valia na data — se o pedido mudar depois, o recibo/romaneio/produtividade antigos não podem mudar junto. Devem permanecer, apenas rotulados como snapshot no código.

## 3. Fonte de verdade recomendada

| Domínio | Fonte única | Observação |
|---|---|---|
| Comercial (itens, valores, desconto) | `orders.data` via `calcTotals()` | `orders.total` vira cache de leitura para listas |
| Valor contratado (fechado) | `approved_total` + `approved_snapshot` | congela na aprovação |
| Recebido / pago | soma de `receivables` | **parar de ler `orders.received`** |
| Técnico (medidas liberadas, acabamentos, checklist) | `environments[].items[].released_*` e `tech_*` | nunca altera o comercial |
| Produção | `production_status` do ambiente + `orders.status` | kanban é leitura |
| Comissões/produtividade | `commissions`, `productivity_entries` | snapshots por definição |
| Documentos | `order_attachments` + `tech_documents` + `order_revisions` | gerados leem o pedido na hora |

## 4. Nova arquitetura de telas

Pedido com **6 abas de tela** e impressão como **ação**, nunca como aba:

```
RESUMO | AMBIENTES | FINANCEIRO | PRODUÇÃO | DOCUMENTOS | HISTÓRICO
                                        (imprimir → visualizador em overlay)
```

Hierarquia dentro de Ambientes:

```
AMBIENTE  (status, nº de peças, pendências, m², valor)
  └─ PEÇA  (medidas, material, acabamentos, conferência)
       └─ painel técnico lateral: desenho + detalhes + liberação
```

Toda impressão passa a sair por **um único componente `PrintOverlay`**, com um só ponto de `doPrint`, eliminando os 4 caminhos duplicados da ordem de corte.

## 5. Componentes a extrair de `pedidos.$id.tsx`

- `order-print-sheet.tsx` (modos "pedido" e "romaneio", hoje ~420 linhas inline)
- `order-internal-sheet.tsx` (ficha interna)
- `order-cut-print.tsx` (modo corte + tecnica_pdf)
- `print-overlay.tsx` (barra "Voltar / Imprimir" + `doPrint` único)
- `use-order.ts` (carregamento, save, travas, realtime)

Meta: rota final com ~300 linhas, só orquestrando abas.

## 6. Helpers que viram módulo único

- `order-view.ts` (já existe) passa a ser **o único** dono de rótulo, material, tom, progresso e pendências — os 3 arquivos restantes passam a importar dele.
- `order-money.ts` (novo): `contracted()`, `receivedFromReceivables()`, `balance()` — proíbe leitura direta de `orders.received`.
- `order-docs.ts` (novo): lista de documentos disponíveis por pedido/ambiente, consumida por Documentos e por Ambientes.

## 7. Estratégia para não quebrar dados

- Nenhuma migração destrutiva. `orders.received` **não é apagada**, apenas deixa de ser lida (marcada como legada no código).
- Nada de mover ambientes/peças para tabelas neste fim de semana: seria reescrever leitura, gravação, PDFs e o editor 2D de uma vez. Fica como evolução futura, com camada de acesso (`getEnvs/saveEnvs`) criada agora para tornar essa troca possível depois sem tocar nas telas.
- Snapshots permanecem intactos.

## 8. Ordem segura de implementação (fim de semana)

1. **Sábado manhã — visual, risco zero**: abas de 13 → 6, impressão em overlay, cabeçalho único.
2. **Sábado tarde — extração**: mover os blocos de impressão para componentes próprios, mesma marcação.
3. **Domingo manhã — fonte de verdade**: `order-money.ts`, remover leitura de `received`, unificar rótulos/status nos 3 arquivos restantes.
4. **Domingo tarde — hierarquia** Ambiente > Peça > painel técnico, e camada `getEnvs/saveEnvs`.
5. **Domingo noite — paridade**: conferir tela a tela que nenhum campo, botão ou documento sumiu.

## 9. Visual x estrutural

- **Somente visual**: 6 abas, overlay de impressão, cabeçalho, hierarquia de ambientes/peças, badges e tipografia.
- **Estrutural (mas sem migração)**: extração de componentes, `order-money.ts`, fim da leitura de `received`, camada de acesso aos ambientes.
- **Estrutural com migração — fora deste fim de semana**: tabelas `order_environments` / `order_items`, e trava de edição concorrente.

## 10. Explicação simples

Hoje o pedido é uma gaveta única onde cabe tudo: tela, impressão, técnico e dinheiro. O plano é colocar divisórias: cada informação passa a ter um lugar só, e cada número um dono só. Nada é jogado fora — só arrumado.
