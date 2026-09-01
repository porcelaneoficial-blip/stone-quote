# Reorganização visual do Porcelane — evolução, não reconstrução

## O que existe hoje (mapeamento)

**Tela do Pedido** (`pedidos.$id.tsx`, 2511 linhas) tem 12 modos numa única barra: Resumo, Ambientes, Produção, Documentos, Documentos técnicos, Histórico, Pedido, Romaneio, Liberação técnica, PDF técnico, Financeiro, Ficha interna. Cinco desses modos são JSX inline gigante dentro da própria rota; os outros delegam para painéis.

**Painéis existentes:** cabeçalho-resumo, ambientes, produção, documentos, histórico, financeiro (leitura); liberação técnica (`tech-release-panel`, 686 linhas) e editor 2D/3D (`quick-room`, 2065 linhas) são onde a edição técnica realmente acontece — peças, medidas liberadas, transpasses, acabamentos por borda, acessórios, checklist.

**Biblioteca** (`finishes-library-tab`, 486 linhas) vive em Configurações → Biblioteca, com galeria, busca e editor de detalhe.

**Duplicidades identificadas:**
- Status/progresso do ambiente recalculado em 3 lugares diferentes (cabeçalho, aba Ambientes, aba Produção).
- Totais financeiros vindos de duas fontes distintas (prop do pedido vs consulta ao banco).
- Ordem de corte acessível por 4 caminhos (Ambientes, Documentos, Documentos técnicos, dentro da própria Liberação técnica).
- Acabamentos editáveis por 2 entradas (lista de peças e clique na borda do 2D) — ambas úteis, mas sem linguagem visual comum.
- Nome/material do ambiente com a mesma regra de fallback reescrita em 4 arquivos.

**Padrão visual disponível:** tokens de cor (stone, dourado #8B5E34, verde #3F6F52, vermelho #B85450), fontes Playfair/Montserrat, classes de badge e botão do Kanban. Já servem de base — não serão trocados, só aplicados de forma consistente.

## Nova organização proposta

### Abas do Pedido: de 12 para 6
Nada é removido — os modos viram ações/subabas dentro do contexto certo.

```
RESUMO | AMBIENTES | FINANCEIRO | PRODUÇÃO | DOCUMENTOS | HISTÓRICO
```

- **Resumo** — cabeçalho fixo (nº, cliente, obra, vendedor, responsável técnico, status) + indicadores (ambientes, peças, pendências, conferência, andamento) + etapa/travas atuais.
- **Ambientes** — o coração. Cada ambiente é um agrupador com peças, status, pendências e progresso. Ao abrir: Peças → Peça → Técnico (desenho, detalhes, acabamentos, acessórios, conferência, liberação) na mesma tela, em painel lateral/expansível.
- **Financeiro**, **Produção**, **Histórico** — painéis atuais, com a mesma linguagem visual.
- **Documentos** — reúne Pedido, Romaneio, Ficha interna, Liberação técnica, Ordem de Corte, Ordem de Acabamento, versões e anexos, agrupados por ambiente. Os modos de impressão continuam existindo, abertos a partir daqui.

### Hierarquia dentro de Ambientes
```
AMBIENTE (card: peças, status, pendências, progresso)
  └─ PEÇAS (tabela: id, material, cor, qtd, medidas, acabamento, conferência, status)
       └─ PEÇA aberta
            ├─ DESENHO em destaque (zoom/pan/ferramentas atuais)
            ├─ DADOS TÉCNICOS (medidas, espessura, material, cor, obs.)
            ├─ DETALHES (recortes, furações, engastes, rebaixo, área molhada, nichos, montantes, testeiras, respaldos)
            ├─ ACABAMENTOS (montante, testeira, respaldo, engaste, rebaixo, área molhada…) com ✓ conferido / ⚠ conferir / — não se aplica
            ├─ ACESSÓRIOS (cuba, torneira, cooktop, acessórios do cliente…)
            └─ CONFERÊNCIA → LIBERAÇÃO (checklist atual, sem checklist paralelo)
```
Sem telas novas: tudo isso reaproveita `tech-release-panel` e `quick-room` reorganizados em seções, com o desenho ocupando a área privilegiada.

### Pendências
Uma pendência tem um único dono (peça, ambiente ou pedido) e "sobe" como contador nos níveis acima — sem repetir o texto. Origem: checklist e campos técnicos já existentes.

### Biblioteca
Continua onde está, ganhando abas por categoria: Bancadas, Nichos, Rebaixos, Engastes, Áreas molhadas, Acabamentos, Detalhes especiais, Outros. Nenhum item removido.

### Componentes padronizados (novos arquivos de UI apenas)
`StatusBadge`, `PendingBadge`, `ProgressSteps`, `SectionHeader`, `DataGrid`/`InfoRow`, `PageHeader` — uma aparência única para status, badges, cabeçalhos, tabelas e indicadores em todo o sistema. Substituem estilos repetidos, sem mudar dados.

### Cores e tipografia
Dourado só para navegação ativa, ação principal e destaque. Verde = concluído/liberado/aprovado. Amarelo = atenção/pendência. Vermelho = erro/bloqueio. Cinza = secundário. Quatro níveis de texto (título, seção, principal, secundário).

## Detalhes técnicos

- Nenhuma migração de banco, nenhuma mudança em regras de negócio, cálculos, permissões, integrações ou fluxo de aprovação.
- `pedidos.$id.tsx` é dividido em painéis por aba (os blocos inline de Pedido/Romaneio/Ficha/Corte saem da rota para componentes próprios) — mesma marcação e mesmas funções, só realocadas.
- Helpers duplicados (rótulo do ambiente, status, progresso) passam a vir de um único módulo compartilhado.
- Zoom de interface, zoom de desenho e escala de PDF permanecem como estão.

## Execução em etapas (validando cada bloco)

1. **Base visual** — componentes padronizados + tokens aplicados; sem mudança de navegação.
2. **Pedido** — 6 abas, cabeçalho e resumo; modos antigos preservados como ações dentro das abas.
3. **Ambientes → Peças → Peça** — hierarquia com desenho em destaque, detalhes, acabamentos, acessórios, conferência e liberação juntos.
4. **Pendências, Documentos por ambiente e Biblioteca por categorias.**
5. **Revisão de paridade** — conferir tela a tela que nenhum campo, botão, filtro ou informação desapareceu.

Sugiro começar pelas etapas 1 e 2 e validar antes de seguir.
