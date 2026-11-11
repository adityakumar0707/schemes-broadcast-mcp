import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

// Creates the account AND signs the user in, in one request.
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string" || password.length < 6)
    return NextResponse.json({ error: "Valid email and a password of 6+ chars required" }, { status: 400 });
  const admin = supabaseAdmin();
  // The distributor id is generated up front and stored in the user's app_metadata, so every later request
  // can read it from the signed token instead of querying the database. email_confirm skips the confirmation mail.
  const distributorId = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { distributor_id: distributorId } });
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? "Signup failed" }, { status: 400 });

  const [ins, signIn] = await Promise.all([
    admin.from("distributors").insert({ id: distributorId, email, user_id: data.user.id }),
    supabaseServer().auth.signInWithPassword({ email, password }),
  ]);
  if (ins.error) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: ins.error.message }, { status: 400 });
  }
  if (signIn.error) return NextResponse.json({ error: signIn.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
