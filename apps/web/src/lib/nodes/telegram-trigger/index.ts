// Telegram Bot trigger. User pastes a bot token; on enable the node
// registers a webhook with Telegram pointing at
// `<publicUrl>/api/hooks/telegram/<nodeId>`. Every incoming update is
// traced. That's it — for v1 there's no "reply" path (would be an
// action node, one we'll add alongside the DAG executor in v2).
//
// Two things need to be set for this to work end-to-end:
//   1. `OCTOPUS_PUBLIC_URL` must be a reachable HTTPS URL that
//      Telegram can POST to. The installer sets this to
//      `https://<domain><basePath>` when the user configured Caddy;
//      without a domain, telegram bots are skipped with a readable
//      trace explaining why.
//   2. The bot token the user pasted must be valid. We call
//      `deleteWebhook` first to clear any stale registration, then
//      `setWebhook`. setWebhook's 200 OK response is the success
//      signal — a 401 / 404 comes back as a clear trace.

import type { NodeDefinition } from "../types";

type Config = {
  botToken: string;
};

const API = "https://api.telegram.org";

async function call(token: string, method: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!res.ok || !json.ok) {
    throw new Error(`telegram ${method}: ${json.description ?? res.statusText}`);
  }
  return json.result;
}

export const telegramTrigger: NodeDefinition<Config> = {
  id: "telegram.trigger",
  name: "Telegram Bot",
  category: "Triggers",
  kind: "trigger",
  description:
    "Receives messages sent to your Telegram bot. Paste a bot token from @BotFather and incoming updates stream into the trace panel.",
  webhookPathSlug: "telegram",
  fields: [
    {
      key: "botToken",
      label: "Bot token",
      type: "text",
      placeholder: "123456:ABC-DEF…",
      secret: true,
      required: true,
    },
  ],
  defaults: () => ({ botToken: "" }),

  async start(cfg, ctx) {
    if (!cfg.botToken || cfg.botToken.trim() === "") {
      throw new Error("bot token is empty");
    }
    if (!ctx.webhookUrl) {
      throw new Error(
        "no public URL configured — install Octopus with a domain so Telegram can reach the webhook",
      );
    }
    const token = cfg.botToken.trim();

    // Identify the bot so the trace panel shows something useful.
    const me = (await call(token, "getMe")) as { username?: string };
    ctx.trace("info", `connected as @${me.username ?? "unknown"}`);

    // Clear any stale registration before setting our own; otherwise a
    // bot that was previously wired to a different host gets confused.
    await call(token, "deleteWebhook", { drop_pending_updates: false });
    await call(token, "setWebhook", {
      url: ctx.webhookUrl,
      allowed_updates: ["message", "edited_message", "callback_query"],
    });
    ctx.trace("info", `webhook set → ${ctx.webhookUrl}`);

    return async () => {
      try {
        await call(token, "deleteWebhook", { drop_pending_updates: false });
        ctx.trace("info", "webhook cleared");
      } catch (err) {
        ctx.trace("warn", `deleteWebhook failed: ${(err as Error).message}`);
      }
    };
  },
};

/**
 * Shape check used by the webhook route. Not a full validator — just
 * enough to reject obvious garbage and pick a short human label for
 * the trace.
 */
export function describeUpdate(update: unknown): { label: string; from?: string } {
  if (typeof update !== "object" || update === null) return { label: "unknown update" };
  const u = update as Record<string, unknown>;
  const msg = (u["message"] ?? u["edited_message"]) as
    | { text?: string; from?: { username?: string; first_name?: string } }
    | undefined;
  if (msg) {
    const text = typeof msg.text === "string" ? msg.text : "(non-text message)";
    const from = msg.from?.username
      ? `@${msg.from.username}`
      : msg.from?.first_name ?? "anon";
    return { label: text.length > 120 ? text.slice(0, 117) + "…" : text, from };
  }
  if (u["callback_query"]) return { label: "callback_query" };
  return { label: Object.keys(u).filter((k) => k !== "update_id").join(",") || "update" };
}
