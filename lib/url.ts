import { headers } from "next/headers";

/** Public base URL: NEXT_PUBLIC_APP_URL if set, else derived from the request host. */
export function baseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const waLink = (text: string, url: string) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
