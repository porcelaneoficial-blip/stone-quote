# Porcelane V2

PORCELANE - ORÇAMENTO, PEDIDO E PROTOCOLO DE ENTREGA

OBJETIVO

Revisar um aplicativo simples, rápido, responsivo e profissional para gerenciamento de Orçamentos, Pedidos e Romaneios de uma marmoraria.

Não criar módulos separados de:

• Cadastro de Clientes

• Estoque

• Produção

• Agenda

• Usuários

As informações serão digitadas diretamente no orçamento e todos os dados deverão ser totalmente editáveis em qualquer etapa do processo.

---

FLUXO DO SISTEMA

Novo Orçamento

↓

Preencher Dados

↓

Gerar PDF

↓

Aprovar

↓

Gerar Pedido Automaticamente

↓

Acompanhamento Financeiro

↓

Gerar Romaneio

↓

Concluir

---

TELA INICIAL

Botões:

➕ Novo Orçamento Convencional

➕ Novo Orçamento MFC

📄 Orçamentos

📦 Pedidos

🚚 Romaneios

📊 Comissões

---

REGRA GERAL DE EDIÇÃO

Todos os campos do sistema deverão ser editáveis.

Permitir editar:

• Nome do Cliente

• Telefone

• Endereço

• Cidade

• Vendedor

• Arquiteto

• Ambientes

• Materiais

• Descrições

• Medidas

• Valores

• Serviços

• Frete

• Desconto

• Forma de pagamento

• Observações

• Projetos anexados

• Cubas e acessórios

• Pedido

• Romaneio

• Comissões

• Status

Ao editar qualquer informação, o sistema deverá:

• Atualizar cálculos automaticamente;

• Atualizar PDFs automaticamente;

• Atualizar Pedido automaticamente;

• Atualizar Romaneio automaticamente;

• Atualizar Comissões automaticamente;

• Atualizar Financeiro automaticamente.

Não será necessário salvar novamente ou recriar documentos.

---

ORÇAMENTO CONVENCIONAL

Cabeçalho

Campos:

• Número do Orçamento (automático)

• Data

• Nome do Cliente

• Telefone

• Endereço da Obra

• Cidade

• Vendedor Interno

• Vendedor Externo (opcional)

• Arquiteto (opcional)

Todos os campos deverão ser editáveis.

---

AMBIENTES

Cada ambiente deverá possuir:

Nome do Ambiente

Exemplo:

COZINHA

Material:

---

Itens:

| Descrição | Comp. | Larg. | M² | Prevê Emenda |

| --------- | ----- | ----- | -- | ------------ |

| Balcão    |       |       |    | ☐            |

| Ilha      |       |       |    | ☑            |

Campo opcional:

Posição da Emenda:

--- exibir valor final por item e sub total por ambiente, antes do resumo financeiro adicionar insumos

Exemplos:

• Centro

• Lado esquerdo

• Próximo à cuba

• Conforme projeto

---

CÁLCULO AUTOMÁTICO

Fórmula:

M² = Comprimento × Largura

Recalcular automaticamente:

• Área da peça

• Área total do ambiente

• Valor do material

• Subtotal do ambiente

• Valor total do orçamento

Sem botão de recalcular.

---

DESPERDÍCIO (M²C)

Checkbox:

☐ Exibir Quantitativo M²C (30%)

Quando marcado:

M²C = Área Real × 1,30

Exibir:

• Orçamento

• Pedido

• PDF

---

SERVIÇOS

Permitir adicionar:

☑ Abertura de Cuba

☑ Corte de Cooktop

☑ Furação

☑ Rodabanca

☑ Acabamento 45°

☑ Instalação

Cada serviço deverá possuir:

• Descrição

• Valor

Todos os serviços deverão ser editáveis.

---

ORÇAMENTO MFC

Tela separada do orçamento convencional.

Cada ambiente deverá possuir:

• Ambiente

• Descrição do MFC

• Valor Fixo

• Serviços

• Observações

Exemplo:

AMBIENTE:

Cozinha

MFC:

Freijó

Valor:

R$ 820,00

Serviços:

☑ Abertura de Cuba

☑ Furação

Subtotal:

Valor Fixo

