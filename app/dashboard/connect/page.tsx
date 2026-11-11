import { requireDistributor } from "@/lib/distributor";
import { baseUrl } from "@/lib/url";
import { regenerateToken } from "../actions";
import CopyButton from "@/components/CopyButton";

export default async function Connect() {
  const { distributor } = await requireDistributor();
  const url = `${baseUrl()}/api/mcp`;
  const urlWithToken = `${url}?token=${distributor.mcp_token}`;
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Connect Claude or ChatGPT</h1>
      <div className="card space-y-3 text-sm">
        <p>1. In Claude (Settings → Connectors → Add custom connector) or ChatGPT (Settings → Connectors), paste the URL below.</p>
        <p>2. If your client has no auth field, use the URL with token. Otherwise send the token as a Bearer token.</p>
      </div>
      <div className="card space-y-2">
        <p className="text-sm font-medium">Connector URL (with token)</p>
        <code className="block break-all rounded bg-gray-100 p-2 text-xs">{urlWithToken}</code>
        <CopyButton text={urlWithToken} label="Copy URL" />
      </div>
      <div className="card space-y-2">
        <p className="text-sm font-medium">Base URL + personal token (Bearer)</p>
        <code className="block break-all rounded bg-gray-100 p-2 text-xs">{url}</code>
        <code className="block break-all rounded bg-gray-100 p-2 text-xs">{distributor.mcp_token}</code>
        <div className="flex gap-2"><CopyButton text={url} label="Copy URL" /><CopyButton text={distributor.mcp_token} label="Copy token" /></div>
      </div>
      <form action={regenerateToken} className="card">
        <p className="mb-2 text-sm text-gray-600">Regenerating invalidates the old token immediately; reconnect your client afterwards.</p>
        <button className="btn-danger">Regenerate token</button>
      </form>
    </div>
  );
}
