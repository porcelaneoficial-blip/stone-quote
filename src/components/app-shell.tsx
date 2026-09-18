import { Link, useRouterState } from "@tanstack/react-router";
import { RouteGuard } from "./route-guard";
import { useAuth } from "@/lib/auth-context";
import { useAccessGate } from "@/lib/access-gate";
import { useMyRoles, type Perms } from "@/lib/roles";
import {
  LogOut,
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Ruler,
  Users,
  Settings,
  Menu,
  X,
  Wallet,
  CalendarDays,
  UserCog,
  User as UserIcon,
  Boxes,
  Truck,
  Megaphone,
  Palette,
  MessagesSquare,
  Package,
} from "lucide-react";
import { useState, useEffect } from "react";
import { GlobalSearch } from "./global-search";
import { ZoomControls } from "./zoom-controls";
import { PedraFab } from "./pedra-fab";

type NavItem = {
  to: string;
  label: string;
  icon: any;
  show?: (p: Perms) => boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Início",
    items: [
      { to: "/pedra", label: "Pedra Assistente", icon: MessagesSquare },
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/relatorios/diario", label: "Relatório Diário de Produção", icon: CalendarDays, show: (p) => p.can("relatorios") },
    ],
  },
  {
    label: "Comercial",
    items: [
      { to: "/orcamentos", label: "Orçamentos", icon: FileText, show: (p) => p.can("orcamentos") },
      { to: "/medicoes", label: "Medições", icon: Ruler, show: (p) => p.can("medicoes") },
      { to: "/pedidos", label: "Pedidos", icon: ShoppingCart, show: (p) => p.can("pedidos") },
      { to: "/clientes", label: "Clientes", icon: Users, show: (p) => p.can("clientes") },
    ],
  },
  {
    label: "Produção",
    items: [
      { to: "/producao", label: "Produção", icon: Boxes, show: (p) => p.can("pedidos") },
      { to: "/romaneios", label: "Romaneios", icon: Truck, show: (p) => p.can("pedidos") },
      { to: "/estoque", label: "Estoque", icon: Package, show: (p) => p.can("pedidos") },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/financeiro", label: "Financeiro", icon: Wallet, show: (p) => p.can("financeiro") },
      { to: "/financeiro/insights", label: "Insights Financeiros", icon: Wallet, show: (p) => p.can("financeiro") && p.isAdmin },
      { to: "/rh", label: "RH / Colaboradores / Folha", icon: UserCog, show: (p) => p.can("rh") },
      { to: "/marketing", label: "Marketing", icon: Megaphone, show: (p) => p.can("marketing") },
    ],
  },
  {
    label: "Configurações",
    items: [
      { to: "/configuracoes", label: "Configurações", icon: Settings, show: (p) => p.can("configuracoes") },
      { to: "/configuracoes/usuarios", label: "Usuários", icon: UserCog, show: (p) => p.can("usuarios") },
      { to: "/configuracoes/emails-autorizados", label: "E-mails autorizados (Google)", icon: UserCog, show: (p) => p.can("usuarios") },
      { to: "/configuracoes/trello", label: "Integrações", icon: Boxes, show: (p) => p.isAdmin },
      { to: "/configuracoes/biblioteca-3d", label: "Biblioteca", icon: Boxes, show: (p) => p.can("configuracoes") },
      { to: "/configuracoes/backups", label: "Backups", icon: Boxes, show: (p) => p.isAdmin },
      { to: "/configuracoes/aparencia", label: "Aparência", icon: Palette, show: (p) => p.can("configuracoes") },
      { to: "/minha-conta", label: "Minha conta", icon: UserIcon },
    ],
  },

];

export function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const { session: gate, signOut: gateOut } = useAccessGate();
  const displayEmail = gate?.email ?? user?.email ?? "";
  const initials = (gate?.name ?? gate?.email ?? user?.email ?? "U").slice(0, 2).toUpperCase();
  const [mobileOpen, setMobileOpen] = useState(false);
  const perms = useMyRoles();

  // Automação Trello: cria os cards dos pedidos elegíveis sem intervenção manual.
  useEffect(() => {
    let stop = false;
    const run = async () => {
      const { autoSyncPendingTrello } = await import("@/lib/trello-sync");
      if (!stop) await autoSyncPendingTrello();
    };
    const t = setTimeout(run, 4000);
    const i = setInterval(run, 10 * 60 * 1000);
    return () => { stop = true; clearTimeout(t); clearInterval(i); };
  }, []);


  const doSignOut = async () => {
    gateOut();
    try { await signOut(); } catch { /* noop */ }
  };

  const isActive = (to: string) =>
    to === "/" ? path === "/" : path === to || path.startsWith(to + "/");

  const visibleGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((n) => !n.show || n.show(perms)) }))
    .filter((g) => g.items.length > 0);

  const SidebarBody = (
    <div className="flex flex-col h-full">
      <div className="h-16 px-5 flex items-center border-b border-stone-200">
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          className="font-display text-xl font-semibold tracking-tight"
        >
          PORCELANE
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {visibleGroups.map((g) => (
          <div key={g.label} className="space-y-0.5">
            <div className="px-3 pb-2 label-eyebrow">{g.label}</div>
            {g.items.map((n) => {
              const Icon = n.icon;
              const active = isActive(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMobileOpen(false)}
                  className={
                    "group flex items-center gap-3 px-3 py-2 rounded-lg text-[0.875rem] transition-colors " +
                    (active
                      ? "bg-white text-stone-950 font-medium shadow-[var(--shadow-card)]"
                      : "text-stone-500 hover:bg-white/70 hover:text-stone-950")
                  }
                >
                  <Icon className={"size-4 shrink-0 " + (active ? "text-accent" : "text-stone-400 group-hover:text-stone-600")} />
                  <span className="truncate">{n.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-stone-200 p-3 flex items-center gap-3">
        <div className="size-9 rounded-full bg-white border border-stone-200 flex items-center justify-center text-[0.7rem] font-semibold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-stone-400 truncate">{displayEmail}</div>
        </div>
        <button
          onClick={doSignOut}
          title="Sair"
          className="text-stone-400 hover:text-stone-950 transition-colors"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas text-stone-950 font-sans">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-stone-100 border-r border-stone-200 z-40 no-print">
        {SidebarBody}
      </aside>

      {/* Mobile topbar */}
      <header className="md:hidden sticky top-0 z-40 h-14 bg-card/90 backdrop-blur border-b border-stone-200 flex items-center justify-between px-4 no-print">
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-stone-500">
          <Menu className="size-5" />
        </button>
        <Link to="/" className="font-display text-lg font-semibold tracking-tight">
          PORCELANE
        </Link>
        <div className="size-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-[0.7rem] font-semibold">
          {initials}
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 no-print">
          <div
            className="absolute inset-0 bg-stone-950/30 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-stone-100 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 text-stone-400"
            >
              <X className="size-5" />
            </button>
            {SidebarBody}
          </aside>
        </div>
      )}

      <main className="md:ml-64">
        <div className="hidden md:flex items-center gap-4 sticky top-0 z-30 bg-canvas/85 backdrop-blur border-b border-stone-200 px-8 py-3 no-print">
          <div className="flex-1 min-w-0"><GlobalSearch /></div>
          <ZoomControls />
        </div>
        <div className="ui-zoom-root">
          <RouteGuard />
        </div>
      </main>
      <PedraFab />
    </div>
  );
}

