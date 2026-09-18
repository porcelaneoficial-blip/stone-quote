import { useState } from "react";
import { ChevronDown } from "lucide-react";

const CONSULTAS = [
  "📄 Orçamentos — situação, cliente e valor",
  "⚫ Pedidos — etapa, valor, recebido e resumo",
  "📐 Medições — agenda, endereço e metragem medida",
  "🏭 Produção — o que está em corte, acabamento e carregamento",
  "💰 Financeiro — a receber, a pagar e comissões",
  "👤 Clientes — dados de contato e endereço da obra",
];

const ACOES = [
  "Alterar a etapa de um pedido",
  "Agendar ou remarcar uma medição",
  "Registrar um recebimento",
  "Cadastrar um novo cliente",
  "Criar um orçamento a partir da descrição",
];

const REGRAS = [
  "Nada é apagado — toda alteração fica registrada no histórico.",
  "Pedido aprovado ou bloqueado comercialmente só muda por revisão ou aditivo.",
  "Medição e instalação somente em horário comercial (08h às 18h).",
  "O preço interno do m² nunca aparece em documento comercial.",
  "A Pedra só enxerga os módulos que o seu acesso permite.",
  "Ela consulta os dados reais do sistema — nunca inventa números.",
];

export function PedraRegras() {
  const [aberto, setAberto] = useState(true);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-black">📘 Painel de regras da Pedra</span>
        <ChevronDown
          className={`size-4 text-neutral-500 transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-neutral-200 px-4 py-4 text-sm text-black">
          <Bloco titulo="O que ela consulta" itens={CONSULTAS} />
          <Bloco
            titulo="O que ela executa (sempre com sua confirmação)"
            itens={ACOES.map((a) => `⚠️ ${a}`)}
          />
          <Bloco titulo="Regras que ela nunca quebra" itens={REGRAS.map((r) => `• ${r}`)} />
        </div>
      )}
    </div>
  );
}

function Bloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">{titulo}</p>
      <ul className="space-y-1.5">
        {itens.map((i) => (
          <li key={i} className="leading-snug">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
