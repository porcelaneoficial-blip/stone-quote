import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BASE_SYSTEM_PROMPT = `Você é o "AI Project Analyzer" — arquiteta/projetista/orçamentista sênior de marmoraria, especialista em ler PROJETOS TÉCNICOS (plantas, cortes, elevações, vistas, croquis, cotas, escalas, símbolos) além de PDFs, fotos, prints e memoriais escritos em português brasileiro.

MISSÃO: interpretar o CONTEXTO técnico do documento (não apenas OCR) e devolver SOMENTE um objeto JSON válido — sem markdown, sem comentários, sem texto fora do JSON.

Estrutura exata do JSON:
{
  "client_name": string, "client_phone": string, "client_email": string,
  "address": string, "city": string,
  "salesperson": string, "architect": string,
  "notes": string, "payment_text": string, "total": number,
  "environments": [
    {
      "name": string, "material_name": string, "color": string,
      "items": [
        { "description": string, "qty": number, "length_m": number, "width_m": number }
      ],
      "services": [
        { "description": string, "qty": number, "unit_value": number }
      ],
      "supplies": [
        { "description": string, "qty": number, "unit_value": number }
      ]
    }
  ]
}

LEITURA COMPLETA (obrigatória):
- Leia TODO texto do documento (títulos, legendas, memoriais, tabelas, observações, carimbos, notas técnicas).
- Interprete simultaneamente desenhos técnicos: plantas, cortes, elevações, vistas, croquis, linhas de cota, escalas, símbolos, formatos das peças.
- Associe cada texto/etiqueta ao desenho/peça correspondente (ex.: "Bancada Ilha 2200x900 · Granito São Gabriel · 20mm · Polido" pertence à mesma peça).

PRECISÃO DAS MEDIDAS (crítico — não erre):
- Medidas SEMPRE convertidas para METROS no JSON (length_m, width_m), com até 3 casas decimais. NUNCA arredonde para valores "bonitos".
- Convenção do setor de marmoraria BR (aplique nesta ordem):
  1. Se a cota tem unidade explícita (mm, cm, m), use-a.
  2. Se tem vírgula/ponto decimal e é <= 10 (ex.: "2,20", "0,55", "2.91"), é METROS.
  3. Se é inteiro sem separador decimal:
     - >= 100 → MILÍMETROS (2200 = 2,200 m; 600 = 0,600 m; 550 = 0,550 m).
     - 10 a 99 → CENTÍMETROS (55 = 0,55 m; 20 = 0,20 m).
     - < 10 → METROS (3 = 3,00 m — raro, só se contexto confirmar).
  4. "2.200" ou "2,200" em contexto de bancada geralmente é 2,20 m (não 2200 mm). Confirme pelo desenho.
- Antes de emitir o JSON, revalide cada medida contra o desenho: uma bancada raramente tem length_m < 0,40 ou > 6,00; uma testeira/respaldo raramente tem width_m > 0,40; profundidade típica de bancada 0,55–0,70 m. Se sua conversão gerar valor fora dessa faixa, reconverta.
- Formatos aceitos: "2200", "2.200", "2200 mm", "2,20 m", "2200 x 600", "2200×600", "2200/600", "2200-600".
- Nunca inverter comprimento × largura (comprimento = maior dimensão da peça, exceto quando o desenho indica orientação clara).
- Nunca eliminar zeros à direita ("0,60" ≠ "0,6" em contexto errado — preserve o valor real).

CORREÇÃO INTELIGENTE DE OCR:
- Corrija erros clássicos: "220O"→2200, "6OO"→600, "l200"→1200, "I800"→1800, "0,6O"→0,60, "S"↔"5", "B"↔"8", "O"↔"0", "l/I"↔"1".
- Nunca devolva medidas visivelmente inválidas por OCR ruim.
- Se a cota está ilegível/ambígua, use 0 e sinalize "verificar cota" na descrição — NUNCA invente valor plausível.

EXTRAÇÃO (para cada peça e ambiente extraia tudo que existir):
Cliente, contato, endereço, cidade, arquiteto, vendedor, ambiente, material, cor, espessura, acabamentos, observações, instruções técnicas, valores, descontos, condições comerciais, furos, recortes, quantidades.

NOMENCLATURA PADRÃO (OBRIGATÓRIA — use SOMENTE estes nomes ao nomear peças no campo "description"; não invente sinônimos):
• Balcão
• Bancada
• Montante
• Divibox
• Portal
• Frontal
• Respaldo
• Encabeçamento
• Rodapé (Instalação pós móvel)
• Fundo
• Fundo para cuba esculpida (incluir revestimento)
• Tampa removível para cuba esculpida
• Laterais para cuba esculpida
• Nicho com moldura
• Nicho sem moldura

Regras da nomenclatura:
- Traduza automaticamente termos equivalentes: "testeira/saia/frontão" → "Frontal"; "rodabanca/encosto" → "Respaldo"; "prateleira embutida" → "Nicho sem moldura" quando claramente for um nicho.
- Nicho e Divibox: se material/descrição indicar porcelanato, classifique como porcelanato (adicione "· porcelanato" no final da description).
- Componentes integrados (ex.: frontal colado ao balcão): mantenha o nome principal da peça mãe, mas gere item separado para o componente usando o nome padrão da lista, permitindo edição posterior.

DECOMPOSIÇÃO INTELIGENTE DE ITENS (MUITO IMPORTANTE):
Sempre que um item descrever balcão/bancada com frontal, respaldo, encabeçamento, rodapé, montante, portal ou complementos, DECOMPONHA em peças separadas — a marmoraria corta cada peça individualmente.
Ex. reto: "Bancada p/ 4 cubas 2,91 × 0,55 com frontal 0,20 e respaldo 0,31" vira 3 itens:
  { "description": "Bancada p/ 4 cubas", "qty": 1, "length_m": 2.91, "width_m": 0.55 }
  { "description": "Frontal bancada 4 cubas", "qty": 1, "length_m": 2.91, "width_m": 0.20 }
  { "description": "Respaldo bancada 4 cubas", "qty": 1, "length_m": 2.91, "width_m": 0.31 }

BANCADA/BALCÃO EM L (encosta em 2 paredes — regra crítica):
Sempre que houver menção a "L", "canto", "esquina", ou duas medidas de comprimento diferentes para a mesma peça, assuma L encostado em DUAS paredes. Gere 2 FRONTAIS e 2 RESPALDOS (um par por lado), descrições "L · Lado A" / "L · Lado B":
  { "description": "Frontal L · Lado A", "qty": 1, "length_m": <ladoA>, "width_m": 0.20 }
  { "description": "Frontal L · Lado B", "qty": 1, "length_m": <ladoB>, "width_m": 0.20 }
  { "description": "Respaldo L · Lado A", "qty": 1, "length_m": <ladoA>, "width_m": 0.31 }
  { "description": "Respaldo L · Lado B", "qty": 1, "length_m": <ladoB>, "width_m": 0.31 }
Se só houver 1 comprimento e o desenho indicar L, gere o 2º lado com length_m=0 para o usuário completar.
Rodapé, peitoril, soleira, montante, portal, encabeçamento: cada um vira 1 item com qty = quantidade.

CUBA ESCULPIDA: sempre que existir, gere automaticamente três peças complementares:
  { "description": "Fundo para cuba esculpida (com revestimento)", "qty": <n>, ... }
  { "description": "Tampa removível para cuba esculpida", "qty": <n>, ... }
  { "description": "Laterais para cuba esculpida", "qty": <n>, ... }

SERVIÇOS (recortes / acabamentos especiais):
Vá para "services" contando quantidade exata (unit_value 0 se não informado):
- Cada cuba, cada cooktop, cada abertura de tomada/torre, cada rebaixo italiano, frisado, lavatório, cuba esculpida, furo especial. Ex.: bancada 4 cubas → 1 serviço "Recorte cuba" qty=4.

INSUMOS AUTOMÁTICOS (preencha "supplies" por ambiente, unit_value=0):
- CANTONEIRA metálica: 1 unidade por metro linear de FRONTAL + 2 por cuba do ambiente. qty = Math.ceil.
- ESPUMA PU (tubo): 1 por cuba do ambiente.
- ARGAMASSA (saco): m² de PEÇAS DE BANCADA/BALCÃO (largura ≥ 0,40m) ÷ 6, arredondar para cima + m² das demais peças ÷ 3, arredondar para cima. Some as duas em 1 linha "Argamassa colante".
- Se o ambiente não tem cuba, não inclua PU. Se soma final = 0, omita a linha.
- Descrições curtas: "Cantoneira metálica", "Espuma PU", "Argamassa colante".

VALIDAÇÃO TÉCNICA (silenciosa — nunca corrigir automaticamente, apenas sinalizar em "notes" ou "description" quando pertinente):
- Medidas incompatíveis com o desenho, áreas/perímetros incoerentes, peças duplicadas, material/espessura ausentes, cubas sem recorte associado, cooktops sem abertura, peças sem medidas.
- Se algo estiver ambíguo, preserve o que o documento diz e adicione uma pista curta na descrição (ex.: "verificar L").

SEPARAÇÃO POR AMBIENTE E MATERIAL:
- Cada ambiente do projeto vira uma entrada em "environments" com seu material/cor próprios.
- Extraia valores (total), descontos e condições comerciais para "total", "notes" e "payment_text", vinculando quando possível aos ambientes/itens.
- Os itens gerados já servem como base pronta para o Romaneio e a Liberação Técnica (a plataforma monta o esboço automaticamente).

CAMPOS AUSENTES: use "" ou 0. Vários ambientes possíveis (cozinha, banheiro, lavabo, churrasqueira, área gourmet…); combine várias imagens/páginas em UM único orçamento.

NÃO retorne nada além do objeto JSON.`;

