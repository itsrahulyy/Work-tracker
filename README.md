# Park Tracker Reminder Runner

This project now runs the existing Google Sheets checks as modular reminder jobs and can send notifications through:

- Gmail via `nodemailer`
- WhatsApp via WATI session messaging
- Vercel Cron via `api/cron/reminders.js`

## What it does

- `work-history` checks each team member's sheet tab for today's date
- `video-status` reads the park video tracker and summarizes completion percentages
- both jobs send email and WhatsApp in parallel
- `--dry-run` prints the messages without sending anything
- `work-history` can send a WATI template reminder using `WATI_TEMPLATE_REMINDER_1`
- WhatsApp recipients can include extra people like Rahul without adding them to the sheet-tracking team

## Local commands

```bash
npm run dry-run
npm run run
npm run work
npm run video
```

## Vercel

- Cron entrypoint: `/api/cron/reminders`
- Current schedule in [vercel.json](/C:/Team_Autpmation/park-tracker/vercel.json): `30 13 * * *` (7:00 PM Asia/Calcutta)
- Optional dry run in browser:
  - `/api/cron/reminders?dryRun=true`
- Optional single job:
  - `/api/cron/reminders?job=work-history`

## Environment variables

Keep using `.env` locally and configure the same keys in Vercel production env vars:

- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_FROM`
- `EMAIL_TO`
- `WATI_API_URL`
- `WATI_API_TOKEN`
- `DIRECT_MSG_API_ENDPOINT`
- `WATI_TEMPLATE_API_ENDPOINT`
- `WATI_ANIRUDH`
- `WATI_SAKSHI`
- `WATI_PREM`
- `WATI_SONALI`
- `WATI_RAHUL`
- `APP_TIMEZONE`
- `GOOGLE_WORK_SHEET_ID`
- `GOOGLE_VIDEO_SHEET_ID`
- `GOOGLE_VIDEO_SHEET_GID`

## Codex execution prompt

See [IMPLEMENTATION_PROMPT.md](/C:/Team_Autpmation/park-tracker/IMPLEMENTATION_PROMPT.md) for a ready-to-run prompt that describes the project and expected outcome.
