# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 🏗️  SISTEMA DE GESTÃO DE PEDIDOS — PORCELANE V1
# 📌 Projeto: Marmoraria Porcelane
# 📅 Atualizado: 10/09/2026
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ═══════════════════════════════════════════════════════════════════════
# 📂 MÓDULO 1 — ESTRUTURA DE ARQUIVOS NO GOOGLE DRIVE
# ═══════════════════════════════════════════════════════════════════════

→ 📁 ESTRUTURA AUTOMÁTICA DE PASTAS:
   📂 TODOS_OS_PEDIDOS
     ┗ 📂 [ANO]
        ┗ 📂 [MM_MÊS, exemplo: 09_SETEMBRO]
           ┗ 📂 PED-[NÚMERO]-[CLIENTE]
              ┣ 📄 PED-[NÚMERO]-[CLIENTE].planilha
              ┣ 📑 ORCAMENTO-[NÚMERO]-[CLIENTE].pdf
              ┣ 📐 Projetos e Desenhos
              ┗ 🖼️ Fotos e Arquivos Diversos

→ 📄 PLANILHA DO PEDIDO:
   ┌─────────────────────────────────────────────────────┐
   │ 📋 DADOS DO PEDIDO                                    │
   ├─────────────────────────────────────────────────────┤
   │ 🔢 Nº Pedido: ........... [NÚMERO]                    │
   │ 👤 Cliente: ............. [NOME]                      │
   │ 📍 Endereço: ............ [ENDEREÇO]                  │
   │ 🏛️ Responsáveis: ........ [NOMES]                     │
   │ 💰 Valor Orçamento: ..... R$ [VALOR]                  │
   │ 📅 Data Abertura: ....... [DD/MM/AAAA]                │
   │ ⏱️ Prazo Execução: ....... [X] dias                    │
   │ 📆 Previsão Conclusão: ... [DD/MM/AAAA]                │
   │    → Cálculo automático: Conclusão = Abertura + Prazo
   └─────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────┐
   │ 📊 ACOMPANHAMENTO POR AMBIENTE                        │
   ├─────────────────────────────────────────────────────┤
   │ ✅ [Ambiente] ........... Concluído em [DATA]         │
   │ 🔄 [Ambiente] ........... Em medição                  │
   │ ⏳ [Ambiente] ........... Aguardando medição           │
   │    → Cálculo automático: Conclusão = Medição + Prazo
   └─────────────────────────────────────────────────────┘

→ 📊 ÍNDICE GERAL:
   ┌─────────────────────────────────────────────────────┐
   │ 📊 PAINEL GERAL                                       │
   ├─────────────────────────────────────────────────────┤
   │ Total: [X]  │ 💰 Valor Total: R$ [VALOR]               │
   │ 🟡 Em Andamento: [Y]  │ 🟢 Concluídos: [Z]             │
   └─────────────────────────────────────────────────────┘
   → Lista em Cartões, ordenado por Nº decrescente

→ 🔒 PERMISSÕES: Apenas visualização. Cliente só vê seu pedido.

# ═══════════════════════════════════════════════════════════════════════
# 🖥️  MÓDULO 2 — EXIBIÇÃO NA TELA
# ═══════════════════════════════════════════════════════════════════════

→ ✅ CONFIRMAÇÃO AO SALVAR:
   ═══════════════════════════════════════════════
               ✅ PEDIDO SALVO COM SUCESSO!
   ═══════════════════════════════════════════════
   🔢 Número: ...... [NÚMERO]
   👤 Cliente: ..... [NOME]
   💰 Valor: ....... R$ [VALOR]
   📅 Abertura: .... [DATA]
   📆 Previsão: .... [DATA]
   📊 Status: ...... 🟡 Em Andamento
   ───────────────────────────────────────────────
   📂 Pasta Drive: .. [LINK]
   📋 Planilha: .... [LINK]
   📑 Orçamento: ... [LINK]
   ───────────────────────────────────────────────
   📋 Link para Cliente: [LINK]
   ═══════════════════════════════════════════════

→ 🎯 REGRAS DE EXIBIÇÃO:
   ✅ Sempre em CARTÕES e BLOCOS bonitos
   ✅ NUNCA em formato de tabela simples
   ✅ Usar ícones e organização visual
   ✅ Exibir Resumo no topo do Painel

# ═══════════════════════════════════════════════════════════════════════
# 🔄 MÓDULO 3 — EXECUÇÃO
# ═══════════════════════════════════════════════════════════════════════

→ ✅ GitHub sincronizar automaticamente
→ ✅ Executar sempre conforme definido — sem pedir confirmação
→ ✅ Manter padrão visual em tudo

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✅ FIM DAS REGRAS — EXECUTAR SEMPRE CONFORME ACIMA
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
