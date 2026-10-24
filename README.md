# UserInfo Telegram Bot

A lightweight Telegram ID helper built with JavaScript and Cloudflare Workers.

The initial development target is a stateless webhook bot. No server process or database is required for the MVP.

## Planned MVP

- `/start`, `/help`, `/id`, and `/me`
- User and chat IDs from accessible messages
- Reply-to-message lookup when Telegram includes sender details
- Forward-origin details when Telegram exposes them
- Public group/channel username lookup through Telegram's Bot API
- Inline mode that returns the requesting user's ID
- Webhook secret validation and minimal logs

## Important limitations

The Bot API cannot reliably resolve every arbitrary person's `@username` to a user ID. Forwarded-message metadata may also be hidden or unavailable. The bot reports only data Telegram supplies.

## Development

See `wrangler.toml` and the README on the `dev` branch for the working implementation and setup instructions. Secrets must be configured as Cloudflare Worker secrets; never commit bot tokens or webhook secrets.

## License

MIT
