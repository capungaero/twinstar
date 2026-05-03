import { NextResponse } from "next/server";
import { readTelegramInbox } from "@/lib/telegram-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? 20);
  const inbox = await readTelegramInbox(Number.isFinite(limit) ? limit : 20);

  return NextResponse.json({
    ok: true,
    count: inbox.length,
    inbox
  });
}
