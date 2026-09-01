# Biblioteca de Acabamentos + detalhes técnicos na Liberação Técnica

Evolução aditiva. Nada do que existe hoje é substituído: Pedido, cálculos, Ordem de Corte, planta 2D atual e layout da Liberação Técnica permanecem exatamente como estão.

## O que será criado

### 1. Configurações → Biblioteca → Biblioteca de Acabamentos
Nova aba dentro da página de Biblioteca já existente (mesma rota `configuracoes/biblioteca-3d`, renomeada no menu para "Biblioteca"), reaproveitando o layout de abas atual.

Cadastro de cada acabamento:
- Nome, categoria, subcategoria, código interno
- Desenho em corte (obrigatório) e planta (opcional)
- Parâmetros dimensionais editáveis (lista nome/rótulo/valor padrão/unidade)
- Descrição técnica, observações, exemplo visual (upload)
- Ativo/inativo e versão

Categorias iniciais já pré-cadastradas: Testeiras, Encabeçamentos, Cubas, Bordas, Pingadeiras, Nichos, Encontros e Emendas, Rebaixos, Acabamentos de superfície — com os modelos listados na solicitação, incluindo o Rebaixo Italiano.

### 2. Desenhos técnicos padrão CAD
Os desenhos são gerados por um renderizador SVG paramétrico (não imagem estática), padrão único:
- Contorno em linha contínua preta
- Elemento oculto / rebaixo em linha tracejada
- Hachura no corte
- Linha de cota + seta + medida, associadas ao elemento (acompanham mudança de dimensão)
- Identificação da peça e chamadas de detalhe (A-A)
- Preto e branco, sem estilização artística

O usuário pode cadastrar novos acabamentos escolhendo um dos *templates gráficos* (corte simples, corte com rebaixo, corte com cuba, planta com recorte, borda perfilada) e ajustando parâmetros — sem precisar de programação nova. Também é permitido subir um SVG/PNG próprio.

### 3. Uso na Liberação Técnica
Na aba da peça, um bloco novo "Acabamentos técnicos" com seletores por tipo (Cuba, Borda, Testeira, Pingadeira, Rebaixo, Encabeçamento, Encontro). Cada seleção:
- referencia o item da Biblioteca (id + versão), sem copiar o desenho
- permite sobrescrever os parâmetros dimensionais só naquele projeto
- aparece como miniatura de corte/planta ao lado da peça

A planta 2D atual continua idêntica; os detalhes selecionados são desenhados **em complemento**: linhas tracejadas do rebaixo/engaste sobre a peça e cotas específicas do detalhe.

### 4. Cortes técnicos automáticos
Quando o acabamento depender de espessura/encaixe/profundidade, o PDF da Liberação Técnica ganha uma seção "Detalhes técnicos" após a planta, com os cortes A-A vinculados às peças (Cuba de embutir e Rebaixo italiano inclusos por padrão). A planta e as páginas atuais não mudam.

### 5. Ordem de Corte
Continua igual. Quando o acabamento tiver informação relevante para corte (ex.: profundidade do rebaixo), ela aparece como uma linha curta vinculada à peça, sem duplicar dados já existentes.

## Detalhes técnicos

- Nova tabela `library_finishes` (aditiva): `id, user_id, category, subcategory, code, name, template, params jsonb, description, notes, drawing_svg, plan_svg, image_url, version, active, timestamps`. RLS por `user_id` + GRANTs no mesmo migration.
- Nova tabela `library_finish_versions` para rastreabilidade: snapshot do desenho a cada alteração; projetos guardam `version` usada.
- Nenhuma coluna existente é alterada. A seleção por peça é gravada em `EnvItem.tech_finishes` dentro do `data` jsonb do pedido (campo novo, opcional).
- Novo componente `src/components/finish-drawing.tsx` (render SVG paramétrico) e `src/components/finish-picker.tsx`, usados tanto na Biblioteca quanto na Liberação Técnica — desenho em um único lugar.
- `quick-room.tsx` recebe apenas uma camada opcional de overlay (tracejados + cotas do detalhe); o código atual da planta não é reescrito.

## Confirmações

1. A Biblioteca de Acabamentos entra como **nova aba** dentro da Biblioteca existente (junto de Texturas e Objetos 3D) — ou prefere uma página separada no menu?
2. Os desenhos gerados por parâmetros (SVG) atendem, ou você quer prioridade no upload de desenhos prontos?
3. Começo pelo pacote 1 (Biblioteca + desenhos paramétricos + Rebaixo italiano e Cuba de embutir) e depois o pacote 2 (uso na Liberação Técnica + cortes no PDF)?
