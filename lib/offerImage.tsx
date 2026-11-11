import { ImageResponse } from "next/og";

/**
 * Renders the shareable offer graphic (1080x1080 PNG) from offer data.
 * Pure server-side rendering with Satori (no AI/LLM): text, product pictures and layout only.
 */
export type OfferImageProduct = { name: string; price: number | null; unit: string | null; image_url: string | null };
export type OfferImageData = {
  offer_text: string;
  discount_detail: string | null;
  valid_from: string | null;
  valid_to: string | null;
  products: OfferImageProduct[];
};

const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Fetch a remote product picture and inline it (Satori only supports png/jpeg; failures just mean a placeholder). */
async function toDataUri(url: string | null): Promise<string | null> {
  if (!url || !url.startsWith("https://")) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = r.headers.get("content-type")?.split(";")[0] ?? "";
    if (!r.ok || !["image/jpeg", "image/png"].includes(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 1_500_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

export async function renderOfferImage(d: OfferImageData) {
  const shown = d.products.slice(0, 3);
  const pics = await Promise.all(shown.map((p) => toDataUri(p.image_url)));
  const len = d.offer_text.length;
  const headSize = len <= 50 ? 84 : len <= 110 ? 66 : len <= 190 ? 52 : 42;
  const validity = d.valid_to ? `Valid ${d.valid_from ? fmtDate(d.valid_from) + " – " : "till "}${fmtDate(d.valid_to)}` : d.valid_from ? `Valid from ${fmtDate(d.valid_from)}` : "Limited period offer";
  const imgSize = shown.length === 1 ? 300 : shown.length === 2 ? 250 : 200;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 56, background: "linear-gradient(160deg,#064e3b 0%,#059669 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex" }}>
          <div style={{ display: "flex", background: "#fde047", color: "#14532d", fontSize: 30, fontWeight: 700, padding: "10px 26px", borderRadius: 999, letterSpacing: 3 }}>SPECIAL SCHEME</div>
        </div>
        <div style={{ display: "flex", fontSize: headSize, fontWeight: 800, lineHeight: 1.1, marginTop: 36 }}>{d.offer_text}</div>
        {d.discount_detail ? (
          <div style={{ display: "flex", marginTop: 28 }}>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.18)", border: "2px solid rgba(255,255,255,0.6)", fontSize: 38, padding: "12px 28px", borderRadius: 20 }}>{d.discount_detail}</div>
          </div>
        ) : null}
        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", background: "white", borderRadius: 32, padding: 28, justifyContent: "space-around", alignItems: "flex-end" }}>
          {shown.map((p, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: imgSize + 20 }}>
              {pics[i] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pics[i]!} width={imgSize} height={imgSize} style={{ objectFit: "contain" }} alt="" />
              ) : (
                <div style={{ display: "flex", width: imgSize, height: imgSize, alignItems: "center", justifyContent: "center", background: "#d1fae5", color: "#047857", fontSize: imgSize / 2, fontWeight: 800, borderRadius: 24 }}>{p.name.slice(0, 1).toUpperCase()}</div>
              )}
              <div style={{ display: "flex", color: "#111827", fontSize: 30, fontWeight: 700, marginTop: 14, textAlign: "center", justifyContent: "center" }}>{p.name.length > 22 ? p.name.slice(0, 21) + "…" : p.name}</div>
              {p.price != null ? <div style={{ display: "flex", color: "#047857", fontSize: 30, marginTop: 4 }}>{`Rs ${p.price}${p.unit ? " / " + p.unit : ""}`}</div> : null}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 30, fontSize: 32 }}>
          <div style={{ display: "flex" }}>{validity}</div>
          <div style={{ display: "flex", fontWeight: 700 }}>Tap the link to order</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080, headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
