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

function normalizePhoneNumber(input) {
  const digits = String(input || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

async function main() {
  const cwd = process.cwd();
  const env = loadDotEnv(path.join(cwd, ".env"));
  const userCode = env.KIRIMI_USER_CODE || process.env.KIRIMI_USER_CODE;
  const secret = env.KIRIMI_SECRET || process.env.KIRIMI_SECRET;
  const deviceId = env.KIRIMI_DEVICE_ID || process.env.KIRIMI_DEVICE_ID;
  const baseUrl = (env.KIRIMI_API_BASE_URL || process.env.KIRIMI_API_BASE_URL || "https://api.kirimi.id").replace(/\/+$/, "");
  const receiver = normalizePhoneNumber(process.argv[2] || env.KIRIMI_TARGET_NUMBER || process.env.KIRIMI_TARGET_NUMBER);
  const message = process.argv.slice(3).join(" ") || "Tes Kirimi dari Codex.";

  if (!userCode || !secret) {
    throw new Error("KIRIMI_USER_CODE dan KIRIMI_SECRET harus diisi.");
  }

  if (!deviceId) {
    throw new Error("KIRIMI_DEVICE_ID harus diisi.");
  }

  if (!receiver) {
    throw new Error("Nomor penerima tidak valid.");
  }

  const payload = { user_code: userCode, phone: receiver, message, secret, device_id: deviceId };

  const response = await fetch(`${baseUrl}/v1/send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Kirimi send-message failed: ${JSON.stringify(data)}`);
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
