import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, RefreshCw, HardDriveDownload } from "lucide-react";
import { generateDailyBackup, listBackups, getBackupDownloadUrl } from "@/lib/backups.functions";
import { fmtDate } from "@/lib/format";
import { useMyRoles } from "@/lib/roles";

function Page() {
  const perms = useMyRoles();
  const qc = useQueryClient();
  const list = useServerFn(listBackups);
  const gen = useServerFn(generateDailyBackup);
  const sign = useServerFn(getBackupDownloadUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["backups"],
    queryFn: () => list(),
    enabled: perms.isAdmin,
  });

  const generate = useMutation({
    mutationFn: () => gen(),
    onSuccess: () => {
      toast.success("Backup gerado.");
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao gerar backup."),
  });

  const download = async (path: string) => {
    try {
      const { url } = await sign({ data: { path } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar link.");
    }
  };

  if (!perms.isAdmin) {
    return <div className="p-10 text-sm text-stone-500">Acesso restrito a administradores.</div>;
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl mb-1">Backups</h1>
          <p className="text-sm text-stone-500">
            Snapshots completos do banco (JSON). Recomendado gerar diariamente às 20h.
            Arquivos ficam em bucket privado — só admin acessa via link temporário.
          </p>
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="bg-stone-950 text-white text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-60"
        >
          {generate.isPending ? <RefreshCw className="size-4 animate-spin" /> : <HardDriveDownload className="size-4" />}
          Gerar backup agora
        </button>
      </div>

      {isLoading ? (
        <div className="text-sm text-stone-500">Carregando…</div>
      ) : !data?.length ? (
        <div className="border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
          Nenhum backup gerado ainda.
        </div>
      ) : (
        <div className="border border-stone-200 bg-white divide-y divide-stone-100">
          {data.map((r: any) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium text-sm">{fmtDate(r.created_at)} — {new Date(r.created_at).toLocaleTimeString("pt-BR")}</div>
                <div className="text-xs text-stone-500 truncate">
                  {r.total_rows} registros · {Array.isArray(r.tables) ? r.tables.length : 0} tabelas
                </div>
              </div>
              <button
                onClick={() => download(r.storage_path)}
                className="text-xs border border-stone-300 px-3 py-1.5 flex items-center gap-1.5 hover:bg-stone-50"
              >
                <Download className="size-3.5" /> Baixar JSON
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/configuracoes/backups")({
  component: Page,
});
