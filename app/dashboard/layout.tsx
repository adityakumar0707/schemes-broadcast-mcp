import Link from "next/link";
import { requireDistributor } from "@/lib/distributor";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { distributor } = await requireDistributor();
  const nav = [
    ["/dashboard", "Offers"],
    ["/dashboard/products", "Products"],
    ["/dashboard/groups", "Groups"],
    ["/dashboard/connect", "Connect Claude"],
  ];
  return (
    <div>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-bold">Scheme Broadcast</span>
          <nav className="flex flex-1 gap-4 text-sm">
            {nav.map(([href, label]) => <Link key={href} href={href} className="text-gray-700 hover:text-emerald-700">{label}</Link>)}
          </nav>
          <span className="text-xs text-gray-500">{distributor.email}</span>
          <form action={signOut}><button className="btn-secondary !py-1">Log out</button></form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
