import type { Environment } from "@/lib/types";
import { TECH_CHECKLIST, TECH_CHECK_STATUS, checklistProgress, type TechCheckStatus } from "@/lib/tech-checklist";

export function TechChecklistPanel({
  env,
  onUpdateEnv,
}: {
  env: Environment;
  onUpdateEnv: (envId: string, patch: Partial<Environment>) => void;
}) {
  const map = env.tech_checklist ?? {};
  const { done, total, pct } = checklistProgress(map);
  const status = (env.tech_check_status ?? "pendente") as TechCheckStatus;
  const releases = env.tech_releases ?? [];

  const toggle = (key: string) =>
    onUpdateEnv(env.id, { tech_checklist: { ...map, [key]: !map[key] } });

  return (
    <div className="bg-white border border-stone-200 p-5 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h4 className="label-eyebrow">Checklist de conferência</h4>
          <p className="text-xs text-stone-500 mt-1">{done} de {total} itens conferidos</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="label-eyebrow">Status</label>
          <select
            value={status}
            onChange={(e) => onUpdateEnv(env.id, { tech_check_status: e.target.value as TechCheckStatus })}
            className="border border-stone-300 px-2 py-1.5 text-xs bg-white"
          >
            {TECH_CHECK_STATUS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {TECH_CHECKLIST.map((c) => (
          <li key={c.key}>
            <label className="flex items-start gap-2 text-xs text-stone-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!map[c.key]}
                onChange={() => toggle(c.key)}
                className="size-3.5 mt-0.5 accent-stone-950"
              />
              <span className={map[c.key] ? "line-through text-stone-400" : ""}>{c.label}</span>
            </label>
          </li>
        ))}
      </ul>

      {releases.length > 0 && (
        <div className="pt-3 border-t border-stone-200">
          <h5 className="label-eyebrow mb-2">Histórico de liberações</h5>
          <ul className="space-y-1 text-xs text-stone-600">
            {releases.slice().reverse().map((r, i) => (
              <li key={i} className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-stone-950">V{r.version}</span>
                <span>{new Date(r.at).toLocaleString("pt-BR")}</span>
                <span className="text-stone-400">·</span>
                <span>{r.by || "—"}</span>
                {r.note && <span className="text-stone-400">— {r.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
