import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Signs in on the server and sets the session cookies in one request (no Supabase JS needed in the browser).
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  const { error } = await supabaseServer().auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
