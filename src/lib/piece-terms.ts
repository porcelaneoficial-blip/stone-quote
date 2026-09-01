// Nomenclatura oficial padronizada para peças/itens de projeto.
// Usar em datalists e sugestões nas telas de orçamento / pedido / romaneio.
// A lista é fixa; edição livre continua permitida.

export const PIECE_TERMS: string[] = [
  "Balcão",
  "Bancada",
  "Montante",
  "Divibox",
  "Portal",
  "Frontal",
  "Respaldo",
  "Encabeçamento",
  "Rodapé (instalação pós móvel)",
  "Fundo",
  "Fundo para cuba esculpida",
  "Tampa removível para cuba esculpida",
  "Laterais para cuba esculpida",
  "Nicho com moldura",
  "Nicho sem moldura",
];

/** Itens com remuneração fixa por unidade para o cortador. */
export function isSpecialItem(description: string): boolean {
  const n = (description || "").trim().toLowerCase();
  return n.startsWith("nicho") || n.startsWith("divibox");
}