+

Serviços

---

REGRAS MFC

Permitir:

☐ Selecionar material cadastrado

ou

☐ Digitar material manualmente

Exemplos:

• Freijó

• Carvalho Hanover

• Branco TX

• Preto Fosco

Não exigir cadastro prévio.

Permitir editar:

• Nome do MFC

• Valor fixo

• Serviços

• Observações

---

FRETE

Campos:

Quantidade:

---

Valor Unitário:

R$ 290,00

Permitir edição total.

---

DESCONTO

Permitir:

• Percentual (%)

  ou

• Valor (R$)

Atualização automática.

---

FORMA DE PAGAMENTO

Entrada:

• Percentual (%)

  ou

• Valor (R$)

Saldo:

• À vista

  ou

• Parcelado

Informar:

Quantidade de parcelas:

---

Calcular automaticamente:

• Valor da entrada

• Saldo

• Valor de cada parcela

Todos os campos deverão ser editáveis.

---

TOTAL GERAL

(Subtotais dos Ambientes)

+

Frete

-----

Desconto

Atualização automática em tempo real.

---

PDF DO ORÇAMENTO

Formato A4 profissional.

Cabeçalho:

• Logo da Empresa

• Nome da Empresa

• Telefone

• Endereço

Conteúdo:

• Dados do Cliente

• Dados da Obra

• Ambientes

• Materiais

• Serviços

• Pagamento

• Valor Total

• Observações

• Assinatura do Cliente

Botões:

• Visualizar

• Gerar PDF

• Compartilhar pelo WhatsApp

• Imprimir

Sempre que houver edição, gerar nova versão automaticamente.

---

PEDIDO

Ao clicar:

APROVAR ORÇAMENTO

O sistema deverá:

• Gerar número do pedido automaticamente;

• Copiar todas as informações do orçamento;

• Manter vínculo entre orçamento e pedido.

Todos os campos deverão permanecer editáveis.

---

STATUS DO PEDIDO

🟡 Aguardando Projeto

🟠 Aguardando Cuba do Cliente

🔵 Em Produção

🟢 Pronto para Entrega

✅ Concluído

Status editáveis.

---

PROJETOS

Adicionar no Pedido:

PROJETOS

Permitir anexar:

• Fotos

• PDFs

• Imagens

• Projetos

• Croquis

• Arquivos diversos

Campos:

• Nome do arquivo

• Data

• Observações

Permitir:

• Visualizar

• Baixar

• Excluir

• Substituir

Todos os anexos deverão permanecer vinculados ao pedido.

--- ambos orçamentos preciso que tenha valor do item individual por peça sem mostrar o valor do m2 do material e preciso que orçamento vire pedido

RECEBIMENTO DE CUBAS E ACESSÓRIOS DO CLIENTE

Adicionar no Pedido:

☐ Cliente entregou cuba

☐ Cliente entregou cooktop

☐ Cliente entregou torneira

☐ Cliente entregou outros acessórios

Para cada item:

• Descrição

• Quantidade

• Data de recebimento

• Observações

Permitir anexar fotos.

Todos os campos deverão ser editáveis.

---

FINANCEIRO SIMPLIFICADO DO PEDIDO

Cada pedido deverá possuir:

Valor Total:

R$ __

Valor Recebido:

R$ __

Valor Pendente:

R$ __

Status:

☐ Pendente

☐ Recebido Parcialmente

☐ Recebido Integralmente

Atualização automática.

---

COMISSÕES

Arquitetos

Comissão fixa:

5%

---

Vendedores Externos

Comissão fixa:

2%

---

Vendedores Internos

Faturamento até R$ 100.000,00:

Comissão:

2%

Faturamento acima de R$ 100.000,00:

Comissão:

3%

Calcular automaticamente:

• Valor vendido

• Percentual aplicado

• Valor da comissão

Status:

☐ Pendente

☐ Pago

☐ Cancelado

Todos os campos deverão ser editáveis.

---

ROMANEIO

Botão:

GERAR ROMANEIO

Permitir selecionar:

☑ Cozinha

☑ Área Gourmet

☐ Banheiro

PDF A4 contendo:

• Número do Pedido

• Cliente

