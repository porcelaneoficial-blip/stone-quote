import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type AccessSession = {
  email: string;
  name: string | null;
  role: string;
  modules: string[];
  seller_id?: string | null;
  source?: "authorized" | "employee";
  employee_id?: string | null;
};

type Ctx = {
  session: AccessSession | null;
  loading: boolean;
  signInWithCpf: (cpf: string) => Promise<void>;
  signOut: () => void;
};

const SESSION_KEY = "porcelane.session.v2";
// legado
const LEGACY_KEY = "porcelane.admin_cpf.v1";

const AccessCtx = createContext<Ctx>({
  session: null,
  loading: true,
  signInWithCpf: async () => {},
  signOut: () => {},
});

function normCpf(v: string) {
  return v.replace(/\D/g, "");
}

async function loginByCpf(cpf: string): Promise<AccessSession | null> {
  const { data, error } = await (supabase.rpc as any)("login_by_cpf", { p_cpf: cpf });
  if (error) throw error;
  const row = (data as any[] | null)?.[0];
  if (!row) return null;
  const src = row.source as "authorized" | "employee";
  return {
    email: row.email ?? `${normCpf(cpf)}@porcelane.local`,
    name: row.name ?? null,
    role: row.role ?? (src === "employee" ? "producao" : "admin"),
    modules: Array.isArray(row.modules) ? row.modules : [],
    seller_id: row.seller_id ?? null,
    source: src,
    employee_id: row.employee_id ?? null,
  };
}

function persist(s: AccessSession | null) {
  if (typeof window === "undefined") return;
  if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else window.localStorage.removeItem(SESSION_KEY);
}

/** Acesso liberado: sem login, todos entram como administrador. */
const OPEN_ACCESS_SESSION: AccessSession = {
  email: "acesso@porcelane.local",
  name: "Acesso livre",
  role: "admin",
  modules: [],
  seller_id: null,
  source: "authorized",
  employee_id: null,
};


export function AccessGateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AccessSession | null>(OPEN_ACCESS_SESSION);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Acesso liberado: nenhum login é exigido. Se houver sessão salva
    // (CPF de colaborador), ela é mantida; caso contrário entra como admin.
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LEGACY_KEY);
        const raw = window.localStorage.getItem(SESSION_KEY);
        if (raw) setSession(JSON.parse(raw));
      }
    } catch { /* noop */ }
    setLoading(false);
  }, []);

  // Garante uma sessão real no backend — sem ela as políticas de segurança
  // devolvem zero registros e o sistema parece "vazio".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session || cancelled) return;
        const { mintWorkspaceSession } = await import("@/lib/session.functions");
        const res = await mintWorkspaceSession();
        if (cancelled || !res?.token_hash) return;
        const { error } = await supabase.auth.verifyOtp({
          type: "email",
          token_hash: res.token_hash,
        });
        if (error) throw error;
        if (!cancelled) window.location.reload();
      } catch (e) {
        console.error("[access-gate] falha ao restaurar sessão do backend", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);



  const signInWithCpf = async (cpf: string) => {
    const digits = normCpf(cpf);
    if (digits.length < 11) {
      toast.error("Informe um CPF válido.");
      return;
    }
    try {
      const s = await loginByCpf(digits);
      if (!s) { toast.error("CPF não cadastrado."); return; }
      persist(s);
      setSession(s);
      toast.success(`Bem-vindo, ${s.name ?? s.email}`);
      if (s.source === "employee" && typeof window !== "undefined") {
        // colaborador vai direto ao portal
        window.location.href = "/funcionario";
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao entrar.");
    }
  };

  const signOut = () => {
    persist(null);
    setSession(OPEN_ACCESS_SESSION);
    try { supabase.auth.signOut(); } catch { /* noop */ }
    if (typeof window !== "undefined") window.location.href = "/";
  };


  return (
    <AccessCtx.Provider value={{ session, loading, signInWithCpf, signOut }}>
      {children}
    </AccessCtx.Provider>
  );
}

export const useAccessGate = () => useContext(AccessCtx);

/** Utilitário para o Portal do Funcionário reutilizar a sessão CPF salva. */
export function readEmployeeSessionCpf(): { cpf: string; employee_id: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as AccessSession & { cpf?: string };
    if (s.source !== "employee" || !s.employee_id) return null;
    // CPF puro não precisa ser salvo — o portal pede uma vez e revalida via RPC legado.
    return { cpf: s.cpf ?? "", employee_id: s.employee_id };
  } catch { return null; }
}
