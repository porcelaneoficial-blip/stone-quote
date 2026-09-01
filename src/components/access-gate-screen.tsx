import { useState } from "react";
import { useAccessGate } from "@/lib/access-gate";

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function AccessGateScreen() {
  const { signInWithCpf } = useAccessGate();
  const [busy, setBusy] = useState(false);
  const [cpf, setCpf] = useState("");

  const handleCpf = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithCpf(cpf);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex">
      <div className="hidden md:flex w-1/2 bg-[#1A1A1A] text-white flex-col justify-between p-12">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-white/60">Porcelane</div>
          <div className="font-display text-5xl mt-4 leading-tight">
            Marmoraria
            <br />de alto padrão.
          </div>
        </div>
        <div className="space-y-2 text-sm text-white/60 max-w-sm">
          <p className="font-display text-xl italic text-white">"Cada peça, um traço."</p>
          <p>Acesso exclusivo por CPF cadastrado.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl mb-1 text-[#1A1A1A]">Entrar</h1>
          <p className="text-sm text-[#4A4A4A] mb-8">Informe seu CPF de cadastro.</p>

          <form onSubmit={handleCpf} className="space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-[#4A4A4A]">CPF</label>
              <input
                autoFocus
                required
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(maskCpf(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full mt-1 border border-[#D9D9D9] rounded-none px-3 py-2 text-sm focus:outline-none focus:border-[#1A1A1A] bg-white"
              />
            </div>
            <button
              type="submit"
              disabled={busy || cpf.replace(/\D/g, "").length < 11}
              className="w-full bg-[#1A1A1A] text-white py-3 text-sm font-semibold uppercase tracking-widest hover:bg-[#4A4A4A] transition-colors disabled:opacity-50"
            >
              {busy ? "Validando…" : "Entrar"}
            </button>
          </form>

          <p className="text-[11px] text-[#9B9B9B] mt-6 text-center">
            Cadastro e permissões são gerenciados pelo Administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
