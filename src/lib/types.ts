import { todayISO } from "@/lib/format";
export type QuoteType = "convencional" | "mfc";
export type QuoteStatus = "rascunho" | "enviado" | "aprovado" | "cancelado";

export type ServiceLine = {
  id: string;
  description: string;
  qty: number;
  unit_value: number;
};

export type SupplyLine = {
  id: string;
  description: string;
  qty: number;
  unit_value: number;
};

export type PieceKind =
  | "balcao_seca" | "balcao_molhada" | "testeira" | "respaldo"
  | "rodape" | "montante" | "cuba" | "tampo" | "outro";
export type PieceShape = "retangular" | "quadrado" | "redondo";
export type CubaInstall = "embutir" | "sobrepor" | "semi_encaixe";

export type EnvItem = {
  id: string;
  description: string;
  qty?: number;
  length: number;
  width: number;
  has_emenda: boolean;
  emenda_position?: string;
  unit_price_override?: number;
  /** Acréscimo interno de 20% no valor do item. Nunca aparece no PDF. */
  markup_20?: boolean;
  /** Valor final editável manualmente (sobrescreve total do item). */
  final_value?: number;
  /** Reconhecimento automático — pode ser sobrescrito manualmente. */
  piece_kind?: PieceKind;
  shape?: PieceShape;
  /** Diâmetro em metros (quando shape = redondo). */
  diameter?: number;
  /** Apenas para peças do tipo "cuba". */
  cuba_install?: CubaInstall;
  /** Acabamentos por item — cor + tipo por lado. Renderizado nos PDFs (orçamento/pedido/romaneio) quando show_item_finishes !== false. */
  finish_edges?: RoomFinishEdge[];
  /** Espessura da peça em mm (sobrescreve a espessura padrão do ambiente no 3D). */
  thickness_mm?: number;
  /** Recortes retangulares na peça (x/y/w/h em metros, origem canto sup. esquerdo). */
  recortes?: PieceCutout[];
  /** Furações circulares (x/y em metros, d em mm). */
  furacoes?: PieceHole[];
  /** Medidas ajustadas na liberação técnica — NÃO alteram valores do pedido; geram aditivo. */
  released_length?: number;
  released_width?: number;
  released_qty?: number;
  /** Observações e usinagens técnicas — só afetam a Ordem de Corte. */
  released_notes?: string;
  usinagem?: string;
  /** Acabamentos da Biblioteca referenciados nesta peça (Liberação Técnica). Não afeta valores. */
  tech_finishes?: import("@/lib/finish-library").FinishSelection[];


};