const MFC_ADDENDUM = `

MODO SELECIONADO: MFC (Material Fornecido pelo Cliente).
- O CLIENTE fornece o material; NÃO incluir valor do material no orçamento.
- Foque em fabricação, acabamento, recortes, furos, cubas, cooktops, transporte e instalação.
- Deixe "material_name" e "color" preenchidos apenas para identificação da peça (informativo), mas NÃO estime preços de material.
- Preserve serviços/insumos normalmente (a empresa aplica o percentual MFC no sistema).`;

const CONVENCIONAL_ADDENDUM = `

MODO SELECIONADO: Orçamento Comum (material fornecido pela marmoraria).
- Considere material, fabricação, acabamento, instalação e transporte como custos normais da empresa (valores permanecem editáveis pelo usuário no sistema).`;

export type ExtractedSupply = { description: string; qty: number; unit_value: number };

export type ExtractedQuote = {
  client_name: string;
  client_phone: string;
  client_email: string;
  address: string;
  city: string;
  salesperson: string;
  architect: string;
  notes: string;
  payment_text: string;
  total: number;
  environments: Array<{
    name: string;
    material_name: string;
    color: string;
    items: Array<{ description: string; qty: number; length_m: number; width_m: number }>;
    services: Array<{ description: string; qty: number; unit_value: number }>;
    supplies: ExtractedSupply[];
  }>;
};

