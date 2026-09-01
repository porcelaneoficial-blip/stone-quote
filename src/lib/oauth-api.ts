import { supabase } from "@/integrations/supabase/client";

export type OAuthClient = { name?: string | null } | null | undefined;
export type AuthorizationDetails = {
  client?: OAuthClient;
  redirect_url?: string | null;
  redirect_to?: string | null;
} | null;

export type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails; error: { message: string } | null }>;
};

export function getOAuthApi(): OAuthApi {
  const oauth = (supabase.auth as unknown as { oauth?: OAuthApi }).oauth;
  if (!oauth) throw new Error("Supabase OAuth API não está disponível neste cliente.");
  return oauth;
}
