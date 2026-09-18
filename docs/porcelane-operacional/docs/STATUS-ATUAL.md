# PORCELANE OPERACIONAL — STATUS ATUAL

Atualizado em 11/09/2026.

## 1. Projeto correto

Este é o repositório ativo do novo Porcelane Operacional:

`porcelaneoficial-blip/Porcelane.operacional`

O Porcelane antigo em produção permanece separado e protegido.

## 2. O que já está implementado

- Interface principal Porcelane.
- Navegação por módulos.
- Dashboard operacional.
- Orçamentos com gravação no Supabase.
- Orçamento com área m², preço/m², desconto, margem, forma de pagamento e tipo de entrega.
- Botão operacional para aprovar orçamento e gerar pedido, preservando os dados comerciais.
- Conversão de orçamento aprovado em pedido com vínculo ao orçamento e herança dos dados comerciais.
- Pedidos com gravação no Supabase.
- Clientes e obras vinculados.
- Medição/conferência com estado persistido de aprovação.
- Auditoria operacional de criação/alteração dos principais registros.
- Fila de produção.
- Ordens de produção e ordens de corte criadas automaticamente quando o pedido entra em produção.
- Painel de produção alimentado por dados reais do Supabase.
- PCP inicial para acompanhamento de ordem de produção e ordem de corte.
- Atualização de status, operador, data de corte, início e conclusão da produção.
- Nova tabela `reservas_estoque` para reservar material por pedido/ordem de produção.
- Instalação vinculada ao pedido e agenda operacional real.
- Agenda de entregas/logística alimentada pela tabela `entregas`.
- Painel financeiro alimentado por contas a receber, contas a pagar e comissões reais.
- Estoque alimentado pela tabela `materiais`.
- Painel de documentos alimentado pela tabela `documentos`, incluindo indicação de vínculo com OneDrive.
- Regra de bloqueio de produção sem medição registrada e aprovada.
- Proteção de pedido finalizado contra alteração direta.
- Configuração por `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## 3. Correções aplicadas em 11/09/2026

- README alinhado ao código real: Vite + JavaScript + Supabase.
- Fluxo oficial atualizado: projeto, leitura, ambientes, medição, desenho, produção, acabamento, logística, instalação, entrega e pós-venda.
- Regras comerciais atuais registradas: tipos de atendimento, taxa de medição, pagamento, comissões, margem e instalação diurna.
- Separação entre autenticação do GitHub e autenticação dos usuários do Porcelane documentada.
- OneDrive definido como integração externa preferencial para documentos quando configurado; Supabase Storage permanece como armazenamento do aplicativo.
- Márcia e IATA registrados como funções internas.
- Service worker atualizado para v6 e preparado para carregar o módulo operacional sem reconstrução do app no Bolt.
- Guardas adicionais do fluxo operacional aplicadas: medição antes da conferência/produção, conferência antes da produção, produção antes da instalação e instalação + data antes da finalização.
- Bloqueio de retorno de etapa no fluxo operacional.
- Exemplos financeiros, estoque, produção, instalação, logística e documentos foram substituídos dinamicamente por dados reais quando disponíveis.
- Migration comercial/medição/auditoria aplicada no Supabase ativo `jwbbhqmyjrmfkdnzfyhl` e registrada no repositório.
- Migration de PCP aplicada com `reservas_estoque` para preparar reserva e consumo de materiais por pedido/produção.

## 4. O que ainda precisa ser concluído antes de produção real

1. Supabase Auth para usuários e perfis.
2. RLS/policies adequadas ao acesso por perfil; a configuração atual é single-tenant sem login.
3. PCP avançado: paginação de chapas, sobras, veios, fotos, consumo efetivo e movimentação de estoque.
4. Acabamento com etapas próprias e apontamento de qualidade.
5. Logística/entrega com protocolos e comprovantes.
6. Financeiro real com geração de parcelas, Pix, cartão, recebimentos e conciliação.
7. RH e produtividade.
8. Documentos/PDFs A4 e organização por número do pedido.
9. Portais do cliente e funcionário.
10. Integração OneDrive efetiva, quando necessária.
11. Testes completos de build e fluxo antes da publicação.

## 5. Regra que não pode ser quebrada

A produção/ordem de corte só pode ser liberada quando existir `data_medicao` **e** `medicao_aprovada = true`. A instalação exige produção anterior e data de instalação. A finalização exige instalação e data.

Nunca usar o GitHub ou o Bolt como substituto da autenticação do aplicativo.

## 6. Regra de custo

Priorizar alterações diretas no código e no GitHub. Evitar reconstruções no Bolt e qualquer operação paga sem autorização prévia.
