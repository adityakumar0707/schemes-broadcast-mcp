import Link from "next/link";
import { requireDistributor } from "@/lib/distributor";
import { baseUrl } from "@/lib/url";
import { buildShareText } from "@/lib/share";
import CopyButton from "@/components/CopyButton";
import ShareOffer from "@/components/ShareOffer";

export default async function Dashboard({ searchParams }: { searchParams: { new?: string } }) {
  const { sb, distributor } = await requireDistributor();
  const base = baseUrl();
  const { data: offers } = await sb.from("offers").select("*, groups(name)").eq("distributor_id", distributor.id).order("created_at", { ascending: false });
  const live = (offers ?? []).filter((o) => o.status === "approved");
  const pending = (offers ?? []).filter((o) => o.status === "pending");

  // Click/interest counts and group contacts for live offers (RLS limits both to this distributor).
  const counts = new Map<string, number>();
  const members = new Map<string, { contact_name: string; phone: string }[]>();
  if (live.length) {
    const gids = Array.from(new Set(live.map((o) => o.group_id).filter(Boolean)));
    // Independent queries run at the same time instead of one after another.
    const [{ data: clicks }, { data: gm }] = await Promise.all([
      sb.from("offer_clicks").select("offer_id").in("offer_id", live.map((o) => o.id)),
      gids.length ? sb.from("group_members").select("group_id,contact_name,phone").in("group_id", gids) : Promise.resolve({ data: [] as { group_id: string; contact_name: string; phone: string }[] }),
    ]);
    clicks?.forEach((c) => counts.set(c.offer_id, (counts.get(c.offer_id) ?? 0) + 1));
    gm?.forEach((m) => members.set(m.group_id, [...(members.get(m.group_id) ?? []), { contact_name: m.contact_name, phone: m.phone }]));
  }

  const newOffer = searchParams.new ? live.find((o) => o.share_link_slug === searchParams.new) : null;

  const shareBlock = (o: (typeof live)[number]) => {
    const url = `${base}/o/${o.share_link_slug}`;
    return (
      <ShareOffer
        imageUrl={`/o/${o.share_link_slug}/image`}
        url={url}
        text={buildShareText(o, url)}
        members={members.get(o.group_id) ?? []}
      />
    );
  };

  return (
    <div className="space-y-8">
      {newOffer && (
        <div className="card border-emerald-300 bg-emerald-50">
          <p className="font-semibold">Offer approved and live</p>
          <p className="mt-1 break-all text-sm">{base}/o/{newOffer.share_link_slug}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-[200px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/o/${newOffer.share_link_slug}/image`} alt="Offer graphic" className="w-full rounded border" />
            <div>
              <p className="whitespace-pre-line text-sm text-gray-700">{buildShareText(newOffer, `${base}/o/${newOffer.share_link_slug}`)}</p>
              {shareBlock(newOffer)}
            </div>
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
                <div className="mt-2"><CopyButton text={url} /></div>
                {shareBlock(o)}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
