/**
 * Minimal fetch-based Telegram Bot API client; no third-party dependencies.
 * Error messages intentionally omit request URLs and bot tokens.
 */
export async function telegramApi(env, method, payload = {}) {
  if (!env.BOT_TOKEN) {
    throw new Error("Missing Cloudflare Worker secret: BOT_TOKEN");
  }

  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Telegram API ${method} returned a non-JSON response`);
  }

  if (!response.ok || data?.ok !== true) {
    const code = Number(data?.error_code || response.status);
    const description = String(data?.description || "unknown error").slice(0, 240);
    throw new Error(`Telegram API ${method} failed (${code}): ${description}`);
  }

  return data.result;
}

export function sendMessage(env, chatId, text, replyToMessageId = null) {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  };

  if (replyToMessageId !== null && replyToMessageId !== undefined) {
    payload.reply_parameters = { message_id: replyToMessageId, allow_sending_without_reply: true };
  }

  return telegramApi(env, "sendMessage", payload);
}
