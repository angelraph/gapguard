import { NextResponse, after } from "next/server";
import { getCensus, refreshCensus } from "@/lib/kamino/census";
import { fetchLoanRisks, type LoanRisk } from "@/lib/kamino/portfolio";
import { newYorkClock } from "@/lib/marketData/session";
import { planAlerts } from "@/lib/alerts/rules";
import { getChat, getState, listChats, removeChat, setLastRun, setState } from "@/lib/alerts/store";
import { sendMessage, TelegramBlockedError } from "@/lib/alerts/telegram";

/**
 * GET /api/alerts/check?key=CRON_SECRET
 *
 * Called every 5 minutes by a free scheduler (cron-job.org). Reads each
 * watched wallet's Kamino loans once, decides which messages are due, and
 * sends them on Telegram. Returns only counts.
 */

const WALLET_CONCURRENCY = 3;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const url = new URL(req.url);
  const given = url.searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer /, "");
  // Locally, with no secret set, it runs open so the flow can be tested.
  if (secret ? given !== secret : process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const rpcUrl = process.env.SOLANA_RPC_URL;
  if (!rpcUrl) return NextResponse.json({ error: "SOLANA_RPC_URL is not configured." }, { status: 500 });

  const clock = newYorkClock();
  const chats = await listChats();
  const records = await Promise.all(chats.map(async (id) => ({ id, chat: await getChat(id) })));

  // Read each wallet once, even if several chats watch it.
  const wallets = [...new Set(records.flatMap((r) => r.chat?.wallets ?? []))];
  const loansByWallet = new Map<string, LoanRisk[]>();
  let errors = 0;
  for (let i = 0; i < wallets.length; i += WALLET_CONCURRENCY) {
    await Promise.all(
      wallets.slice(i, i + WALLET_CONCURRENCY).map(async (w) => {
        try {
          loansByWallet.set(w, await fetchLoanRisks(rpcUrl, w));
        } catch (err) {
          // Skip this wallet this round; never treat a failed read as "no loan".
          errors++;
          console.error(`alerts: reading ${w} failed:`, err);
        }
      })
    );
  }

  let sent = 0;
  for (const { id, chat } of records) {
    if (!chat) continue;
    try {
      for (const wallet of chat.wallets) {
        const loans = loansByWallet.get(wallet);
        if (!loans) continue;
        const previous = await getState(id, wallet);
        const { messages, state } = planAlerts(wallet, loans, previous, clock);
        for (const m of messages) {
          await sendMessage(id, m);
          sent++;
        }
        await setState(id, wallet, state);
      }
    } catch (err) {
      if (err instanceof TelegramBlockedError) {
        // They blocked the bot: stop watching for them.
        await removeChat(id);
      } else {
        errors++;
        console.error(`alerts: chat ${id} failed:`, err);
      }
    }
  }

  const summary = { at: new Date().toISOString(), chats: records.length, wallets: wallets.length, sent, errors };
  await setLastRun(summary);

  // Keep the command center's shock map fresh, after this response is sent.
  after(async () => {
    const { stale } = await getCensus(rpcUrl).catch(() => ({ stale: true }));
    if (stale) await refreshCensus(rpcUrl).catch((err) => console.error("census refresh failed:", err));
  });
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
