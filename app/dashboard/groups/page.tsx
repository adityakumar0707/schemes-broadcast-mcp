import { requireDistributor } from "@/lib/distributor";
import SubmitButton from "@/components/SubmitButton";
import { addMember, deleteGroup, removeMember } from "../actions";

export default async function Groups() {
  const { sb, distributor } = await requireDistributor();
  const { data: groups } = await sb.from("groups").select("*, group_members(id, contact_name, phone)").eq("distributor_id", distributor.id).order("name");
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Buyer groups</h1>
      <form action={addMember} className="card flex flex-wrap items-end gap-2">
        <input name="group_name" list="groups" className="input !w-44" placeholder="Group (new or existing)" required />
        <datalist id="groups">{groups?.map((g) => <option key={g.id} value={g.name} />)}</datalist>
        <input name="contact_name" className="input !w-44" placeholder="Contact name" required />
        <input name="phone" className="input !w-40" placeholder="Phone" required />
        <SubmitButton pendingText="Adding…">Add contact</SubmitButton>
      </form>
      {groups?.length === 0 && <p className="text-sm text-gray-500">No groups yet.</p>}
      {groups?.map((g) => (
        <div key={g.id} className="card">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{g.name} <span className="text-sm font-normal text-gray-500">({g.group_members.length} members)</span></h2>
            <form action={deleteGroup.bind(null, g.id)}><button className="text-sm text-red-600 hover:underline">Delete group</button></form>
          </div>
          <ul className="mt-2 divide-y text-sm">
            {g.group_members.map((m: { id: string; contact_name: string; phone: string }) => (
              <li key={m.id} className="flex items-center justify-between py-1.5">
                <span>{m.contact_name} · {m.phone}</span>
                <form action={removeMember.bind(null, m.id)}><button className="text-red-600 hover:underline">Remove</button></form>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
