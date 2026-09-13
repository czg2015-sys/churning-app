export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    url: url?.trim() || "",
    key: key?.trim() || "",
  };
}

export function hasSupabasePublicConfig() {
  const { url, key } = getSupabasePublicConfig();
  return Boolean(url && key);
}