• Telefone

• Endereço da Obra

• Data

• Ambientes selecionados

• Observações

• Assinatura do Cliente

• Assinatura do Entregador

Todos os dados deverão ser editáveis.

---

INTERFACE

• Extremamente simples

• Poucos cliques

• Sem telas desnecessárias

• Responsivo para computador e celular

• Todos os campos editáveis

• Carregamento rápido

• Layout limpo e profissional

• PDFs profissionais em formato A4

• Foco total em:

ORÇAMENTO

↓

PEDIDO

↓

FINANCEIRO SIMPLIFICADO

↓

ROMANEIO

↓

COMISSÕES

O aplicativo deverá funcionar de forma intuitiva, rápida e permitir alterações em qualquer etapa sem perda de informações.# MÓDULO ORÇAMENTOS E MFC

O sistema deve possuir dois tipos de orçamento:

1. ORÇAMENTO CONVENCIONAL

Documento comercial para apresentação ao cliente.

Cabeçalho

• Número do orçamento

• Data de emissão

• Validade

• Empresa

• Logo

• Vendedor

• Arquiteto

• Cliente

• Telefone

• E-mail

• Endereço da obra

Tipo

• Orçamento Rápido (sem cadastro)

• Orçamento Completo (com cadastro)

Dados da Medição

• Data da Medição

• Responsável pela Medição

Itens Digitáveis

Para cada item:

• Ambiente

• Descrição

• Material

• Cor

• Fabricante

• Espessura

• Acabamento

• Quantidade

• Comprimento

• Largura

• Área m²

• Valor Unitário

• Valor Total

Serviços

• Saia

• Frontão

• Rodabanca

• Pingadeira

• Borda Dupla

• Borda 45°

• Meia Esquadria

• Polimento

Recortes

• Cuba

• Cooktop

• Lixeira

• Torneira

• Dosador

• Tomadas

• Calha Úmida

• Ralo Oculto

Totais

• Material

• Beneficiamento

• Frete

• Instalação

• Desconto

• Total Geral

Condições Comerciais

• Prazo de Fabricação

• Prazo de Instalação

• Forma de Pagamento

• Garantia

• Observações

PDF Comercial

Visual premium:

• Branco

• Preto

• Cinza Chumbo

Características:

• Sem excesso de linhas

• Layout elegante

• Valor total destacado

• Assinatura digital

• A4 profissional

---

DUPLICAR ORÇAMENTO

Botão:

DUPLICAR

Objetivo:

Criar nova versão do orçamento sem refazer tudo.

Exemplo:

ORC-2026-00125

↓

ORC-2026-00125-R1

↓

ORC-2026-00125-R2

↓

ORC-2026-00125-R3

Copiar

• Cliente

• Obra

• Ambientes

• Medidas

• Serviços

• Recortes

• Observações

• Dados da Medição

Alterar

Principalmente:

• Material

• Cor

• Fabricante

• Espessura

• Acabamento

• Valor

Comparativo

Exibir:

• R1

• R2

• R3

Comparando:

• Material

• Valor

• Diferença

Aprovação

Ao aprovar uma revisão:

Status:

APROVADO

Demais versões:

CANCELADAS

---

BOTÃO

GERAR MFC

Disponível apenas após aprovação.

---

MFC - MAPA DE FABRICAÇÃO COMPLETO

Documento técnico para produção.

Gerado automaticamente a partir do orçamento aprovado.

Dados Gerais

• Número MFC

• Número Orçamento

• Cliente

• Obra

• Ambiente

• Vendedor

• Medidor

• Data da Medição

• Hora da Medição

• Responsável pela Medição

• Data de Produção

Tipo de Medição

• Original

• Remedição

---

PEÇAS

Cada peça recebe código próprio.

Exemplo:

COZ-001

COZ-002

LAV-001

Campos:

• Código

• Ambiente

• Descrição

• Material

• Cor

• Fabricante

• Espessura

• Acabamento

---

MEDIDAS TÉCNICAS

• Comprimento

• Largura

• Espessura

• Quantidade

• Área Total

---

BENEFICIAMENTOS

Bordas

Selecionar lado:

• Superior

• Inferior

• Direita

• Esquerda

