# PORCELANE OPERACIONAL

Aplicativo independente de operação e gestão para a Porcelane, construído para marmoraria e preparado para evoluir para a arquitetura Petra.

> **Proteção obrigatória:** este projeto é separado do PORCELANE antigo em produção. Este repositório não deve alterar, sobrescrever, excluir ou migrar o sistema antigo.

## Fonte de verdade

- Repositório: `porcelaneoficial-blip/Porcelane.operacional`
- Branch principal: `main`
- Banco e storage: Supabase
- Arquivos/documentos: Supabase Storage, com OneDrive como integração externa preferencial quando configurado
- Bolt: somente para importar, visualizar, ajustar e publicar o código existente; não reconstruir o projeto do zero.

## Arquitetura atual

`PORCELANE (interface) → Supabase (dados/storage) → integrações`

`PETRA` permanece como conceito de motor/gestão integrado ao ecossistema, sem criar um segundo aplicativo de assistente.

### Estado técnico atual

O código atual usa Vite + JavaScript no frontend e `@supabase/supabase-js` para acesso ao banco. A documentação antiga que descrevia o projeto como React + TypeScript não correspondia ao código atual.

As variáveis públicas do frontend são `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Nenhuma chave `service_role` ou segredo administrativo deve aparecer no frontend, no GitHub ou no Bolt.

**Importante:** a conexão do GitHub deste projeto não é a autenticação dos usuários do aplicativo. O app ainda precisa de uma camada própria de Supabase Auth antes de ser considerado pronto para uso multiusuário.

## Fluxo operacional oficial

`Lead/Cliente → Obra → Projeto → Leitura do projeto → Ambientes → Medição/Conferência → Desenho Técnico → Produção → Acabamento → Carregamento/Logística → Instalação → Entrega → Pós-venda`

## Regra crítica de produção

**Sem data de medição registrada e medição aprovada/conferida, a ordem de corte/produção permanece bloqueada.**

Pedido finalizado/encerrado fica protegido contra alteração direta.

## Regras comerciais atuais

- Tipos de atendimento: retirada; entrega + instalação; entrega sem instalação.
- Orçamento aprovado deve gerar/iniciar o pedido herdando os dados comerciais.
- Medição pela Porcelane: R$ 150,00 quando o cliente não fornece as medidas; o valor é creditado se o pedido for fechado.
- Condição de pagamento: 40% via Pix + 60% no cartão em até 3x.
- Comissão Amanda Ferraz: 2% até R$ 100 mil e 3% acima de R$ 100 mil.
- Comissão padrão de arquitetos: 5%.
- Meta de margem: aproximadamente 50%.
- Não programar instalação noturna.

## Módulos previstos

Dashboard; Comercial; Orçamentos; Pedidos; Medição/Conferência; Projeto/Desenho Técnico; PCP/Produção; Acabamento; Logística; Instalação; Clientes/Obras; Financeiro; Estoque; RH/Administrativo; Documentos; Portal do Cliente; Portal do Funcionário; Assistente; Configurações e Integrações.

## Assistentes internos

- **Márcia:** RH, financeiro e administrativo.
- **IATA:** funções internas de PCP, estoque e paginação de chapas.
- O usuário final não deve receber uma interface identificada simplesmente como “IA”; o acesso deve aparecer conforme o perfil e a função.

## Desenvolvimento econômico

O código deve ser corrigido e versionado primeiro no GitHub. O Bolt deve consumir o código existente. Evitar reconstruções, gerações repetidas e qualquer ação que consuma créditos sem necessidade.

## Segurança

A chave anon do Supabase é uma chave pública de cliente e não substitui regras de segurança. Dados reais devem ser protegidos por Supabase Auth + RLS/policies ou por backend/Edge Functions quando uma operação exigir privilégio elevado.

## Documentação

O estado atual consolidado está em `docs/STATUS-ATUAL.md` e nas instruções do `BOLT.md`.
