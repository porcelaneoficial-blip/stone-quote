import { auth, defineMcp } from "@lovable.dev/mcp-js";
import appInfoTool from "./tools/app-info";
import echoTool from "./tools/echo";

// O emissor OAuth deve ser o host direto do Supabase — o proxy `.lovable.cloud`
// é reescrito no publish e falha a verificação de emissor (RFC 8414). O project
// ref é inlined pelo Vite em tempo de build.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "porcelane-mcp",
  title: "Porcelane MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas do sistema Porcelane. Use `app_info` para consultar módulos disponíveis e `echo` para verificar conectividade.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [appInfoTool, echoTool],
});
