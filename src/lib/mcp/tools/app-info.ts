import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "app_info",
  title: "Informações do app",
  description: "Retorna informações básicas sobre o sistema Porcelane (nome, versão, módulos disponíveis).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{
      type: "text",
      text: JSON.stringify({
        name: "Porcelane",
        description: "Sistema de gestão para marmoraria: orçamentos, pedidos, medições, produção e financeiro.",
        modules: ["orcamentos", "pedidos", "medicoes", "clientes", "financeiro", "producao", "relatorios"],
      }),
    }],
  }),
});
