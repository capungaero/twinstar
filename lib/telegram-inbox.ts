import fs from "node:fs/promises";
import path from "node:path";

export type TelegramInboxItem = {
  kind: "message" | "ai_request";
  receivedAt: string;
  updateId: number;
  chatId: number | string | null;
  messageId: number | null;
  fromId: number | string | null;
  fromName: string | null;
  username: string | null;
  text: string | null;
  command: string | null;
  aiPrompt: string | null;
  raw: unknown;
};

const INBOX_FILE_PATH = path.join(process.cwd(), ".telegram", "inbox.jsonl");
type UnknownRecord = Record<string, unknown>;

async function ensureInboxDir() {
  await fs.mkdir(path.dirname(INBOX_FILE_PATH), { recursive: true });
}

function stringifyInboxItem(item: TelegramInboxItem) {
  return `${JSON.stringify(item)}\n`;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

function getNestedRecord(parent: UnknownRecord, key: string) {
  const value = parent[key];
  return isRecord(value) ? value : null;
}

function getRecordValue(parent: UnknownRecord | null, key: string): unknown {
  if (!parent) {
    return null;
  }

  return parent[key];
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getNumberLike(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? value : null;
}

function getTelegramMessage(update: unknown) {
  if (!isRecord(update)) {
    return null;
  }

  return (
    getNestedRecord(update, "message") ??
    getNestedRecord(update, "edited_message") ??
    getNestedRecord(update, "channel_post") ??
    getNestedRecord(update, "edited_channel_post")
  );
}

export function mapTelegramUpdateToInboxItem(update: unknown): TelegramInboxItem | null {
  const message = getTelegramMessage(update);

  if (!message) {
    return null;
  }

  const chat = getNestedRecord(message, "chat");
  const from = getNestedRecord(message, "from");
  const text = getString(getRecordValue(message, "text")) ?? getString(getRecordValue(message, "caption"));
  const aiPrompt = parseAiPrompt(text);

  return {
    kind: aiPrompt ? "ai_request" : "message",
    receivedAt: new Date().toISOString(),
    updateId: Number(getNumberLike(getRecordValue(isRecord(update) ? update : null, "update_id")) ?? 0),
    chatId: getNumberLike(getRecordValue(chat, "id")),
    messageId: Number(getNumberLike(getRecordValue(message, "message_id")) ?? 0),
    fromId: getNumberLike(getRecordValue(from, "id")),
    fromName: [getString(getRecordValue(from, "first_name")), getString(getRecordValue(from, "last_name"))].filter(Boolean).join(" ") || null,
    username: getString(getRecordValue(from, "username")),
    text,
    command: aiPrompt ? "/ai" : null,
    aiPrompt,
    raw: update
  };
}

function parseAiPrompt(text: string | null) {
  if (!text) {
    return null;
  }

  const match = text.match(/^\/ai\s*:\s*([\s\S]+)$/i);
  if (!match) {
    return null;
  }

  const prompt = match[1].trim();
  return prompt.length > 0 ? prompt : null;
}

export function formatInboxItem(item: TelegramInboxItem) {
  const sender = item.username ? `@${item.username}` : item.fromName || item.fromId || "unknown";
  const time = new Date(item.receivedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

  if (item.kind === "ai_request") {
    return `[${time}] AI request from ${sender}: ${item.aiPrompt || item.text || ""}`;
  }

  return `[${time}] Message from ${sender}: ${item.text || "[non-text message]"}`;
}

export async function appendTelegramInboxItem(item: TelegramInboxItem) {
  await ensureInboxDir();
  await fs.appendFile(INBOX_FILE_PATH, stringifyInboxItem(item), "utf8");
}

export async function readTelegramInbox(limit = 20) {
  try {
    const content = await fs.readFile(INBOX_FILE_PATH, "utf8");
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed = lines.map((line) => {
      try {
        return JSON.parse(line) as TelegramInboxItem;
      } catch {
        return null;
      }
    });

    return parsed.filter((item): item is TelegramInboxItem => item !== null).slice(-Math.max(1, limit));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}
