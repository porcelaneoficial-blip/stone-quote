import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, KeyRound, Trash2, ShieldCheck, Sparkles, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  adminCreateUser,
  adminListUsers,
  adminSetRole,
  adminResetPassword,
  adminDeleteUser,
  adminSeedDefaults,
} from "@/lib/users.functions";
import {
  ASSIGNABLE_ROLES,
  ROLE_LABEL,
  useMyRoles,
  ALL_MODULES,
  MODULE_LABEL,
  DEFAULT_ROLE_MODULES,
  type AppRole,
  type AppModule,
} from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/configuracoes/usuarios")({
  component: UsersPage,
});

type Row = {
  id: string;
  email: string;
  username: string;
  name: string;
  created_at: string;
  roles: string[];
};

function UsersPage() {
  const { isAdmin, loading: permsLoading } = useMyRoles();
  const list = useServerFn(adminListUsers);
  const create = useServerFn(adminCreateUser);
  const setRole = useServerFn(adminSetRole);
  const reset = useServerFn(adminResetPassword);
  const del = useServerFn(adminDeleteUser);
  const seed = useServerFn(adminSeedDefaults);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "vendas" as AppRole,
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await list();
      setRows(r as Row[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permsLoading && isAdmin) refresh();
  }, [permsLoading, isAdmin]);

  if (permsLoading) return null;
  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <ShieldCheck className="size-10 mx-auto text-stone-300" />
        <h1 className="font-display text-2xl mt-4">Acesso restrito</h1>
        <p className="text-sm text-stone-500 mt-2">
          Apenas administradores podem gerenciar usuários.
        </p>
      </div>
    );
  }

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create({ data: form });
      toast.success("Usuário criado");
      setForm({ name: "", username: "", password: "", role: "vendas" });
      setShowNew(false);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const changeRole = async (userId: string, role: AppRole) => {
    try {
      await setRole({ data: { userId, role } });
      toast.success("Perfil atualizado");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const resetPw = async (userId: string, username: string) => {
    const pw = prompt(`Nova senha para ${username}:`);
    if (!pw) return;
    try {
      await reset({ data: { userId, password: pw } });
      toast.success("Senha redefinida");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeUser = async (userId: string, username: string) => {
    if (!confirm(`Apagar usuário ${username}?`)) return;
    try {
      await del({ data: { userId } });
      toast.success("Usuário removido");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const [permsFor, setPermsFor] = useState<Row | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {permsFor && (
        <PermissionsModal
          user={permsFor}
          onClose={() => setPermsFor(null)}
        />
      )}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="label-eyebrow">Acesso</p>
          <h1 className="font-display text-4xl mt-1">Usuários</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await seed();
                toast.success("Admins padrão prontos (Amanda, Roxane, Clóvis)");
                refresh();
              } catch (e: any) { toast.error(e.message); }
            }}
            className="flex items-center gap-2 border border-stone-300 px-3 py-2 text-xs uppercase tracking-widest font-bold hover:bg-stone-50"
            title="Cria/garante Amanda, Roxane e Clóvis como Admin (senha Porcelane123)"
          >
            <Sparkles className="size-4" /> Criar admins padrão
          </button>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="flex items-center gap-2 bg-stone-950 text-white px-4 py-2 text-xs uppercase tracking-widest font-bold"
          >
            <Plus className="size-4" /> Novo usuário
          </button>
        </div>
      </div>

      {showNew && (
        <form
          onSubmit={submitNew}
          className="bg-white border border-stone-200 p-5 mb-6 grid grid-cols-1 md:grid-cols-5 gap-3"
        >
          <input
            required
            placeholder="Nome completo"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input-line"
          />
          <input
            required
            placeholder="Usuário (ex: amanda)"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="input-line"
          />
          <input
            required
            type="password"
            placeholder="Senha"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input-line"
          />
          <select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as AppRole })
            }
            className="input-line"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-stone-950 text-white text-xs uppercase tracking-widest font-bold"
          >
            Criar
          </button>
        </form>
      )}

      <div className="bg-white border border-stone-200">
        {loading ? (
          <p className="p-6 text-sm text-stone-400">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-stone-400">Nenhum usuário.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-widest text-stone-500">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Usuário</th>
                <th className="text-left p-3">Perfil</th>
                <th className="text-right p-3 w-48">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((u) => {
                const current = (u.roles[0] as AppRole) ?? "vendas";
                return (
                  <tr key={u.id}>
                    <td className="p-3 font-medium">{u.name || "—"}</td>
                    <td className="p-3 font-mono text-xs">{u.username}</td>
                    <td className="p-3">
                      <select
                        value={current}
                        onChange={(e) =>
                          changeRole(u.id, e.target.value as AppRole)
                        }
                        className="border border-stone-200 px-2 py-1 text-xs"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setPermsFor(u)}
                        className="text-xs uppercase tracking-wider text-stone-500 hover:text-stone-950 mr-3 inline-flex items-center gap-1"
                      >
                        <SlidersHorizontal className="size-3" /> permissões
                      </button>
                      <button
                        onClick={() => resetPw(u.id, u.username)}
                        className="text-xs uppercase tracking-wider text-stone-500 hover:text-stone-950 mr-3 inline-flex items-center gap-1"
                      >
                        <KeyRound className="size-3" /> senha
                      </button>
                      <button
                        onClick={() => removeUser(u.id, u.username)}
                        className="text-xs uppercase tracking-wider text-red-500 hover:text-red-700 inline-flex items-center gap-1"
                      >
                        <Trash2 className="size-3" /> apagar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <EmployeesPasswordPanel />
    </div>
  );
}

/* =========================================================================
 * Painel de senhas dos funcionários da produção (visível só para admin)
 * ========================================================================= */
type Emp = {
  id: string;
  name: string;
  cpf: string | null;
  role: string;
  active: boolean;
  custom_password: string | null;
};

function EmployeesPasswordPanel() {
  const [rows, setRows] = useState<Emp[]>([]);
  const [loading, setLoading] = useState(true);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employees" as never)
      .select("id, name, cpf, role, active, custom_password")
      .eq("active", true)
      .order("name");
    if (error) toast.error(error.message);
    setRows((data as any as Emp[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setPw = async (emp: Emp) => {
    const pw = prompt(`Nova senha para ${emp.name} (deixe vazio para usar a senha padrão "Porcelane 123"):`);
    if (pw === null) return;
    const value = pw.trim() === "" ? null : pw.trim();
    const { error } = await supabase
      .from("employees" as never)
      .update({ custom_password: value } as never)
      .eq("id", emp.id);
    if (error) return toast.error(error.message);
    toast.success(value ? "Senha atualizada" : "Senha redefinida para o padrão");
    load();
  };

  const resetDefault = async (emp: Emp) => {
    if (!confirm(`Voltar a senha de ${emp.name} para "Porcelane 123"?`)) return;
    const { error } = await supabase
      .from("employees" as never)
      .update({ custom_password: null } as never)
      .eq("id", emp.id);
    if (error) return toast.error(error.message);
    toast.success("Senha padrão restaurada");
    load();
  };

  const roleLabel = (r: string) =>
    r === "corte" ? "Cortador"
    : r === "acabamento" ? "Acabador"
    : r === "gerente_producao" ? "Gerente de Produção"
    : r;

  return (
    <div className="mt-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="label-eyebrow">Produção</p>
          <h2 className="font-display text-2xl mt-1">Funcionários (CPF + Senha)</h2>
          <p className="text-xs text-stone-500 mt-1">
            Login pelo portal <code>/funcionario</code>. Senha padrão para todos: <strong>Porcelane 123</strong>. Você pode definir uma senha individual quando precisar.
          </p>
        </div>
        <button onClick={load} className="text-xs uppercase tracking-widest text-stone-500 hover:text-stone-950">
          atualizar
        </button>
      </div>

      <div className="bg-white border border-stone-200">
        {loading ? (
          <p className="p-6 text-sm text-stone-400">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-stone-400">Nenhum funcionário cadastrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-widest text-stone-500">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Cargo</th>
                <th className="text-left p-3">CPF</th>
                <th className="text-left p-3">Senha atual</th>
                <th className="text-right p-3 w-56">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((e) => {
                const effective = e.custom_password ?? "Porcelane 123";
                const isCustom = !!e.custom_password;
                const shown = reveal[e.id];
                return (
                  <tr key={e.id}>
                    <td className="p-3 font-medium">{e.name}</td>
                    <td className="p-3 text-xs text-stone-600">{roleLabel(e.role)}</td>
                    <td className="p-3 font-mono text-xs">{e.cpf || "—"}</td>
                    <td className="p-3 font-mono text-xs">
                      <span>{shown ? effective : "••••••••••"}</span>
                      <button
                        onClick={() => setReveal((r) => ({ ...r, [e.id]: !r[e.id] }))}
                        className="ml-2 text-[10px] uppercase tracking-widest text-stone-400 hover:text-stone-950"
                      >
                        {shown ? "ocultar" : "mostrar"}
                      </button>
                      {!isCustom && (
                        <span className="ml-2 text-[10px] uppercase tracking-widest text-stone-400">
                          (padrão)
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setPw(e)}
                        className="text-xs uppercase tracking-wider text-stone-500 hover:text-stone-950 mr-3 inline-flex items-center gap-1"
                      >
                        <KeyRound className="size-3" /> definir
                      </button>
                      {isCustom && (
                        <button
                          onClick={() => resetDefault(e)}
                          className="text-xs uppercase tracking-wider text-stone-500 hover:text-stone-950 inline-flex items-center gap-1"
                        >
                          padrão
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function PermissionsModal({ user, onClose }: { user: Row; onClose: () => void }) {
  const role = (user.roles[0] as AppRole) ?? "vendas";
  const defaults = new Set<AppModule>(DEFAULT_ROLE_MODULES[role] ?? []);
  const [state, setState] = useState<Record<AppModule, boolean>>(
    () => Object.fromEntries(ALL_MODULES.map((m) => [m, defaults.has(m)])) as Record<AppModule, boolean>,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("user_module_permissions" as never)
        .select("module, allowed")
        .eq("target_user_id", user.id);
      if (data && data.length) {
        setState((prev) => {
          const next = { ...prev };
          (data as any[]).forEach((r) => { next[r.module as AppModule] = r.allowed; });
          return next;
        });
      }
      setLoading(false);
    })();
  }, [user.id]);

  const toggle = (m: AppModule) => setState((s) => ({ ...s, [m]: !s[m] }));

  const save = async () => {
    setSaving(true);
    try {
      const rows = ALL_MODULES.map((m) => ({
        target_user_id: user.id,
        module: m,
        allowed: !!state[m],
      }));
      const { error } = await supabase
        .from("user_module_permissions" as never)
        .upsert(rows as never, { onConflict: "target_user_id,module" });
      if (error) throw error;
      toast.success("Permissões salvas");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setState(Object.fromEntries(ALL_MODULES.map((m) => [m, defaults.has(m)])) as Record<AppModule, boolean>);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4">
      <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-stone-500">Permissões</p>
            <h2 className="font-display text-xl">{user.name || user.username}</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Perfil base: <b>{ROLE_LABEL[role]}</b>
            </p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-950">
            <X className="size-5" />
          </button>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-stone-400">Carregando…</p>
        ) : (
          <div className="p-5 space-y-2">
            {ALL_MODULES.map((m) => (
              <label
                key={m}
                className="flex items-center justify-between gap-3 px-3 py-2 border border-stone-200 cursor-pointer hover:bg-stone-50"
              >
                <span className="text-sm">{MODULE_LABEL[m]}</span>
                <input
                  type="checkbox"
                  checked={!!state[m]}
                  onChange={() => toggle(m)}
                  className="size-4"
                />
              </label>
            ))}
          </div>
        )}

        <div className="px-5 py-4 border-t border-stone-200 flex items-center justify-between gap-3">
          <button
            onClick={resetToDefault}
            className="text-xs uppercase tracking-widest text-stone-500 hover:text-stone-950"
          >
            Restaurar padrão do perfil
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs uppercase tracking-widest px-3 py-2 border border-stone-300"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-xs uppercase tracking-widest font-bold px-4 py-2 bg-stone-950 text-white disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