Tipos:

• Reta

• Dupla

• 45°

• Meia Esquadria

Saia

• Altura

• Comprimento

• Tipo

Frontão

• Altura

• Comprimento

Rodabanca

• Altura

• Comprimento

Pingadeira

• Sim

• Não

---

RECORTES

Cuba

• Marca

• Modelo

• Medidas

• Posição

Cooktop

• Marca

• Modelo

• Medidas

• Posição

CUBA ESCULPIDA

• Modelo

• Medidas Internas

• Profundidade

• Inclinação

• Tipo de Escoamento

---

ESTRUTURAS

• Cantoneira

• Tubo Galvanizado

• Perfil U

• Perfil L

• Mão Francesa

Informar:

• Quantidade

• Medidas

---

EMENDAS

• Junta Seca

• Junta Invisível

• Colagem

• Meia Esquadria

---

FOTOS

Anexar:

• Projeto

• Medição

• Ambiente

---

CROQUI

Campo para desenho técnico.

Upload:

• PDF

• DWG

• Imagem

---

PRODUÇÃO

Checklist:

• Corte

• Acabamento

• Conferência

• Embalagem

---

INSTALAÇÃO

Dados

• Data da Instalação

• Hora da Instalação

• Equipe Responsável

Informações da Medição

• Data da Medição

• Responsável pela Medição

Local

• Térreo

• Escada

• Elevador

Necessidades

• Guindaste

• Munck

• Andaime

Observações

Campo livre.

---

ASSINATURAS

• Medidor

• Produção

• Instalador

• Cliente

---

DUPLICAR MFC

Botão:

DUPLICAR MFC

Criar:

MFC-00125-R1

MFC-00125-R2

MFC-00125-R3

Copiando:

• Medidas

• Recortes

• Estruturas

• Fotos

• Croquis

• Instalação

Alterando apenas:

• Material

• Cor

• Espessura

• Acabamento

---

RESULTADO

O sistema deverá gerar automaticamente:

1. PDF Comercial (Cliente)

2. PDF MFC (Produção)

3. Ordem de Instalação

4. Checklist de Produção

5. Etiquetas das Peças

6. Relatório de Medição

Todos os documentos devem manter vínculo entre:

• Orçamento

• Revisões

• MFC

• Produção

• Instalação

Mantendo histórico completo e rastreabilidade da obra. enquadrar em A4 colcocar campo de configuração para dados da empresa

EXTRAIR SEPARADAMENTE MATERIAIS INSUMOS E SERVIÇOS ADICIONAR UM CAMPO DE CONFIGURAÇÃO ONDE COLOCAREI TERMOS DE SERVIÇOS QUE DEVE ESTÁ INCLUSO NO ORÇAMENTO E PEDIDO

Mfc precisa conter itens descritos igual orçamento convencional e ter campo para escrever o nome do material, valor por peça, sub total por ambiente, resumo em observações por material +30% INDEPENDENTE DOS AMBIENTES JUNTA TUDO E ADICIONA 30%  gerar todos os pdf mostrar quantidade do item e calculo automatico pelo valor do m2 do material( Orçamento convencional) Mfc mostrar quantidade de item calculo por 820 mas escrever nome do material pois ele vai comprar o material eu so fabrico extrair logo e dados da empresa, extrair materiais, insumos, serviços e acessórios   Leyalt do orçamento chic marmoaria alto padrão sem gastar muita tinta Padrão A4 Gerar pdf orçamento, pedido e romaneio duplicar orçamentos podendo fazer alteração de material o calculo deverá ser automatico ao escolher o material pra digitar no orçamento deve ter um campo para colocar o valor do m2 e esse valor ser calculado automaticamente os itens do ambiente lembrando que esse valor que vou colcoar não deve aparecer apenas o m2 e o valor de cada item individual e sub total por ambiente colocar caixa de seleção de emenda na lateral visualizar orçamento e pedido antes de salvar pdf incluir quantidade de insumos e serviços por item, ter opção de colocar resumo do material 

 orçamento e pedido não precisa de código por tem apenas numeração 1,2,3

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://stone-quote.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cabc6e8b-3abf-4cf5-81aa-5b4aec32067b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
