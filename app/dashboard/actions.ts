"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDistributor } from "@/lib/distributor";
import { LIMITS, checkDates, checkPhone, checkPrice, checkPublicText, checkText, first } from "@/lib/guardrails";
import { findProductImage } from "@/lib/productImage";

// All actions use the session (RLS) client AND filter by distributor_id explicitly.
// Every text path goes through lib/guardrails.ts, same as the MCP tools.

const str = (f: FormData, k: string) => (String(f.get(k) ?? "").trim() || null);
const back = (path: string, error: string): never => redirect(`${path}?error=${encodeURIComponent(error)}`);

export async function signOut() {
  const { sb } = await requireDistributor();
  await sb.auth.signOut();
  redirect("/login");
}

/* ---------- offers ---------- */
function offerPatch(f: FormData, path: string) {
  const patch = {
    offer_text: str(f, "offer_text") ?? "",
    discount_detail: str(f, "discount_detail"),
    share_message: str(f, "share_message"),
    valid_from: str(f, "valid_from"),
    valid_to: str(f, "valid_to"),
  };
  const bad = first(
    checkPublicText("Offer text", patch.offer_text, LIMITS.offerText),
    checkPublicText("Discount detail", patch.discount_detail, LIMITS.discountDetail, { allowEmpty: true }),
    checkPublicText("WhatsApp message", patch.share_message, LIMITS.shareMessage, { allowEmpty: true }),
    checkDates(patch.valid_from, patch.valid_to),
  );
  if (bad) back(path, bad);
  return patch;
}

export async function saveOffer(id: string, f: FormData) {
  const { sb, distributor } = await requireDistributor();
  const path = `/dashboard/offers/${id}`;
  const patch = offerPatch(f, path);
  await sb.from("offers").update(patch).eq("id", id).eq("distributor_id", distributor.id).eq("status", "pending");
  revalidatePath(path);
}

export async function approveOffer(id: string, f: FormData) {
  const { sb, distributor } = await requireDistributor();
  const patch = offerPatch(f, `/dashboard/offers/${id}`); // guardrails re-run on whatever the human edited
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
const P = "/dashboard/products";

async function upsertProduct(sb: Awaited<ReturnType<typeof requireDistributor>>["sb"], distributorId: string, row: { name: string; price: number | null; unit: string | null }) {
  const { data: existing } = await sb.from("products").select("id,image_url").eq("distributor_id", distributorId).ilike("name", row.name.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  const patch: Record<string, unknown> = { ...row };
  if (!existing?.image_url) { const img = await findProductImage(row.name); if (img) patch.image_url = img; }
  if (existing) await sb.from("products").update(patch).eq("id", existing.id);
  else await sb.from("products").insert({ ...patch, distributor_id: distributorId });
}

function checkProductRow(r: { name: string; price: number | null; unit: string | null }) {
  return first(checkPublicText("Product name", r.name, LIMITS.productName), checkPrice(r.price), r.unit ? checkPublicText("Unit", r.unit, 20) : null);
}

export async function addProduct(f: FormData) {
  const { sb, distributor } = await requireDistributor();
  const name = str(f, "name");
  const price = str(f, "price");
  const row = { name: name ?? "", price: price ? Number(price) : null, unit: str(f, "unit") };
  const bad = checkProductRow(row);
  if (bad) back(P, bad);
  const { count } = await sb.from("products").select("id", { count: "exact", head: true }).eq("distributor_id", distributor.id);
  if ((count ?? 0) >= LIMITS.maxProducts) back(P, `Catalogue limit is ${LIMITS.maxProducts} products.`);
  await upsertProduct(sb, distributor.id, row);
  revalidatePath(P);
}

/** Bulk import from the upload modal (rows come from /api/products/parse, re-validated here). */
export async function importProducts(f: FormData) {
  const { sb, distributor } = await requireDistributor();
  let rows: { name: string; price: number | null; unit: string | null }[] = [];
  try { rows = JSON.parse(String(f.get("rows") ?? "[]")); } catch { back(P, "Could not read the product list."); }
  if (!Array.isArray(rows) || rows.length === 0) back(P, "No products to add.");
  rows = rows.slice(0, LIMITS.productsPerUpload).map((r) => ({
    name: String(r.name ?? "").trim(), price: r.price === null || r.price === undefined ? null : Number(r.price), unit: r.unit ? String(r.unit).trim() : null,
  }));
  for (const r of rows) { const bad = checkProductRow(r); if (bad) back(P, `${bad} (row: "${r.name}")`); }
  const { count } = await sb.from("products").select("id", { count: "exact", head: true }).eq("distributor_id", distributor.id);
  if ((count ?? 0) + rows.length > LIMITS.maxProducts) back(P, `Catalogue limit is ${LIMITS.maxProducts} products.`);
  await Promise.all(rows.map((r) => upsertProduct(sb, distributor.id, r)));
  revalidatePath(P);
  redirect(`${P}?added=${rows.length}`);
}

export async function updateProduct(id: string, f: FormData) {
  const { sb, distributor } = await requireDistributor();
  const price = str(f, "price");
  const unit = str(f, "unit");
  const bad = first(checkPrice(price ? Number(price) : null), unit ? checkPublicText("Unit", unit, 20) : null);
  if (bad) back(P, bad);
  await sb.from("products").update({ price: price ? Number(price) : null, unit })
    .eq("id", id).eq("distributor_id", distributor.id);
  revalidatePath(P);
}

export async function findImageForProduct(id: string) {
  const { sb, distributor } = await requireDistributor();
  const { data: p } = await sb.from("products").select("name").eq("id", id).eq("distributor_id", distributor.id).single();
  if (!p) return;
  const img = await findProductImage(p.name);
  if (!img) back(P, `No matching picture found online for "${p.name}". The offer image will use a text placeholder.`);
  await sb.from("products").update({ image_url: img }).eq("id", id).eq("distributor_id", distributor.id);
  revalidatePath(P);
}

export async function deleteProduct(id: string) {
  const { sb, distributor } = await requireDistributor();
  await sb.from("products").delete().eq("id", id).eq("distributor_id", distributor.id);
  revalidatePath(P);
}

/* ---------- groups ---------- */
export async function addMember(f: FormData) {
  const { sb, distributor } = await requireDistributor();
  const G = "/dashboard/groups";
  const groupName = str(f, "group_name"), contact = str(f, "contact_name"), phone = str(f, "phone")?.replace(/[^\d+]/g, "");
  if (!groupName || !contact || !phone) return;
  const bad = first(checkText("Group name", groupName, LIMITS.groupName), checkText("Contact name", contact, LIMITS.contactName), checkPhone(phone));
  if (bad) back(G, bad);
  const { data: groups } = await sb.from("groups").select("id,name").eq("distributor_id", distributor.id);
  let gid = groups?.find((g) => g.name.toLowerCase() === groupName.toLowerCase())?.id;
  if (!gid) {
    const { data } = await sb.from("groups").insert({ distributor_id: distributor.id, name: groupName }).select("id").single();
    gid = data?.id;
  }
  if (gid) {
    const { count } = await sb.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", gid);
    if ((count ?? 0) >= LIMITS.maxMembersPerGroup) back(G, `A group can have at most ${LIMITS.maxMembersPerGroup} contacts.`);
    await sb.from("group_members").upsert({ group_id: gid, contact_name: contact, phone }, { onConflict: "group_id,phone" });
  }
  revalidatePath(G);
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
