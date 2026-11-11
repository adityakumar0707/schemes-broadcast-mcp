import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// TEMPORARY diagnostic: same session code path as the dashboard pages, timed step by step.
export async function GET() {
  const out: Record<string, number | string> = { region: process.env.VERCEL_REGION ?? "local" };
  const time = async <T,>(k: string, fn: () => PromiseLike<T>) => { const s = Date.now(); const r = await fn(); out[k] = Date.now() - s; return r; };
  const sb = supabaseServer();
  const { data: { user } } = await time("getUser_1_ms", () => sb.auth.getUser());
  await time("getUser_2_ms", () => sb.auth.getUser());
  await time("distributor_ms", () => sb.from("distributors").select("*").eq("user_id", user?.id ?? "").single());
  await time("offers_ms", () => sb.from("offers").select("*, groups(name)"));
  out.user = user ? "yes" : "no";
  return Response.json(out);
}
