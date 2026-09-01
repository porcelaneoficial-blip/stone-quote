// Auto-preenchimento por CEP (ViaCEP) e CNPJ (BrasilAPI)
export type CepData = {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
};

export async function fetchCep(cep: string): Promise<CepData | null> {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    const j = await r.json();
    if (j.erro) return null;
    return j as CepData;
  } catch {
    return null;
  }
}

export type CnpjData = {
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  ddd_telefone_1: string;
  email: string;
};

export async function fetchCnpj(cnpj: string): Promise<CnpjData | null> {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (!r.ok) return null;
    return (await r.json()) as CnpjData;
  } catch {
    return null;
  }
}
