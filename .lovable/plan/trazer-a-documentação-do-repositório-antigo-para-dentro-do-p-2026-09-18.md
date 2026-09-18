# Trazer a documentação do repositório antigo para dentro do Petra

Objetivo: o novo repositório do GitHub já nascer com os dois conteúdos — o sistema Petra e toda a documentação do `Porcelane.operacional`.

## O que será feito

1. Baixar novamente o repositório `Porcelane.operacional` (a cópia temporária anterior foi apagada pelo ambiente).
2. Copiar para dentro do projeto, em uma pasta `docs/porcelane-operacional/`, somente o conteúdo de documentação e regras: textos de padrão, instruções de sistema e prompts.
3. Não copiar o código do protótipo antigo (página, script e estilos soltos) nem as migrações de banco dele — elas são incompatíveis com o sistema atual e poderiam quebrar o acesso.
4. Criar um índice curto em `docs/README.md` apontando para o padrão já consolidado (`docs/PADROES_PORCELANE.md`) e para os documentos originais importados.
5. Registrar no roadmap que a documentação foi unificada.

Depois disso, ao conectar o GitHub e criar o repositório, tudo sobe junto num lugar só.

## Observações

- O `docs/PADROES_PORCELANE.md` atual continua sendo a referência oficial; os arquivos importados entram como material de origem, sem sobrescrever nada.
- Nenhuma tela, documento ou cálculo do sistema é alterado por essa etapa.
- Se o repositório antigo estiver privado no momento do download, será necessário liberar o acesso antes.

## Detalhes técnicos

- Clone raso (`--depth 1`) para `/tmp`, cópia seletiva de `*.md` e da pasta `prompts/` para `docs/porcelane-operacional/`.
- Exclusões: `index.html`, `app.js`, `styles.css`, `sw.js`, `supabase/migrations/*`.
