import { requireDistributor } from "@/lib/distributor";
import { renderOfferImage } from "@/lib/offerImage";

export const dynamic = "force-dynamic";

// Authenticated preview of the offer graphic (works for pending offers too).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { sb, distributor } = await requireDistributor();
  const { data: offer } = await sb.from("offers")
    .select("product_ids, offer_text, discount_detail, valid_from, valid_to")
    .eq("id", params.id).eq("distributor_id", distributor.id).maybeSingle();
  if (!offer) return new Response("Not found", { status: 404 });
  const { data: products } = await sb.from("products").select("name,price,unit,image_url").in("id", offer.product_ids);
  return renderOfferImage({ ...offer, products: products ?? [] });
}
