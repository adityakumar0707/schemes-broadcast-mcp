import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildServer } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Token via "Authorization: Bearer <token>" or "?token=<token>" (for connector UIs with only a URL field).
async function resolveDistributor(req: Request): Promise<string | null> {
  const h = req.headers.get("authorization");
  const token = h?.match(/^Bearer\s+(.+)$/i)?.[1] ?? new URL(req.url).searchParams.get("token");
  if (!token) return null;
  const { data } = await supabaseAdmin().from("distributors").select("id").eq("mcp_token", token).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function handle(req: Request) {
  const distributorId = await resolveDistributor(req);
  if (!distributorId)
    return Response.json({ jsonrpc: "2.0", error: { code: -32001, message: "Invalid or missing MCP token" }, id: null }, { status: 401 });
  // Stateless: fresh server + transport per request (serverless-friendly), bound to this distributor.
  const server = buildServer(distributorId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
