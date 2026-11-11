import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Session-scoped client (anon key + user cookies) — subject to RLS. */
export function supabaseServer() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* server component: ignore */ }
      },
    },
  });
}
