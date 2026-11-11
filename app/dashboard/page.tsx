import Link from "next/link";
import { requireDistributor } from "@/lib/distributor";
import { baseUrl, waLink } from "@/lib/url";
import CopyButton from "@/components/CopyButton";

export default async function Dashboard({ searchParams }: { searchParams: { new?: string } }) {
  const { sb, distributor } = await requireDistributor();
  const base = baseUrl();
  const { data: offers } = await sb.from("offers").select("*, groups(name)").eq("distributor_id", distributor.id).order("created_at", { ascending: false });
  const live = (offers ?? []).filter((o) => o.status === "approved");
  const pending = (offers ?? []).filter((o) => o.status === "pending");

  // Click/interest counts for live offers (RLS limits offer_clicks to own offers).
  const counts = new Map<string, number>();
  if (live.length) {
    const { data: clicks } = await sb.from("offer_clicks").select("offer_id").in("offer_id", live.map((o) => o.id));
    clicks?.forEach((c) => counts.set(c.offer_id, (counts.get(c.offer_id) ?? 0) + 1));
  }

  const newLink = searchParams.new ? `${base}/o/${searchParams.new}` : null;
  const newOffer = searchParams.new ? live.find((o) => o.share_link_slug === searchParams.new) : null;

  return (
    <div className="space-y-8">
      {newLink && (
        <div className="card border-emerald-300 bg-emerald-50">
          <p className="font-semibold">Offer approved and live</p>
          <p className="mt-1 break-all text-sm">{newLink}</p>
          <div className="mt-3 flex gap-2">
            <CopyButton text={newLink} />
            <a className="btn" target="_blank" href={waLink(newOffer?.offer_text ?? "New scheme", newLink)}>Share on WhatsApp</a>
          </div>
        </div>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Pending approval ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-gray-500">Nothing pending. Ask Claude to draft an offer.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {pending.map((o) => (
            <Link key={o.id} href={`/dashboard/offers/${o.id}`} className="card block hover:border-emerald-400">
              <p className="font-medium">{o.offer_text}</p>
              <p className="mt-1 text-sm text-gray-600">{o.discount_detail}</p>
              <p className="mt-2 text-xs text-gray-500">For: {o.groups?.name ?? "-"} · Valid to: {o.valid_to ?? "-"}</p>
              <p className="mt-2 text-xs font-medium text-amber-700">Review and approve →</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Live ({live.length})</h2>
        {live.length === 0 && <p className="text-sm text-gray-500">No live offers yet.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {live.map((o) => {
            const url = `${base}/o/${o.share_link_slug}`;
            return (
              <div key={o.id} className="card">
                <p className="font-medium">{o.offer_text}</p>
                <p className="mt-1 text-xs text-gray-500">For: {o.groups?.name ?? "-"} · Valid to: {o.valid_to ?? "-"}</p>
                <a href={url} target="_blank" className="mt-2 block break-all text-sm text-emerald-700 underline">{url}</a>
                <p className="mt-2 text-sm"><b>{counts.get(o.id) ?? 0}</b> interested</p>
                <div className="mt-2 flex gap-2">
                  <CopyButton text={url} />
                  <a className="btn-secondary" target="_blank" href={waLink(o.offer_text, url)}>WhatsApp</a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
