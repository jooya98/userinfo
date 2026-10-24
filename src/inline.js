import { displayName, escapeHtml, toId } from "./identifiers.js";
import { telegramApi } from "./telegram.js";

function result(id, title, description, text) {
  return { type: "article", id: String(id).slice(0, 64), title, description,
    input_message_content: { message_text: text, parse_mode: "HTML",
      link_preview_options: { is_disabled: true } } };
}

function idResult(user) {
  const rows = ["<b>شناسهٔ حساب تلگرام شما</b>",
    user.id == null ? null : `<b>User ID:</b> <code>${escapeHtml(user.id)}</code>`,
    displayName(user) ? `<b>نام:</b> <code>${escapeHtml(displayName(user))}</code>` : null,
    user.username ? `<b>نام کاربری:</b> <code>@${escapeHtml(user.username)}</code>` : null
  ].filter(Boolean).join("\n");
  return result(`me-${user.id}`, "نمایش شناسهٔ تلگرام من", `User ID: ${user.id}`, rows);
}

const helpText = [
  "<b>UserInfo — راهنمای Inline</b>", "",
  "<code>me</code> یا <code>id</code> — نمایش شناسهٔ خودتان",
  "<code>@username</code> یا <code>chat @username</code> — تلاش برای شناسایی گروه یا کانال",
  "<code>id -100123456789</code> — بررسی شناسهٔ عددی چت",
  "<code>help</code> — این راهنما", "",
  "Inline شناسهٔ چت مقصد یا پیامِ ریپلای‌شده را در اختیار بات نمی‌گذارد.",
  "برای بررسی فرستنده یا پیام فورواردشده از <code>/id</code> در همان چت یا فوروارد به پی‌وی بات استفاده کنید.",
  "Bot API راه عمومی برای تبدیل نام کاربری هر شخص به User ID ارائه نمی‌کند."
].join("\n");

function helpResult() {
  return result("inline-help", "راهنمای قابلیت‌های Inline",
    "شناسهٔ کاربر، جست‌وجوی گروه/کانال و فوروارد", helpText);
}

function failureResult(reference) {
  const text = [
    "<b>امکان شناسایی این مورد نبود</b>",
    `<b>ورودی:</b> <code>${escapeHtml(reference)}</code>`, "",
    "این جست‌وجو از Telegram Bot API استفاده می‌کند؛ این API امکان تبدیل عمومی نام کاربری هر شخص به شناسه را ندارد.",
    "برای گروه یا کانال عمومی، <code>@username</code> را امتحان کنید. برای کاربر، از <code>/id</code> در پاسخ به پیام او استفاده کنید."
  ].join("\n");
  return result("lookup-failed", "نتیجه‌ای از Bot API پیدا نشد",
    "ورودی ممکن است نام کاربری یک شخص باشد یا برای بات قابل‌دسترسی نباشد", text);
}

export async function handleInlineQuery(query, env) {
  const user = query?.from;
  if (!query?.id || !user?.id) return;
  const raw = String(query.query || "").trim().slice(0, 256).replace(/^\/+/, "").trim();
  const mine = idResult(user);
  let results;

  if (!raw) {
    results = [mine, helpResult(),
      result("chat-lookup-help", "جست‌وجوی گروه یا کانال",
        "عبارت @username یا chat @username را وارد کنید",
        "برای جست‌وجوی گروه یا کانال عمومی، عبارت <code>@username</code> یا <code>chat @username</code> را وارد کنید."),
      result("forward-help", "بررسی پیام فورواردشده",
        "در Inline ممکن نیست؛ پیام را به پی‌وی بات فوروارد کنید",
        "برای بررسی مبدأ فوروارد، پیام را به گفت‌وگوی خصوصی بات بفرستید؛ Inline محتوای پیام دیگری را دریافت نمی‌کند.")
    ];
  } else if (/^(me|myid|user|id)$/i.test(raw)) {
    results = [mine, helpResult()];
  } else if (/^(help|راهنما)$/i.test(raw)) {
    results = [helpResult(), mine];
  } else {
    const match = raw.match(/^(?:id|chat|info|lookup)\s+(.+)$/i);
    const explicit = Boolean(match);
    const ref = (match ? match[1] : raw).trim();
    const username = /^@[a-zA-Z0-9_]{5,32}$/.test(ref);
    const numeric = /^-?\d{5,20}$/.test(ref);

    if (username || (explicit && numeric)) {
      try {
        const chat = await telegramApi(env, "getChat", { chat_id: ref });
        const lines = ["<b>اطلاعات چت</b>",
          `<b>شناسه:</b> <code>${escapeHtml(chat.id)}</code>`,
          `<b>نوع:</b> <code>${escapeHtml(chat.type)}</code>`,
          chat.title ? `<b>عنوان:</b> <code>${escapeHtml(chat.title)}</code>` : null,
          chat.username ? `<b>نام کاربری:</b> <code>@${escapeHtml(chat.username)}</code>` : null,
          chat.description ? `<b>توضیحات:</b> <code>${escapeHtml(chat.description.slice(0, 300))}</code>` : null
        ].filter(Boolean).join("\n");
        results = [result("chat-result", `اطلاعات چت: ${ref}`,
          `Chat ID: ${chat.id} · ${chat.type}`, lines), mine];
      } catch {
        results = [failureResult(ref), mine];
      }
    } else if (explicit) {
      results = [failureResult(ref), mine];
    } else {
      results = [mine, helpResult()];
    }
  }

  return telegramApi(env, "answerInlineQuery", {
    inline_query_id: query.id, is_personal: true, cache_time: 0, results: results.slice(0, 50)
  });
}
