import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";

/**
 * Gatekeeper for /dashboard. Reads the session cookie and verifies the JWT locally (no network call),
 * so it adds ~0 ms. If the token is expired, getSession() refreshes it and updates the cookies.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  const { data: { session } } = await supabase.auth.getSession();
  let ok = !!(await verifyAccessToken(session?.access_token));
  if (!ok && session) ok = !!(await supabase.auth.getUser()).data.user; // legacy-key fallback
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/dashboard/:path*"] };
