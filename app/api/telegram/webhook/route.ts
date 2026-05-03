import { NextResponse } from "next/server";
import { appendTelegramInboxItem, mapTelegramUpdateToInboxItem } from "@/lib/telegram-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySecret(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return true;
  }

  return request.headers.get("x-telegram-bot-api-secret-token") === expected;
}

export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const inboxItem = mapTelegramUpdateToInboxItem(update);

  if (!inboxItem) {
    return NextResponse.json({ ok: true, stored: false });
  }

  await appendTelegramInboxItem(inboxItem);

  return NextResponse.json({ ok: true, stored: true });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Telegram webhook is active. Send POST updates from Telegram here."
  });
}
