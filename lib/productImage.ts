/**
 * Finds a product pack-shot by name using free, key-less public product databases. Best effort:
 * returns null if nothing credible matches. No AI involved.
 *
 * Sources, in order:
 *  1. Open Food Facts "search-a-licious" (fast, generous limits)
 *  2. Open Products Facts legacy search (household / personal-care goods; rate-limited, so queued)
 *  3. Open Food Facts legacy search (rate-limited, so queued)
 */
const UA = { "User-Agent": "SchemesBroadcastMCP/0.1 (product image lookup)" };

const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1);

type Hit = { product_name?: string; image_front_url?: string };

/** Require every word of our product name to appear in the match, to avoid wrong pictures. */
function pick(hits: Hit[], name: string): string | null {
  const want = tokens(name);
  if (!want.length) return null;
  const hit = hits.find((p) => {
    if (!p.image_front_url || !p.product_name) return false;
    const have = new Set(tokens(p.product_name));
    return want.every((t) => have.has(t));
  });
  return hit?.image_front_url?.startsWith("https://") ? hit.image_front_url : null;
}

async function searchAli(name: string): Promise<string | null> {
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(name)}&page_size=10&fields=product_name,image_front_url`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: UA, cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { hits?: Hit[] };
  return pick(json.hits ?? [], name);
}

async function searchLegacy(base: string, name: string): Promise<string | null> {
  const url = `${base}/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,image_front_url`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: UA, cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { products?: Hit[] };
  return pick(json.products ?? [], name);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The legacy APIs allow only ~10 searches/minute, so those calls are queued one at a time.
let chain: Promise<unknown> = Promise.resolve();
const gate = <T,>(fn: () => Promise<T>): Promise<T> => {
  const run = chain.then(fn, fn);
  chain = run.then(() => sleep(400), () => sleep(400));
  return run;
};
const cache = new Map<string, string>();

export async function findProductImage(name: string): Promise<string | null> {
  const key = name.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const found = (url: string | null) => { if (url) cache.set(key, url); return url; };

  for (let attempt = 0; attempt < 2; attempt++) {
    try { const u = found(await searchAli(name)); if (u) return u; break; } catch { await sleep(500); }
  }
  for (const base of ["https://world.openproductsfacts.org", "https://world.openfoodfacts.org"]) {
    try {
      const u = found(await gate(() => searchLegacy(base, name)));
      if (u) return u;
    } catch { /* rate limited or network error: try next source */ }
  }
  return null;
}
