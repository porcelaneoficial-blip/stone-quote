import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "echo",
  title: "Echo",
  description: "Ecoa o texto de entrada. Útil para verificar conectividade com o servidor MCP.",
  inputSchema: { text: z.string().min(1).describe("Texto a ser ecoado.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ text }) => ({ content: [{ type: "text", text }] }),
});
