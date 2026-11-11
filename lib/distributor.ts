import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";
import { verifyAccessToken, type Claims } from "./jwt";

/**
 * Resolves the logged-in user to their distributor, with ZERO network calls in the common case:
 *  - the session cookie is read locally and the JWT is verified locally (lib/jwt.ts)
 *  - the distributor id is stored in the token itself (app_metadata.distributor_id, writable only by
 *    the service role, so users cannot forge it; RLS still enforces ownership in the database)
 * Wrapped in React cache() so a layout and its page share one result per request.
 */
export const requireDistributor = cache(async () => {
  const sb = supabaseServer();
  const { data: { session } } = await sb.auth.getSession(); // cookie read; refreshes only if expired
  let claims: Claims | null = await verifyAccessToken(session?.access_token);

  if (!claims) {
    // Slow path (expired/legacy token): ask Supabase Auth.
    const { data: { user } } = await sb.auth.getUser();
    if (!user) redirect("/login");
    claims = { sub: user.id, email: user.email ?? undefined, app_metadata: user.app_metadata as Claims["app_metadata"] };
  }

  let distributorId = claims.app_metadata?.distributor_id;
  if (!distributorId) {
    // Older accounts: look it up once, then store it in the user's metadata so later tokens carry it.
    const { data } = await sb.from("distributors").select("id").eq("user_id", claims.sub).single();
    if (!data) redirect("/login");
    distributorId = data.id as string;
    void supabaseAdmin().auth.admin.updateUserById(claims.sub, { app_metadata: { distributor_id: distributorId } });
  }

  return { sb, userId: claims.sub, distributor: { id: distributorId, email: claims.email ?? "" } };
});
