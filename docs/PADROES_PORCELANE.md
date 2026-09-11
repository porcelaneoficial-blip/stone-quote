# Padrões Oficiais Porcelane — Interface e Documentos

> Fonte: repositório Porcelane.operacional (`PADRÃO OFICIAL — PORCELANE`, `INTERFACE_SISTEMA.md`).
> Referência única de padrão visual para o Petra / Porcelane V1.

---

## 1. Identidade visual — regra de ouro

- Fundo: **branco sempre** (economia de tinta, clareza máxima).
- Texto: **preto puro** (contraste e legibilidade máximos).
- Destaque: **negrito + tamanho + emoji**. Nunca fundo preenchido.
- Linhas e bordas: **finas e sutis**.
- Proibido: faixa preta cheia, caixa colorida, texto sobre fundo escuro.

## 2. Emojis — linguagem universal

- ✅ = pode / recomendado
- ⚠️ = atenção / cuidado
- ❌ = proibido / evite

Mesma linguagem em documentos e na interface.

## 3. Fonte e legibilidade

- Família sem serifa.
- Títulos 16–18pt negrito · Texto 11–12pt · Rodapé 9–10pt.
- Entrelinha 1,2x a 1,4x.
- Margens 2cm nos documentos; espaçamento generoso na interface.

---

## 4. Padrão de documentos

### Estrutura
1. Cabeçalho: logo Porcelane + tipo do documento + nº + data.
2. Linha fina preta abaixo do cabeçalho.
3. Corpo em blocos, rótulos em negrito.
4. Tabelas: cabeçalho em negrito, fundo branco sempre.
5. Valores e termos destacados por negrito e tamanho.
6. Linha fina separando o rodapé.
7. Rodapé: contato + Página X de Y + assinatura.

### Dados padronizados
- Data: **DD/MM/AAAA**.
- Valor: **R$ 0.000,00** (ponto milhar, vírgula decimal).
- Validade: **10 dias corridos** da emissão.
- Confidencialidade: *"Documento confidencial · Uso exclusivo do destinatário"*.
- Assinatura: linha + nome + função/CPF + data.

### Relação de documentos oficiais
- 📄 Orçamento Comercial
- 📑 Capa de Pedido Confirmado
- 📝 Contrato de Prestação de Serviços
- 📅 Agenda de Medições e Instalações
- 🧾 Recibo de Pagamento
- 📦 Termo de Recebimento de Acessórios
- 📋 Ficha Técnica do Material
- 📋 Guia de Cuidados e Orientações — **entregue em todo pedido**
- 🤝 Termo de Garantia
- ✍️ Termo de Entrega e Aceite
- ✅ Checklists: Atendimento · Medição · Fabricação · Instalação · Fechamento

---

## 5. Padrão de interface

### Identidade (a mesma dos documentos)
- Fundo branco suave / cinza claríssimo.
- Texto preto / cinza escuro.
- Destaque: tom quente/dourado suave, só em botões, ícones e rótulos importantes.
- Bordas: linha fina cinza clara.
- Proibido: cores saturadas, fundos escuros em excesso, sombras pesadas.

### Estrutura de tela
- Barra lateral esquerda branca, menu limpo, recolhível.
- Conteúdo principal em cartões arredondados, sombra suave, espaçamento generoso.
- Cabeçalho superior: logo, busca, notificações, usuário, separados por linha fina.
- Rodapé discreto: versão, links, suporte.

### Componentes
- **Cartões:** fundo branco, borda fina, cantos arredondados, sombra suave. Conteúdo em cartões, nunca em tabelas simples.
- **Botões:** borda fina + texto em negrito; tom quente só na ação principal.
- **Tabelas:** cabeçalho em negrito, linhas claras, separação fina — igual aos documentos.
- **Responsivo:** celular → tablet → desktop sem quebras.
- Datas, valores e números **sempre destacados**.

---

## 6. Cartão de pedido — formato padrão

```text
╭───────────────────────────────────────────────────────╮
│ ⚫ PEDIDO [NÚMERO] — [CLIENTE]                        │
│───────────────────────────────────────────────────────│
│ 👤 Cliente:    [NOME]                                 │
│ 📍 Endereço:   [ENDEREÇO]                             │
│ 🏙️ Cidade:     [CIDADE / UF]                          │
│ 🪨 Material:   [TIPO]                                 │
│ 💰 VALOR:      R$ [VALOR]                             │
│ 📅 Abertura:   [DATA]                                 │
│ 📆 Conclusão:  [DATA] ([PRAZO] dias)                  │
│ 📊 Status:     [ÍCONE] [TEXTO]                        │
│───────────────────────────────────────────────────────│
│ 📂 Pasta · 📋 Planilha · 📑 Orçamento · 🔗 Link       │
╰───────────────────────────────────────────────────────╯
```

### Ícones fixos de status
- ✅ Concluído
- 🔄 Em andamento
- ⏳ Aguardando medição
- 🔴 Atrasado

---

## 7. Tela principal — ordem obrigatória

1. Saudação personalizada + data atual + alternância claro/escuro.
2. Atalhos rápidos (botões grandes): Novo Pedido · Acompanhamento · Orçamentos · Arquivos · Financeiro · Ajuda.
3. Avisos e alertas: pedidos próximos de concluir, orçamentos aguardando aprovação, medições/instalações agendadas.
4. Agenda: próximos compromissos ordenados por data (data → tipo — cliente · cidade).
5. Resumo financeiro do mês: total do mês e a receber, em destaque.
6. Pedidos recentes.
7. Sem poluição visual — só o essencial à vista.

---

🤎 **PORCELANE** · Elegância e resistência em cada detalhe
