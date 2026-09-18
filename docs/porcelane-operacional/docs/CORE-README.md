# CORE UNIVERSAL — Porcelane.operacional

Este diretório define a base reutilizável do sistema. O nome do repositório continua sendo Porcelane.operacional e o aplicativo atual continua sendo Porcelane.

## Princípio

`CORE UNIVERSAL + MÓDULOS + CONFIGURAÇÃO DO APP + REGRAS DO SEGMENTO`

O core não deve depender de uma empresa específica. Cada aplicativo pode habilitar módulos e definir identidade, permissões, campos, status, automações e regras próprias por configuração.

## O que pertence ao core

- autenticação e sessão
- perfis e permissões
- empresas e usuários
- clientes e contatos
- documentos e arquivos
- tarefas e agenda
- financeiro genérico
- notificações
- auditoria e histórico
- configurações
- navegação modular
- integrações desacopladas
- estrutura para relatórios e busca

## O que não pertence ao core

Regras exclusivas da Porcelane/marmoraria, como medição antes da produção, ordem de corte, paginação de chapas e regras comerciais específicas devem permanecer em módulos/regras do aplicativo.

## Regra de sincronização

Plataformas como Base44, Bolt ou outras devem consumir o código existente deste repositório. Não reconstruir o aplicativo por prompt quando o código já estiver disponível. Alterações devem ser versionadas no GitHub.

## Custo

A arquitetura não exige geração paga para cada novo aplicativo. O código pode ser reutilizado por clonagem/sincronização. Serviços externos e recursos pagos de cada plataforma continuam sujeitos às regras de cobrança da própria plataforma.
