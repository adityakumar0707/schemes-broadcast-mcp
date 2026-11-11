import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDistributor } from "@/lib/distributor";
import { approveOffer, rejectOffer, saveOffer } from "../../actions";

export default async function OfferPage({ params }: { params: { id: string } }) {
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
    <div className="max-w-2xl space-y-4">
      <Link href="/dashboard" className="text-sm text-emerald-700 underline">← Back</Link>
      <h1 className="text-xl font-bold">Review offer <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-xs font-normal">{offer.status}</span></h1>

      <div className="card text-sm">
        <p className="font-medium">Products</p>
        <ul className="mt-1 list-disc pl-5 text-gray-700">
          {products?.map((p) => <li key={p.id}>{p.name}{p.price != null ? ` - ₹${p.price}` : ""}{p.unit ? `/${p.unit}` : ""}</li>)}
        </ul>
        <p className="mt-3"><span className="font-medium">Target group:</span> {group?.name ?? "-"} ({count ?? 0} members)</p>
      </div>

      <form className="card space-y-3">
        <label className="block text-sm font-medium">Offer text
          <textarea name="offer_text" className="input mt-1" rows={3} defaultValue={offer.offer_text} disabled={!editable} required />
        </label>
        <label className="block text-sm font-medium">Discount detail
          <input name="discount_detail" className="input mt-1" defaultValue={offer.discount_detail ?? ""} disabled={!editable} />
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
            <button className="btn" formAction={approveOffer.bind(null, offer.id)} formMethod="post">Approve</button>
            <button className="btn-secondary" formAction={saveOffer.bind(null, offer.id)} formMethod="post">Save changes</button>
            <button className="btn-danger" formAction={rejectOffer.bind(null, offer.id)} formMethod="post" formNoValidate>Reject</button>
          </div>
        )}
      </form>
    </div>
  );
}
