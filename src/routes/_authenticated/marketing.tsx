import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useEffect } from "react";
import { marketingChat, marketingGenerateImage } from "@/lib/marketing.functions";
import { toast } from "sonner";
import { Send, Image as ImageIcon, Loader2, Sparkles, Download, LayoutTemplate, Paperclip, X, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/marketing")({
  component: MarketingPage,
  head: () => ({
    meta: [
      { title: "Marketing — Porcelane" },
      { name: "description", content: "Direção de marketing premium para marmoraria de alto padrão." },
    ],
  }),
});

type Attachment = { name: string; mime: string; dataUrl?: string; text?: string; size: number };
type Msg = { role: "user" | "assistant"; content: string; attachments?: Attachment[] };

const IMG_FORMATS: Array<{ id: string; label: string; hint: string }> = [
  { id: "1:1", label: "Feed 1:1", hint: "1080×1080" },
  { id: "4:5", label: "Feed 4:5", hint: "1080×1350" },
  { id: "9:16", label: "Story 9:16", hint: "1080×1920" },
  { id: "16:9", label: "Capa 16:9", hint: "1920×1080" },
  { id: "2:1", label: "E-mail 2:1", hint: "1600×800" },
  { id: "3:2", label: "Portfólio 3:2", hint: "1500×1000" },
];

