import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export function createClient() {
  const { url, key } = getSupabasePublicConfig();
  if (!url || !key) throw new Error("Supabase public environment variables are unavailable.");

  return createBrowserClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
