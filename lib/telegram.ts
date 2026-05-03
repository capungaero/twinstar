type TelegramSendOptions = {
  token?: string;
  chatId?: string;
  message: string;
};

function getEnvValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function getTelegramConfig() {
  const token = getEnvValue("TELEGRAM_BOT_TOKEN");
  const chatId = getEnvValue("TELEGRAM_CHAT_ID");

  return { token, chatId };
}

export async function sendTelegramMessage({ token, chatId, message }: TelegramSendOptions) {
  const resolvedToken = token ?? getEnvValue("TELEGRAM_BOT_TOKEN");
  const resolvedChatId = chatId ?? getEnvValue("TELEGRAM_CHAT_ID");

  if (!resolvedToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing.");
  }

  if (!resolvedChatId) {
    throw new Error("TELEGRAM_CHAT_ID is missing.");
  }

  const response = await fetch(`https://api.telegram.org/bot${resolvedToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: resolvedChatId,
      text: message
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return response.json();
}
