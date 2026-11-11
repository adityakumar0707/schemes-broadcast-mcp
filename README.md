# Schemes Broadcast MCP

A B2B tool for FMCG distributors. The distributor's **own Claude or ChatGPT** drafts combo offers and discounts through MCP tools, the distributor **approves them on a web dashboard**, and the app generates a **public shareable link** that buyers (kirana retailers) open with no login.

> **There is no AI/LLM API key anywhere in this codebase.** All generation happens in the distributor's own Claude/ChatGPT session. This app is a plain CRUD backend + an MCP tool surface + a dashboard + a public offer page.

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
| `upload_catalogue` | Add/update products (name, price, unit). Matches on name case-insensitively, so repeats don't duplicate. |
| `list_products` | List the catalogue (so Claude can map names to ids). |
| `manage_group` | Create a buyer group if needed, add/remove a contact (removal by phone). |
| `list_groups` | List groups with member counts. |
| `create_offer` | Save an offer as **pending**. It is never visible to buyers until approved. |

### Approval flow

`create_offer` only ever inserts `status = 'pending'` and does not create a share link. The distributor opens the offer card in the dashboard, edits any field, and clicks **Approve**. Only then is a random link slug generated and the offer becomes visible at `/o/<slug>`. Rejected or pending offers show "This offer is no longer available."

### Security model

- Each distributor has a personal MCP token. The server resolves it to exactly one `distributor_id` and scopes every read/write to it. `create_offer` also checks that the product ids and group id belong to that distributor.
- The dashboard uses a Supabase session with Row Level Security policies (see `supabase/schema.sql`) plus explicit `distributor_id` filters.
- The public page and the interest endpoint use the service-role key server-side only, and match only `status = 'approved'` offers. The service-role key is never sent to the browser.
- The token can be regenerated from the Connect page (this invalidates the old one immediately).

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
2. **Create the database.** In the Supabase SQL editor, run the contents of `supabase/schema.sql`.
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
