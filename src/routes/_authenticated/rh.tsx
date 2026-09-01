import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listPartners, savePartner, deletePartner,
  listEmployeesRH, updateEmployeeRH, createEmployeeRH, deleteEmployeeRH,
  generatePayroll, listPayslips,
  listProductivityServices, saveProductivityService, deleteProductivityService,
  listProductivityPayout, markProductivityPaid,
} from "@/lib/rh.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Pencil, Plus, Play } from "lucide-react";
import { ProductivityRulesTab } from "@/components/rh-productivity-rules";


export const Route = createFileRoute("/_authenticated/rh")({
  head: () => ({
    meta: [
      { title: "RH & Folha — Porcelane" },
      { name: "description", content: "Colaboradores, parceiros, comissões e folha de pagamento integrada." },
      { property: "og:title", content: "RH & Folha — Porcelane" },
      { property: "og:description", content: "Módulo de RH e folha da Porcelane." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RHPage,
});

const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RHPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">RH & Folha de Pagamento</h1>
        <p className="text-sm text-stone-500">Colaboradores, parceiros externos e geração automática de folha.</p>
      </div>
      <Tabs defaultValue="colaboradores">
        <TabsList>
          <TabsTrigger value="colaboradores">Colaboradores</TabsTrigger>
          <TabsTrigger value="parceiros">Parceiros</TabsTrigger>
          <TabsTrigger value="regras">Regras de Produtividade</TabsTrigger>
          <TabsTrigger value="servicos">Serviços de Produtividade</TabsTrigger>
          <TabsTrigger value="payout">Produtividade a Pagar</TabsTrigger>
          <TabsTrigger value="folha">Folha / Contracheques</TabsTrigger>
        </TabsList>
        <TabsContent value="colaboradores" className="mt-4"><ColaboradoresTab /></TabsContent>
        <TabsContent value="parceiros" className="mt-4"><ParceirosTab /></TabsContent>
        <TabsContent value="regras" className="mt-4"><ProductivityRulesTab /></TabsContent>
        <TabsContent value="servicos" className="mt-4"><ServicosTab /></TabsContent>
        <TabsContent value="payout" className="mt-4"><PayoutTab /></TabsContent>
        <TabsContent value="folha" className="mt-4"><FolhaTab /></TabsContent>
      </Tabs>

    </div>
  );
}

/* -------------------- Colaboradores -------------------- */

const EMP_ROLES = [
  { v: "tecnico", l: "Técnico" },
  { v: "corte", l: "Corte" },
  { v: "acabamento", l: "Acabamento" },
  { v: "expedicao", l: "Expedição" },
  { v: "instalador", l: "Instalador" },
  { v: "administrativo", l: "Administrativo" },
  { v: "gerente_producao", l: "Gerente de Produção" },
];
const roleLabel = (v: string) => EMP_ROLES.find((r) => r.v === v)?.l ?? v;

const PROD_TYPES = [
  { v: "percent", l: "% sobre produção" },
  { v: "per_m2", l: "R$ por m²" },
  { v: "per_env", l: "R$ por ambiente" },
  { v: "fixed", l: "Valor fixo (R$)" },
];
const prodLabel = (type: string, value: number) =>
  type === "percent" ? `${Number(value || 0)}%` : money(Number(value || 0));

function maskCPF(v: string) {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

const EMPTY_EMP = {
  name: "", role: "corte", cpf: "", phone: "", email: "", pix_key: "", login: "", pin: "",
  hire_date: "", base_salary: 0, productivity_type: "per_env", productivity_value: 0,
  commission_type: "percent", commission_value: 0, notes: "", active: true,
};

function ColaboradoresTab() {
  const list = useServerFn(listEmployeesRH);
  const update = useServerFn(updateEmployeeRH);
  const create = useServerFn(createEmployeeRH);
  const del = useServerFn(deleteEmployeeRH);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["rh-employees"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_EMP);

  const refresh = () => qc.invalidateQueries({ queryKey: ["rh-employees"] });

  const mut = useMutation({
    mutationFn: async (d: any): Promise<unknown> => (d.id ? update({ data: d }) : create({ data: d })),
    onSuccess: () => { toast.success("Colaborador salvo"); refresh(); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Colaborador removido"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const openNew = () => { setForm({ ...EMPTY_EMP }); setOpen(true); };
  const openEdit = (e: any) => { setForm({ ...EMPTY_EMP, ...e, hire_date: e.hire_date ?? "" }); setOpen(true); };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-stone-500">
          Cadastro completo de colaboradores — dados pessoais, acesso ao portal, salário e produtividade individual.
        </p>
        <Button size="sm" onClick={openNew}><Plus className="size-3 mr-1" /> Novo colaborador</Button>
      </div>

      {isLoading ? <div>Carregando…</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b">
              <tr>
                <th className="p-2">Nome</th><th className="p-2">Função</th>
                <th className="p-2">CPF</th><th className="p-2">Telefone</th><th className="p-2">PIX</th>
                <th className="p-2">Salário base</th><th className="p-2">Produtividade</th>
                <th className="p-2">Comissão</th><th className="p-2">Ativo</th><th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((e: any) => (
                <tr key={e.id} className="border-b">
                  <td className="p-2 font-medium">{e.name}</td>
                  <td className="p-2">{roleLabel(e.role)}</td>
                  <td className="p-2">{e.cpf ?? "—"}</td>
                  <td className="p-2">{e.phone ?? "—"}</td>
                  <td className="p-2">{e.pix_key ?? "—"}</td>
                  <td className="p-2">{money(e.base_salary ?? 0)}</td>
                  <td className="p-2">{prodLabel(e.productivity_type, e.productivity_value)}</td>
                  <td className="p-2">{e.commission_type === "percent" ? `${e.commission_value ?? 0}%` : money(e.commission_value ?? 0)}</td>
                  <td className="p-2">{e.active ? "Sim" : "Não"}</td>
                  <td className="p-2 flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(e)}><Pencil className="size-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => { if (confirm(`Remover ${e.name}?`)) delMut.mutate(e.id); }}>
                      <Trash2 className="size-3" />
                    </Button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && <tr><td className="p-4 text-stone-500" colSpan={10}>Nenhum colaborador cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? `Editar ${form.name}` : "Novo colaborador"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Função</Label>
              <Select value={form.role ?? "corte"} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMP_ROLES.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>CPF (login do portal)</Label><Input value={form.cpf ?? ""} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Chave PIX</Label><Input value={form.pix_key ?? ""} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} /></div>
            <div><Label>Login (opcional)</Label><Input value={form.login ?? ""} onChange={(e) => setForm({ ...form, login: e.target.value })} /></div>
            <div><Label>PIN (opcional)</Label><Input value={form.pin ?? ""} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></div>
            <div><Label>Data admissão</Label><Input type="date" value={form.hire_date ?? ""} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
            <div><Label>Salário base (R$)</Label><Input type="number" step="0.01" value={form.base_salary ?? 0} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} /></div>
            <div>
              <Label>Produtividade — tipo</Label>
              <Select value={form.productivity_type ?? "per_env"} onValueChange={(v) => setForm({ ...form, productivity_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROD_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Produtividade — {form.productivity_type === "percent" ? "percentual (%)" : "valor (R$)"}</Label>
              <Input type="number" step="0.01" value={form.productivity_value ?? 0}
                onChange={(e) => setForm({ ...form, productivity_value: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Tipo comissão</Label>
              <Select value={form.commission_type ?? "percent"} onValueChange={(v) => setForm({ ...form, commission_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROD_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>{form.commission_type === "percent" ? "Comissão (%)" : "Comissão (R$)"}</Label>
              <Input type="number" step="0.01" value={form.commission_value ?? 0}
                onChange={(e) => setForm({ ...form, commission_value: Number(e.target.value) })} />
            </div>
            <div className="col-span-2"><Label>Observações</Label><Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            {form.id && (
              <div className="col-span-2 flex items-center gap-2">
                <input id="emp-active" type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                <Label htmlFor="emp-active">Colaborador ativo</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!form.name?.trim()) { toast.error("Informe o nome"); return; }
                const base = {
                  name: form.name, role: form.role, cpf: form.cpf || null,
                  phone: form.phone || null, email: form.email || null, pix_key: form.pix_key || null,
                  login: form.login || null, pin: form.pin || null,
                  hire_date: form.hire_date || null, base_salary: Number(form.base_salary || 0),
                  productivity_type: form.productivity_type, productivity_value: Number(form.productivity_value || 0),
                  commission_type: form.commission_type, commission_value: Number(form.commission_value || 0),
                  notes: form.notes || null,
                };
                mut.mutate(form.id ? { id: form.id, active: !!form.active, ...base } : base);
              }}
              disabled={mut.isPending}
            >Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}


/* -------------------- Parceiros -------------------- */

function ParceirosTab() {
  const list = useServerFn(listPartners);
  const save = useServerFn(savePartner);
  const del = useServerFn(deletePartner);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["partners"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ name: "", kind: "arquiteto", commission_type: "percent", commission_value: 5, active: true });

  const saveMut = useMutation({
    mutationFn: (d: any) => save({ data: d }),
    onSuccess: () => { toast.success("Parceiro salvo"); qc.invalidateQueries({ queryKey: ["partners"] }); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["partners"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const openNew = () => { setForm({ name: "", kind: "arquiteto", commission_type: "percent", commission_value: 5, active: true }); setEditing({}); };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex justify-end">
        <Button onClick={openNew}><Plus className="size-4 mr-1" /> Novo parceiro</Button>
      </div>
      {isLoading ? <div>Carregando…</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b">
              <tr><th className="p-2">Nome</th><th className="p-2">Tipo</th><th className="p-2">Contato</th><th className="p-2">PIX</th><th className="p-2">Comissão</th><th className="p-2"></th></tr>
            </thead>
            <tbody>
              {data.map((p: any) => (
                <tr key={p.id} className="border-b">
                  <td className="p-2 font-medium">{p.name}</td>
                  <td className="p-2">{p.kind}</td>
                  <td className="p-2">{p.phone ?? p.email ?? "—"}</td>
                  <td className="p-2">{p.pix_key ?? "—"}</td>
                  <td className="p-2">{p.commission_type === "percent" ? `${p.commission_value ?? 0}%` : money(p.commission_value ?? 0)}</td>
                  <td className="p-2 flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setForm(p); setEditing(p); }}><Pencil className="size-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => delMut.mutate(p.id)}><Trash2 className="size-3" /></Button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && <tr><td className="p-4 text-stone-500" colSpan={6}>Nenhum parceiro cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Editar parceiro" : "Novo parceiro"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.kind ?? "arquiteto"} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="arquiteto">Arquiteto(a)</SelectItem>
                  <SelectItem value="projetista">Projetista</SelectItem>
                  <SelectItem value="vendedor_externo">Vendedor externo</SelectItem>
                  <SelectItem value="indicador">Indicador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Documento</Label><Input value={form.document ?? ""} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Chave PIX</Label><Input value={form.pix_key ?? ""} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} /></div>
            <div>
              <Label>Tipo comissão</Label>
              <Select value={form.commission_type ?? "percent"} onValueChange={(v) => setForm({ ...form, commission_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">% sobre pedido</SelectItem>
                  <SelectItem value="fixed">Valor fixo por pedido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor</Label><Input type="number" step="0.01" value={form.commission_value ?? 0} onChange={(e) => setForm({ ...form, commission_value: Number(e.target.value) })} /></div>
            <div className="col-span-2"><Label>Observações</Label><Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.name}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* -------------------- Folha -------------------- */

function FolhaTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const gen = useServerFn(generatePayroll);
  const list = useServerFn(listPayslips);
  const qc = useQueryClient();

  const key = ["payslips", year, month];
  const { data = [], isFetching } = useQuery({ queryKey: key, queryFn: () => list({ data: { year, month } }) });

  const mut = useMutation({
    mutationFn: () => gen({ data: { year, month } }),
    onSuccess: () => { toast.success("Folha gerada e integrada ao Financeiro"); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const total = data.reduce((a: number, b: any) => a + Number(b.net_total || 0), 0);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><Label>Ano</Label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" /></div>
        <div>
          <Label>Mês</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          <Play className="size-4 mr-1" /> {mut.isPending ? "Gerando…" : "Gerar folha do mês"}
        </Button>
        <div className="ml-auto text-sm text-stone-500">
          Total líquido: <span className="font-bold text-stone-900">{money(total)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b">
            <tr><th className="p-2">Colaborador</th><th className="p-2">Função</th><th className="p-2">Salário</th><th className="p-2">Comissões</th><th className="p-2">Líquido</th><th className="p-2">Status</th></tr>
          </thead>
          <tbody>
            {isFetching && <tr><td className="p-4 text-stone-500" colSpan={6}>Carregando…</td></tr>}
            {!isFetching && data.length === 0 && <tr><td className="p-4 text-stone-500" colSpan={6}>Sem contracheques para {String(month).padStart(2, "0")}/{year}. Clique em “Gerar folha”.</td></tr>}
            {data.map((p: any) => (
              <tr key={p.id} className="border-b">
                <td className="p-2 font-medium">{p.employees?.name ?? "—"}</td>
                <td className="p-2">{p.employees?.role ?? "—"}</td>
                <td className="p-2">{money(p.base_salary)}</td>
                <td className="p-2">{money(p.commissions_total)}</td>
                <td className="p-2 font-semibold">{money(p.net_total)}</td>
                <td className="p-2">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">
        A geração da folha cria automaticamente as contas a pagar em <b>Financeiro → A Pagar</b>, vinculadas ao contracheque de cada colaborador.
      </p>
    </Card>
  );
}

/* -------------------- Serviços de Produtividade -------------------- */

function ServicosTab() {
  const list = useServerFn(listProductivityServices);
  const save = useServerFn(saveProductivityService);
  const del = useServerFn(deleteProductivityService);
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["prod-services"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);
  const empty = { name: "", applies_to: "cortador", pricing_kind: "per_unit", unit_price: 0, active: true, notes: "" };
  const [form, setForm] = useState<any>(empty);

  const saveMut = useMutation({
    mutationFn: (d: any) => save({ data: d }),
    onSuccess: () => { toast.success("Serviço salvo"); qc.invalidateQueries({ queryKey: ["prod-services"] }); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["prod-services"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const openNew = () => { setForm(empty); setEditing({}); };
  const labelKind = (k: string) => k === "per_m2_national" ? "R$ / m² (Nacional)" : k === "per_m2_imported" ? "R$ / m² (Importado)" : "R$ por unidade";
  const labelApplies = (a: string) => a === "ambos" ? "Cortador + Acabador" : a.charAt(0).toUpperCase() + a.slice(1);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Catálogo de serviços que geram produtividade</h3>
          <p className="text-xs text-stone-500">Cortador/Acabador: abertura de cuba, nicho, divi box, furos, polimento etc. — valor por unidade. Montador: instalação por m² (Nacional/Importado) e adicionais fixos (torre, tomada, cooktop, furos especiais).</p>
        </div>
        <Button onClick={openNew}><Plus className="size-4 mr-1" /> Novo serviço</Button>
      </div>

      {isLoading ? <div>Carregando…</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left border-b">
              <tr><th className="p-2">Serviço</th><th className="p-2">Aplica a</th><th className="p-2">Tipo</th><th className="p-2">Valor</th><th className="p-2">Ativo</th><th className="p-2"></th></tr>
            </thead>
            <tbody>
              {data.map((s: any) => (
                <tr key={s.id} className="border-b">
                  <td className="p-2 font-medium">{s.name}</td>
                  <td className="p-2">{labelApplies(s.applies_to)}</td>
                  <td className="p-2">{labelKind(s.pricing_kind)}</td>
                  <td className="p-2">{money(s.unit_price)}</td>
                  <td className="p-2">{s.active ? "Sim" : "Não"}</td>
                  <td className="p-2 flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setForm(s); setEditing(s); }}><Pencil className="size-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => delMut.mutate(s.id)}><Trash2 className="size-3" /></Button>
                  </td>
                </tr>
              ))}
              {data.length === 0 && <tr><td className="p-4 text-stone-500" colSpan={6}>Nenhum serviço cadastrado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.id ? "Editar serviço" : "Novo serviço"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nome do serviço</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Abertura de cuba, Instalação Nacional, Recorte cooktop…" /></div>
            <div>
              <Label>Aplica a</Label>
              <Select value={form.applies_to ?? "cortador"} onValueChange={(v) => setForm({ ...form, applies_to: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cortador">Cortador</SelectItem>
                  <SelectItem value="acabador">Acabador</SelectItem>
                  <SelectItem value="ambos">Cortador + Acabador</SelectItem>
                  <SelectItem value="montador">Montador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de valor</Label>
              <Select value={form.pricing_kind ?? "per_unit"} onValueChange={(v) => setForm({ ...form, pricing_kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_unit">R$ por unidade (fixo)</SelectItem>
                  <SelectItem value="per_m2_national">R$ por m² — Material Nacional</SelectItem>
                  <SelectItem value="per_m2_imported">R$ por m² — Material Importado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.unit_price ?? 0} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.active ? "1" : "0"} onValueChange={(v) => setForm({ ...form, active: v === "1" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Ativo</SelectItem>
                  <SelectItem value="0">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Observações</Label><Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate({
              id: form.id, name: form.name, applies_to: form.applies_to,
              pricing_kind: form.pricing_kind, unit_price: Number(form.unit_price || 0),
              active: !!form.active, notes: form.notes || null,
            })} disabled={saveMut.isPending || !form.name}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* -------------------- Produtividade a Pagar -------------------- */

function PayoutTab() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const [from, setFrom] = useState(firstDay.slice(0, 10));
  const [to, setTo] = useState(lastDay.slice(0, 10));
  const [status, setStatus] = useState<"a_pagar" | "pago" | "todos">("a_pagar");
  const list = useServerFn(listProductivityPayout);
  const pay = useServerFn(markProductivityPaid);
  const qc = useQueryClient();

  const key = ["prod-payout", from, to, status];
  const { data = [], isFetching } = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { from: from + "T00:00:00Z", to: to + "T23:59:59Z", status } }),
  });

  const [sel, setSel] = useState<Record<string, boolean>>({});
  const selectedIds = Object.entries(sel).filter(([, v]) => v).map(([k]) => k);

  const payMut = useMutation({
    mutationFn: () => pay({ data: { ids: selectedIds } }),
    onSuccess: (r: any) => { toast.success(`${r.count} lançamento(s) marcado(s) como pago`); setSel({}); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  // Agrupar por colaborador
  const grouped: Record<string, { name: string; role: string; rows: any[]; total: number }> = {};
  for (const r of data as any[]) {
    const k = r.employee_id ?? "sem";
    if (!grouped[k]) grouped[k] = { name: r.employees?.name ?? "—", role: r.employees?.role ?? "—", rows: [], total: 0 };
    grouped[k].rows.push(r);
    grouped[k].total += Number(r.commission_value || 0);
  }
  const totalGeral = Object.values(grouped).reduce((a, g) => a + g.total, 0);

  // Seleção de colaboradores para relatório
  const [empSel, setEmpSel] = useState<Record<string, boolean>>({});
  const allEmpIds = Object.keys(grouped);
  const allSelected = allEmpIds.length > 0 && allEmpIds.every((id) => empSel[id]);
  const toggleAll = () => {
    if (allSelected) setEmpSel({});
    else setEmpSel(Object.fromEntries(allEmpIds.map((id) => [id, true])));
  };
  const selectedEmpIds = allEmpIds.filter((id) => empSel[id]);

  function gerarPDF(ids: string[]) {
    if (!ids.length) { toast.error("Nenhum colaborador para imprimir"); return; }
    const periodo = `${new Date(from).toLocaleDateString("pt-BR")} a ${new Date(to).toLocaleDateString("pt-BR")}`;
    const totalSel = ids.reduce((a, id) => a + (grouped[id]?.total ?? 0), 0);
    const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    const blocos = ids.map((id) => {
      const g = grouped[id]; if (!g) return "";
      const rows = g.rows.map((r: any) => `
        <tr>
          <td>${new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
          <td>#${esc(r.orders?.number ?? "—")} · ${esc(r.orders?.client_name ?? "")}</td>
          <td>${esc(r.env_name)} / ${esc(r.env_material)}</td>
          <td>${esc(r.kind)}</td>
          <td class="r">${r.gross_value != null ? money(r.gross_value) : "—"}</td>
          <td class="r">${r.discount_pct != null ? (Number(r.discount_pct) * 100).toFixed(1) + "%" : "—"}</td>
          <td class="r">${r.base_value != null ? money(r.base_value) : "—"}</td>
          <td class="r"><b>${money(r.commission_value)}</b></td>
          <td>${esc(r.payout_status)}</td>
        </tr>`).join("");
      return `
        <section class="bloco">
          <div class="cab">
            <div><div class="nome">${esc(g.name)}</div><div class="fn">${esc(g.role)}</div></div>
            <div class="tot">Total: <b>${money(g.total)}</b></div>
          </div>
          <table>
            <thead><tr>
              <th>Data</th><th>Pedido</th><th>Ambiente / Material</th><th>Etapa</th>
              <th class="r">Valor original</th><th class="r">Desc.</th><th class="r">Base</th>
              <th class="r">Comissão</th><th>Status</th>
            </tr></thead>
            <tbody>${rows || `<tr><td colspan="9" class="vazio">Sem lançamentos</td></tr>`}</tbody>
          </table>
        </section>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Produtividade — ${esc(periodo)}</title>
      <style>
        *{box-sizing:border-box} body{font-family:Inter,system-ui,sans-serif;color:#1a1a1a;margin:24px;font-size:12px}
        h1{font-family:'Playfair Display',serif;font-size:22px;margin:0 0 4px}
        .meta{color:#666;margin-bottom:16px;font-size:11px}
        .resumo{margin:8px 0 20px;padding:8px 12px;background:#f2f2f2;border:1px solid #d9d9d9;border-radius:6px;display:flex;justify-content:space-between}
        .bloco{margin-bottom:20px;break-inside:avoid;border:1px solid #d9d9d9;border-radius:6px;overflow:hidden}
        .cab{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f2f2f2;border-bottom:1px solid #d9d9d9}
        .nome{font-weight:600;font-size:13px} .fn{color:#666;font-size:10px}
        .tot{font-size:12px}
        table{width:100%;border-collapse:collapse}
        th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left;font-size:11px}
        th{background:#fafafa;font-weight:600}
        .r{text-align:right} .vazio{text-align:center;color:#999;padding:12px}
        @media print{@page{size:A4;margin:0} body{margin:0;padding:12mm}}
      </style></head><body>
      <h1>Relatório de Produtividade</h1>
      <div class="meta">Período: ${esc(periodo)} · Status: ${esc(status)} · ${ids.length} colaborador(es)</div>
      <div class="resumo"><span>Total geral (selecionados)</span><b>${money(totalSel)}</b></div>
      ${blocos}
      <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Permita pop-ups para gerar o PDF"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a_pagar">A pagar</SelectItem>
              <SelectItem value="pago">Pagos</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button disabled={!selectedIds.length || payMut.isPending} onClick={() => payMut.mutate()}>
          Marcar {selectedIds.length || ""} como pago(s)
        </Button>
        <Button variant="outline" onClick={toggleAll} disabled={!allEmpIds.length}>
          {allSelected ? "Desmarcar todos" : "Selecionar todos"}
        </Button>
        <Button variant="outline" onClick={() => gerarPDF(selectedEmpIds.length ? selectedEmpIds : allEmpIds)} disabled={!allEmpIds.length}>
          Gerar PDF ({selectedEmpIds.length || allEmpIds.length})
        </Button>
        <div className="ml-auto text-sm text-stone-500">
          Total: <span className="font-bold text-stone-900">{money(totalGeral)}</span>
        </div>
      </div>

      <p className="text-xs text-stone-500">
        Valores calculados sobre o <b>valor diluído por ambiente/serviço após desconto</b> do pedido.
        Esta lista é <b>separada do contracheque</b> — salário base e descontos permanecem no módulo Folha.
      </p>

      {isFetching && <div className="text-sm text-stone-500">Carregando…</div>}

      {Object.entries(grouped).map(([empId, g]) => (
        <div key={empId} className="border rounded-md">
          <div className="flex items-center justify-between px-3 py-2 bg-stone-100">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!empSel[empId]}
                onChange={(e) => setEmpSel({ ...empSel, [empId]: e.target.checked })}
              />
              <div className="font-semibold">{g.name} <span className="text-xs text-stone-500 font-normal">({g.role})</span></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm">Total: <b>{money(g.total)}</b></div>
              <Button size="sm" variant="ghost" onClick={() => gerarPDF([empId])}>PDF</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left border-b bg-stone-50">
                <tr>
                  <th className="p-2 w-8"></th>
                  <th className="p-2">Data</th>
                  <th className="p-2">Pedido</th>
                  <th className="p-2">Ambiente / Material</th>
                  <th className="p-2">Etapa</th>
                  <th className="p-2 text-right">Valor original</th>
                  <th className="p-2 text-right">Desc.</th>
                  <th className="p-2 text-right">Base</th>
                  <th className="p-2 text-right">Comissão</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r: any) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">
                      {r.payout_status === "a_pagar" && (
                        <input type="checkbox" checked={!!sel[r.id]} onChange={(e) => setSel({ ...sel, [r.id]: e.target.checked })} />
                      )}
                    </td>
                    <td className="p-2">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-2">#{r.orders?.number ?? "—"} · {r.orders?.client_name ?? ""}</td>
                    <td className="p-2">{r.env_name} <span className="text-stone-500">/ {r.env_material}</span></td>
                    <td className="p-2">{r.kind}</td>
                    <td className="p-2 text-right">{r.gross_value != null ? money(r.gross_value) : "—"}</td>
                    <td className="p-2 text-right">{r.discount_pct != null ? `${(Number(r.discount_pct) * 100).toFixed(1)}%` : "—"}</td>
                    <td className="p-2 text-right">{r.base_value != null ? money(r.base_value) : "—"}</td>
                    <td className="p-2 text-right font-medium">{money(r.commission_value)}</td>
                    <td className="p-2">
                      <span className={r.payout_status === "pago" ? "text-green-700" : r.payout_status === "cancelado" ? "text-stone-400" : "text-amber-700"}>
                        {r.payout_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {!isFetching && Object.keys(grouped).length === 0 && (
        <div className="text-sm text-stone-500 p-4">Nenhum lançamento no período.</div>
      )}
    </Card>
  );
}
