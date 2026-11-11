import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// TEMPORARY diagnostic: time 3 sequential DB round trips from the serverless function.
export async function GET() {
  const db = supabaseAdmin();
  const t: number[] = [];
  for (let i = 0; i < 3; i++) {
    const s = Date.now();
    await db.from("distributors").select("id").limit(1);
    t.push(Date.now() - s);
  }
  return Response.json({ region: process.env.VERCEL_REGION ?? "local", dbRoundTripsMs: t });
}
