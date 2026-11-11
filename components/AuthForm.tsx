"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Warm up the dashboard route while the user types.
  useEffect(() => { router.prefetch("/dashboard"); }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      // One server request signs in (or signs up and signs in) and sets the cookies.
      const r = await fetch(mode === "signup" ? "/api/signup" : "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "Something went wrong"); setBusy(false); return; }
      router.replace("/dashboard");
    } catch { setError("Network error. Try again."); setBusy(false); }
  }

  return (
    <main className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="mb-1 text-2xl font-bold">Scheme Broadcast</h1>
      <p className="mb-6 text-sm text-gray-600">{mode === "login" ? "Log in to your distributor account" : "Create your distributor account"}</p>
      <form onSubmit={submit} className="card space-y-3">
        <input className="input" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Password (min 6 chars)" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? (mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Log in" : "Sign up"}</button>
      </form>
      <p className="mt-4 text-center text-sm">
        {mode === "login" ? <>New here? <Link className="text-emerald-700 underline" href="/signup">Sign up</Link></> : <>Have an account? <Link className="text-emerald-700 underline" href="/login">Log in</Link></>}
      </p>
    </main>
  );
}