async function fileToAttachment(file: File): Promise<Attachment> {
  const isText = file.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(file.name);
  if (isText) {
    const text = await file.text();
    return { name: file.name, mime: file.type || "text/plain", text, size: file.size };
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return { name: file.name, mime: file.type || "application/octet-stream", dataUrl, size: file.size };
}

const SUGGESTIONS = [
  "Escreva uma legenda de Instagram sobre Calacatta para cozinhas premium.",
  "Crie um roteiro de apresentação técnica de granito Preto São Gabriel para arquitetos.",
  "Sugira 5 temas de campanha mensal para nossa marmoraria em Recife.",
  "E-mail para arquitetos sobre quartzito como alternativa ao mármore.",
  "Explique polido vs. levigado vs. flameado em 3 parágrafos elegantes.",
];

type TemplateCategory = "post" | "legenda" | "email" | "apresentacao";

type Template = {
  id: string;
  category: TemplateCategory;
  title: string;
  description: string;
  build: (ctx: { material: string; ambiente: string; publico: string }) => string;
};

const BRAND_VOICE =
  "Padrão Porcelane: tom premium, sóbrio, elegante, técnico quando necessário, sem clichês, sem emojis excessivos, sem valores financeiros. Português do Brasil. Frases curtas e cadenciadas.";

const TEMPLATES: Template[] = [
  // Posts (roteiro completo de post)
  {
    id: "post-lancamento",
    category: "post",
    title: "Post — Lançamento de material",
    description: "Anúncio sofisticado de um material novo no showroom.",
    build: ({ material, ambiente }) =>
      `${BRAND_VOICE}\n\nEscreva um post completo de Instagram anunciando o lançamento do material "${material || "[material]"}" no showroom Porcelane${ambiente ? `, com aplicação em ${ambiente}` : ""}. Entregue:\n1) Título/hook curto (até 8 palavras).\n2) Corpo do post (3 parágrafos curtos, elegante).\n3) 3 variações de CTA discretos.\n4) 8 hashtags sóbrias e relevantes.`,
  },
  {
    id: "post-antes-depois",
    category: "post",
    title: "Post — Antes e depois",
    description: "Storytelling de uma transformação de ambiente.",
    build: ({ material, ambiente }) =>
      `${BRAND_VOICE}\n\nCrie um post de Instagram no formato antes/depois sobre uma ${ambiente || "cozinha"} revestida em ${material || "[material]"}. Entregue: hook, descrição do antes, descrição do depois, detalhe técnico (acabamento/borda), e CTA discreto para agendar visita ao showroom.`,
  },
  {
    id: "post-detalhe-tecnico",
    category: "post",
    title: "Post — Detalhe técnico",
    description: "Educa arquitetos e clientes finais com autoridade.",
    build: ({ material }) =>
      `${BRAND_VOICE}\n\nCrie um post educativo sobre um detalhe técnico do ${material || "[material]"} (ex.: veios, dureza, absorção, indicação de uso). Entregue: título, 3 bullets técnicos precisos, 1 parágrafo interpretativo e um fechamento assinado "Porcelane".`,
  },

  // Legendas curtas
  {
    id: "legenda-showroom",
    category: "legenda",
    title: "Legenda — Peça em destaque no showroom",
    description: "Legenda curta e elegante para foto de peça.",
    build: ({ material, ambiente }) =>
      `${BRAND_VOICE}\n\nEscreva 3 opções de legenda curta (máx. 220 caracteres cada) para uma foto de ${material || "[material]"}${ambiente ? ` aplicado em ${ambiente}` : ""}. Sem emojis. Sem valores. Numere as opções.`,
  },
  {
    id: "legenda-arquiteto",
    category: "legenda",
    title: "Legenda — Parceria com arquiteto",
    description: "Crédito discreto ao arquiteto do projeto.",
    build: ({ material, ambiente, publico }) =>
      `${BRAND_VOICE}\n\nEscreva 3 legendas curtas creditando o projeto assinado por ${publico || "[nome do arquiteto]"}, usando ${material || "[material]"}${ambiente ? ` em ${ambiente}` : ""}. Máx. 220 caracteres cada. Tom sóbrio e agradecido.`,
  },
  {
    id: "legenda-carrossel",
    category: "legenda",
    title: "Legenda — Carrossel (5 slides)",
    description: "Uma frase-título por slide + legenda-mãe.",
    build: ({ material }) =>
      `${BRAND_VOICE}\n\nCrie a estrutura de um carrossel de 5 slides sobre ${material || "[material]"}: para cada slide, um título curto (até 6 palavras) e uma linha de apoio (até 90 caracteres). No final, uma legenda-mãe com 3 parágrafos curtos.`,
  },

  // E-mails
  {
    id: "email-arquitetos",
    category: "email",
    title: "E-mail — Prospecção de arquitetos",
    description: "Primeiro contato com escritório de arquitetura.",
    build: ({ material, publico }) =>
      `${BRAND_VOICE}\n\nEscreva um e-mail curto de prospecção para o escritório "${publico || "[escritório]"}" apresentando a Porcelane e destacando ${material || "nossa curadoria de materiais"}. Entregue: assunto (até 60 caracteres), corpo em 3 parágrafos curtos, assinatura "Equipe Porcelane" e uma linha final oferecendo visita ao showroom.`,
  },
  {
    id: "email-cliente-final",
    category: "email",
    title: "E-mail — Novidade para cliente final",
    description: "Comunicado elegante para base de clientes.",
    build: ({ material }) =>
      `${BRAND_VOICE}\n\nEscreva um e-mail para clientes finais apresentando novidade em ${material || "[material]"}. Entregue: assunto, pré-cabeçalho (até 90 caracteres), corpo (2 parágrafos), 3 opções de CTA discretos. Sem menção a preço.`,
  },
  {
    id: "email-pos-visita",
    category: "email",
    title: "E-mail — Pós-visita ao showroom",
    description: "Follow-up sofisticado após visita.",
    build: () =>
      `${BRAND_VOICE}\n\nEscreva um e-mail de follow-up sobrio após a visita de um cliente ao showroom Porcelane. Assunto discreto, 2 parágrafos, agradecimento, retomada do próximo passo. Sem promessas exageradas, sem emoji.`,
  },

  // Mini apresentações
  {
    id: "aprese-material",
    category: "apresentacao",
    title: "Mini apresentação — Material",
    description: "5 slides sobre um material (uso técnico + estético).",
    build: ({ material, publico }) =>
      `${BRAND_VOICE}\n\nMonte uma mini apresentação de 5 slides sobre ${material || "[material]"} para ${publico || "arquitetos e designers"}. Para cada slide entregue: título, subtítulo, 3 bullets curtos e uma nota de fala (máx. 2 frases). Ordem sugerida: 1) Origem e caráter, 2) Estética e paleta, 3) Indicações de uso, 4) Cuidados e acabamentos, 5) Aplicações Porcelane.`,
  },
  {
    id: "aprese-projeto",
    category: "apresentacao",
    title: "Mini apresentação — Projeto entregue",
    description: "Case de projeto para portfólio comercial.",
    build: ({ material, ambiente }) =>
      `${BRAND_VOICE}\n\nMonte uma mini apresentação de 4 slides apresentando um projeto entregue: ${ambiente || "[ambiente]"} em ${material || "[material]"}. Slides: 1) Briefing, 2) Escolha do material, 3) Execução e acabamento, 4) Resultado. Cada slide com título, 3 bullets e 1 frase de fala.`,
  },
  {
    id: "aprese-institucional",
    category: "apresentacao",
    title: "Mini apresentação — Institucional Porcelane",
    description: "6 slides para reuniões com parceiros.",
    build: () =>
      `${BRAND_VOICE}\n\nMonte uma apresentação institucional Porcelane em 6 slides para reuniões B2B. Slides sugeridos: 1) Quem somos, 2) Curadoria de materiais, 3) Processo técnico, 4) Diferenciais de acabamento, 5) Parcerias com arquitetos, 6) Convite para visita. Cada slide: título, 3 bullets, nota de fala curta.`,
  },
];

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  post: "Posts",
  legenda: "Legendas",
  email: "E-mails",
  apresentacao: "Mini apresentações",
};


function MarketingPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [genImg, setGenImg] = useState<string | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [tplCat, setTplCat] = useState<TemplateCategory>("post");
  const [tplMaterial, setTplMaterial] = useState("");
  const [tplAmbiente, setTplAmbiente] = useState("");
  const [tplPublico, setTplPublico] = useState("");
  const [imgFormat, setImgFormat] = useState<string>("1:1");
  const [imgRef, setImgRef] = useState<Attachment | null>(null);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const chat = useServerFn(marketingChat);
  const genImage = useServerFn(marketingGenerateImage);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refFileRef = useRef<HTMLInputElement>(null);


  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleFiles = async (files: FileList | null, kind: "chat" | "ref") => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const arr: Attachment[] = [];
      for (const f of Array.from(files)) {
        if (f.size > 15 * 1024 * 1024) { toast.error(`"${f.name}" excede 15MB`); continue; }
        arr.push(await fileToAttachment(f));
      }
      if (kind === "chat") setPending((p) => [...p, ...arr]);
      else if (arr[0]) setImgRef(arr[0]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler arquivo");
    } finally {
      setUploading(false);
    }
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if ((!msg && pending.length === 0) || loading) return;
    setInput("");
    const attachments = pending;
    setPending([]);
    const next = [...messages, { role: "user" as const, content: msg, attachments }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await chat({ data: { history: messages, message: msg, attachments } });
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao consultar a IA");
    } finally {
      setLoading(false);
    }
  };

  const gerarArte = async () => {
    if (!imagePrompt.trim() || genLoading) return;
    setGenLoading(true);
    setGenImg(null);
    try {
      const res = await genImage({ data: { prompt: imagePrompt, format: imgFormat, reference: imgRef ?? undefined } });
      setGenImg(res.imageUrl);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar imagem");
    } finally {
      setGenLoading(false);
    }
  };

  const runTemplate = (tpl: Template) => {
    const prompt = tpl.build({
      material: tplMaterial.trim(),
      ambiente: tplAmbiente.trim(),
      publico: tplPublico.trim(),
    });
    void send(prompt);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">

      <div className="mb-8">
        <p className="label-eyebrow">Direção de conteúdo</p>
        <h1 className="font-display text-4xl mt-1">Marketing</h1>
        <p className="text-sm text-stone-500 mt-2 max-w-2xl">
          Diretora de marketing sênior, especialista em mármore, granito, quartzo e quartzito.
          Cria conteúdo pronto no padrão visual Porcelane.
        </p>
      </div>

      {/* Templates prontos */}
      <div className="mb-8 bg-white border border-stone-200 rounded-md">
        <div className="px-5 py-3 border-b border-stone-200 flex items-center gap-2">
          <LayoutTemplate className="size-4 text-stone-700" />
          <span className="text-xs uppercase tracking-widest font-bold">Templates prontos</span>
          <span className="text-xs text-stone-400 ml-2">clique para gerar no chat</span>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-stone-500">Material</label>
              <input value={tplMaterial} onChange={(e) => setTplMaterial(e.target.value)}
                placeholder="Ex.: Calacatta, Preto São Gabriel…"
                className="w-full mt-1 border border-stone-200 rounded px-3 py-2 text-sm outline-none focus:border-stone-950" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-stone-500">Ambiente</label>
              <input value={tplAmbiente} onChange={(e) => setTplAmbiente(e.target.value)}
                placeholder="Ex.: cozinha, lavabo, escada…"
                className="w-full mt-1 border border-stone-200 rounded px-3 py-2 text-sm outline-none focus:border-stone-950" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-stone-500">Público / referência</label>
              <input value={tplPublico} onChange={(e) => setTplPublico(e.target.value)}
                placeholder="Ex.: arquitetos, nome do escritório…"
                className="w-full mt-1 border border-stone-200 rounded px-3 py-2 text-sm outline-none focus:border-stone-950" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-stone-200">
            {(Object.keys(CATEGORY_LABEL) as TemplateCategory[]).map((c) => (
              <button key={c} onClick={() => setTplCat(c)}
                className={`text-xs uppercase tracking-widest px-3 py-2 -mb-px border-b-2 transition ${
                  tplCat === c
                    ? "border-stone-950 text-stone-950 font-bold"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}>
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {TEMPLATES.filter((t) => t.category === tplCat).map((tpl) => (
              <button key={tpl.id} onClick={() => runTemplate(tpl)} disabled={loading}
                className="text-left border border-stone-200 rounded-md p-4 hover:border-stone-950 hover:bg-stone-50 transition disabled:opacity-40">
                <div className="font-display text-base leading-tight">{tpl.title}</div>
                <div className="text-xs text-stone-500 mt-1">{tpl.description}</div>
                <div className="text-[11px] uppercase tracking-widest text-stone-400 mt-3 flex items-center gap-1">
                  <Sparkles className="size-3" /> gerar no chat
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Chat */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-md flex flex-col h-[70vh]">
          <div className="px-5 py-3 border-b border-stone-200 flex items-center gap-2">
            <Sparkles className="size-4 text-stone-700" />
            <span className="text-xs uppercase tracking-widest font-bold">Assistente de conteúdo</span>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-stone-500">Sugestões para começar:</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="text-left text-sm px-3 py-2 border border-stone-200 rounded hover:bg-stone-50 transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[85%] rounded-md px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === "user" ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-900"
                }`}>
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {m.attachments.map((a, k) => (
                        <div key={k} className={`text-[11px] px-2 py-1 rounded flex items-center gap-1 ${m.role === "user" ? "bg-white/15" : "bg-white border border-stone-200"}`}>
                          {a.mime.startsWith("image/") && a.dataUrl
                            ? <img src={a.dataUrl} alt={a.name} className="size-10 object-cover rounded" />
                            : <><FileText className="size-3" /> {a.name}</>}
                        </div>
                      ))}
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-stone-100 rounded-md px-4 py-3 text-sm text-stone-500 flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin" /> escrevendo…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t border-stone-200 p-3 space-y-2">
            {pending.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pending.map((a, k) => (
                  <div key={k} className="flex items-center gap-2 border border-stone-200 rounded px-2 py-1 text-xs bg-stone-50">
                    {a.mime.startsWith("image/") && a.dataUrl
                      ? <img src={a.dataUrl} className="size-8 object-cover rounded" />
                      : <FileText className="size-3.5" />}
                    <span className="max-w-[160px] truncate">{a.name}</span>
                    <button onClick={() => setPending((p) => p.filter((_, i) => i !== k))} className="text-stone-500 hover:text-stone-950">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input ref={fileRef} type="file" multiple hidden
                accept="image/*,application/pdf,text/*,.md,.csv,.json,.doc,.docx"
                onChange={(e) => { handleFiles(e.target.files, "chat"); e.currentTarget.value = ""; }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || loading}
                className="border border-stone-200 rounded px-3 text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                title="Anexar arquivos (JPG, PNG, PDF, TXT…)">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Anexe arquivos e diga o que quer gerar…"
                className="flex-1 border border-stone-200 rounded px-3 py-2 text-sm outline-none focus:border-stone-950"
              />
              <button onClick={() => send()} disabled={loading || (!input.trim() && pending.length === 0)}
                className="bg-stone-950 text-white px-4 rounded text-sm flex items-center gap-2 disabled:opacity-40">
                <Send className="size-4" /> Enviar
              </button>
            </div>
          </div>
        </div>

        {/* Image generator */}
        <div className="bg-white border border-stone-200 rounded-md p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="size-4 text-stone-700" />
            <span className="text-xs uppercase tracking-widest font-bold">Geração de arte</span>
          </div>
          <p className="text-xs text-stone-500 mb-3">
            Descreva a arte. Ela sai automaticamente no padrão visual Porcelane.
          </p>
          <textarea
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            rows={4}
            placeholder="Ex.: post de Instagram apresentando bancada em Calacatta com iluminação suave."
            className="w-full border border-stone-200 rounded px-3 py-2 text-sm outline-none focus:border-stone-950 mb-3"
          />

          <label className="text-[11px] uppercase tracking-widest text-stone-500">Formato</label>
          <div className="grid grid-cols-2 gap-2 mt-1 mb-3">
            {IMG_FORMATS.map((f) => (
              <button key={f.id} type="button" onClick={() => setImgFormat(f.id)}
                className={`text-left border rounded px-2 py-1.5 text-xs transition ${
                  imgFormat === f.id ? "border-stone-950 bg-stone-950 text-white" : "border-stone-200 hover:border-stone-400"
                }`}>
                <div className="font-medium">{f.label}</div>
                <div className={`text-[10px] ${imgFormat === f.id ? "text-stone-300" : "text-stone-400"}`}>{f.hint}</div>
              </button>
            ))}
          </div>

          <label className="text-[11px] uppercase tracking-widest text-stone-500 mb-1">Referência (opcional)</label>
          <input ref={refFileRef} type="file" accept="image/*" hidden
            onChange={(e) => { handleFiles(e.target.files, "ref"); e.currentTarget.value = ""; }} />
          {imgRef ? (
            <div className="flex items-center gap-2 border border-stone-200 rounded p-2 mb-3">
              {imgRef.dataUrl && <img src={imgRef.dataUrl} className="size-12 object-cover rounded" />}
              <span className="text-xs truncate flex-1">{imgRef.name}</span>
              <button onClick={() => setImgRef(null)} className="text-stone-500 hover:text-stone-950"><X className="size-3.5" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => refFileRef.current?.click()}
              className="border border-dashed border-stone-300 rounded px-3 py-2 text-xs text-stone-600 hover:border-stone-950 mb-3 flex items-center justify-center gap-1">
              <Paperclip className="size-3.5" /> anexar imagem de referência
            </button>
          )}

          <button onClick={gerarArte} disabled={genLoading || !imagePrompt.trim()}
            className="bg-stone-950 text-white px-4 py-2 rounded text-sm flex items-center justify-center gap-2 disabled:opacity-40">
            {genLoading ? <><Loader2 className="size-4 animate-spin" /> gerando…</> : <>Gerar arte {imgFormat}</>}
          </button>
          {genImg && (
            <div className="mt-4 space-y-2">
              <img src={genImg} alt="Arte gerada" className="w-full rounded border border-stone-200" />
              <a href={genImg} download="porcelane-arte.png"
                className="text-xs text-stone-700 flex items-center gap-1 hover:text-stone-950">
                <Download className="size-3" /> baixar imagem
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
