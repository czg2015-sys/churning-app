import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export async function createClient() {
  const { url, key } = getSupabasePublicConfig();
  if (!url || !key) throw new Error("Supabase public environment variables are unavailable.");

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
        catch { /* Proxy refreshes cookies when Server Components cannot write them. */ }
      },
    },
  });
}
