import { useRouterState } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";
import { useMyRoles, type AppModule } from "@/lib/roles";
import { Lock } from "lucide-react";

/**
 * Mapa: prefixo de rota autenticada → módulo requerido.
 * A ordem importa (mais específico antes do mais genérico).
 */
const ROUTE_MODULE: Array<{ prefix: string; module: AppModule }> = [
  { prefix: "/orcamentos", module: "orcamentos" },
  { prefix: "/pedidos", module: "pedidos" },
  { prefix: "/medicoes", module: "medicoes" },
  { prefix: "/clientes", module: "clientes" },
  { prefix: "/financeiro/comissoes", module: "comissoes" },
  { prefix: "/financeiro", module: "financeiro" },
  { prefix: "/relatorios", module: "relatorios" },
  { prefix: "/producao", module: "producao" },
  { prefix: "/enviar-orcamento", module: "orcamentos" },
  { prefix: "/configuracoes/usuarios", module: "usuarios" },
  { prefix: "/configuracoes", module: "configuracoes" },
];

// Rotas sempre livres para qualquer autenticado
const ALWAYS_OPEN = ["/", "/minha-conta"];

export function RouteGuard() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const perms = useMyRoles();

  if (perms.loading) {
    return (
      <div className="p-10 text-sm text-stone-500">Carregando permissões…</div>
    );
  }

  if (ALWAYS_OPEN.includes(path)) return <Outlet />;
  if (perms.isAdmin) return <Outlet />;

  const match = ROUTE_MODULE.find((r) => path.startsWith(r.prefix));
  if (!match) return <Outlet />;

  if (!perms.can(match.module)) {
    return (
      <div className="max-w-lg mx-auto mt-24 border border-stone-200 bg-white p-10 text-center">
        <Lock className="size-8 mx-auto text-stone-400 mb-4" />
        <h2 className="font-display text-2xl mb-2">Acesso restrito</h2>
        <p className="text-sm text-stone-600">
          Seu perfil não tem permissão para acessar este módulo. Fale com um
          administrador se precisar de acesso.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
