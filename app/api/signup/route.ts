import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string" || password.length < 6)
    return NextResponse.json({ error: "Valid email and a password of 6+ chars required" }, { status: 400 });
  const admin = supabaseAdmin();
  // email_confirm: true skips the confirmation mail so the demo flow works immediately.
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Signup failed" }, { status: 400 });
  const { error: dErr } = await admin.from("distributors").insert({ email, user_id: data.user.id });
  if (dErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: dErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
