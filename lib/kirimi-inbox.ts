import { supabaseInsert, supabaseSelect } from "@/lib/supabase";

export type KirimiInboxItem = {
  id?: number;
  kind: "message" | "ai_request";
  source: "kirimi";
  received_at: string;
  from_phone: string;
  to_phone: string;
  text: string;
  ai_prompt: string | null;
  raw?: unknown;
};

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
    received_at: new Date().toISOString(),
    from_phone: fromPhone,
    to_phone: toPhone,
    text,
    ai_prompt: aiPrompt,
    raw: payload
  };

  await supabaseInsert("wa_inbox", {
    source: item.source,
    received_at: item.received_at,
    from_phone: item.from_phone,
    to_phone: item.to_phone,
    text: item.text,
    kind: item.kind,
    ai_prompt: item.ai_prompt,
    raw: payload
  });

  return item;
}

export async function readKirimiInbox(limit = 50): Promise<KirimiInboxItem[]> {
  const rows = await supabaseSelect<{
    id: number;
    received_at: string;
    source: string;
    from_phone: string;
    to_phone: string;
    text: string;
    kind: string;
    ai_prompt: string | null;
    raw: unknown;
  }>("wa_inbox", { limit: String(limit) });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as "message" | "ai_request",
    source: "kirimi",
    received_at: row.received_at,
    from_phone: row.from_phone,
    to_phone: row.to_phone,
    text: row.text,
    ai_prompt: row.ai_prompt
  }));
}

