# Schemes Broadcast MCP

A B2B tool for FMCG distributors. The distributor's **own Claude or ChatGPT** drafts combo offers and discounts through MCP tools, the distributor **approves them on a web dashboard**, and the app generates a **public shareable link** that buyers (kirana retailers) open with no login.

> **There is no AI/LLM API key anywhere in this codebase.** All generation happens in the distributor's own Claude/ChatGPT session. This app is a plain CRUD backend + an MCP tool surface + a dashboard + a public offer page.

**Live demo:** https://schemes-broadcast-mcp.vercel.app (sign up with any email to try it)

## Why this exists

Distributors announce schemes ("10% off Tata Salt this week") by phone calls and unstructured WhatsApp text. There is no record, no targeting, and no safe approval step. Claude alone cannot persist an offer, show a tap-to-approve card, or give a retailer without Claude a link to open. This app does exactly those parts. See the Approval flow section below.

## How it works

```
Distributor's Claude/ChatGPT --(MCP tools, personal token)--> /api/mcp --> Supabase
                                                                     |
Distributor dashboard (login) <--- pending offers ---------------------+
        | Approve (edit if needed)
        v
public link  /o/<slug>  --> buyer opens it, taps "I'm interested" --> counted on dashboard
```

### MCP tools

| Tool | What it does |
| --- | --- |
| `upload_catalogue` | Add/update products (name, price, unit) and auto-find pictures. Matches on name case-insensitively, so repeats don't duplicate. |
| `list_products` | List the catalogue (so Claude can map names to ids). |
| `manage_group` | Create a buyer group if needed, add/remove a contact (removal by phone). |
| `list_groups` | List groups with member counts. |
| `create_offer` | Save an offer (headline, discount, dates, WhatsApp `share_message`) as **pending**. Never visible to buyers until approved. |

### Approval flow

`create_offer` only ever inserts `status = 'pending'` and does not create a share link. The distributor opens the offer card in the dashboard, edits any field, and clicks **Approve**. Only then is a random link slug generated and the offer becomes visible at `/o/<slug>`. Rejected or pending offers show "This offer is no longer available."

### Security model

- Each distributor has a personal MCP token. The server resolves it to exactly one `distributor_id` and scopes every read/write to it. `create_offer` also checks that the product ids and group id belong to that distributor.
- The dashboard uses a Supabase session with Row Level Security policies (see `supabase/schema.sql`) plus explicit `distributor_id` filters.
- The public page and the interest endpoint use the service-role key server-side only, and match only `status = 'approved'` offers. The service-role key is never sent to the browser.
- The token can be regenerated from the Connect page (this invalidates the old one immediately).

## Features beyond the basics

