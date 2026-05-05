import fs from "node:fs/promises";
import path from "node:path";

export type KirimiInboxItem = {
  kind: "message" | "ai_request";
  source: "kirimi";
  receivedAt: string;
  fromPhone: string;
  toPhone: string;
  text: string;
  aiPrompt: string | null;
  raw: unknown;
};

const INBOX_FILE_PATH = path.join(process.cwd(), ".kirimi", "inbox.jsonl");

async function ensureInboxDir() {
  await fs.mkdir(path.dirname(INBOX_FILE_PATH), { recursive: true });
}

function stringifyInboxItem(item: KirimiInboxItem) {
  return `${JSON.stringify(item)}\n`;
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

export function formatKirimiPhoneNumber(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("62")) {
    return `+${digits}`;
  }
  return `+62${digits.replace(/^0/, "")}`;
}

export async function appendKirimiInboxItem(payload: unknown, fromPhone: string, toPhone: string, text: string) {
  const aiPrompt = parseAiPrompt(text);
  const item: KirimiInboxItem = {
    kind: aiPrompt ? "ai_request" : "message",
    source: "kirimi",
    receivedAt: new Date().toISOString(),
    fromPhone,
    toPhone,
    text,
    aiPrompt,
    raw: payload
  };

  await ensureInboxDir();
  await fs.appendFile(INBOX_FILE_PATH, stringifyInboxItem(item), "utf8");
  return item;
}

export async function readKirimiInbox(limit = 20) {
  try {
    const content = await fs.readFile(INBOX_FILE_PATH, "utf8");
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed = lines.map((line) => {
      try {
        return JSON.parse(line) as KirimiInboxItem;
      } catch {
        return null;
      }
    });

    return parsed.filter((item): item is KirimiInboxItem => item !== null).slice(-Math.max(1, limit));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}