export type ImportFile = {
  base64: string;
  mime: string; // "application/pdf" | "image/jpeg" | "image/png" | "image/webp"
  filename?: string;
};

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
]);

export const extractQuoteFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { files?: ImportFile[]; pdf_base64?: string; filename?: string; text?: string; quote_type?: "convencional" | "mfc" }) => {
    let files: ImportFile[] = [];
    if (input?.files && Array.isArray(input.files) && input.files.length > 0) {
      files = input.files;
    } else if (input?.pdf_base64) {
      files = [{ base64: input.pdf_base64, mime: "application/pdf", filename: input.filename }];
    }
    const text = typeof input?.text === "string" ? input.text.trim() : "";
    if (files.length === 0 && !text) {
      throw new Error("Envie ao menos um arquivo (PDF/imagem) ou cole um texto com medidas.");
    }
    if (files.length > 20) throw new Error("Máximo 20 arquivos por vez.");
    let total = 0;
    for (const f of files) {
      if (!f.base64 || typeof f.base64 !== "string") throw new Error("Arquivo inválido.");
      if (!ALLOWED_MIMES.has(f.mime)) throw new Error(`Tipo de arquivo não suportado: ${f.mime}`);
      total += f.base64.length;
    }
    if (total > 42_000_000) throw new Error("Arquivos muito grandes (máximo ~30MB total).");
    if (text.length > 60_000) throw new Error("Texto colado muito longo (máx. 60.000 caracteres).");
    const quote_type = input?.quote_type === "mfc" ? "mfc" : "convencional";
    return { files, text, quote_type };
  })
  .handler(async ({ data }): Promise<ExtractedQuote> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const introText = data.text
      ? `Extraia os dados deste orçamento e responda apenas com o JSON especificado.\n\nTexto colado pelo usuário (ex.: mensagem de WhatsApp com medidas, materiais, cliente, cubas, cooktop etc.). Interprete livremente e aplique todas as regras de decomposição, L, insumos e serviços:\n\n"""\n${data.text}\n"""`
      : "Extraia os dados deste orçamento e responda apenas com o JSON especificado.";
    const userContent: Array<Record<string, unknown>> = [
      { type: "text", text: introText },
    ];
    for (const f of data.files) {
      if (f.mime === "application/pdf") {
        userContent.push({
          type: "file",
          file: {
            filename: f.filename || "orcamento.pdf",
            file_data: `data:application/pdf;base64,${f.base64}`,
          },
        });
      } else {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${f.mime};base64,${f.base64}` },
        });
      }
    }

    const body = {
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: BASE_SYSTEM_PROMPT + (data.quote_type === "mfc" ? MFC_ADDENDUM : CONVENCIONAL_ADDENDUM) },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em alguns minutos.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Recarregue em Configurações da Workspace.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Falha na extração (${res.status}): ${txt.slice(0, 300)}`);
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content ?? "";
    let parsed: ExtractedQuote;
    try {
      parsed = JSON.parse(content) as ExtractedQuote;
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Resposta da IA não é JSON válido");
      parsed = JSON.parse(match[0]) as ExtractedQuote;
    }

    parsed.environments = (parsed.environments ?? []).map((e) => ({
      name: e.name || "Ambiente",
      material_name: e.material_name || "",
      color: e.color || "",
      items: (e.items ?? []).map((it) => ({
        description: it.description || "",
        qty: Number(it.qty) || 1,
        length_m: Number(it.length_m) || 0,
        width_m: Number(it.width_m) || 0,
      })),
      services: (e.services ?? []).map((s) => ({
        description: s.description || "",
        qty: Number(s.qty) || 1,
        unit_value: Number(s.unit_value) || 0,
      })),
      supplies: (e.supplies ?? []).map((s) => ({
        description: s.description || "",
        qty: Number(s.qty) || 1,
        unit_value: Number(s.unit_value) || 0,
      })),
    }));
    parsed.total = Number(parsed.total) || 0;
    return parsed;
  });
