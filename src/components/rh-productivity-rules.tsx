import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RemParams = {
  value_per_m2: number;
  value_special: number;
  finisher_percent: number;
  note_cut_m2: number;
  note_finish_m2: number;
};

const DEFAULT_PARAMS: RemParams = {
  value_per_m2: 16, value_special: 15, finisher_percent: 5, note_cut_m2: 0, note_finish_m2: 0,
};

const ROLES = [
  { v: "tecnico", l: "Técnico (medição/liberação)" },
  { v: "corte", l: "Corte" },
  { v: "acabamento", l: "Acabamento" },
  { v: "expedicao", l: "Expedição" },
  { v: "instalador", l: "Instalador" },
  { v: "administrativo", l: "Administrativo" },
  { v: "gerente_producao", l: "Gerente de Produção" },
] as const;

const TYPES = [
  { v: "percent", l: "% sobre o valor líquido" },
  { v: "per_m2", l: "R$ por m²" },
  { v: "per_env", l: "R$ por ambiente" },
  { v: "fixed", l: "Valor fixo (R$)" },
];

type RuleRow = { id?: string; role: string; type: string; value: number };

export function ProductivityRulesTab() {
  const [uid, setUid] = useState<string | null>(null);
  const [params, setParams] = useState<RemParams>(DEFAULT_PARAMS);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      setUid(u.user.id);
      const [{ data: p }, { data: cfg }] = await Promise.all([
        supabase.from("remuneration_params").select("*").eq("user_id", u.user.id).maybeSingle(),
        supabase.from("productivity_config").select("id, role, type, value").eq("user_id", u.user.id),
      ]);
      if (p) {
        setParams({
          value_per_m2: Number(p.value_per_m2) || 0,
          value_special: Number(p.value_special) || 0,
          finisher_percent: Number(p.finisher_percent) || 0,
          note_cut_m2: Number((p as { note_cut_m2?: number }).note_cut_m2) || 0,
          note_finish_m2: Number((p as { note_finish_m2?: number }).note_finish_m2) || 0,
        });
      }
      const byRole = new Map((cfg ?? []).map((r) => [r.role as string, r]));
      setRules(ROLES.map((r) => {
        const found = byRole.get(r.v) as RuleRow | undefined;
        return {
          id: found?.id,
          role: r.v,
          type: found?.type ?? (r.v === "acabamento" || r.v === "tecnico" ? "percent" : "per_env"),
          value: Number(found?.value ?? 0),
        };
      }));
      setLoading(false);
    })();
  }, []);

  const setRule = (role: string, patch: Partial<RuleRow>) =>
    setRules((rs) => rs.map((r) => (r.role === role ? { ...r, ...patch } : r)));

  const saveAll = async () => {
    if (!uid) return;
    setSaving(true);
    const { error: e1 } = await supabase
      .from("remuneration_params")
      .upsert({ user_id: uid, ...params } as never);
    const { error: e2 } = await supabase
      .from("productivity_config")
      .upsert(
        rules.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          user_id: uid,
          role: r.role,
          type: r.type,
          value: Number(r.value) || 0,
        })) as never,
      );
    setSaving(false);
    if (e1 || e2) { toast.error(e1?.message ?? e2?.message ?? "Erro ao salvar"); return; }
    toast.success("Regras de produtividade salvas");
  };

  if (loading) return <Card className="p-4 text-sm text-stone-500">Carregando…</Card>;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold">Regras globais de remuneração</h3>
          <p className="text-xs text-stone-500">
            Base de cálculo automática dos lançamentos de produtividade (Ordem de Corte e de Acabamento).
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label>Cortador — R$ por m²</Label>
            <Input type="number" step="0.01" value={params.value_per_m2}
              onChange={(e) => setParams({ ...params, value_per_m2: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Item especial (Nicho / Divibox) — R$ fixo</Label>
            <Input type="number" step="0.01" value={params.value_special}
              onChange={(e) => setParams({ ...params, value_special: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Acabador — % sobre líquido</Label>
            <Input type="number" step="0.01" value={params.finisher_percent}
              onChange={(e) => setParams({ ...params, finisher_percent: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Valor da nota — Ordem de Corte (R$/m²)</Label>
            <Input type="number" step="0.01" value={params.note_cut_m2}
              onChange={(e) => setParams({ ...params, note_cut_m2: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Valor da nota — Ordem de Acabamento (R$/m²)</Label>
            <Input type="number" step="0.01" value={params.note_finish_m2}
              onChange={(e) => setParams({ ...params, note_finish_m2: Number(e.target.value) })} />
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold">Regra padrão por função</h3>
          <p className="text-xs text-stone-500">
            Aplicada a novos colaboradores da função. O cadastro individual em <b>Colaboradores</b> tem prioridade sobre esta regra.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b">
              <tr><th className="p-2">Função</th><th className="p-2">Tipo de cálculo</th><th className="p-2 w-48">Valor</th></tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.role} className="border-b">
                  <td className="p-2 font-medium">{ROLES.find((x) => x.v === r.role)?.l ?? r.role}</td>
                  <td className="p-2">
                    <Select value={r.type} onValueChange={(v) => setRule(r.role, { type: v })}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input type="number" step="0.01" value={r.value}
                      onChange={(e) => setRule(r.role, { value: Number(e.target.value) })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveAll} disabled={saving}>{saving ? "Salvando…" : "Salvar regras"}</Button>
      </div>
    </div>
  );
}