export type PieceCutout = {
  id: string;
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PieceHole = {
  id: string;
  label?: string;
  x: number;
  y: number;
  /** Diâmetro em mm. */
  d: number;
};



export type FinishSide = "direito" | "esquerdo" | "frente" | "fundo" | "ambos" | "superior" | "inferior";

export type AccessoryKind =
  | "cuba" | "cooktop" | "torre_tomada" | "churrasqueira"
  | "torneira" | "valvula" | "ralo" | "coifa" | "forno" | "microondas"
  | "dispenser" | "ponto_gas" | "ponto_eletrico" | "vaso_sanitario" | "bide"
  | "lava_louca" | "lava_roupa" | "geladeira" | "adega" | "lixeira"
  | "tabua" | "escorredor" | "porta_temperos" | "sifao"
  | "outro";
export type CubaSubKind =
  | "embutir_ret" | "embutir_red" | "apoio" | "semi_encaixe"
  | "banheiro_oval" | "banheiro_ret" | "banheiro_red"
  | "tanque"
  | "gourmet_grande" | "gourmet_dupla" | "inox_simples" | "inox_dupla"
  | "granito_esculpida_ret" | "granito_esculpida_red"
  | "salao_beleza" | "utilidade";
export type CooktopSubKind =
  | "2_bocas" | "4_bocas" | "5_bocas" | "6_bocas"
  | "inducao" | "inducao_4" | "inducao_5" | "domino"
  | "gas_embutido" | "eletrico";
export type ChurrasqueiraSubKind = "gas" | "carvao" | "eletrica" | "pre_moldada" | "bafo";
export type RoomAccessory = {
  id: string;
  kind: AccessoryKind;
  /** Subtipo: cuba (embutir ret/red, apoio, semi-encaixe) ou cooktop (4/5 bocas, indução). */
  subkind?: CubaSubKind | CooktopSubKind | ChurrasqueiraSubKind;
  label?: string;
  /** Posição em metros, origem no canto superior esquerdo do tampo. */
  x: number;
  y: number;
  /** Tamanho em metros. */
  w: number;
  l: number;
  color?: string;
};

/** Estilo geométrico da borda (afeta render 3D). */
export type EdgeStyle = "reto" | "bisel_45" | "chanfrado" | "boleado" | "meia_esquadria";
export type RoomFinishEdge = {
  side: FinishSide;
  /** ID do tipo de acabamento cadastrado (para cor da legenda). */
  finish_type_id?: string;
  style?: EdgeStyle;
};

export type TampoShape = "retangular" | "redondo";

export type QuickRoom = {
  width: number;
  length: number;
  height: number;
  /** Espessura da pedra em mm — habilitada apenas na liberação técnica. */
  thickness_mm?: number;
  /** Formato do tampo. */
  shape?: TampoShape;
  /** Diâmetro em metros quando shape="redondo". */
  diameter?: number;
  finish_side: FinishSide;
  finish_edges?: RoomFinishEdge[];
  material_id?: string;
  material_color?: string;
  tile_w?: number;
  tile_l?: number;
  show_2d?: boolean;
  show_3d?: boolean;
  /** Imprime a folha 2D sem o desenho (apenas cabeçalho + dados da obra + legenda). */
  hide_2d_drawing?: boolean;
  /** Imprime a folha 2D sem a divisão/numeração de peças (tampo inteiro). */
  hide_2d_pieces?: boolean;
  accessories?: RoomAccessory[];
  /** Cotas externas manuais — anotações livres exibidas nas páginas 2D e 3D do PDF. */
  extra_dims_2d?: { id: string; label: string; value: string }[];
  extra_dims_3d?: { id: string; label: string; value: string }[];
};

export type FinishType = { id: string; name: string; color: string; active: boolean };

export type Environment = {
  id: string;
  name: string;
  material_name: string;
  /** Internal only: not displayed in PDF — used to compute item totals */
  material_price_m2: number;
  show_mc: boolean;
  items: EnvItem[];
  services: ServiceLine[];
  supplies: SupplyLine[];
  material_summary?: string;
  /** Prazo individual em dias (usado quando há instalação) */
  delivery_days?: number;
  /** Data ISO em que este ambiente foi liberado para corte */
  released_for_cut_at?: string;
  /** Produção — Kanban */
  production_status?: "liberado" | "em_corte" | "em_acabamento" | "concluido";
  cutter_id?: string;
  finisher_id?: string;
  cut_started_at?: string;
  cut_done_at?: string;
  finish_started_at?: string;
  finish_done_at?: string;
  /** Nome de quem movimentou o cartão no Kanban (última ação) */
  moved_by_name?: string;
  moved_by_at?: string;
  cut_by_name?: string;
  finish_by_name?: string;
  /** Confirmação rápida (sem projeto) usada na liberação técnica */
  quick_room?: QuickRoom;
  /** Observação opcional por ambiente (Agente, Marca, Informações extras). */
  notes_enabled?: boolean;
  env_notes?: { agente?: string; marca?: string; extras?: string };
  /** Valor de aditivo manual para este ambiente (R$). Somado ao subtotal. */
  additive_value?: number;
  /** Peças extras adicionadas manualmente na Liberação Técnica (só corte, não afetam valores). */
  extra_cut_pieces?: EnvItem[];
  /** Quantidades para bônus fixo do acabador (definidas na Liberação Técnica). */
  qtd_cuba?: number;
  qtd_nicho?: number;
  qtd_divibox?: number;
  /** ——— Liberação Técnica (independente do pedido comercial) ——— */
  /** Nome/material técnicos usados apenas na Ordem de Corte. */
  tech_name?: string;
  tech_material?: string;
  /** Observações técnicas do ambiente (Ordem de Corte). */
  tech_notes?: string;
  /** Status próprio do ambiente na liberação técnica. */
  tech_status?: "pendente" | "liberado" | "em_producao" | "concluido";
  /** Responsável e usuário que liberou. */
  tech_responsible?: string;
  released_by_name?: string;
  /** Logística definida (sugerida pelo pedido, editável). */
  tech_logistics?: "retirada" | "entrega" | "instalacao";
  /** Rateio/comissão da técnica — sugestão automática com edição manual. */
  tech_net_override?: number;
  tech_commission_pct?: number;
  /** Transpasses definidos manualmente na Liberação Técnica (nunca automáticos). */
  tech_transpasses?: TechTranspasse[];
  /** Revisão da liberação técnica (00, 01, 02…). */
  tech_revision?: number;
  /** Checklist técnico de conferência (chave -> conferido). */
  tech_checklist?: Record<string, boolean>;
  /** Status da conferência técnica do ambiente. */
  tech_check_status?: "pendente" | "em_analise" | "em_revisao" | "aguardando_correcao" | "liberado" | "bloqueado";
  /** Histórico de versões de liberação técnica (V1, V2, ...). */
  tech_releases?: { version: number; at: string; by?: string; note?: string }[];
  /** Visibilidade dos desenhos por cargo no Portal do Funcionário. */
  visibility?: { cortador?: boolean; acabador?: boolean; montador?: boolean };

};

/** Transpasse técnico: trecho, valor em metros, autor e data. Não altera o pedido. */
export type TechTranspasse = {
  id: string;
  /** Índice da peça no desenho 2D (ordem da Ordem de Corte). */
  piece_index: number;
  side: "top" | "bottom" | "left" | "right";
  /** Valor em metros (3 casas). Sem padrão automático. */
  value_m: number;
  created_at?: string;
  created_by?: string;
};


export type DeliveryMode = "retirada" | "entrega" | "instalacao";
export type DeliveryDaysType = "uteis" | "corridos";
export type DeliveryInfo = {
  mode: DeliveryMode;
  days_type: DeliveryDaysType;
  /** Prazo padrão em dias (retirada/entrega). Para instalação, usa-se delivery_days por ambiente */
  days: number;
  /** Data ISO base para iniciar a contagem (default: data do pedido) */
  start_date?: string;
};

export type Freight = { qty: number; unit_value: number };
export type MfcPickupItem = { id: string; description: string; qty: number; unit_value: number };
export type MfcPickup = { enabled?: boolean; qty: number; unit_value: number; items?: MfcPickupItem[] };
export type Discount = {
  type: "percent" | "value";
  value: number;
  /** Base do desconto: "total" (padrão) ou "material" (só materiais/peças, sem insumos, frete e instalação). */
  scope?: "total" | "material";
  /** Oculta a linha de desconto no PDF (o valor continua abatido do total). */
  hide_on_pdf?: boolean;
};
export type PaymentMethodCode = "pix" | "cartao" | "transferencia" | "boleto" | "dinheiro" | "cheque" | "a_combinar";
export type PaymentEntry = {
  enabled: boolean;
  type: "percent" | "value";
  value: number;
  method?: PaymentMethodCode;
  /** Parcelas da entrada (ex.: entrada dividida no cartão). Default 1. */
  installments?: number;
};
export type PaymentMethodLine = {
  id: string;
  method: PaymentMethodCode;
  /** Forma de informar o valor: percentual do saldo, valor R$ ou "restante" (rateia o que sobra). */
  amount_type: "percent" | "value" | "remaining";
  amount: number;
  installments: number;
  notes?: string;
};
export type Payment = {
  // Legacy — mantém compatibilidade com orçamentos antigos
  entry_type: "percent" | "value";
  entry_value: number;
  balance_type: "avista" | "parcelado";
  installments: number;
  notes?: string;
  // Novo modelo multi-método
  entry?: PaymentEntry;
  methods?: PaymentMethodLine[];
  /** Quando true, prazo e valor das parcelas são "a combinar" — não gera parcelas com vencimento. */
  terms_to_agree?: boolean;
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodCode, string> = {
  pix: "PIX",
  cartao: "Cartão",
  transferencia: "Transferência",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  cheque: "Cheque",
  a_combinar: "À combinar",
};

export type QuoteData = {
  date: string;
  validity_days: number;
  client_name: string;
  client_phone: string;
  client_email: string;
  address: string;
  city: string;
  salesperson: string;
  seller_id?: string;
  external_salesperson?: string;
  tech_measurer_id?: string;
  architect?: string;
  /** Telefones dos responsáveis (aparecem no PDF quando preenchidos). */
  salesperson_phone?: string;
  external_salesperson_phone?: string;
  architect_phone?: string;
  /** Contatos adicionais de responsáveis (podem ser vários). */
  contacts?: { id: string; label: string; name: string; phone?: string }[];
  environments: Environment[];
  /** Quote-level supplies block (before financial summary) */
  quote_supplies: SupplyLine[];
  freight: Freight;
  /** MFC only: collection/pickup fee (per trip) */
  mfc_pickup?: MfcPickup;
  discount: Discount;
  payment: Payment;
  notes?: string;
  /** Configuração do prazo de entrega (apenas em pedidos) */
  delivery?: DeliveryInfo;
  show_material_summary?: boolean;
  show_item_count?: boolean;
  /** Oculta a coluna m² por item e o total m² do ambiente nos PDFs (orçamento/pedido/romaneio). */
  hide_env_m2?: boolean;
  /** When true, material summary in PDF shows the +30% waste column */
  show_waste_pct?: boolean;
  /** Mostrar acabamentos por item (cor + nome) nos PDFs de orçamento, pedido e romaneio. Default: true. */
  show_item_finishes?: boolean;
  /** Quando true (padrão), valores monetários ficam travados e exigem desbloqueio com motivo. */
  values_locked?: boolean;
  /** Materiais (por nome) ocultados do "Resumo de materiais" no PDF (ex.: insumos próprios da marmoraria). */
  hidden_materials?: string[];
  /** Serviço de instalação (apenas convencional): percentual sobre materiais com taxa mínima. */
  installation?: Installation;
  /** Caminho do PDF original importado, no bucket "imported-pdfs". */
  imported_pdf_path?: string;
  /** Histórico de envios pelo WhatsApp. */
  whatsapp_sends?: Array<{ to: string; sent_at: string; status: string; message_id?: string }>;
  /** Instalação de rodapé pós móvel (opcional, valor ajustável). */
  baseboard_install?: { enabled: boolean; value: number };
  /** Frete para rodapé pós móvel (opcional, valor ajustável). */
  baseboard_freight?: { enabled: boolean; value: number };
  /** Snapshot dos ambientes no momento da aprovação (usado para detectar aditivos). */
  original_environments?: Environment[];
  /** Data ISO em que a etapa final (retirada/entrega/instalação) foi concluída — remove do Kanban. */
  fulfillment_done_at?: string;
  /** Nome de quem concluiu a etapa final. */
  fulfillment_by_name?: string;
  /** Etapa manual do Kanban de produção (7 colunas). Sobrepõe a auto-derivação. */
  kanban_stage?: KanbanStage;
  /** Histórico de conversões entre MFC e Convencional. */
  type_history?: Array<{
    from: "convencional" | "mfc";
    to: "convencional" | "mfc";
    at: string;
    total_before: number;
    total_after: number;
    by?: string;
  }>;

};

export type KanbanStage =
  | "aguardando_diretoria"
  | "liberado_corte"
  | "em_corte"
  | "em_acabamento"
  | "pronto_instalacao"
  | "instalacao"
  | "finalizado";

export type Installation = {
  enabled: boolean;
  /** Percentual sobre o valor dos materiais (editável). */
  percent: number;
  /** Taxa mínima em R$. */
  min_value: number;
  /** Valor manual; se preenchido (> 0) sobrescreve o cálculo automático. */
  override_value?: number;
};

export const emptyEnvironment = (name = "Cozinha"): Environment => ({
  id: crypto.randomUUID(),
  name,
  material_name: "",
  material_price_m2: 0,
  show_mc: false,
  items: [{
    id: crypto.randomUUID(),
    description: "",
    qty: 1,
    length: 0,
    width: 0,
    has_emenda: false,
  }],
  services: [],
  supplies: [],
});

export const emptyQuoteData = (): QuoteData => ({
  date: todayISO(),
  validity_days: 7,
  client_name: "",
  client_phone: "",
  client_email: "",
  address: "",
  city: "",
  salesperson: "",
  seller_id: "",
  external_salesperson: "",
  architect: "",
  environments: [emptyEnvironment()],
  quote_supplies: [],
  freight: { qty: 0, unit_value: 290 },
  mfc_pickup: { enabled: false, qty: 1, unit_value: 300 },
  discount: { type: "value", value: 0 },
  payment: {
    entry_type: "percent",
    entry_value: 50,
    balance_type: "parcelado",
    installments: 2,
    notes: "",
  },
  notes: "",
  show_waste_pct: false,
  values_locked: true,
  installation: { enabled: true, percent: 20, min_value: 590 },
});

export type Material = {
  id: string;
  category: string;
  name: string;
  finish: string;
  porosity: string;
  price_m2: number;
  indication: string;
  active: boolean;
  /** URL pública/assinada da textura usada no 3D realista. */
  texture_url?: string | null;
};

export type CatalogService = { id: string; name: string; unit: string; price: number; active: boolean };
export type CatalogSupply = { id: string; name: string; unit: string; price: number; active: boolean };
export type Seller = { id: string; name: string; commission_pct: number; active: boolean; kind?: "interno" | "externo" };
export type TechMeasurer = { id: string; name: string; commission_pct: number; active: boolean };
