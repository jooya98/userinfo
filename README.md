# UserInfo Telegram Bot

A minimal Telegram ID helper written in JavaScript for Cloudflare Workers. The MVP uses Telegram's official Bot API and a webhook; it has no database or continuously running server.

## Features in the dev branch

- `/start` and `/help`
- `/id`: IDs and metadata for the current chat/message and sender
- Reply to a message with `/id` to inspect its sender when Telegram includes that information
- `/me`: current user's ID and basic profile fields
- Forward a message to the bot in a private chat to inspect exposed forward-origin metadata
- `/id @username`: attempt to look up a public group/channel or chat accessible to the bot
- Inline mode returns the invoking user's ID for insertion into another chat
- Webhook secret-header verification, health endpoint, no third-party runtime dependencies

The bot deliberately does not claim to resolve every arbitrary person's `@username` to a user ID. Telegram may hide the identity of forward senders; in that case no ID is fabricated.

## Requirements

- Node.js 20+ for local tests
- A Cloudflare account with Workers access
- A Telegram bot token from BotFather

## Local development

```sh
npm test
npm run check
```

Local development can use a local `.dev.vars` file for Wrangler, but do not commit it. It should contain:

```dotenv
BOT_TOKEN=replace-me
TELEGRAM_WEBHOOK_SECRET=replace-with-a-random-secret
```

Run locally with `npx wrangler dev`. For a real Telegram webhook, the Worker must be reachable over HTTPS.

## Deploy

Use Wrangler, or the Cloudflare API if you have an established deployment flow.

```sh
npx wrangler login
npx wrangler secret put BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler deploy
```

Keep both secrets out of Git, logs, and client-side output. To generate a webhook secret, use a cryptographically random string of 32+ characters that is allowed by Telegram's `secret_token` parameter (letters, digits, underscore, hyphen).

After deployment, set `WORKER_URL` to the Worker URL and set the webhook from a shell with `BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` already exported into the environment. This example avoids writing the token literal into shell history:

```sh
curl --fail-with-body --silent --show-error \
  --request POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WORKER_URL}/webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message","channel_post","inline_query"]'
```

Check webhook state without exposing the token in output:

```sh
curl --fail-with-body --silent --show-error \
  "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" \
  | jq '{ok, result: {url: .result.url, pending_update_count: .result.pending_update_count, last_error_date: .result.last_error_date, last_error_message: .result.last_error_message}}'
```

Enable Inline Mode for the bot through BotFather before trying the inline feature. The health endpoint is `GET /health`.

## Security and operational notes

- Never commit `.dev.vars`, bot tokens, Cloudflare API tokens, or the webhook secret.
- Webhook requests must include Telegram's `X-Telegram-Bot-Api-Secret-Token` header.
- The Worker logs update IDs and safe error text, not raw user messages.
- Inline responses use `is_personal: true` and `cache_time: 0`, because the result contains the requesting user's ID.
- This MVP acknowledges a valid update promptly and processes it through the Worker execution context; errors are logged. A durable queue and duplicate-update store are not justified until real usage requires them.
- Review Telegram's returned fields before interpreting message origins; protected forwards and hidden senders can omit IDs.

## Project layout

- `src/index.js`: Worker webhook and Telegram update routing
- `src/telegram.js`: dependency-free Bot API client
- `src/identifiers.js`: pure ID and forward-origin extraction helpers
- `test/`: Node built-in test suite
- `wrangler.toml`: Cloudflare Workers configuration

## License

MIT

## Expanded Inline mode

The Inline handler offers multiple options for an empty query: the requesting user's ID, Inline help, public group/channel lookup instructions, and forward-message guidance. Query me or id for your own ID; use @username, chat @username, or id @username to try a public group/channel lookup; use help for syntax.

Inline Query updates do not contain the target chat's ID, a replied-to message, or another message's forward-origin metadata. Use a normal /id command or forward to the bot's private chat for those cases. Telegram's Bot API cannot generally resolve arbitrary people from display names or usernames.
