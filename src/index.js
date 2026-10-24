import { displayName, escapeHtml, getForwardOrigin, toId } from "./identifiers.js";
import { sendMessage, telegramApi } from "./telegram.js";
import { handleInlineQuery as handleInlineQueryV2 } from "./inline.js";

const HELP_TEXT = [
  "<b>UserInfo — راهنمای بات</b>",
  "",
  "/id — نمایش شناسهٔ کاربر و چت جاری",
  "/id در پاسخ به پیام — نمایش شناسهٔ فرستندهٔ آن پیام، در صورت دسترسی",
  "/id @username — تلاش برای شناسایی گروه یا کانال عمومی",
  "/me — نمایش شناسه و اطلاعات حساب شما",
  "/help — نمایش این راهنما",
  "",
  "برای بررسی مبدأ یک پیام فورواردشده، آن را در گفت‌وگوی خصوصی با بات فوروارد کنید.",
  "برای دریافت شناسهٔ خود در هر گفت‌وگو، بات را در Inline Mode فراخوانی کنید (پس از فعال‌کردن این قابلیت در BotFather).",
  "",
  "محدودیت تلگرام: شناسهٔ هر کاربر دلخواهی را نمی‌توان صرفاً از روی @username بازیابی کرد؛ اطلاعات فوروارد هم ممکن است پنهان باشد."
].join("\n");

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function responseJson(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function commandOf(text = "") {
  const match = String(text).trim().match(/^\/([a-z0-9_]+)(?:@[a-z0-9_]+)?(?:\s+([\s\S]*))?$/i);
  return match ? { command: match[1].toLowerCase(), args: (match[2] || "").trim() } : null;
}

function line(label, value) {
  return value === null || value === undefined || value === ""
    ? null
    : `<b>${escapeHtml(label)}:</b> <code>${escapeHtml(value)}</code>`;
}

function userLines(user, prefix = "کاربر") {
  if (!user) return [`<b>${escapeHtml(prefix)}:</b> اطلاعات فرستنده در این Update موجود نیست.`];
  return [
    line(`${prefix} — نام`, displayName(user)),
    line(`${prefix} — شناسه`, toId(user.id)),
    user.username ? line(`${prefix} — نام کاربری`, `@${user.username}`) : null,
    user.is_bot ? line(`${prefix} — نوع حساب`, "bot") : null,
  ].filter(Boolean);
}

function forwardLines(origin) {
  if (!origin) return [];
  const rows = [line("مبدأ فوروارد", origin.label)];
  if (origin.name) rows.push(line("نام مبدأ", origin.name));
  if (origin.username) rows.push(line("نام کاربری مبدأ", `@${origin.username}`));
  if (origin.id !== null) rows.push(line("شناسهٔ مبدأ", origin.id));
  if (origin.messageId !== null) rows.push(line("شناسهٔ پیام مبدأ", origin.messageId));
  if (origin.type === "hidden_user") {
    rows.push("تلگرام هویت یا شناسهٔ این فرستنده را در اختیار بات نگذاشته است.");
  } else if (origin.id === null) {
    rows.push("شناسهٔ مبدأ در اطلاعات دریافتی تلگرام موجود نیست.");
  }
  return rows.filter(Boolean);
}

export function describeMessage(message) {
  const chat = message.chat || {};
  const rows = [
    "<b>اطلاعات شناسه</b>",
    line("شناسهٔ چت", toId(chat.id)),
    line("نوع چت", chat.type),
    chat.title ? line("عنوان چت", chat.title) : null,
    chat.username ? line("نام کاربری چت", `@${chat.username}`) : null,
    line("شناسهٔ پیام", toId(message.message_id)),
    "",
    ...userLines(message.from, "فرستنده"),
  ].filter(item => item !== null);

  if (message.reply_to_message) {
    rows.push("", "<b>پیامِ پاسخ‌داده‌شده</b>", ...userLines(message.reply_to_message.from, "فرستندهٔ پیام"));
    rows.push(...[
      line("شناسهٔ پیام مورد پاسخ", toId(message.reply_to_message.message_id)),
    ].filter(Boolean));
    const repliedOrigin = getForwardOrigin(message.reply_to_message);
    if (repliedOrigin) rows.push(...forwardLines(repliedOrigin));
  }

  const origin = getForwardOrigin(message);
  if (origin) rows.push("", "<b>مبدأ فوروارد</b>", ...forwardLines(origin));

  return rows.join("\n");
}

async function lookupPublicChat(env, chatReference) {
  const result = await telegramApi(env, "getChat", { chat_id: chatReference });
  const rows = [
    "<b>اطلاعات چت</b>",
    line("شناسه", toId(result.id)),
    line("نوع", result.type),
    result.title ? line("عنوان", result.title) : null,
    result.username ? line("نام کاربری", `@${result.username}`) : null,
    result.description ? line("توضیحات", result.description.slice(0, 500)) : null,
  ].filter(Boolean);
  return rows.join("\n");
}

async function handleMessage(message, env) {
  if (!message?.chat?.id) return;

  const command = commandOf(message.text || message.caption || "");
  if (command) {
    if (command.command === "start" || command.command === "help") {
      await sendMessage(env, message.chat.id, HELP_TEXT, message.message_id);
      return;
    }

    if (command.command === "me") {
      await sendMessage(env, message.chat.id, ["<b>اطلاعات حساب شما</b>", ...userLines(message.from)].join("\n"), message.message_id);
      return;
    }

    if (command.command === "id" || command.command === "info") {
      if (command.args) {
        // getChat resolves public groups/channels and chats known to this bot.
        // It is not a general @username -> user ID resolver.
        try {
          const text = await lookupPublicChat(env, command.args);
          await sendMessage(env, message.chat.id, text, message.message_id);
        } catch {
          await sendMessage(
            env,
            message.chat.id,
            "نتوانستم این مورد را از طریق Bot API به‌عنوان یک چت قابل‌دسترسی شناسایی کنم. این قابلیت برای گروه‌ها و کانال‌های عمومی است؛ شناسهٔ هر کاربر دلخواهی را نمی‌توان فقط از روی @username بازیابی کرد.",
            message.message_id,
          );
        }
        return;
      }
      await sendMessage(env, message.chat.id, describeMessage(message), message.message_id);
      return;
    }
  }

  // In private chats, forwarding a message to the bot is a convenient way
  // to inspect source metadata. Group conversations are not auto-replied to.
  if (message.chat.type === "private" && getForwardOrigin(message)) {
    const origin = getForwardOrigin(message);
    await sendMessage(env, message.chat.id, ["<b>اطلاعات پیام فورواردشده</b>", ...forwardLines(origin)].join("\n"), message.message_id);
  }
}

async function handleInlineQuery(query, env) {
  const user = query?.from;
  if (!query?.id || !user?.id) return;

  const text = [
    "<b>شناسهٔ حساب تلگرام شما</b>",
    line("User ID", toId(user.id)),
    line("نام", displayName(user)),
    user.username ? line("نام کاربری", `@${user.username}`) : null,
  ].filter(Boolean).join("\n");

  await telegramApi(env, "answerInlineQuery", {
    inline_query_id: query.id,
    is_personal: true,
    cache_time: 0,
    results: [{
      type: "article",
      id: `user-${user.id}`,
      title: "نمایش شناسهٔ تلگرام من",
      description: `User ID: ${user.id}`,
      input_message_content: {
        message_text: text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      },
    }],
  });
}

async function processUpdate(update, env) {
  if (update.inline_query) {
    await handleInlineQueryV2(update.inline_query, env);
    return;
  }
  if (update.message) {
    await handleMessage(update.message, env);
    return;
  }
  if (update.channel_post) {
    // Channel posts are inspected only when they contain a supported command.
    await handleMessage(update.channel_post, env);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return responseJson({ status: "ok", service: "userinfo-bot-dev" });
    }

    if (url.pathname !== "/webhook") {
      return new Response("Not Found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
    }
    if (!env.TELEGRAM_WEBHOOK_SECRET) {
      console.error("Worker secret TELEGRAM_WEBHOOK_SECRET is not configured");
      return new Response("Webhook unavailable", { status: 503 });
    }

    const suppliedSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
    if (!constantTimeEqual(suppliedSecret, env.TELEGRAM_WEBHOOK_SECRET)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 1_000_000) {
      return new Response("Payload Too Large", { status: 413 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400 });
    }
    if (!update || !Number.isInteger(update.update_id)) {
      return new Response("Invalid Update", { status: 400 });
    }

    // ACK promptly. Handler errors are logged without payload or token values.
    ctx.waitUntil(processUpdate(update, env).catch(error => {
      console.error("Telegram update processing failed", {
        updateId: update.update_id,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }));

    return new Response("OK", { status: 200, headers: { "cache-control": "no-store" } });
  },
};

export { handleInlineQuery, processUpdate };
