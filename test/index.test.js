import test from "node:test";
import assert from "node:assert/strict";
import { commandOf, describeMessage, processUpdate } from "../src/index.js";

test("parses basic commands and optional arguments", () => {
  assert.deepEqual(commandOf("/id"), { command: "id", args: "" });
  assert.deepEqual(commandOf("/id @jooyaonline"), { command: "id", args: "@jooyaonline" });
  assert.deepEqual(commandOf("/me"), { command: "me", args: "" });
  assert.equal(commandOf("ordinary message"), null);
});

test("parses commands addressed to this bot", () => {
  assert.deepEqual(commandOf("/id@webmaterobot"), { command: "id", args: "" });
  assert.deepEqual(commandOf("/id@webmaterobot @examplechannel"), {
    command: "id",
    args: "@examplechannel",
  });
});

test("describes private-chat sender and chat with IDs", () => {
  const text = describeMessage({
    message_id: 6,
    chat: { id: 8761106264, type: "private" },
    from: { id: 8761106264, first_name: "Milad" },
  });

  assert.match(text, /شناسهٔ چت.*8761106264/);
  assert.match(text, /نوع چت.*private/);
  assert.match(text, /شناسهٔ پیام.*6/);
  assert.match(text, /فرستنده — نام.*Milad/);
  assert.match(text, /فرستنده — شناسه.*8761106264/);
});

test("includes the replied-to sender separately from the command sender", () => {
  const text = describeMessage({
    message_id: 22,
    chat: { id: -1001234567890, type: "supergroup", title: "Developers" },
    from: { id: 8761106264, first_name: "Milad" },
    reply_to_message: {
      message_id: 21,
      from: { id: 123456789, first_name: "Jooya", username: "jooyaonline" },
    },
  });

  assert.match(text, /شناسهٔ چت.*-1001234567890/);
  assert.match(text, /فرستنده — شناسه.*8761106264/);
  assert.match(text, /فرستندهٔ پیام — شناسه.*123456789/);
  assert.match(text, /@jooyaonline/);
});

test("escapes chat and user supplied HTML in message details", () => {
  const text = describeMessage({
    message_id: 1,
    chat: { id: 1, type: "group", title: "<img src=x onerror=alert(1)>" },
    from: { id: 2, first_name: "<b>user</b>" },
  });

  assert.match(text, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(text, /&lt;b&gt;user&lt;\/b&gt;/);
  assert.doesNotMatch(text, /<img src=x/);
  assert.doesNotMatch(text, /<b>user<\/b>/);
});


test("ignores inline queries because inline mode is disabled", async () => {
  await processUpdate({ inline_query: { id: "q-disabled", query: "", from: { id: 1 } } }, {});
});
