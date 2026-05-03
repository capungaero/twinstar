import { NextResponse } from "next/server";
import { buildAiSearchResponse } from "@/lib/ai-search";
import { isMatchingKirimiNumber, normalizeKirimiPhoneNumber, sendKirimiMessage } from "@/lib/kirimi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === "object" && value !== null;
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getNestedRecord(value: unknown, key: string) {
  if (!isRecord(value)) return null;
  const nested = value[key];
  return isRecord(nested) ? nested : null;
}

function extractIncomingText(payload: unknown) {
  if (!isRecord(payload)) {
    return "";
  }

  const data = getNestedRecord(payload, "data") ?? payload;
  const message = getNestedRecord(data, "message") ?? data;

  return pickFirstString(
    message.message,
    message.text,
    message.content,
    message.body,
    data.message,
    data.text,
    data.content,
    data.body,
    payload.message,
    payload.text
  );
}

function extractIncomingNumber(payload: unknown) {
  if (!isRecord(payload)) {
    return "";
  }

  const data = getNestedRecord(payload, "data") ?? payload;
  const message = getNestedRecord(data, "message") ?? data;
  const chat = getNestedRecord(message, "chat") ?? getNestedRecord(data, "chat") ?? null;

  return pickFirstString(
    message.receiver,
    message.from,
    message.sender,
    message.phone,
    message.number,
    chat?.receiver,
    chat?.from,
    chat?.sender,
    chat?.phone,
    chat?.number,
    data.receiver,
    data.from,
    data.sender,
    data.phone,
    data.number,
    payload.receiver,
    payload.from,
    payload.sender,
    payload.phone,
    payload.number
  );
}

function stripAiPrefix(text: string) {
  if (/^\/ai\s*:?\s*$/i.test(text.trim())) {
    return "";
  }

  const match = text.match(/^\/ai\s*:?\s*([\s\S]+)$/i);
  return match ? match[1].trim() : text.trim();
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "kirimi-webhook" });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, handled: false, reason: "Invalid JSON" }, { status: 400 });
  }

  const incomingText = extractIncomingText(body);
  const incomingNumber = normalizeKirimiPhoneNumber(extractIncomingNumber(body));
  const targetNumber = normalizeKirimiPhoneNumber(process.env.KIRIMI_TARGET_NUMBER || process.env.KIRIMI_REPLY_TO_NUMBER || "085272447141");

  if (!incomingText) {
    return NextResponse.json({ ok: true, handled: false, reason: "No text message" });
  }

  if (targetNumber && incomingNumber && !isMatchingKirimiNumber(incomingNumber, targetNumber)) {
    return NextResponse.json({ ok: true, handled: false, reason: "Message ignored for non-target number" });
  }

  const query = stripAiPrefix(incomingText);
  if (!query) {
    return NextResponse.json({ ok: true, handled: false, reason: "Empty query" });
  }

  const search = await buildAiSearchResponse(query);
  const replyText = search.replyText;

  if (!replyText) {
    return NextResponse.json({ ok: false, handled: false, reason: "Empty reply text" }, { status: 500 });
  }

  const receiver = incomingNumber || targetNumber;
  if (!receiver) {
    return NextResponse.json({ ok: false, handled: false, reason: "No receiver detected" }, { status: 400 });
  }

  await sendKirimiMessage({
    receiver,
    message: replyText
  });

  return NextResponse.json({
    ok: true,
    handled: true,
    receiver,
    query,
    results: {
      totalResults: search.totalResults,
      totalSales: search.totalSales,
      totalProfit: search.totalProfit
    }
  });
}
