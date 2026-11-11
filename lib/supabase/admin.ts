import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server-only; bypasses RLS, so callers MUST scope queries themselves. */
export const supabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
