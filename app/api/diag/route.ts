import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// TEMPORARY diagnostic: times auth + RLS queries from inside the serverless function.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const out: Record<string, number | string> = { region: process.env.VERCEL_REGION ?? "local" };
  const time = async (k: string, fn: () => PromiseLike<unknown>) => { const s = Date.now(); await fn(); out[k] = Date.now() - s; };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  await time("ping_rest_ms", () => anon.from("distributors").select("id").limit(1));
  if (token) {
    await time("auth_getUser_1_ms", () => anon.auth.getUser(token));
    await time("auth_getUser_2_ms", () => anon.auth.getUser(token));
    const user = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    await time("rls_distributor_ms", () => user.from("distributors").select("*").single());
    await time("rls_offers_ms", () => user.from("offers").select("*, groups(name)"));
    await time("rls_products_ms", () => user.from("products").select("*"));
  }
  return Response.json(out);
}
