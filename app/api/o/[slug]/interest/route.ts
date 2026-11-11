import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Public, unauthenticated insert into offer_clicks - only for APPROVED offers.
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const body = await req.json().catch(() => ({}));
  const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const db = supabaseAdmin();
  const { data: offer } = await db.from("offers").select("id").eq("share_link_slug", params.slug).eq("status", "approved").maybeSingle();
  if (!offer) return NextResponse.json({ error: "Offer not available" }, { status: 404 });
  const { error } = await db.from("offer_clicks").insert({
    offer_id: offer.id, interested: true, contact_name: clean(body.name, 100), phone: clean(body.phone, 20),
  });
  if (error) return NextResponse.json({ error: "Could not record" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
