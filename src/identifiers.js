/**
 * Pure helpers for Telegram message metadata. Telegram may omit sender or
 * forward-origin data for privacy reasons; callers should not infer missing IDs.
 */

export function toId(value) {
  return value === undefined || value === null ? null : String(value);
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function displayName(user) {
  if (!user) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return name || user.username || toId(user.id) || "Unknown";
}

/**
 * Returns the best forward-origin metadata present in a Bot API Message.
 * The returned object deliberately distinguishes hidden origins from missing data.
 */
export function getForwardOrigin(message = {}) {
  const origin = message.forward_origin;

  if (origin && typeof origin === "object") {
    switch (origin.type) {
      case "user": {
        const user = origin.sender_user;
        return {
          type: "user",
          label: "کاربر",
          id: toId(user?.id),
          name: displayName(user),
          username: user?.username ?? null,
          messageId: null,
        };
      }
      case "hidden_user":
        return {
          type: "hidden_user",
          label: "کاربر با هویت پنهان",
          id: null,
          name: origin.sender_user_name || null,
          username: null,
          messageId: null,
        };
      case "chat": {
        const chat = origin.sender_chat;
        return {
          type: "chat",
          label: chat?.type === "channel" ? "کانال" : "چت",
          id: toId(chat?.id),
          name: chat?.title || chat?.username || null,
          username: chat?.username ?? null,
          messageId: null,
        };
      }
      case "channel": {
        const chat = origin.chat;
        return {
          type: "channel",
          label: "کانال",
          id: toId(chat?.id),
          name: chat?.title || chat?.username || null,
          username: chat?.username ?? null,
          messageId: toId(origin.message_id),
        };
      }
      default:
        return {
          type: String(origin.type || "unknown"),
          label: "مبدأ فوروارد",
          id: null,
          name: null,
          username: null,
          messageId: null,
        };
    }
  }

  // Legacy compatibility fields, when present in the update.
  if (message.forward_from_chat) {
    const chat = message.forward_from_chat;
    return {
      type: chat.type === "channel" ? "channel" : "chat",
      label: chat.type === "channel" ? "کانال" : "چت",
      id: toId(chat.id),
      name: chat.title || chat.username || null,
      username: chat.username ?? null,
      messageId: toId(message.forward_from_message_id),
    };
  }

  if (message.forward_from) {
    const user = message.forward_from;
    return {
      type: "user",
      label: "کاربر",
      id: toId(user.id),
      name: displayName(user),
      username: user.username ?? null,
      messageId: null,
    };
  }

  if (message.forward_sender_name) {
    return {
      type: "hidden_user",
      label: "کاربر با هویت پنهان",
      id: null,
      name: message.forward_sender_name,
      username: null,
      messageId: null,
    };
  }

  return null;
}
