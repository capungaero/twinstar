type KirimiSendMessageInput = {
  receiver: string;
  message: string;
};

function getKirimiBaseUrl() {
  return (process.env.KIRIMI_API_BASE_URL?.trim() || "https://api.kirimi.id").replace(/\/+$/, "");
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} belum diisi di .env`);
  }

  return value;
}

export function normalizeKirimiPhoneNumber(input: string) {
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("62")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  return digits;
}

export function isMatchingKirimiNumber(a: string | null | undefined, b: string) {
  if (!a) return false;

  const left = normalizeKirimiPhoneNumber(a);
  const right = normalizeKirimiPhoneNumber(b);
  return Boolean(left && right && left === right);
}

export async function sendKirimiMessage(input: KirimiSendMessageInput) {
  const userCode = getRequiredEnv("KIRIMI_USER_CODE");
  const deviceId = getRequiredEnv("KIRIMI_DEVICE_ID");
  const secret = getRequiredEnv("KIRIMI_SECRET");
  const receiver = normalizeKirimiPhoneNumber(input.receiver);
  if (!receiver) {
    throw new Error("Nomor penerima Kirimi tidak valid.");
  }

  const payload: Record<string, string> = {
    user_code: userCode,
    phone: receiver,
    message: input.message,
    secret,
    device_id: deviceId
  };

  const response = await fetch(`${getKirimiBaseUrl()}/v1/send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || (data && typeof data === "object" && "success" in data && data.success === false)) {
    throw new Error(`Kirimi send-message gagal: ${JSON.stringify(data ?? { status: response.status })}`);
  }

  return data;
}
