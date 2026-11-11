import { supabaseAdmin } from "@/lib/supabase/admin";
import { renderOfferImage } from "@/lib/offerImage";

export const dynamic = "force-dynamic";

// Public offer graphic. Only approved offers are rendered.
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const db = supabaseAdmin();
  const { data: offer } = await db.from("offers")
    .select("product_ids, offer_text, discount_detail, valid_from, valid_to")
    .eq("share_link_slug", params.slug).eq("status", "approved").maybeSingle();
  if (!offer) return new Response("Not found", { status: 404 });
  const { data: products } = await db.from("products").select("name,price,unit,image_url").in("id", offer.product_ids);
  return renderOfferImage({ ...offer, products: products ?? [] });
}
