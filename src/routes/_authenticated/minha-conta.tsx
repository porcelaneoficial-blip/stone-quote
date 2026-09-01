import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { selfUpdatePassword } from "@/lib/users.functions";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/minha-conta")({
  component: MyAccountPage,
});

function MyAccountPage() {
  const { user } = useAuth();
  const update = useServerFn(selfUpdatePassword);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  const username = (user?.user_metadata as any)?.username ?? (user?.email ?? "").replace("@porcelane.local", "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { toast.error("As senhas não conferem"); return; }
    if (pw.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setSaving(true);
    try {
      await update({ data: { password: pw } });
      toast.success("Senha alterada com sucesso");
      setPw(""); setPw2("");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <p className="label-eyebrow">Perfil</p>
      <h1 className="font-display text-4xl mt-1 mb-8">Minha conta</h1>

      <div className="bg-white border border-stone-200 p-6 mb-6">
        <div className="text-xs text-stone-500 uppercase tracking-widest font-bold mb-1">Usuário</div>
        <div className="text-lg font-mono">{username}</div>
      </div>

      <form onSubmit={submit} className="bg-white border border-stone-200 p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold mb-2">
          <KeyRound className="size-4" /> Alterar senha
        </div>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Nova senha</span>
          <input type="password" required minLength={6} value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full border border-stone-300 px-3 py-2 focus:outline-none focus:border-stone-950" />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">Confirmar nova senha</span>
          <input type="password" required minLength={6} value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="w-full border border-stone-300 px-3 py-2 focus:outline-none focus:border-stone-950" />
        </label>
        <button type="submit" disabled={saving}
          className="w-full bg-stone-950 text-white text-xs uppercase tracking-widest font-bold py-3 disabled:opacity-50">
          {saving ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}
