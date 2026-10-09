import { createHash } from "crypto";

/**
 * A tiny Telegram Bot API client: just the calls GapGuard needs. Free, no
 * package. With no bot token during local development, messages are printed
 * to the server log instead of sent, so the flow can be tested offline.
 */

const API = "https://api.telegram.org";

export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

/**
 * The secret Telegram sends back with every webhook call, so nobody else can
 * pretend to be Telegram. Derived from the bot token, so there's one less
 * setting to manage.
 */
export function webhookSecret(): string | null {
  const token = botToken();
  return token ? createHash("sha256").update(`gapguard-webhook:${token}`).digest("hex").slice(0, 48) : null;
}

export class TelegramBlockedError extends Error {}

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = botToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string; error_code?: number };
  if (!json.ok) {
    // 403 means the person blocked the bot or deleted the chat.
    if (json.error_code === 403) throw new TelegramBlockedError(json.description ?? "blocked");
    throw new Error(`Telegram ${method} failed: ${json.description ?? res.status}`);
  }
  return json.result as T;
}

/** Sends an HTML-formatted message. Throws TelegramBlockedError if the person blocked the bot. */
export async function sendMessage(chatId: string, html: string): Promise<void> {
  if (!botToken() && process.env.NODE_ENV !== "production") {
    console.log(`[telegram dev] to ${chatId}:\n${html}\n`);
    return;
  }
  await call("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

let cachedUsername: string | null = null;

/** The bot's @username, looked up once. Null if no bot is set up. */
export async function botUsername(): Promise<string | null> {
  if (cachedUsername) return cachedUsername;
  if (!botToken()) return null;
  try {
    const me = await call<{ username: string }>("getMe", {});
    cachedUsername = me.username;
    return cachedUsername;
  } catch {
    return null;
  }
}

/** Points Telegram at our webhook and sets the command menu. Run once after deploying. */
export async function configureBot(webhookUrl: string): Promise<{ username: string }> {
  await call("setWebhook", {
    url: webhookUrl,
    secret_token: webhookSecret(),
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  await call("setMyCommands", {
    commands: [
      { command: "status", description: "How safe your loan is right now" },
      { command: "wallets", description: "The wallets you're watching" },
      { command: "remove", description: "Stop watching one wallet" },
      { command: "stop", description: "Turn off all alerts" },
      { command: "help", description: "What this bot does" },
    ],
  });
  await call("setMyDescription", {
    description:
      "GapGuard warns you before a weekend stock move can liquidate your Kamino loan. Send your Solana wallet address to start. Read-only: it never asks to connect or sign anything.",
  });
  const me = await call<{ username: string }>("getMe", {});
  return { username: me.username };
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
