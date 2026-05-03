const fs = require("node:fs");
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

async function main() {
  const cwd = process.cwd();
  const envFromFile = loadDotEnv(path.join(cwd, ".env"));
  const inboxPath = path.join(cwd, ".telegram", "inbox.jsonl");
  const limit = Number(process.argv[2] || 20);
  const resolvedLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;

  if (!fs.existsSync(inboxPath)) {
    console.log("Inbox Telegram belum ada.");
    return;
  }

  const content = fs.readFileSync(inboxPath, "utf8");
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(-resolvedLimit);

  console.log(`Inbox Telegram (${rows.length} pesan terakhir)`);
  for (const item of rows) {
    const sender = item.username ? `@${item.username}` : item.fromName || item.fromId || "unknown";
    const text = item.kind === "ai_request" ? item.aiPrompt || item.text || "[empty ai prompt]" : item.text || "[non-text message]";
    const label = item.kind === "ai_request" ? "ai_request" : "message";
    console.log(`[${item.receivedAt}] kind=${label} chat=${item.chatId} sender=${sender} text=${text}`);
  }

  if (envFromFile.TELEGRAM_BOT_TOKEN) {
    console.log("Token Telegram terdeteksi di .env.");
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
