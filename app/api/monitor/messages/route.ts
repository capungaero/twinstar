import { NextResponse } from "next/server";
import { readTelegramInbox } from "@/lib/telegram-inbox";
import { readKirimiInbox } from "@/lib/kirimi-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type MonitorMessage = {
  id: string;
  source: "telegram" | "kirimi";
  timestamp: string;
  sender: string;
  senderPhone?: string;
  text: string;
  kind: "message" | "ai_request";
  isAiRequest: boolean;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const source = searchParams.get("source"); // "telegram", "kirimi", or null for both

    const results: MonitorMessage[] = [];

    // Fetch Telegram messages
    if (!source || source === "telegram") {
      const telegramMessages = await readTelegramInbox(limit);
      results.push(
        ...telegramMessages.map((item, idx) => ({
          id: `telegram-${item.updateId}`,
          source: "telegram" as const,
          timestamp: item.receivedAt,
          sender: item.username ? `@${item.username}` : item.fromName || String(item.fromId) || "Unknown",
          text: item.text || "[non-text message]",
          kind: item.kind,
          isAiRequest: item.kind === "ai_request"
        }))
      );
    }

    // Fetch Kirimi (WhatsApp) messages
    if (!source || source === "kirimi") {
      const kirimiMessages = await readKirimiInbox(limit);
      results.push(
        ...kirimiMessages.map((item) => ({
          id: `kirimi-${item.receivedAt}-${item.fromPhone}`,
          source: "kirimi" as const,
          timestamp: item.receivedAt,
          sender: item.fromPhone,
          senderPhone: item.fromPhone,
          text: item.text,
          kind: item.kind,
          isAiRequest: item.kind === "ai_request"
        }))
      );
    }

    // Sort by timestamp descending
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      ok: true,
      total: results.length,
      messages: results.slice(0, limit)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
