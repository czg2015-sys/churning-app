import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

const protectedPaths = ["/my-plan", "/questionnaire", "/recommendations", "/cards"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const needsAuth = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path));

  const { url: supabaseUrl, key: supabaseKey } = getSupabasePublicConfig();
  if (!supabaseUrl || !supabaseKey) {
    console.error("[auth-proxy] Supabase environment variables are unavailable");
    if (!needsAuth) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let hasSession = false;
  try {
    const { data } = await supabase.auth.getClaims();
    hasSession = Boolean(data?.claims?.sub);
  } catch (error) {
    console.error("[auth-proxy] Session check failed", error instanceof Error ? error.message : String(error));
  }

  if (needsAuth && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
