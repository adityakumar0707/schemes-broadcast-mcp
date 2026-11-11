"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDistributor } from "@/lib/distributor";

// All actions use the session (RLS) client AND filter by distributor_id explicitly.

const str = (f: FormData, k: string) => (String(f.get(k) ?? "").trim() || null);

export async function signOut() {
  const { sb } = await requireDistributor();
  await sb.auth.signOut();
  redirect("/login");
}

/* ---------- offers ---------- */
function offerPatch(f: FormData) {
  return {
    offer_text: str(f, "offer_text") ?? "",
    discount_detail: str(f, "discount_detail"),
    valid_from: str(f, "valid_from"),
    valid_to: str(f, "valid_to"),
  };
}

export async function saveOffer(id: string, f: FormData) {
  const { sb, distributor } = await requireDistributor();
  const patch = offerPatch(f);
  if (!patch.offer_text) return;
  await sb.from("offers").update(patch).eq("id", id).eq("distributor_id", distributor.id).eq("status", "pending");
  revalidatePath(`/dashboard/offers/${id}`);
}

export async function approveOffer(id: string, f: FormData) {
  const { sb, distributor } = await requireDistributor();
  const patch = offerPatch(f);
  if (!patch.offer_text) return;
  const slug = randomBytes(6).toString("base64url");
  const { data } = await sb.from("offers")
    .update({ ...patch, status: "approved", share_link_slug: slug, approved_at: new Date().toISOString() })
    .eq("id", id).eq("distributor_id", distributor.id).eq("status", "pending") // only pending can be approved
    .select("share_link_slug").single();
  revalidatePath("/dashboard");
  redirect(data ? `/dashboard?new=${data.share_link_slug}` : "/dashboard");
}

export async function rejectOffer(id: string) {
  const { sb, distributor } = await requireDistributor();
  await sb.from("offers").update({ status: "rejected" }).eq("id", id).eq("distributor_id", distributor.id).eq("status", "pending");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/* ---------- products ---------- */
export async function addProduct(f: FormData) {
  const { sb, distributor } = await requireDistributor();
  const name = str(f, "name");
  if (!name) return;
  const price = str(f, "price");
  const { data: existing } = await sb.from("products").select("id").eq("distributor_id", distributor.id).ilike("name", name.replace(/[%_]/g, "\\$&")).maybeSingle();
  const row = { name, price: price ? Number(price) : null, unit: str(f, "unit") };
  if (existing) await sb.from("products").update(row).eq("id", existing.id);
  else await sb.from("products").insert({ ...row, distributor_id: distributor.id });
  revalidatePath("/dashboard/products");
}

export async function updateProduct(id: string, f: FormData) {
  const { sb, distributor } = await requireDistributor();
  const price = str(f, "price");
  await sb.from("products").update({ price: price ? Number(price) : null, unit: str(f, "unit") })
    .eq("id", id).eq("distributor_id", distributor.id);
  revalidatePath("/dashboard/products");
}

export async function deleteProduct(id: string) {
  const { sb, distributor } = await requireDistributor();
  await sb.from("products").delete().eq("id", id).eq("distributor_id", distributor.id);
  revalidatePath("/dashboard/products");
}

/* ---------- groups ---------- */
export async function addMember(f: FormData) {
  const { sb, distributor } = await requireDistributor();
  const groupName = str(f, "group_name"), contact = str(f, "contact_name"), phone = str(f, "phone")?.replace(/[^\d+]/g, "");
  if (!groupName || !contact || !phone) return;
  const { data: groups } = await sb.from("groups").select("id,name").eq("distributor_id", distributor.id);
  let gid = groups?.find((g) => g.name.toLowerCase() === groupName.toLowerCase())?.id;
  if (!gid) {
    const { data } = await sb.from("groups").insert({ distributor_id: distributor.id, name: groupName }).select("id").single();
    gid = data?.id;
  }
  if (gid) await sb.from("group_members").upsert({ group_id: gid, contact_name: contact, phone }, { onConflict: "group_id,phone" });
  revalidatePath("/dashboard/groups");
}

export async function removeMember(id: string) {
  const { sb } = await requireDistributor(); // RLS restricts to own groups
  await sb.from("group_members").delete().eq("id", id);
  revalidatePath("/dashboard/groups");
}

export async function deleteGroup(id: string) {
  const { sb, distributor } = await requireDistributor();
  await sb.from("groups").delete().eq("id", id).eq("distributor_id", distributor.id);
  revalidatePath("/dashboard/groups");
}

/* ---------- MCP token ---------- */
export async function regenerateToken() {
  const { sb, distributor } = await requireDistributor();
  await sb.from("distributors").update({ mcp_token: randomBytes(24).toString("hex") }).eq("id", distributor.id);
  revalidatePath("/dashboard/connect");
}
