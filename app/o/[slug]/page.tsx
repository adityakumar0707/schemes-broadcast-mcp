import { supabaseAdmin } from "@/lib/supabase/admin";
import InterestForm from "@/components/InterestForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Special offer", robots: { index: false } };

function Unavailable() {
  return (
    <main className="mx-auto mt-24 max-w-md px-4 text-center">
      <p className="text-lg font-medium">This offer is no longer available.</p>
    </main>
  );
}

export default async function PublicOffer({ params }: { params: { slug: string } }) {
  // Service role used server-side only; the query is hard-scoped to approved offers.
  const db = supabaseAdmin();
  const { data: offer } = await db.from("offers")
    .select("id, product_ids, offer_text, discount_detail, valid_from, valid_to")
    .eq("share_link_slug", params.slug).eq("status", "approved").maybeSingle();
  if (!offer) return <Unavailable />;

  const { data: products } = await db.from("products").select("id,name,price,unit").in("id", offer.product_ids);
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const expired = offer.valid_to && new Date(offer.valid_to + "T23:59:59") < new Date();

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <div className="card space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Special scheme</p>
        <h1 className="text-xl font-bold">{offer.offer_text}</h1>
        {offer.discount_detail && <p className="text-gray-700">{offer.discount_detail}</p>}
        <ul className="divide-y rounded border text-sm">
          {products?.map((p) => (
            <li key={p.id} className="flex justify-between p-2"><span>{p.name}</span>
              <span className="text-gray-600">{p.price != null ? `₹${p.price}` : ""}{p.unit ? ` / ${p.unit}` : ""}</span></li>
          ))}
        </ul>
        {(offer.valid_from || offer.valid_to) && (
          <p className="text-sm text-gray-600">Valid {offer.valid_from ? `from ${fmt(offer.valid_from)} ` : ""}{offer.valid_to ? `till ${fmt(offer.valid_to)}` : ""}</p>
        )}
        {expired ? <p className="text-sm font-medium text-red-600">This offer has ended.</p> : <InterestForm slug={params.slug} />}
      </div>
      <p className="mt-4 text-center text-xs text-gray-500">Questions about pricing? <a className="underline" href="mailto:hello@example.com">Contact us</a></p>
    </main>
  );
}
