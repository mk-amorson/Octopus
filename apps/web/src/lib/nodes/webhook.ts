// Single source of truth for the public URL of an inbound webhook.
// Both the runtime (manager.ts, when it calls setWebhook on the
// external service) and the serialiser (serialize.ts, when it hands
// the URL to the UI) funnel through here. Changing the shape of the
// URL — e.g. adding `/hooks/v2/` — means editing one file.

const API_BASE = (process.env["OCTOPUS_PUBLIC_URL"] ?? "").replace(/\/$/, "");

export function webhookUrl(nodeId: string, slug: string): string {
  if (!API_BASE || !slug) return "";
  return `${API_BASE}/api/hooks/${slug}/${nodeId}`;
}

export function hasPublicUrl(): boolean {
  return API_BASE !== "";
}
