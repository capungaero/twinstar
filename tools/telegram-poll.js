const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function getString(value) {
  return typeof value === "string" ? value : null;
}

function getTelegramMessage(update) {
  if (!isRecord(update)) {
    return null;
  }

  return update.message ?? update.edited_message ?? update.channel_post ?? update.edited_channel_post ?? null;
}

function parseAiPrompt(text) {
  if (!text) {
    return null;
  }

  const match = text.match(/^\/ai\s*:?\s*([\s\S]+)$/i);
  if (!match) {
    return null;
  }

  const prompt = match[1].trim();
  return prompt.length > 0 ? prompt : null;
}

async function ensureDir(filePath) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

async function appendJsonl(filePath, item) {
  await ensureDir(filePath);
  await fsp.appendFile(filePath, `${JSON.stringify(item)}\n`, "utf8");
}

async function telegramApi(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload ?? {})
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${JSON.stringify(data)}`);
  }

  return data.result;
}

async function getUpdates(token, offset, timeoutSeconds) {
  const params = new URLSearchParams();
  params.set("timeout", String(timeoutSeconds));
  params.set("offset", String(offset));
  params.set("allowed_updates", JSON.stringify(["message", "edited_message", "channel_post", "edited_channel_post"]));

  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?${params.toString()}`);
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram getUpdates failed: ${JSON.stringify(data)}`);
  }

  return data.result;
}

async function deleteWebhook(token) {
  return telegramApi(token, "deleteWebhook", { drop_pending_updates: false });
}

function asLogLine(item) {
  const sender = item.username ? `@${item.username}` : item.fromName || item.fromId || "unknown";
  const time = new Date(item.receivedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const text = item.kind === "ai_request" ? item.aiPrompt || item.text || "" : item.text || "[non-text message]";
  return `[${time}] kind=${item.kind} chat=${item.chatId} sender=${sender} text=${text}`;
}

async function main() {
  const cwd = process.cwd();
  const env = loadDotEnv(path.join(cwd, ".env"));
  const token = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diisi.");
  }

  const pollIntervalMs = Number(env.TELEGRAM_POLL_INTERVAL_MS || process.env.TELEGRAM_POLL_INTERVAL_MS || 1000);
  const longPollSeconds = Number(env.TELEGRAM_LONG_POLL_SECONDS || process.env.TELEGRAM_LONG_POLL_SECONDS || 25);
  const inboxPath = path.join(cwd, ".telegram", "inbox.jsonl");
  const aiQueuePath = path.join(cwd, ".telegram", "ai-requests.jsonl");
  const disableWebhookOnStart = String(env.TELEGRAM_DISABLE_WEBHOOK_ON_START || process.env.TELEGRAM_DISABLE_WEBHOOK_ON_START || "true").toLowerCase() !== "false";

  if (disableWebhookOnStart) {
    await deleteWebhook(token);
    console.log("Webhook Telegram dimatikan.");
  }

  let offset = Number(env.TELEGRAM_UPDATE_OFFSET || process.env.TELEGRAM_UPDATE_OFFSET || 0);
  if (!Number.isFinite(offset) || offset < 0) {
    offset = 0;
  }

  console.log("Polling Telegram dimulai.");

  while (true) {
    const updates = await getUpdates(token, offset, longPollSeconds);

    for (const update of updates) {
      offset = Math.max(offset, Number(update.update_id || 0) + 1);
      const message = getTelegramMessage(update);
      if (!message) {
        continue;
      }

      const text = getString(message.text) || getString(message.caption);
      const chat = isRecord(message.chat) ? message.chat : null;
      const from = isRecord(message.from) ? message.from : null;
      const aiPrompt = parseAiPrompt(text);

      const item = {
        kind: aiPrompt ? "ai_request" : "message",
        receivedAt: new Date().toISOString(),
        updateId: Number(update.update_id || 0),
        chatId: chat?.id ?? null,
        messageId: message.message_id ?? null,
        fromId: from?.id ?? null,
        fromName: [getString(from?.first_name), getString(from?.last_name)].filter(Boolean).join(" ") || null,
        username: getString(from?.username),
        text: text || null,
        command: aiPrompt ? "/ai" : null,
        aiPrompt,
        raw: update
      };

      await appendJsonl(inboxPath, item);
      console.log(asLogLine(item));

      if (aiPrompt) {
        await appendJsonl(aiQueuePath, item);
        console.log(`AI request queued: ${aiPrompt}`);

        try {
          await telegramApi(token, "sendMessage", {
            chat_id: chat?.id,
            text: `Perintah diterima:\n${aiPrompt}`
          });
          console.log("AI acknowledgment sent.");
        } catch (error) {
          console.error(`Failed to send AI acknowledgment: ${error.message}`);
        }
      }
    }

    if (pollIntervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
