import { NextResponse } from "next/server";
import { buildAiSearchResponse } from "@/lib/ai-search";
import { normalizeKirimiPhoneNumber, sendKirimiMessage } from "@/lib/kirimi";
import { appendKirimiInboxItem } from "@/lib/kirimi-inbox";

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

function findFirstStringByKeys(value: unknown, keys: string[], depth = 0): string {
  if (!isRecord(value) || depth > 6) {
    return "";
  }

  for (const [key, child] of Object.entries(value)) {
    if (keys.includes(key.toLowerCase()) && typeof child === "string" && child.trim()) {
      return child.trim();
    }
  }

  for (const child of Object.values(value)) {
    const found = findFirstStringByKeys(child, keys, depth + 1);
    if (found) {
      return found;
    }
  }

  return "";
}

function findFirstBooleanByKeys(value: unknown, keys: string[], depth = 0): boolean | null {
  if (!isRecord(value) || depth > 6) {
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    if (!keys.includes(key.toLowerCase())) {
      continue;
    }

    if (typeof child === "boolean") {
      return child;
    }

    if (typeof child === "string") {
      const normalized = child.toLowerCase().trim();
      if (["true", "1", "yes", "outgoing", "sent", "from_me"].includes(normalized)) return true;
      if (["false", "0", "no", "incoming", "received"].includes(normalized)) return false;
    }
  }

  for (const child of Object.values(value)) {
    const found = findFirstBooleanByKeys(child, keys, depth + 1);
    if (found !== null) {
      return found;
    }
  }

  return null;
}

function isOutgoingMessage(payload: unknown) {
  return (
    findFirstBooleanByKeys(payload, ["fromme", "from_me", "isfromme", "is_from_me", "outgoing", "sentbyme", "sent_by_me"]) === true
  );
}

// Format Kirimi: payload flat langsung di root
// { from, name, event, msgId, groupId, message, isFromMe, isFromGroup, messageType, participant, ... }
function extractKirimiText(payload: RecordLike): string {
  const msgType = typeof payload.messageType === "string" ? payload.messageType : "";
  // Jika messageType dikenal berisi teks
  if (["text", "chat", "extendedtext", "extended_text", ""].includes(msgType.toLowerCase())) {
    const text = pickFirstString(payload.message, payload.text, payload.body, payload.caption, payload.content);
    if (text && text !== "[unknown]") return text;
  }
  // Pesan media: tampilkan info tipe
  if (msgType && msgType !== "unknown") {
    const caption = pickFirstString(payload.caption, payload.message !== "[unknown]" ? payload.message : "");
    const typeLabel: Record<string, string> = {
      image: "[Gambar]", video: "[Video]", audio: "[Audio]", document: "[Dokumen]",
      sticker: "[Stiker]", voice: "[Pesan Suara]", gif: "[GIF]", location: "[Lokasi]",
      contact: "[Kontak]", poll: "[Polling]", reaction: "[Reaksi]"
    };
    const label = typeLabel[msgType.toLowerCase()] || `[${msgType}]`;
    return caption ? `${label}: ${caption}` : label;
  }
  return "";
}

function extractIncomingText(payload: unknown) {
  if (!isRecord(payload)) return "";
  // Kirimi flat format
  if (typeof payload.event === "string" || typeof payload.isFromGroup === "boolean") {
    return extractKirimiText(payload);
  }
  // Fallback format lama (nested)
  const data = getNestedRecord(payload, "data") ?? payload;
  const message = getNestedRecord(data, "message") ?? data;
  return pickFirstString(
    message.message, message.text, message.content, message.body,
    data.message, data.text, data.content, data.body,
    payload.message, payload.text,
    findFirstStringByKeys(payload, ["text", "body", "content", "caption", "conversation", "message"])
  );
}

function extractIncomingNumber(payload: unknown) {
  if (!isRecord(payload)) return "";
  // Kirimi flat format: gunakan participant untuk grup, from untuk pribadi
  if (typeof payload.event === "string" || typeof payload.isFromGroup === "boolean") {
    const isGroup = payload.isFromGroup === true;
    if (isGroup && typeof payload.participant === "string" && payload.participant) {
      return payload.participant as string;
    }
    const from = typeof payload.from === "string" ? payload.from.replace(/@.*$/, "") : "";
    return from;
  }
  // Fallback format lama
  const data = getNestedRecord(payload, "data") ?? payload;
  const message = getNestedRecord(data, "message") ?? data;
  const chat = getNestedRecord(message, "chat") ?? getNestedRecord(data, "chat") ?? null;
  return pickFirstString(
    message.receiver, message.from, message.sender, message.phone, message.number,
    chat?.receiver, chat?.from, chat?.sender, chat?.phone, chat?.number,
    data.receiver, data.from, data.sender, data.phone, data.number,
    payload.receiver, payload.from, payload.sender, payload.phone, payload.number,
    findFirstStringByKeys(payload, ["from", "sender", "phone", "number", "remotejid", "remote_jid", "participant"])
  );
}

