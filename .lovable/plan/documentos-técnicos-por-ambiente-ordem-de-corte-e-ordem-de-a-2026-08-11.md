# Documentos Técnicos por Ambiente — Ordem de Corte e Ordem de Acabamento

## O que já existe hoje (análise)

- **Pedido** (`orders`): número, cliente, status, `data` em JSON com todos os ambientes.
- **Ambiente** (dentro de `data.environments`): nome, material, peças, serviços, insumos, quick room 2D/3D, checklist técnico, revisão (`tech_revision`), histórico de liberações (`tech_releases`), responsável, status técnico, logística, visibilidade por cargo.
- **Peça** (`items` / `extra_cut_pieces`): descrição, quantidade, comprimento, largura, espessura, recortes, furações, acabamentos por lado, acabamentos da Biblioteca, medidas liberadas e observações técnicas separadas do comercial.
- **Arquivos**: `order_attachments` + bucket de arquivos do pedido.
- **Financeiro**: recebíveis, comissões e pagamentos, já exibidos na aba Financeiro do pedido (mesma origem do módulo financeiro).
- **Documento técnico atual**: uma única folha (`TechReleaseSheet`) que mistura corte e acabamento e é sempre regerada a partir do estado atual — não há arquivamento.

Conclusão: os dados necessários já existem. O trabalho é de **apresentação, geração, versionamento e arquivamento** — nenhuma tabela de pedido/cliente/ambiente/peça será duplicada.

## O que será construído

### 1. Dois documentos separados, no layout das imagens

- **Ordem de Corte**: cabeçalho com logo, título, subtítulo "LIBERAÇÃO TÉCNICA", número do pedido, data e paginação; faixa com Cliente / Ambiente / Material / Acabamento com ícones lineares; tabela de peças (Item, Descrição, Quant., Comp., Larg., e Espessura/Observações/Código apenas quando existirem); observações reais; bloco de responsável, revisão e liberação.
- **Ordem de Acabamento**: área principal com os desenhos técnicos reais do ambiente (vistas geradas do 2D/quick room e peças), coluna lateral com legenda de tipos de acabamento, legenda de cores, acessórios do cliente, conferido por, quem liberou e observações.

Regras aplicadas em ambos: nada é inventado; seções sem dado são ocultadas; legenda mostra somente acabamentos realmente usados no ambiente; sem desenho, exibe "DESENHO TÉCNICO NÃO DISPONÍVEL". Paleta preto/grafite/cinza/branco, cor apenas com função técnica.

### 2. Escopo estrito por pedido e ambiente

O gerador recebe apenas `{ pedido, ambiente }` e monta o documento a partir daquele ambiente. Nada de outro pedido ou de outro ambiente entra no documento.

### 3. Versionamento e arquivamento

Nova tabela `tech_documents` (uma linha por versão gerada), guardando: pedido, ambiente, tipo (corte/acabamento), número da versão, data/hora, responsável, status, snapshot completo dos dados usados e caminho do PDF no armazenamento. Versões anteriores nunca são sobrescritas nem afetadas por alterações posteriores no pedido — são somente leitura.

Nome do arquivo: `Pedido_000254_Cozinha_Ordem_Corte_V2.pdf`.

### 4. Painel de Documentos Técnicos dentro do ambiente

Em cada ambiente: botões **Gerar Ordem de Corte** e **Gerar Ordem de Acabamento**, e a lista de versões (V3 — 08/08/2026 — LIBERADA) com **Pré-visualizar**, **Imprimir** e **PDF**. A pré-visualização renderiza o snapshot arquivado, idêntico à impressão.

### 5. Visualizador com zoom

Pré-visualização com Zoom +, Zoom −, Ajustar à tela, Tamanho original, Tela cheia, Centralizar e arrastar (pan). Zoom é apenas visual. Separadamente, seletor de escala de impressão (1:1 a 1:50 e Ajustar à página) para desenhos técnicos. Nenhum dos dois altera medidas cadastradas.

### 6. Paginação automática

Quando o conteúdo passa de uma página, novas páginas são criadas repetindo o cabeçalho (pedido, cliente, ambiente) e numerando "PÁGINA 02/03". Tabelas, desenhos e cotas não são cortados.

### 7. Organização do ambiente

Ao abrir um ambiente: Peças, Insumos, Ordem de Corte, Ordem de Acabamento, 2D, Liberação Técnica, Documentos e Histórico — reaproveitando os componentes já existentes, sem recadastro.

O Financeiro do pedido continua lendo os mesmos registros do módulo financeiro; nenhum lançamento novo é criado.

## Detalhes técnicos

- Nova migração: tabela `tech_documents` (order_id, env_id, kind, version, status, responsible, snapshot jsonb, pdf_path, created_at) com RLS por usuário e GRANTs; versão calculada por (order_id, env_id, kind).
- PDFs arquivados no bucket `order-files` sob `tech-docs/{order_id}/{env_id}/...`.
- Novos componentes de render: `cut-order-sheet.tsx` e `finish-order-sheet.tsx` em `src/components/pdf/`, alimentados por um builder puro `src/lib/tech-doc.ts` que transforma `{order, env}` em um snapshot serializável — o mesmo snapshot é usado para gerar, pré-visualizar e imprimir.
- `TechReleaseSheet` atual é mantido; os novos documentos entram como camada adicional, sem remover o que já funciona.
- Visualizador reaproveita o `DrawingZoom` existente, ampliado com os controles pedidos.

## Fora de escopo

- Nenhuma alteração em medidas, valores, comissões ou registros financeiros existentes.
- Nenhum novo cadastro de pedido, cliente, ambiente ou peça.
