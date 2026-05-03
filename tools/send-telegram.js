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
  const token = process.env.TELEGRAM_BOT_TOKEN || envFromFile.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || envFromFile.TELEGRAM_CHAT_ID;
  const message = process.argv.slice(2).join(" ").trim() || "Tes Telegram dari Codex";

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diisi.");
  }

  if (!chatId) {
    throw new Error("TELEGRAM_CHAT_ID belum diisi.");
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message
    })
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(`Telegram gagal: ${JSON.stringify(payload)}`);
  }

  console.log("Telegram terkirim:", payload.result.message_id);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
