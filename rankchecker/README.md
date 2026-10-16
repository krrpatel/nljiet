# Rank Checker

Standalone Vercel-ready rank checker for the student portal.

It accepts an enrollment number or current roll number, reads published MSE records from Supabase through the serverless API, verifies the matched name with Octopod, combines up to six subjects across MSE 1 and MSE 2, calculates `ceil(total marks / 4)`, and keeps equal-score students together when allocating divisions.

## Deploy

Deploy this folder as its own Vercel project with `rankchecker` as the project root. Its frontend and API are both served from that project: the browser calls `/api/rank-checker` and the function reads Supabase server-side.

Configure the variables from the repository `.env.example`, especially `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OCTOPOD_BASE_URL`, and `OCTOPOD_ACADEMY_ID`. The service-role key and Telegram variables are used only by `api/index.js` and are never sent to the browser.

For Telegram notifications, set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in the Rankchecker Vercel project. Use the numeric chat ID for a private chat or group; `@channelusername` works for a channel when the bot has permission to post. Do not use a `VITE_` prefix for these variables.

Run locally with:

```bash
npm install
npm run dev
```
