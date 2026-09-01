/**
 * Cabeçalho unificado para todos os documentos: Orçamento, Pedido,
 * Liberação para Corte, Romaneio e Relatórios. Mantém visual idêntico
 * e dados sempre sincronizados.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Company = {
  company_name?: string; razao_social?: string; cnpj?: string;
  inscricao_estadual?: string; phone?: string; whatsapp?: string;
  email?: string; instagram?: string; website?: string;
  address?: string; neighborhood?: string; cep?: string;
  logo_url?: string | null;
};

export type DocHeaderProps = {
  /** Título grande do documento. Ex.: "Pedido", "Orçamento", "Liberação para Corte". */
  title: string;
  /** Linha de identificação à direita. Ex.: "PED 1234". */
  badge?: string;
  quoteNumber?: number | string;
  orderNumber?: number | string;
  clientName?: string;
  sellerName?: string;
  issueDate?: string;
  updatedDate?: string;
};

function fmtBR(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }); } catch { return d; }
}

export function DocHeader(props: DocHeaderProps) {
  const [c, setC] = useState<Company | null>(null);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("company_settings").select("*").eq("user_id", u.user.id).maybeSingle();
      setC((data ?? {}) as Company);
    })();
  }, []);
  return (
    <header className="pb-3 mb-5 print:mb-4 border-b border-[color:var(--pdf-ink)]">
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4 min-w-0">
          {c?.logo_url ? (
            <img src={c.logo_url} alt="Logo" className="h-20 w-auto max-w-[240px] object-contain object-left print:h-24 print:max-w-[200px]" />
          ) : null}
          <div className="min-w-0">
            <div className="font-display text-[15pt] font-bold leading-tight">{c?.company_name || ""}</div>
            {c?.razao_social && <div className="text-[8.5pt] text-stone-600 break-words">{c.razao_social}</div>}
            <div className="text-[8.5pt] text-stone-500 mt-1 leading-snug break-words">
              {c?.cnpj && <>CNPJ {c.cnpj}{c?.inscricao_estadual ? ` · IE ${c.inscricao_estadual}` : ""}<br /></>}
              {(c?.address || c?.neighborhood || c?.cep) && (
                <>{[c?.address, c?.neighborhood, c?.cep].filter(Boolean).join(" · ")}<br /></>
              )}
              {(c?.phone || c?.whatsapp) && <>{[c?.phone, c?.whatsapp].filter(Boolean).join(" · ")} </>}
              {c?.email && <>· {c.email}</>}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 min-w-[45mm]">
          <div className="pdf-eyebrow">{props.title}</div>
          {props.badge && <div className="font-display text-[22pt] font-bold leading-none mt-0.5">{props.badge}</div>}
          <div className="pdf-rule-gold ml-auto mt-1.5" />
          <div className="text-[8.5pt] text-stone-600 mt-2 space-y-0.5">
            {props.quoteNumber != null && <div>Orçamento Nº <strong>{props.quoteNumber}</strong></div>}
            {props.orderNumber != null && <div>Pedido Nº <strong>{props.orderNumber}</strong></div>}
            {props.clientName && <div>Cliente: <strong>{props.clientName}</strong></div>}
            {props.sellerName && <div>Vendedor: {props.sellerName}</div>}
            {props.issueDate && <div>Emissão: {fmtBR(props.issueDate)}</div>}
            {props.updatedDate && props.updatedDate !== props.issueDate && (
              <div>Alteração: {fmtBR(props.updatedDate)}</div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
