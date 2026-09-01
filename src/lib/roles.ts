import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccessGate } from "@/lib/access-gate";

export type AppRole =
  | "admin"
  | "producao"
  | "vendedor"
  | "vendas"
  | "supervisor"
  | "cortador"
  | "acabador"
  | "parceiro";

export type UserRoleRow = {
  id: string;
  target_user_id: string;
  role: AppRole;
  created_at: string;
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrativo",
  producao: "Produção",
  vendedor: "Vendedor (legado)",
  vendas: "Vendas",
  supervisor: "Supervisor",
  cortador: "Cortador",
  acabador: "Acabador",
  parceiro: "Parceiro (vendedor externo)",
};

export const ASSIGNABLE_ROLES: AppRole[] = [
  "admin",
  "vendas",
  "supervisor",
  "cortador",
  "acabador",
];

// ---- Módulos ---------------------------------------------------------------

export type AppModule =
  | "orcamentos"
  | "pedidos"
  | "medicoes"
  | "clientes"
  | "romaneio"
  | "producao"
  | "financeiro"
  | "comissoes"
  | "relatorios"
  | "rh"
  | "marketing"
  | "configuracoes"
  | "usuarios";

export const MODULE_LABEL: Record<AppModule, string> = {
  orcamentos: "Orçamentos",
  pedidos: "Pedidos",
  medicoes: "Medições",
  clientes: "Clientes",
  romaneio: "Romaneios",
  producao: "Produção / Corte / Acabamento",
  financeiro: "Financeiro",
  comissoes: "Comissões",
  relatorios: "Relatórios",
  rh: "RH / Folha",
  marketing: "Marketing",
  configuracoes: "Configurações",
  usuarios: "Usuários",
};

export const ALL_MODULES: AppModule[] = [
  "orcamentos",
  "pedidos",
  "medicoes",
  "clientes",
  "romaneio",
  "producao",
  "financeiro",
  "comissoes",
  "relatorios",
  "rh",
  "marketing",
  "configuracoes",
  "usuarios",
];

// Permissões padrão por perfil (fallback quando não há override do admin)
export const DEFAULT_ROLE_MODULES: Record<AppRole, AppModule[]> = {
  admin: [...ALL_MODULES],
  vendas: ["orcamentos", "pedidos", "medicoes", "clientes", "romaneio", "comissoes", "relatorios", "marketing"],
  supervisor: ["orcamentos", "pedidos", "medicoes", "clientes", "romaneio", "producao", "relatorios"],
  producao: ["pedidos", "romaneio", "producao"],
  cortador: ["producao"],
  acabador: ["producao"],
  vendedor: ["orcamentos", "pedidos", "clientes", "comissoes"],
  parceiro: ["orcamentos", "pedidos", "comissoes"],
};

function defaultModulesForRoles(roles: AppRole[]): Set<AppModule> {
  const s = new Set<AppModule>();
  roles.forEach((r) => DEFAULT_ROLE_MODULES[r]?.forEach((m) => s.add(m)));
  return s;
}

// ---- Hook ------------------------------------------------------------------

export type Perms = {
  roles: AppRole[];
  isAdmin: boolean;
  isVendas: boolean;
  isSupervisor: boolean;
  isCortador: boolean;
  isAcabador: boolean;
  isParceiro: boolean;
  parceiroSellerId: string | null;
  modules: Set<AppModule>;
  can: (m: AppModule) => boolean;
  canManageUsers: boolean;
  canEditOrders: boolean;
  canTechnicalRelease: boolean;
  canSeeFinancials: boolean;
  canSeeEmployeePayments: boolean;
  canSeeFinalStages: boolean;
  loading: boolean;
};

export function useMyRoles(): Perms {
  const { session: gate } = useAccessGate();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Fonte primária: sessão do access-gate (por e-mail autorizado).
      if (gate) {
        setRoles([gate.role as AppRole]);
        const map: Record<string, boolean> = {};
        gate.modules.forEach((m) => { map[m] = true; });
        // Módulos NÃO listados ficam bloqueados (exceto se for admin).
        setOverrides(map);
        setLoading(false);
        return;
      }
      // Fallback: usuário logado no Supabase (fluxo antigo).
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setRoles(["admin"]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("target_user_id", u.user.id);
      let mine = (data ?? []).map((r) => r.role as AppRole);
      if (mine.length === 0) mine = ["admin"];
      setRoles(mine);

      const { data: ov } = await supabase
        .from("user_module_permissions" as never)
        .select("module, allowed")
        .eq("target_user_id", u.user.id);
      const map: Record<string, boolean> = {};
      (ov as any[] | null)?.forEach((r) => { map[r.module] = r.allowed; });
      setOverrides(map);
      setLoading(false);
    })();
  }, [gate]);

  const isAdmin = roles.includes("admin");
  const isVendas = roles.includes("vendas") || roles.includes("vendedor");
  const isSupervisor = roles.includes("supervisor");
  const isCortador = roles.includes("cortador");
  const isAcabador = roles.includes("acabador");
  const isParceiro = roles.includes("parceiro");
  const parceiroSellerId = isParceiro ? (gate?.seller_id ?? null) : null;

  const base = defaultModulesForRoles(roles);
  const modules = new Set<AppModule>(base);
  Object.entries(overrides).forEach(([m, allowed]) => {
    const mod = m as AppModule;
    if (allowed) modules.add(mod);
    else modules.delete(mod);
  });
  if (isAdmin) ALL_MODULES.forEach((m) => modules.add(m)); // admin sempre pode tudo

  const can = (m: AppModule) => modules.has(m);

  return {
    roles,
    isAdmin,
    isVendas,
    isSupervisor,
    isCortador,
    isAcabador,
    isParceiro,
    parceiroSellerId,
    modules,
    can,
    canManageUsers: can("usuarios"),
    canEditOrders: can("orcamentos") || can("pedidos"),
    canTechnicalRelease: can("pedidos"),
    canSeeFinancials: can("financeiro") && !isParceiro,
    canSeeEmployeePayments: can("comissoes") && isAdmin,
    canSeeFinalStages: can("pedidos") || can("romaneio"),
    loading,
  };
}
