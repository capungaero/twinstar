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

async function ensureInboxDir() {
  await fs.mkdir(path.dirname(INBOX_FILE_PATH), { recursive: true });
}

function stringifyInboxItem(item: TelegramInboxItem) {
  return `${JSON.stringify(item)}\n`;
}

export function mapTelegramUpdateToInboxItem(update: any): TelegramInboxItem | null {
  const message = update?.message ?? update?.edited_message ?? update?.channel_post ?? update?.edited_channel_post;

  if (!message) {
    return null;
  }

  const text = typeof message?.text === "string" ? message.text : typeof message?.caption === "string" ? message.caption : null;
  const aiPrompt = parseAiPrompt(text);

  return {
    kind: aiPrompt ? "ai_request" : "message",
    receivedAt: new Date().toISOString(),
    updateId: Number(update?.update_id ?? 0),
    chatId: message?.chat?.id ?? null,
    messageId: message?.message_id ?? null,
    fromId: message?.from?.id ?? null,
    fromName: [message?.from?.first_name, message?.from?.last_name].filter(Boolean).join(" ") || null,
    username: message?.from?.username ?? null,
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
