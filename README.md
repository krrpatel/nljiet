# Student Portal

Independent React/Vite student portal with a Node API, Supabase Auth/Database/Storage, Octopod student/fee data, and server-side AI integrations.

## Local setup

1. Copy `.env.example` to `.env` and add the Supabase, Octopod, and AI values. Set `VITE_SITE_URL` to the public HTTPS URL users will open (for example, `https://your-domain.com`); this is used for Supabase email verification and password-reset links. If it is empty, local development uses the current browser origin.
2. Run the SQL in `supabase/schema.sql` in the Supabase SQL editor.
   If the database already exists, also run `supabase/migrations/20260904_add_attendance_planner.sql`, `supabase/migrations/20260904_add_student_division.sql`, and `supabase/migrations/20260904_add_assignments_and_timetables.sql`.
3. Install packages:

```bash
npm install
```

4. Start the API and Vite development server together:

```bash
npm run dev
```

Open `http://localhost:5173`.

The API listens on port `3001` by default and Vite proxies `/api` requests to it. Restart the process after changing `.env`.

## Production / Replit

Build and serve the compiled application with:

```bash
npm run build
npm start
```

Set the Replit Run command to `npm start` and configure all variables from `.env.example` as Replit Secrets. Never expose the Supabase service-role key or AI provider keys as `VITE_` variables.

## Vercel

`vercel.json` configures the Vite build, routes `/api/*` to the serverless function in `api/index.js`, and rewrites client-side routes such as `/profile`, `/fees`, and `/admin/*` to `index.html`. Add the variables from `.env.example` in Vercel Project Settings → Environment Variables. `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_ADMIN_EMAILS` are client-visible; keep service-role, Octopod, AI, and storage credentials server-only. `PORT` is not required on Vercel.

## Admin data setup

After signing in as an admin:

- `/admin/departments` manages departments.
- `/admin/academic-data` adds subjects by department/semester and adds the Octopod academic years. Enter the Octopod `AYID` (for example `9205`) and mark the current year.
- `/admin/upload` imports attendance and result PDFs using the selected department, semester, subject, and the current academic-year UUID.
- `/admin/assignments` adds and publishes assignments, shows student solution PDFs, and lets an admin approve or reject each submission. Approved solutions are downloadable by students from `/assignments`.
- `/admin/timetable` manages Mid Sem and GTU timetable entries. Students see published entries at `/timetable` for their branch and semester.

The attendance upload intentionally asks only for department, semester, and PDF. It replaces all attendance rows belonging to registered students in that department/semester and removes the source PDF after a successful import. Result uploads are partial upserts: a normal or re-exam PDF changes/adds only the students present in that file, preserving every other result row. Re-exam uploads correct an existing AB row when possible.

Department admin emails must already belong to Supabase Auth. The server uses `SUPABASE_SERVICE_ROLE_KEY` to resolve the email to its Auth UUID before saving `departments.admin_user_ids`; this key must never be exposed as a `VITE_` variable.

## Environment variables

See `.env.example`. Client-safe variables are limited to `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`, and the admin email allowlist. Database writes, Octopod requests, file storage, and AI calls are handled server-side.
