import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Verifies a Supabase access token locally against the project's public signing keys (JWKS), with no
 * network call per request. The key set is fetched once per server instance and cached.
 * Works on the Edge runtime (middleware) and Node. Returns null if the token is invalid/expired,
 * or if the project uses legacy symmetric keys (callers then fall back to supabase.auth.getUser()).
 */
const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const jwks = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`), { cacheMaxAge: 60 * 60 * 1000, timeoutDuration: 4000 });

export type Claims = { sub: string; email?: string; app_metadata?: { distributor_id?: string } };

export async function verifyAccessToken(token: string | undefined | null): Promise<Claims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: `${base}/auth/v1`, audience: "authenticated" });
    return payload as unknown as Claims;
  } catch {
    return null;
  }
}
