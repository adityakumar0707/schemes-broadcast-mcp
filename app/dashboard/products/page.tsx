import { requireDistributor } from "@/lib/distributor";
import { addProduct, deleteProduct, findImageForProduct, updateProduct } from "../actions";
import ProductUploadModal from "@/components/ProductUploadModal";

// Bulk upload looks up pictures one by one (rate-limited public APIs), so allow a longer run.
export const maxDuration = 60;

export default async function Products({ searchParams }: { searchParams: { error?: string; added?: string } }) {
  const { sb, distributor } = await requireDistributor();
  const { data: products } = await sb.from("products").select("*").eq("distributor_id", distributor.id).order("name");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Products</h1>
        <ProductUploadModal />
      </div>
      {searchParams.added && <p className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm">Added {searchParams.added} products. Pictures were matched where a public product listing was found.</p>}
      {searchParams.error && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">{searchParams.error}</p>}
      <form action={addProduct} className="card flex flex-wrap items-end gap-2">
        <input name="name" className="input !w-56" placeholder="Product name" required />
        <input name="price" type="number" step="0.01" min="0" className="input !w-28" placeholder="Price ₹" />
        <input name="unit" className="input !w-24" placeholder="Unit (kg)" />
        <button className="btn">Add / update</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr><th className="p-3">Picture</th><th>Name</th><th>Price ₹ / Unit</th><th /></tr>
          </thead>
          <tbody>
            {products?.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={4}>No products yet. Upload a file, add one, or tell Claude your catalogue.</td></tr>}
            {products?.map((p) => (
              <tr key={p.id} className="border-t align-middle">
                <td className="p-3">
                  {p.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded border object-contain" />
                    : <form action={findImageForProduct.bind(null, p.id)}><button className="text-xs text-emerald-700 underline">Find picture</button></form>}
                </td>
                <td className="font-medium">{p.name}</td>
                <td>
                  <form action={updateProduct.bind(null, p.id)} className="flex gap-2">
                    <input name="price" type="number" step="0.01" min="0" defaultValue={p.price ?? ""} className="input !w-24 !py-1" />
                    <input name="unit" defaultValue={p.unit ?? ""} className="input !w-20 !py-1" />
                    <button className="btn-secondary !py-1">Save</button>
                  </form>
                </td>
                <td className="pr-3 text-right">
                  <form action={deleteProduct.bind(null, p.id)}><button className="text-red-600 hover:underline">Delete</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
