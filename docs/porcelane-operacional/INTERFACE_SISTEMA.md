# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🎨 INTERFACE DE EXIBIÇÃO — PORCELANE
# Arquivo Único · Formato · Estrutura · Tela Principal · Sem Duplicação
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔗 REFERÊNCIA ÚNICA DE CORES
→ Todas as regras de cores, contraste, modo claro e escuro:
   CONSULTAR: PALETA_CORES.md
→ NÃO DEFINIR CORES AQUI → usar exclusivamente da paleta oficial

## 📦 FORMATO DOS CARTÕES
→ Cantos: arredondados e suaves
→ Fundo: conforme modo → PALETA_CORES.md
→ Borda: linha sutil → PALETA_CORES.md
→ Sombra: leve elevação
→ Título: ícone + número + nome → em destaque
→ Conteúdo: bem espaçado, linhas separadas
→ Valores e datas: em destaque e negrito
→ Rodapé: links de ação alinhados

## 📐 ESTRUTURA DO CARTÃO DE PEDIDO
╭───────────────────────────────────────────────────────╮
│ ⚫ PEDIDO [NÚMERO] — [CLIENTE]                       │
│───────────────────────────────────────────────────────│
│ 👤 Cliente:    [NOME]                                  │
│ 📍 Endereço:   [ENDEREÇO]                              │
│ 🏙️ Cidade:     [CIDADE / UF]                           │
│ 🪨 Material:   [TIPO]                                   │
│ 💰 VALOR:      ██████ R$ [VALOR]                       │
│ 📅 Abertura:   [DATA]                                   │
│ 📆 Conclusão:  [DATA] ([PRAZO] dias)                   │
│ 📊 Status:     [ÍCONE] [TEXTO]                          │
│───────────────────────────────────────────────────────│
│ 📂 Pasta  ·  📋 Planilha  ·  📑 Orçamento  ·  🔗 Link │
╰───────────────────────────────────────────────────────╯

## 📊 ÍCONES FIXOS POR STATUS
→ ✅ Concluído
→ 🔄 Em andamento
→ ⏳ Aguardando medição
→ 🔴 Atrasado

## 🚀 MENU PRINCIPAL — ATALHOS RÁPIDOS
→ Aparece SEMPRE no topo da tela principal
→ Botões grandes, claros e visíveis
→ Acesso direto às funções mais usadas

┌─────────────────────────────────────────────────────────────┐
│   📋 NOVO PEDIDO   │   📊 ACOMPANHAMENTO   │   📄 ORÇAMENTOS   │
│   📁 ARQUIVOS      │   💰 FINANCEIRO        │   ⚙️ AJUDA         │
└─────────────────────────────────────────────────────────────┘

→ Cores de destaque → consultar PALETA_CORES.md
→ Sempre visíveis → não precisa procurar
→ Formato retangular com cantos suaves

## 🔔 AVISOS E ALERTAS — DESTAQUE NA TELA
→ Aparecem logo abaixo dos atalhos, em destaque suave
→ Avisos em ordem de importância

┌─────────────────────────────────────────────────────────────┐
│  ⚠️ [N] Pedidos próximos de concluir (até [DATA])            │
│  💡 [N] Orçamentos aguardando aprovação                       │
│  📅 [N] Medições/instalações agendadas                        │
└─────────────────────────────────────────────────────────────┘

→ Avisos sutis mas visíveis → cor de destaque suave
→ Sem poluir → só o que realmente precisa de atenção

## 📅 PRÓXIMOS COMPROMISSOS — AGENDA
→ Lista de medições, instalações e visitas agendadas
→ Ordenados por data → mais próximo primeiro

┌─────────────────────────────────────────────────────────────┐
│ 📅 [DATA] → [TIPO] — [CLIENTE] · [CIDADE]                   │
│ 📅 [DATA] → [TIPO] — [CLIENTE] · [CIDADE]                   │
└─────────────────────────────────────────────────────────────┘

→ Data, tipo, cliente e local visíveis de imediato

## 💰 RESUMO FINANCEIRO — VISÃO RÁPIDA
→ Valores do mês atual → visão simplificada

┌───────────────────────────┐  ┌───────────────────────────┐
│  📈 Total do mês           │  📉 A receber               │
│   R$ [VALOR]               │   R$ [VALOR]                │
└───────────────────────────┘  └───────────────────────────┘

→ Valores sempre em destaque e negrito
→ Cores conforme status → PALETA_CORES.md

## 📌 ESTRUTURA COMPLETA DA TELA PRINCIPAL
→ [1] Saudação personalizada + Data atual + Troca Claro/Escuro
→ [2] Atalhos rápidos → botões grandes
→ [3] Avisos e alertas → o que precisa de atenção
→ [4] Agenda → próximos compromissos
→ [5] Resumo financeiro → mês atual
→ [6] Pedidos recentes → últimos criados
→ [7] Sem poluição visual → só o essencial à vista
→ Tudo com contraste e legibilidade → PALETA_CORES.md

## ✅ REGRAS OBRIGATÓRIAS FINAIS
→ Sempre em cartões arredondados → NUNCA em tabelas simples
→ Datas, valores e números SEMPRE destacados
→ Espaçamento generoso → máxima legibilidade
→ Alternância Tela Clara/Escuro → PALETA_CORES.md
→ Cores → SEMPRE da PALETA → NÃO definir aqui
