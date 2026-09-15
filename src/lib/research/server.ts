import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

function getResearchSecretKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
}

export function getResearchAdminEmails() {
  return (process.env.RESEARCH_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isResearchAdminEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return Boolean(normalized && getResearchAdminEmails().includes(normalized));
}

export function hasResearchServerConfig() {
  const { url } = getSupabasePublicConfig();
  return Boolean(url && getResearchSecretKey());
}

export function createResearchAdminClient() {
  const { url } = getSupabasePublicConfig();
  const secretKey = getResearchSecretKey();

  if (!url || !secretKey) {
    throw new Error(
      "Research Agent server credentials are missing. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  return createSupabaseClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export type ResearchAdminSession = {
  configured: boolean;
  authorized: boolean;
  userId: string | null;
  email: string | null;
};

export async function getResearchAdminSession(): Promise<ResearchAdminSession> {
  const adminEmails = getResearchAdminEmails();
  const configured = adminEmails.length > 0;

  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  const email = user?.email?.trim().toLowerCase() || null;
  const authorized = Boolean(configured && isResearchAdminEmail(email));

  return {
    configured,
    authorized,
    userId: user?.id || null,
    email,
  };
}
