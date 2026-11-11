import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

/** Resolves the logged-in user to their distributors row (RLS-scoped client). */
export async function requireDistributor() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: distributor } = await sb.from("distributors").select("*").eq("user_id", user.id).single();
  if (!distributor) redirect("/login");
  return { sb, distributor };
}
