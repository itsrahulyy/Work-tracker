Update this project into a modular reminder runner that:

- reads the existing public Google Sheets used by the project
- builds two reminder jobs: `work-history` and `video-status`
- sends Gmail email and WATI WhatsApp notifications in parallel
- supports local execution with `node tracker.js`
- supports safe verification with `node tracker.js --dry-run`
- exposes a Vercel cron entrypoint at `api/cron/reminders.js`
- keeps secrets in `.env` locally and Vercel env vars in production

Implementation constraints:

- use CommonJS to match the current project
- keep Google Sheets parsing in `lib/googleSheets.js`
- keep WATI code in `lib/wati.js`
- keep email code in `lib/email.js`
- keep orchestration in `lib/reminders.js` and `lib/runner.js`
- do not log secrets
- default timezone should be `Asia/Calcutta`
- cron schedule should remain easy to edit in `vercel.json`

Verification:

- run `npm run dry-run`
- if dry-run passes, explain how to deploy on Vercel and which env vars must be set
