# YPO Lead Session app

Web app for the **HBS YPO program, Week 2: Lead Session**:

- **Date:** Wednesday, January 20, 2027
- **Time:** 12:30–1:30 PM ET
- **Location:** Tata 100 (downstairs)

## What it does

- **Registration by QR code:** people enter their name, email, chapter and need, and pick a category: Professional Services, Fundraising or Other.
- **Email-only sign-in:** no password and no emailed code. People stay signed in **through January 30, 2027** (until midnight ET). You can change this in Admin → Event setup.
- **Live board:** the facilitator moves through presenters, and every phone can follow along.
  - The presenter ticks the people who raised their hands and rates each lead from **5 (strong) to 1 (weak)**.
  - Anyone else can tick **"I have a lead for you"**, optionally adding a note on what the lead is. The presenter then rates it.
  - Changes appear on every device within seconds.
- **How it works:** a seven-page walkthrough (one page per feature) that opens the first time each person signs in, and any time from the button in the top menu.
- **Notes** on any need. Notes are **private by default**, and the author can switch one to Shared.
- **Index tab:** all needs grouped by category, with search, a chapter filter and sorting.
- **My Need tab:**
  - edit your need
  - check and rate your leads
  - draft an outreach email to each lead for **cut and paste** (the app never sends these)
  - see the leads you offered to others
- **PowerPoint emailed before the session:** at **12:00 PM ET on January 20**, 30 minutes before the start, the app builds the deck from the latest data and emails it as an attachment to every address in `ADMIN_EMAILS`. Put your own email there. The admin page also has an **Email it to me now** button.
- **Generate PowerPoint:** one click builds the deck from the data at that moment:
  - an opening slide with the logos, date, time and place
  - a numbered speaking-order list
  - one numbered slide per person ("3 of 12") showing their name, chapter and need in large type, with an "Up next" panel on the right listing the next five presenters. Leads are not shown; they're captured after the session.
- **Automatic summaries:** these go out on **Saturday, January 23, 2027 at 9:00 AM ET**, the Saturday after the session. Until then, people can enter and rate the leads from the photos they took in the room.
  - If the session is never closed, it closes itself at the end time (1:30 PM ET). The send still happens on Saturday.
  - The send day and time are set in Admin → Event setup. If they're left blank, summaries go out a set number of minutes after closing.
  - Each person gets a personal summary: their leads with contact details and outreach drafts, the leads they offered, notes, and their top 3 actions.
  - Everyone also gets the group digest: needs and lead givers, with **no ratings and no notes**.
  - Nobody is emailed twice.
- **Admin page:**
  - session steps
  - QR code
  - projector view
  - participants (add walk-ins, edit, reorder, remove)
  - CSV exports
  - send status with Retry
  - a test send
  - event setup
  - creating events for later weeks

## Run it locally

You need Node 20+ and Postgres. Without API keys, Claude text and emails are replaced by built-in placeholders and an email log, so everything still works.

```bash
cp .env.example .env.local          # then edit values
npm install
npm run db:migrate                  # creates tables and the Jan 20 event
npm run seed                        # optional: demo event at /e/demo with 12 people
npm run dev                         # http://localhost:3100
```

- **Real event:** `http://localhost:3100/e/ypo-week-2-lead-session/register`
- **Demo:** `http://localhost:3100/e/demo/login`. Sign in as `alex@example.com`, or any seeded first name followed by `@example.com`.
- **Facilitator:** sign in with an email listed in `ADMIN_EMAILS`, then enter `ADMIN_PIN`.

## Tests

```bash
npm test               # unit and database tests (uses a local Postgres database "ypo_test")
npm run build && npm run test:e2e   # full browser test (uses database "ypo_e2e", which it resets)
```

## Deploy (Supabase + Vercel + Resend + Anthropic)

1. **Supabase**
   1. Create a project.
   2. Copy the connection strings from Project Settings → Database. Use the **transaction pooler** string (port 6543) as `DATABASE_URL` on Vercel.
   3. Run the migrations once from your computer: `DATABASE_URL=<direct connection string> npm run db:migrate`.
   4. From Project Settings → API, copy the project URL, the anon key and the service-role key into the three `SUPABASE` variables. These turn on instant Realtime updates; without them the app checks for changes every 4 seconds.
2. **Resend**
   1. Add and verify your sending domain (a few DNS records).
   2. Create an API key.
   3. Set `RESEND_API_KEY` and set `EMAIL_FROM` to an address on that domain.

   Until the domain is verified, Resend only delivers to your own address.
3. **Anthropic:** create an API key and set `ANTHROPIC_API_KEY`. The model is `claude-opus-5-5`; change it with `ANTHROPIC_MODEL`.
4. **Vercel**
   1. Import the repository and set **Root Directory** to `ypo-lead-session`.
   2. Add every variable from `.env.example`. `APP_BASE_URL` is your Vercel URL; it goes into the QR code and the emails.
   3. Set `SESSION_SECRET` and `CRON_SECRET` to long random strings.
   4. Choose a short `ADMIN_PIN`.
5. **Automatic sending:** edit `supabase/cron.sql` with your URL and `CRON_SECRET`, then run it in the Supabase SQL editor. It calls the app every 5 minutes. This is needed because Vercel's free plan only allows daily cron jobs. On Vercel Pro you can instead add a `vercel.json` cron for `/api/cron/send-summaries` every 5 minutes. As a backup, the app also sends whenever someone has it open (for example the facilitator's admin page) after the send time.

## Day-of-session runbook

1. **Before:** Admin → Session → **1. Open registration** (open by default). Put the QR code up (Admin → *Show QR code*), or share the link.
2. When people have arrived: **2. Lock registration**. Add walk-ins under Participants. Set the speaking order with ↑ ↓.
3. **3. Go live.** Open *Projector view* on the room screen. Use **Next →** to move everyone to the next presenter.
4. When the session ends: **4. Close session.** This freezes everyone's needs, though leads can still be entered. If you forget, it closes itself at 1:30 PM ET. Summaries send automatically on **Saturday, January 23 at 9:00 AM ET**.
5. **Generate PowerPoint** whenever you want the deck. It always reflects the latest data.
6. Afterwards, check the send status on the Admin page and use **Retry** for any failures.

## Security note

Sign-in uses only an email address, which trusts people to type their own. That is fine for a closed session, but it is not strong security. Facilitator features also require the shared `ADMIN_PIN`. All database access goes through the server. Row Level Security is on with no public policies, so the browser can never read or write tables directly.

## Where things are

| Path | What |
|---|---|
| `supabase/migrations/` | Database schema, plus the January 20 event |
| `src/lib/access.ts` | Who can do what (unit tested) |
| `src/lib/leads.ts` | Lead writes; an owner check and a giver offer merge into one row |
| `src/lib/summaries.ts` | Summary assembly, the scheduler, idempotent sending |
| `src/lib/ai/` | Claude prompts and calls (outreach drafts, summaries, category suggestions) |
| `src/lib/email/` | Email templates and sending |
| `src/lib/pptx.ts` | The PowerPoint |
| `src/app/e/[slug]/` | Pages: register, login, qr, live, needs (Index), me (My Need), admin |
