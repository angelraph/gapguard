/**
 * Who gets alerts for which wallet, and what each of them was last told.
 *
 * Stored in Upstash Redis over its REST API (free tier, no extra package).
 * Holds only Telegram chat ids, public wallet addresses and alert state:
 * nothing private. With no Upstash keys set during local development, it
 * falls back to memory so the whole flow can be tested offline.
 */

export const MAX_WALLETS_PER_CHAT = 5;

export type ChatRecord = { wallets: string[]; since: string };

export type AlertState = {
  /** The lowest warning level already sent (0.15, 0.10, 0.05, 0), or null. */
  level: number | null;
  /** New York date of the last Friday and Monday messages, so each is sent once. */
  friday?: string;
  monday?: string;
  /** Did this wallet have a loan at the last check, and how many checks has it been missing? */
  hadLoan?: boolean;
  missing?: number;
};

export type RunSummary = { at: string; chats: number; wallets: number; sent: number; errors: number };

const P = "gg:";

function upstash(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function storeConfigured(): boolean {
  return upstash() !== null || process.env.NODE_ENV !== "production";
}

// Local development only.
const memory = new Map<string, string>();
const memorySets = new Map<string, Set<string>>();

async function redis(command: (string | number)[]): Promise<unknown> {
  const cfg = upstash();
  if (!cfg) {
    if (process.env.NODE_ENV === "production") throw new Error("Upstash Redis is not configured");
    return memoryCommand(command.map(String));
  }
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (!res.ok || json.error) throw new Error(`Redis ${command[0]} failed: ${json.error ?? res.status}`);
  return json.result;
}

function memoryCommand([cmd, key, ...rest]: string[]): unknown {
  switch (cmd) {
    case "GET":
      return memory.get(key) ?? null;
    case "SET":
      memory.set(key, rest[0]);
      return "OK";
    case "DEL":
      memory.delete(key);
      return 1;
    case "SADD":
      (memorySets.get(key) ?? memorySets.set(key, new Set()).get(key)!).add(rest[0]);
      return 1;
    case "SREM":
      memorySets.get(key)?.delete(rest[0]);
      return 1;
    case "SMEMBERS":
      return [...(memorySets.get(key) ?? [])];
    default:
      throw new Error(`memory store: ${cmd} not supported`);
  }
}

async function getJson<T>(key: string): Promise<T | null> {
  const raw = await redis(["GET", key]);
  return typeof raw === "string" ? (JSON.parse(raw) as T) : null;
}

async function setJson(key: string, value: unknown): Promise<void> {
  await redis(["SET", key, JSON.stringify(value)]);
}

export async function listChats(): Promise<string[]> {
  return ((await redis(["SMEMBERS", `${P}chats`])) as string[]) ?? [];
}

export async function getChat(chatId: string): Promise<ChatRecord | null> {
  return getJson<ChatRecord>(`${P}chat:${chatId}`);
}

/** Adds a wallet to a chat. Returns false if the chat is already at the limit. */
export async function addWallet(chatId: string, wallet: string): Promise<"added" | "already" | "full"> {
  const chat = (await getChat(chatId)) ?? { wallets: [], since: new Date().toISOString() };
  if (chat.wallets.includes(wallet)) return "already";
  if (chat.wallets.length >= MAX_WALLETS_PER_CHAT) return "full";
  chat.wallets.push(wallet);
  await setJson(`${P}chat:${chatId}`, chat);
  await redis(["SADD", `${P}chats`, chatId]);
  return "added";
}

export async function removeWallet(chatId: string, wallet: string): Promise<boolean> {
  const chat = await getChat(chatId);
  if (!chat || !chat.wallets.includes(wallet)) return false;
  chat.wallets = chat.wallets.filter((w) => w !== wallet);
  await redis(["DEL", `${P}state:${chatId}:${wallet}`]);
  if (chat.wallets.length === 0) {
    await removeChat(chatId);
  } else {
    await setJson(`${P}chat:${chatId}`, chat);
  }
  return true;
}

export async function removeChat(chatId: string): Promise<void> {
  const chat = await getChat(chatId);
  for (const w of chat?.wallets ?? []) await redis(["DEL", `${P}state:${chatId}:${w}`]);
  await redis(["DEL", `${P}chat:${chatId}`]);
  await redis(["SREM", `${P}chats`, chatId]);
}

export async function getState(chatId: string, wallet: string): Promise<AlertState> {
  return (await getJson<AlertState>(`${P}state:${chatId}:${wallet}`)) ?? { level: null };
}

export async function setState(chatId: string, wallet: string, state: AlertState): Promise<void> {
  await setJson(`${P}state:${chatId}:${wallet}`, state);
}

export async function getLastRun(): Promise<RunSummary | null> {
  return getJson<RunSummary>(`${P}lastRun`);
}

export async function setLastRun(summary: RunSummary): Promise<void> {
  await setJson(`${P}lastRun`, summary);
}
