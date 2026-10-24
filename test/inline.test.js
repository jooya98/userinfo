import test from "node:test";
import assert from "node:assert/strict";
import { handleInlineQuery } from "../src/inline.js";

function fakeFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => handler(String(input), init.body ? JSON.parse(init.body) : {});
  return () => { globalThis.fetch = original; };
}

function ok(result) {
  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("empty inline query offers personal ID, help, group lookup and forward guidance", async () => {
  const restore = fakeFetch((url, payload) => {
    assert.match(url, /answerInlineQuery$/);
    assert.equal(payload.is_personal, true);
    assert.equal(payload.cache_time, 0);
    assert.equal(payload.results.length, 4);
    assert.match(payload.results[0].input_message_content.message_text, /8761106264/);
    assert.equal(payload.results[1].title, "راهنمای قابلیت‌های Inline");
    return ok(true);
  });
  try {
    await handleInlineQuery({ id: "q-empty", query: "", from: { id: 8761106264, first_name: "Milad" } }, { BOT_TOKEN: "test-token" });
  } finally { restore(); }
});

test("id query returns the invoking user's ID", async () => {
  const restore = fakeFetch((url, payload) => {
    assert.match(url, /answerInlineQuery$/);
    assert.equal(payload.results.length, 2);
    assert.match(payload.results[0].input_message_content.message_text, /8761106264/);
    return ok(true);
  });
  try {
    await handleInlineQuery({ id: "q-id", query: "id", from: { id: 8761106264, first_name: "Milad" } }, { BOT_TOKEN: "test-token" });
  } finally { restore(); }
});

test("username query returns public group or channel details", async () => {
  const restore = fakeFetch((url, payload) => {
    if (url.endsWith("/getChat")) {
      assert.equal(payload.chat_id, "@journal_ctl");
      return ok({ id: -1003601546401, type: "channel", title: "journalctl", username: "journal_ctl" });
    }
    assert.match(url, /answerInlineQuery$/);
    assert.match(payload.results[0].input_message_content.message_text, /-1003601546401/);
    return ok(true);
  });
  try {
    await handleInlineQuery({ id: "q-chat", query: "@journal_ctl", from: { id: 8761106264, first_name: "Milad" } }, { BOT_TOKEN: "test-token" });
  } finally { restore(); }
});

test("plain display name in explicit lookup explains Bot API limitation", async () => {
  const restore = fakeFetch((url, payload) => {
    assert.match(url, /answerInlineQuery$/);
    assert.equal(payload.results.length, 2);
    assert.match(payload.results[0].input_message_content.message_text, /Bot API/);
    return ok(true);
  });
  try {
    await handleInlineQuery({ id: "q-name", query: "id Milad", from: { id: 8761106264, first_name: "Milad" } }, { BOT_TOKEN: "test-token" });
  } finally { restore(); }
});
