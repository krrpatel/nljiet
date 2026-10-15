# Rank Checker

Standalone Vercel-ready rank checker for the student portal.

It accepts an enrollment number or current roll number, reads published MSE records from Supabase through the serverless API, verifies the matched name with Octopod, combines up to six subjects across MSE 1 and MSE 2, calculates `ceil(total marks / 4)`, and keeps equal-score students together when allocating divisions.

## Deploy

Deploy this folder as the Vercel project root. Configure the variables from `.env.example`, especially `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OCTOPOD_BASE_URL`, and `OCTOPOD_ACADEMY_ID`. The service-role key is used only by `api/index.js` and is never sent to the browser.

Run locally with:

```bash
npm install
npm run dev
```
