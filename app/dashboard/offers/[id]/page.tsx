import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDistributor } from "@/lib/distributor";
import SubmitButton from "@/components/SubmitButton";
import { approveOffer, rejectOffer, saveOffer } from "../../actions";

export default async function OfferPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const { sb, distributor } = await requireDistributor();
  const { data: offer } = await sb.from("offers").select("*").eq("id", params.id).eq("distributor_id", distributor.id).maybeSingle();
  if (!offer) notFound();

  const [{ data: products }, { data: group }, { count }] = await Promise.all([
    sb.from("products").select("*").in("id", offer.product_ids),
    offer.group_id ? sb.from("groups").select("name").eq("id", offer.group_id).maybeSingle() : Promise.resolve({ data: null }),
    offer.group_id ? sb.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", offer.group_id) : Promise.resolve({ count: 0 }),
  ]);

  const editable = offer.status === "pending";

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/dashboard" className="text-sm text-emerald-700 underline">← Back</Link>
      <h1 className="text-xl font-bold">Review offer <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-xs font-normal">{offer.status}</span></h1>
      {searchParams.error && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>}

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div>
          <p className="mb-1 text-xs font-medium text-gray-500">Offer image (generated automatically; save to refresh)</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/dashboard/offers/${offer.id}/image?v=${encodeURIComponent(offer.offer_text.length + (offer.discount_detail ?? "") + (offer.valid_to ?? ""))}`} alt="Offer graphic preview" className="w-full rounded border bg-white" />
        </div>
        <div className="card text-sm">
          <p className="font-medium">Products</p>
          <ul className="mt-1 space-y-1 text-gray-700">
            {products?.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                {p.image_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.image_url} alt="" className="h-8 w-8 rounded border object-contain" />
                  : <span className="flex h-8 w-8 items-center justify-center rounded bg-emerald-100 text-xs font-bold text-emerald-700">{p.name.slice(0, 1)}</span>}
                <span>{p.name}{p.price != null ? ` - ₹${p.price}` : ""}{p.unit ? `/${p.unit}` : ""}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3"><span className="font-medium">Target group:</span> {group?.name ?? "-"} ({count ?? 0} members)</p>
        </div>
      </div>

      <form className="card space-y-3">
        <label className="block text-sm font-medium">Offer text (headline on the image)
          <textarea name="offer_text" className="input mt-1" rows={2} defaultValue={offer.offer_text} disabled={!editable} required />
        </label>
        <label className="block text-sm font-medium">Discount detail
          <input name="discount_detail" className="input mt-1" defaultValue={offer.discount_detail ?? ""} disabled={!editable} />
        </label>
        <label className="block text-sm font-medium">WhatsApp message (sent with the image)
          <textarea name="share_message" className="input mt-1" rows={4} defaultValue={offer.share_message ?? ""} disabled={!editable} placeholder="Written by Claude. The offer link is added automatically." />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">Valid from
            <input type="date" name="valid_from" className="input mt-1" defaultValue={offer.valid_from ?? ""} disabled={!editable} />
          </label>
          <label className="block text-sm font-medium">Valid to
            <input type="date" name="valid_to" className="input mt-1" defaultValue={offer.valid_to ?? ""} disabled={!editable} />
          </label>
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2 pt-2">
            <SubmitButton formAction={approveOffer.bind(null, offer.id)} formMethod="post" pendingText="Approving…">Approve</SubmitButton>
            <SubmitButton className="btn-secondary" formAction={saveOffer.bind(null, offer.id)} formMethod="post" pendingText="Saving…">Save changes</SubmitButton>
            <SubmitButton className="btn-danger" formAction={rejectOffer.bind(null, offer.id)} formMethod="post" formNoValidate pendingText="Rejecting…">Reject</SubmitButton>
          </div>
        )}
      </form>
    </div>
  );
}