function extractSenderName(payload: unknown): string {
  if (!isRecord(payload)) return "";
  return typeof payload.name === "string" ? payload.name : "";
}

function extractGroupId(payload: unknown): string {
  if (!isRecord(payload)) return "";
  return typeof payload.groupId === "string" ? payload.groupId.replace(/@.*$/, "") : "";
}

function extractIsFromGroup(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  return payload.isFromGroup === true;
}

function extractMessageType(payload: unknown): string {
  if (!isRecord(payload)) return "text";
  return typeof payload.messageType === "string" ? payload.messageType : "text";
}

function stripAiPrefix(text: string) {
  const cleaned = text.replace(/^(?:\s*Pencarian AI:\s*)+/i, "").trim();

  if (/^\/ai\s*:?\s*$/i.test(cleaned)) {
    return "";
  }

  const match = cleaned.match(/^\/ai\s*:?\s*([\s\S]+)$/i);
  return match ? match[1].trim() : cleaned;
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "kirimi-webhook" });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, handled: false, reason: "Invalid JSON" }, { status: 400 });
  }

  // Log raw payload untuk debugging (terlihat di Vercel Function Logs)
  console.log("[kirimi-webhook] RAW PAYLOAD:", JSON.stringify(body, null, 2));

  const incomingText = extractIncomingText(body);
  const incomingNumber = normalizeKirimiPhoneNumber(extractIncomingNumber(body));
  const senderName = extractSenderName(body);
  const groupId = extractGroupId(body);
  const isFromGroup = extractIsFromGroup(body);
  const messageType = extractMessageType(body);
  const targetNumber = normalizeKirimiPhoneNumber(process.env.KIRIMI_TARGET_NUMBER || process.env.KIRIMI_REPLY_TO_NUMBER || "085272447141");

  console.log("[kirimi-webhook] text:", incomingText, "| from:", incomingNumber, "| name:", senderName, "| group:", isFromGroup, groupId, "| isOutgoing:", isOutgoingMessage(body));

  if (isOutgoingMessage(body) || /^Pencarian AI:/i.test((incomingText || "").trim())) {
    return NextResponse.json({ ok: true, handled: false, reason: "Outgoing or bot reply ignored" });
  }

  // Simpan SEMUA pesan masuk ke inbox (termasuk media)
  try {
    await appendKirimiInboxItem(body, incomingNumber, targetNumber, incomingText || `[${messageType}]`, senderName, groupId, isFromGroup, messageType);
  } catch (inboxError) {
    console.error("Failed to save Kirimi message to inbox:", inboxError);
  }

  if (!incomingText) {
    return NextResponse.json({ ok: true, handled: false, reason: "No text content, saved as media message" });
  }

  // Auto-reply AI hanya aktif jika pesan diawali /ai: atau /ai <spasi>
  const autoReplyEnabled = process.env.KIRIMI_AUTO_REPLY === "true";
  if (!autoReplyEnabled) {
    return NextResponse.json({ ok: true, handled: true, reason: "Auto-reply disabled, message saved to inbox" });
  }

  // Hanya proses jika pesan diawali dengan perintah /ai
  const isAiCommand = /^\/ai\s*:/i.test(incomingText.trim());
  if (!isAiCommand) {
    return NextResponse.json({ ok: true, handled: false, reason: "Not an AI command, message saved to inbox only" });
  }

  const query = stripAiPrefix(incomingText);
  if (!query) {
    return NextResponse.json({ ok: true, handled: false, reason: "Empty query" });
  }

  try {
    const search = await buildAiSearchResponse(query);
    const replyText = search.replyText;

    if (!replyText) {
      return NextResponse.json({ ok: false, handled: false, reason: "Empty reply text" }, { status: 500 });
    }

    const receiver = targetNumber || incomingNumber;
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Kirimi webhook error";
    return NextResponse.json({ ok: false, handled: false, reason: message }, { status: 500 });
  }
}
