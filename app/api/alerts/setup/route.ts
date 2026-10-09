import { NextResponse } from "next/server";
import { configureBot } from "@/lib/alerts/telegram";

/**
 * GET /api/alerts/setup?key=CRON_SECRET
 *
 * Open this once after deploying (or after changing the bot token). It tells
 * Telegram where to send messages for the bot and sets its command menu.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const url = new URL(req.url);
  if (!secret || url.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  try {
    const { username } = await configureBot(`${url.origin}/api/telegram/webhook`);
    return NextResponse.json({
      ok: true,
      bot: `@${username}`,
      next: `Message https://t.me/${username} and send /start to try it.`,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
