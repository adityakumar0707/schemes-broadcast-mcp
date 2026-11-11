import { requireDistributor } from "@/lib/distributor";
import { addProduct, deleteProduct, updateProduct } from "../actions";

export default async function Products() {
  const { sb, distributor } = await requireDistributor();
  const { data: products } = await sb.from("products").select("*").eq("distributor_id", distributor.id).order("name");
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Products</h1>
      <form action={addProduct} className="card flex flex-wrap items-end gap-2">
        <input name="name" className="input !w-56" placeholder="Product name" required />
        <input name="price" type="number" step="0.01" min="0" className="input !w-28" placeholder="Price ₹" />
        <input name="unit" className="input !w-24" placeholder="Unit (kg)" />
        <button className="btn">Add / update</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr><th className="p-3">Name</th><th>Price ₹</th><th>Unit</th><th /></tr>
          </thead>
          <tbody>
            {products?.length === 0 && <tr><td className="p-3 text-gray-500" colSpan={4}>No products yet. Add one or tell Claude your catalogue.</td></tr>}
            {products?.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-medium">{p.name}</td>
                <td colSpan={2}>
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
