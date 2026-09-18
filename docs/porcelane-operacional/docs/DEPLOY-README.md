# Publicação própria do Porcelane

O Porcelane pode ser hospedado sem Lovable, Bolt ou Base44.

## Arquitetura

- GitHub: código-fonte
- VPS: hospedagem da aplicação web/PWA
- Nginx: servidor web
- Docker: empacotamento e reinício do serviço
- Supabase: banco, autenticação e Storage

## Publicação no VPS

1. Instale Docker e Docker Compose no VPS.
2. Clone este repositório.
3. Configure as variáveis públicas do Supabase conforme o ambiente de build/execução usado pelo projeto.
4. Na raiz do repositório, execute:

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

5. Configure HTTPS antes de uso em produção e aponte o domínio para o VPS.

## PWA

O projeto já possui `manifest.webmanifest` e registra `sw.js`. Quando servido por HTTPS, o Porcelane pode ser instalado no Android como aplicativo/PWA.

## Importante

Este diretório não altera o banco Supabase nem cria cobrança. O VPS, domínio e eventuais serviços externos são custos separados e só devem ser contratados após aprovação.
