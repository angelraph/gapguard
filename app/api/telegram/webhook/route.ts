import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { fetchLoanRisks } from "@/lib/kamino/portfolio";
import { levelFor, riskiestLoan, shortWallet, SITE_URL, statusMessage } from "@/lib/alerts/rules";
import {
  addWallet,
  getChat,
  MAX_WALLETS_PER_CHAT,
  removeChat,
  removeWallet,
  setState,
} from "@/lib/alerts/store";
import { escapeHtml, sendMessage, webhookSecret } from "@/lib/alerts/telegram";

/**
 * POST /api/telegram/webhook
 *
 * Telegram calls this for every message sent to the bot. People subscribe
 * by opening t.me/<bot>?start=<wallet> from the Your risk page, or by
 * sending a wallet address. Nothing here can move funds: it only reads
 * public loan data.
 */

type Update = { message?: { chat: { id: number; type: string }; text?: string } };

const HELP =
  `<b>GapGuard warns you before a stock move can liquidate your Kamino loan.</b>\n\n` +
  `Send me a Solana wallet address and I'll watch its loans on Kamino's xStocks market. I'll message you:\n` +
  `• on Friday before the stock market closes for the weekend\n` +
  `• if your safety cushion drops under 15%, 10% or 5%\n` +
  `• on Monday before the market opens\n\n` +
  `/status how safe your loan is right now\n` +
  `/wallets the wallets you're watching\n` +
  `/remove &lt;wallet&gt; stop watching one\n` +
  `/stop turn off all alerts\n\n` +
  `Read-only: I never ask you to connect a wallet or sign anything. Anyone who messages you claiming to be GapGuard support and asks for your seed phrase is a scammer.`;

function validWallet(text: string): string | null {
  const t = text.trim();
  if (t.length < 32 || t.length > 44) return null;
  try {
    return new PublicKey(t).toBase58();
  } catch {
    return null;
  }
}

async function status(wallet: string): Promise<string> {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) return "I can't read Kamino right now. Try again in a few minutes.";
  try {
    return statusMessage(wallet, await fetchLoanRisks(rpcUrl, wallet));
  } catch {
    return `I couldn't read the loan for ${shortWallet(wallet)} just now. Kamino or the Solana network may be busy. Try /status again in a minute.`;
  }
}

async function subscribe(chatId: string, wallet: string): Promise<string> {
  const result = await addWallet(chatId, wallet);
  if (result === "full") {
    return `You're already watching ${MAX_WALLETS_PER_CHAT} wallets, the most one chat can watch. Use /remove to drop one first.`;
  }

  const intro =
    result === "already"
      ? `You're already watching this wallet. Here's where it stands:`
      : `Done. I'm now watching wallet ${shortWallet(wallet)} and will message you before it's in danger.`;

  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) return intro;
  try {
    const loans = await fetchLoanRisks(rpcUrl, wallet);
    // Start the warning level where the loan already is, so the first check
    // doesn't repeat what this reply already says.
    const loan = riskiestLoan(loans);
    await setState(chatId, wallet, {
      level: loan ? levelFor(loan.dropToLiquidation) : null,
      hadLoan: loan !== null,
      missing: 0,
    });
    return `${intro}\n\n${statusMessage(wallet, loans)}`;
  } catch {
    // The first scheduled check will catch up.
    return `${intro}\n\nI couldn't read the loan just now, but I'll check again within 5 minutes.`;
  }
}

async function handle(chatId: string, text: string): Promise<string> {
  const [rawCommand, ...args] = text.trim().split(/\s+/);
  const command = rawCommand.toLowerCase().replace(/@\w+$/, "");
  const arg = args.join(" ");

  if (command === "/start") {
    const wallet = arg ? validWallet(arg) : null;
    if (wallet) return subscribe(chatId, wallet);
    return `${HELP}\n\nTo begin, paste your Solana wallet address here.`;
  }
  if (command === "/help") return HELP;

  if (command === "/status") {
    const chat = await getChat(chatId);
    if (!chat?.wallets.length) return "You're not watching any wallet yet. Paste a Solana wallet address to start.";
    const parts = await Promise.all(chat.wallets.map((w) => status(w)));
    return parts.join("\n\n");
  }

  if (command === "/wallets") {
    const chat = await getChat(chatId);
    if (!chat?.wallets.length) return "You're not watching any wallet yet. Paste a Solana wallet address to start.";
    return `You're watching:\n${chat.wallets.map((w) => `• <code>${w}</code>`).join("\n")}\n\nTo stop one, send /remove followed by its address.`;
  }

  if (command === "/remove") {
    const chat = await getChat(chatId);
    if (!chat?.wallets.length) return "You're not watching any wallet.";
    const wallet = arg ? validWallet(arg) : chat.wallets.length === 1 ? chat.wallets[0] : null;
    if (!wallet) return "Send /remove followed by the wallet address you want to stop watching. /wallets lists them.";
    return (await removeWallet(chatId, wallet))
      ? `Stopped watching ${shortWallet(wallet)}.`
      : `You weren't watching ${shortWallet(wallet)}.`;
  }

  if (command === "/stop") {
    await removeChat(chatId);
    return "All alerts are off and I've forgotten your wallets. Paste an address any time to start again.";
  }

  const wallet = validWallet(text);
  if (wallet) return subscribe(chatId, wallet);

  return `I didn't understand "${escapeHtml(text.slice(0, 60))}". Paste a Solana wallet address to get alerts for it, or send /help.\n\nYou can also check any wallet at ${SITE_URL}/portfolio`;
}

export async function POST(req: Request) {
  const secret = webhookSecret();
  // Locally, with no bot token, it runs open so the flow can be tested.
  const allowed = secret
    ? req.headers.get("x-telegram-bot-api-secret-token") === secret
    : process.env.NODE_ENV !== "production";
  if (!allowed) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const update = (await req.json().catch(() => ({}))) as Update;
  const message = update.message;
  // Private chats only: alerts about someone's loan don't belong in a group.
  if (!message?.text || message.chat.type !== "private") return NextResponse.json({ ok: true });

  const chatId = String(message.chat.id);
  try {
    await sendMessage(chatId, await handle(chatId, message.text));
  } catch (err) {
    console.error("telegram webhook failed:", err);
  }
  // Always 200, or Telegram keeps retrying the same message.
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;
