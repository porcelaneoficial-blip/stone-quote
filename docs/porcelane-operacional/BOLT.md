# Porcelane Operacional — Instruções para Bolt

## Regra principal
Este repositório é a fonte de verdade do projeto. O Bolt deve trabalhar sobre o código existente, sem reconstruir o aplicativo do zero.

## Objetivo
Manter e tornar funcional o Porcelane Operacional preservando a interface, regras de negócio, documentação e arquitetura já existentes.

## O que NÃO fazer
- Não recriar o projeto do zero.
- Não substituir a interface existente por uma interface genérica.
- Não apagar módulos ou fluxos já implementados.
- Não alterar o Porcelane antigo que está em produção.
- Não colocar chaves secretas no código.
- Não gerar dados fictícios quando houver integração com o banco disponível.
- Não alterar regras de negócio apenas para facilitar a implementação.
- Não adicionar serviços pagos sem autorização.

## Fonte de verdade
1. Código deste repositório.
2. Documentação em `docs/`.
3. Regras de negócio documentadas em `docs/05-REGRAS-DE-NEGOCIO.md`.
4. Fluxo operacional em `docs/04-FLUXO-OPERACIONAL.md`.
5. Configurações e automações em `docs/11-CONFIGURACOES-E-AUTOMACOES.md`.

## Regra crítica de produção
Nenhuma ordem de corte/produção pode ser liberada sem uma data de medição registrada e sem a medição estar aprovada. Pedido finalizado/fechado não pode ser alterado.

## Backend
Usar as variáveis de ambiente definidas em `.env.example`. Nunca versionar credenciais reais.

## Antes de alterar código
- Ler os arquivos relacionados.
- Preservar contratos existentes.
- Verificar se a funcionalidade já existe antes de criar outra.
- Rodar `npm run build` após alterações.
- Corrigir erros de TypeScript/build antes de considerar a alteração concluída.

## Deploy/uso
O GitHub permanece como fonte central. Bolt, Lovable e Base44 devem consumir o projeto existente, não reconstruí-lo.
