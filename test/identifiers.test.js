import test from "node:test";
import assert from "node:assert/strict";
import { displayName, escapeHtml, getForwardOrigin, toId } from "../src/identifiers.js";

test("toId preserves large Telegram IDs as strings", () => {
  assert.equal(toId(9007199254740991), "9007199254740991");
  assert.equal(toId(null), null);
  assert.equal(toId(undefined), null);
});

test("displayName combines first and last name", () => {
  assert.equal(displayName({ first_name: "Ada", last_name: "Lovelace" }), "Ada Lovelace");
  assert.equal(displayName({ username: "ada" }), "ada");
});

test("escapeHtml escapes markup characters", () => {
  assert.equal(escapeHtml('<x a="b">&'), "&lt;x a=&quot;b&quot;&gt;&amp;");
});

test("extracts a channel forward origin with its chat and message IDs", () => {
  assert.deepEqual(getForwardOrigin({
    forward_origin: {
      type: "channel",
      chat: { id: -1001234567890, title: "News", username: "newsfeed" },
      message_id: 42,
      date: 1700000000,
    },
  }), {
    type: "channel",
    label: "کانال",
    id: "-1001234567890",
    name: "News",
    username: "newsfeed",
    messageId: "42",
  });
});

test("does not invent an ID for a hidden forward sender", () => {
  assert.deepEqual(getForwardOrigin({
    forward_origin: { type: "hidden_user", sender_user_name: "Hidden sender", date: 1700000000 },
  }), {
    type: "hidden_user",
    label: "کاربر با هویت پنهان",
    id: null,
    name: "Hidden sender",
    username: null,
    messageId: null,
  });
});

test("supports legacy forward fields if present", () => {
  assert.equal(getForwardOrigin({ forward_from: { id: 123, first_name: "Sam" } }).id, "123");
});

test("returns null when no forward metadata exists", () => {
  assert.equal(getForwardOrigin({ text: "hello" }), null);
});
