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
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || envFromFile.TELEGRAM_WEBHOOK_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || envFromFile.TELEGRAM_WEBHOOK_SECRET;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diisi.");
  }

  if (!webhookUrl) {
    throw new Error("TELEGRAM_WEBHOOK_URL belum diisi.");
  }

  const url = `${webhookUrl.replace(/\/$/, "")}/api/telegram/webhook`;
  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      url,
      secret_token: secret || undefined,
      drop_pending_updates: true
    })
  });

  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(`Gagal set webhook: ${JSON.stringify(payload)}`);
  }

  console.log(`Webhook terdaftar: ${url}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