- **Catalogue upload:** Products → *Upload catalogue* accepts a text-based PDF, CSV or TXT (`Product | Price | Unit`, one per line), shows a preview, and adds up to 10 products per upload. A sample file is available in the modal (`public/sample-catalogue.pdf`).
- **Product pictures:** when a product is added (upload, form or MCP), a picture is looked up by name from the free [Open Food Facts](https://world.openfoodfacts.org) and Open Products Facts databases (no API key). A match requires every word of the product name, so wrong pictures are avoided. Coverage is best-effort: if nothing is found, the offer image shows a letter placeholder and the Products page has a "Find picture" button.
- **Offer image:** on approval, a 1080x1080 shareable graphic (headline, discount, product pictures, prices, validity) is rendered server-side at `/o/<slug>/image` with Satori. No AI. The public page uses it as the link preview (`og:image`).
- **WhatsApp sharing:** the dashboard's *Share image + message* uses the device share sheet with the image attached (choose WhatsApp, then search any contact). The message is the `share_message` that Claude wrote in `create_offer` (editable before approval). Fallbacks: download/copy image, copy message, per-contact `wa.me` chat links. WhatsApp does not allow attaching an image through a plain link, hence the share sheet.

## Guardrails

Deterministic rules in `lib/guardrails.ts` (no AI) run on every MCP tool, every dashboard form, and again when you click Approve:

- Only FMCG: blocks adult content, illegal drugs, weapons, hate/extremism, gambling/crypto/loans and prescription medicine terms in product names, groups, offers and messages.
- No personal data in public offers: phone numbers, emails and links are rejected, so buyer details cannot leak into an offer.
- Sanity limits: discount at most 90%, valid price range, no past or far-future dates, max 20 offers per 24h, 30 pending offers, 500 products, 500 contacts per group.
- Offers can only reference the distributor's own catalogue and groups, and are always saved as pending until a human approves them.
- The MCP server also sends the connected model a scope statement (`instructions`) telling it to refuse non-FMCG requests and never put personal data in offers.

Limitation: the app cannot control what a distributor's own Claude/ChatGPT says in chat outside these tools. It can refuse to store or publish anything outside its purpose, and a human approves every offer.

## Tech stack

Next.js 14 (App Router) + TypeScript, Tailwind, Supabase (Postgres + Auth), `@modelcontextprotocol/sdk` (stateless Streamable HTTP in a Next.js route), deployable to Vercel.

## Run it yourself

**Prerequisites:** Node 20+, a free [Supabase](https://supabase.com) project.

1. **Clone and install**
   ```bash
   git clone https://github.com/adityakumar0707/schemes-broadcast-mcp.git
   cd schemes-broadcast-mcp
   npm install
   ```
2. **Create the database.** In the Supabase SQL editor, run the contents of `supabase/schema.sql`. (If you created the database from an earlier version, also run `supabase/migrations/002_images_and_share_message.sql`.)
3. **Configure env vars.** Copy `.env.example` to `.env.local` and fill in:
   | Variable | Where to find it |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service-role / secret key. **Server only. Never commit it.** |
   | `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally, your deployed URL in production |
4. **Start**
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000/signup` and create an account. (Signup pre-confirms the email so you can start immediately.)

## Connect Claude or ChatGPT

1. Log in and open **Connect Claude** in the dashboard.
2. Copy the connector URL. It looks like `https://<your-domain>/api/mcp?token=<your-token>`.
3. In Claude: **Settings → Connectors → Add custom connector** and paste it. In ChatGPT: **Settings → Connectors** (developer mode / custom connector) and paste it.
4. Clients that support headers can use `https://<your-domain>/api/mcp` with `Authorization: Bearer <token>` instead.

Claude.ai cannot reach `localhost`. For the full Claude flow, deploy first (below). To test locally, use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector): `npx @modelcontextprotocol/inspector`, choose Streamable HTTP, and enter your local connector URL.

> Treat the token like a password. If it leaks, click **Regenerate token**.

## Deploy to Vercel

1. Fork/import this repo into Vercel.
2. Add the four env vars above. Set `NEXT_PUBLIC_APP_URL` to your Vercel URL (for example `https://your-app.vercel.app`).
3. Deploy, sign up on the deployed site, and use the Connect page URL in Claude.

## Try this demo conversation in Claude

1. "Add my products: Tata Salt ₹22/kg, Surf Excel ₹180/kg" → appears under **Products**
2. "Create a group called Faridabad with Ramesh 9876543210" → appears under **Groups**
3. "10% off Tata Salt for the Faridabad group, valid till Friday" → a **pending** card appears on the dashboard
4. Open the card, edit a field, click **Approve** → you get a live link and a WhatsApp share button
5. Open the link in a private window (no login) and tap **I'm interested** → the count updates on the dashboard

## Project layout

```
app/api/mcp/route.ts        MCP endpoint (token auth, stateless)
lib/mcp/server.ts           the 5 tool definitions
app/dashboard/              offers, approval screen, products, groups, connect
app/o/[slug]/               public offer page (+ app/api/o/[slug]/interest)
app/api/signup/route.ts     creates auth user + distributor row
supabase/schema.sql         tables + RLS policies
```

## Scope and limitations

This is an MVP. Intentionally out of scope: WhatsApp Business API (sharing uses `wa.me` deep links, so the distributor taps send), Google Contacts import, payments, SMS/email notifications, team accounts, analytics beyond the interest count. The "Contact us" link on the public page is a placeholder (`hello@example.com`); change it in `app/o/[slug]/page.tsx`.

## License

MIT
