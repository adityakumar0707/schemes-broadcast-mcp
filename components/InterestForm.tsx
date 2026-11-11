"use client";
import { useState } from "react";

export default function InterestForm({ slug }: { slug: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const r = await fetch(`/api/o/${slug}/interest`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, phone }) });
      setState(r.ok ? "done" : "error");
    } catch { setState("error"); }
  }

  if (state === "done") return <p className="rounded bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Thank you! The distributor will contact you.</p>;
  return (
    <form onSubmit={submit} className="space-y-2">
      <input className="input" placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      <input className="input" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" />
      {state === "error" && <p className="text-sm text-red-600">Something went wrong. Please try again.</p>}
      <button className="btn w-full" disabled={state === "busy"}>I&apos;m interested</button>
    </form>
  );
}
