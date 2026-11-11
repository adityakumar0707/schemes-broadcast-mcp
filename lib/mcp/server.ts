import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fillImagesInBackground } from "@/lib/productImage";
import { LIMITS, MCP_INSTRUCTIONS, checkDates, checkPhone, checkPrice, checkPublicText, checkText, first } from "@/lib/guardrails";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const ok = (data: unknown, note?: string) => ({
  content: [{ type: "text" as const, text: JSON.stringify(note ? { note, data } : data, null, 2) }],
});
const fail = (msg: string) => ({ isError: true, content: [{ type: "text" as const, text: msg }] });
const blocked = (msg: string) => fail(`GUARDRAIL: ${msg}`);
const normPhone = (p: string) => p.replace(/[^\d+]/g, "");

/**
 * Builds an MCP server bound to ONE distributor. Every query below filters by that
 * distributorId (service role bypasses RLS, so this scoping is the security boundary).
 * No LLM calls here - pure reads/writes plus deterministic guardrails (lib/guardrails.ts).
 */
export function buildServer(distributorId: string) {
  const db = supabaseAdmin();
  const server = new McpServer({ name: "scheme-broadcast", version: "0.2.0" }, { instructions: MCP_INSTRUCTIONS });

  server.registerTool("upload_catalogue", {
    description: `Add or update FMCG products in the distributor's catalogue (max ${LIMITS.productsPerMcpCall} per call). Matches on name (case-insensitive) so repeats do not create duplicates. A product picture is looked up automatically in the background from public product databases. Only FMCG / everyday consumer goods are accepted.`,
    inputSchema: {
      products: z.array(z.object({ name: z.string().min(1), price: z.number().optional(), unit: z.string().optional() })).min(1).max(LIMITS.productsPerMcpCall),
    },
  }, async ({ products }) => {
    for (const p of products) {
      const bad = first(checkPublicText("Product name", p.name, LIMITS.productName), checkPrice(p.price), p.unit ? checkPublicText("Unit", p.unit, 20) : null);
      if (bad) return blocked(`${bad} (product: "${p.name}")`);
    }
    const { data: existing, error } = await db.from("products").select("id,name,image_url").eq("distributor_id", distributorId);
    if (error) return fail(error.message);
    const byName = new Map((existing ?? []).map((p) => [p.name.trim().toLowerCase(), p]));
    const newCount = new Set(products.map((p) => p.name.trim().toLowerCase()).filter((k) => !byName.has(k))).size;
    if ((existing?.length ?? 0) + newCount > LIMITS.maxProducts) return blocked(`Catalogue limit is ${LIMITS.maxProducts} products.`);

    const out: unknown[] = [];
    for (const p of products) {
      const key = p.name.trim().toLowerCase();
      const patch: Record<string, unknown> = { name: p.name.trim() };
      if (p.price !== undefined) patch.price = p.price;
      if (p.unit !== undefined) patch.unit = p.unit;
      const prev = byName.get(key);
      const res = prev
        ? await db.from("products").update(patch).eq("id", prev.id).eq("distributor_id", distributorId).select().single()
        : await db.from("products").insert({ ...patch, distributor_id: distributorId }).select().single();
      if (res.error) return fail(res.error.message);
      byName.set(key, res.data);
      out.push(res.data);
    }
    // Pictures are looked up after we respond (public APIs can take seconds), then saved.
    fillImagesInBackground(distributorId, (out as { id: string; name: string; image_url: string | null }[]).filter((p) => !p.image_url).map((p) => ({ id: p.id, name: p.name })));
    return ok(out, "Saved. Product pictures are being looked up in the background and will appear in the dashboard within a few seconds; where none is found the offer image uses a text placeholder.");
  });

  server.registerTool("list_products", {
    description: "List all products in the distributor's catalogue (use to match product names to ids before create_offer).",
    inputSchema: {},
  }, async () => {
    const { data, error } = await db.from("products").select("*").eq("distributor_id", distributorId).order("name");
    return error ? fail(error.message) : ok(data);
  });

  server.registerTool("manage_group", {
    description: "Add or remove a buyer contact (a retailer) in the distributor's own group. Creates the group if it does not exist. Removal is by phone number. Returns the group with its members. Only for the distributor's own buyers.",
    inputSchema: {
      group_name: z.string().min(1),
      action: z.enum(["add", "remove"]),
      contact_name: z.string().optional(),
      phone: z.string().optional(),
    },
  }, async ({ group_name, action, contact_name, phone }) => {
    const name = group_name.trim();
    const bad = first(checkText("Group name", name, LIMITS.groupName), action === "add" ? checkText("Contact name", contact_name, LIMITS.contactName) : null, phone ? checkPhone(phone) : null);
    if (bad) return blocked(bad);
    const { data: groups, error } = await db.from("groups").select("*").eq("distributor_id", distributorId);
    if (error) return fail(error.message);
    let group = (groups ?? []).find((g) => g.name.trim().toLowerCase() === name.toLowerCase());
    if (!group) {
      if (action === "remove") return fail(`Group "${name}" does not exist.`);
      const ins = await db.from("groups").insert({ distributor_id: distributorId, name }).select().single();
      if (ins.error) return fail(ins.error.message);
      group = ins.data;
    }
    if (action === "add") {
      if (!phone || !contact_name) return fail("contact_name and phone are required for action 'add'.");
      const { count } = await db.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", group.id);
      if ((count ?? 0) >= LIMITS.maxMembersPerGroup) return blocked(`A group can have at most ${LIMITS.maxMembersPerGroup} contacts.`);
      const r = await db.from("group_members").upsert(
        { group_id: group.id, contact_name: contact_name.trim(), phone: normPhone(phone) }, { onConflict: "group_id,phone" });
      if (r.error) return fail(r.error.message);
    } else {
      if (!phone) return fail("phone is required for action 'remove'.");
      const r = await db.from("group_members").delete().eq("group_id", group.id).eq("phone", normPhone(phone));
      if (r.error) return fail(r.error.message);
    }
    const { data: members } = await db.from("group_members").select("id,contact_name,phone").eq("group_id", group.id);
    return ok({ ...group, members: members ?? [] });
  });

  server.registerTool("list_groups", {
    description: "List the distributor's buyer groups with member counts (use to match a group name to a group_id before create_offer). Does not return contact details.",
    inputSchema: {},
  }, async () => {
    const { data, error } = await db.from("groups").select("id,name,created_at,group_members(count)").eq("distributor_id", distributorId).order("name");
    if (error) return fail(error.message);
    return ok((data ?? []).map((g: any) => ({ id: g.id, name: g.name, member_count: g.group_members?.[0]?.count ?? 0 })));
  });

  server.registerTool("create_offer", {
    description: `Draft an FMCG offer for one of the distributor's groups. It is saved as PENDING and is NOT visible to buyers until the distributor approves it in their dashboard. Resolve product_ids via list_products and group_id via list_groups first. Convert relative dates (e.g. 'Friday') to YYYY-MM-DD. offer_text (max ${LIMITS.offerText} chars) is the headline buyers see. share_message (max ${LIMITS.shareMessage} chars) is the friendly WhatsApp message that accompanies the offer image and link: write it for a retailer, mention product and discount and validity, and do NOT include phone numbers, names of other people, emails or links (the app adds the link). Max discount ${LIMITS.maxDiscountPct}%.`,
    inputSchema: {
      product_ids: z.array(z.string().uuid()).min(1).max(10),
      offer_text: z.string().min(1),
      discount_detail: z.string().optional(),
      share_message: z.string().optional(),
      valid_from: date.optional(),
      valid_to: date.optional(),
      group_id: z.string().uuid(),
    },
  }, async ({ product_ids, offer_text, discount_detail, share_message, valid_from, valid_to, group_id }) => {
    const bad = first(
      checkPublicText("offer_text", offer_text, LIMITS.offerText),
      checkPublicText("discount_detail", discount_detail, LIMITS.discountDetail, { allowEmpty: true }),
      checkPublicText("share_message", share_message, LIMITS.shareMessage, { allowEmpty: true }),
      checkDates(valid_from, valid_to),
    );
    if (bad) return blocked(bad);

    const since = new Date(Date.now() - 864e5).toISOString();
    const [{ count: recent }, { count: pending }] = await Promise.all([
      db.from("offers").select("id", { count: "exact", head: true }).eq("distributor_id", distributorId).gte("created_at", since),
      db.from("offers").select("id", { count: "exact", head: true }).eq("distributor_id", distributorId).eq("status", "pending"),
    ]);
    if ((recent ?? 0) >= LIMITS.maxOffersPer24h) return blocked(`Limit reached: max ${LIMITS.maxOffersPer24h} offers per 24 hours.`);
    if ((pending ?? 0) >= LIMITS.maxPendingOffers) return blocked(`There are already ${pending} offers waiting for approval. Ask the distributor to approve or reject some first.`);

    const ids = Array.from(new Set(product_ids));
    const [{ data: prods }, { data: grp }] = await Promise.all([
      db.from("products").select("id").eq("distributor_id", distributorId).in("id", ids),
      db.from("groups").select("id").eq("distributor_id", distributorId).eq("id", group_id).maybeSingle(),
    ]);
    if ((prods?.length ?? 0) !== ids.length) return fail("One or more product_ids not found in this catalogue. Call list_products.");
    if (!grp) return fail("group_id not found. Call list_groups.");
    const { data, error } = await db.from("offers").insert({
      distributor_id: distributorId, product_ids: ids, offer_text: offer_text.trim(), discount_detail: discount_detail?.trim() || null,
      share_message: share_message?.trim() || null,
      valid_from: valid_from ?? null, valid_to: valid_to ?? null, group_id, status: "pending", // never anything else
    }).select().single();
    if (error) return fail(error.message);
    return ok(data, "Offer drafted - ask the distributor to open their dashboard to review and approve it. An image with the offer text is generated automatically after approval.");
  });

  return server;
}
