# Prompt for Claude Code: HBS YPL Week 2 Lead Session App

Copy everything below the line into a new Claude Code session, ideally in a new, empty repository.

---

Build a production-ready web app for the **Harvard Business School Young Presidents/Leaders (YPL) program, Week 2: Lead Session**. Work through the phases below in order. Commit after each phase. Ask me only about things you cannot decide yourself, such as API keys or the sending domain. For everything else, pick a sensible default and write it down in the README.

## 1. How the session works

1. **Before the session**, each participant scans a QR code or opens a link, registers with their **name, email, chapter, and need**, and chooses a **need category**: *Professional Services*, *Fundraising*, or *Other*. They can sign back in later to edit their need.
2. **Once the leads are in**, the facilitator clicks **Generate PowerPoint** and downloads a deck with one slide per participant showing their name, their need, and their leads. The deck is built from whatever is in the database at the moment of the click.
3. **During the session**, each participant presents their need in turn. People in the room who have a lead raise their hand. Each signed-in participant checks the leads that apply to **their own need**: they **tick the names of the people who raised their hands** for them and rate each lead from **5 (strong) to 1 (weak)**. The facilitator can record or correct leads for anyone. Participants can also **take notes** on anyone's need.
4. **After the session**, the app generates a **personal summary** for every registrant. It covers their need, every lead offered (who, contact email, chapter, strength 1–5, notes), suggested next steps and a **draft outreach email to each lead** for the person to copy and paste into their own email. The app never sends outreach emails itself. The app emails each summary to the address the person registered with. It also sends a **group digest** of everyone's needs and leads to all registrants.

## 2. Tech stack (use unless there is a strong reason not to)

- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**, deployed on **Vercel**
- **Supabase**:
  - Postgres for the data
  - Realtime Broadcast, so lead changes show up on every device at once
- **Simple email-only login, no password and no emailed code** (see section 4, "Login"). Do not use Supabase Auth. Keep the session in a signed, httpOnly cookie (use `jose` or `iron-session`).
  - Row Level Security
- **Anthropic TypeScript SDK (`@anthropic-ai/sdk`)** to write the summaries and the outreach drafts
  - Model `claude-opus-5-5`, set through the `ANTHROPIC_MODEL` environment variable
  - Use `output_config.effort` = `"medium"`
  - Use structured outputs (`output_config.format`) so the JSON can be parsed reliably
  - Check `stop_reason` before reading content, and handle a `"refusal"`
- **Resend** for email, with a verified sending domain from an environment variable and HTML plus plain-text templates (React Email)
- **`pptxgenjs`** for the PowerPoint export
- **`qrcode`** to make the QR code (PNG and SVG)
- **Zod** to validate every form and API input

Provide `.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`, `ADMIN_EMAILS` (comma-separated), `ADMIN_PIN`, `SESSION_SECRET` and `CRON_SECRET`.

## 3. Data model (Supabase migrations in `supabase/migrations/`)

- `events`
  - `id`, `slug` (for example `ypl-week-2-lead-session`), `title`, `starts_at`, `ends_at`, `timezone`
  - `status`: `registration_open` | `registration_locked` | `live` | `closed`
  - `summaries_sent_at`
  - Build for multiple events so the app can be reused in later weeks.
- `participants`
  - `id`, `event_id`, `name`, `email` (stored lowercase and trimmed; unique per event), `chapter`, `role` (`participant` | `facilitator`), `presentation_order`, `created_at`, `updated_at`
- `needs`
  - `id`, `participant_id`, `event_id`, `category` (`professional_services` | `fundraising` | `other`), `title` (short headline), `description`, `updated_at`
  - One active need per participant per event.
- `leads`
  - `id`, `need_id`, `giver_participant_id`, `strength` (integer 1–5), `outreach_subject`, `outreach_body` (the saved cut-and-paste draft), `recorded_by`, `created_at`, `updated_at`
  - Unique on (`need_id`, `giver_participant_id`). A repeat tap updates the existing row instead of creating a duplicate.
  - Keep a `lead_history` audit table for every change.
- `notes`
  - `id`, `need_id`, `author_participant_id`, `body`, `visibility` (`shared` | `private`), `created_at`, `updated_at`
- `summaries`
  - `id`, `participant_id`, `event_id`, `content_json`, `html`, `status` (`draft` | `approved` | `sent` | `failed`), `sent_at`, `error`

**Access rules:**

All database access goes through server routes and server actions using the service-role key. Turn on Row Level Security with no public policies, so the browser can never read or write tables directly. Every server route checks the session cookie and enforces these rules:

- Only signed-in participants of an event can read that event's needs, leads, and shared notes.
- Participants can only edit their own registration and their own notes.
- Private notes are visible only to their author.
- **Leads**: while the event is `live`, a participant can only add, change, or remove leads on **their own need**. Facilitators can do this for anyone.
- Facilitators can do everything.

## 4. Pages and features

### Login: `/e/[slug]/login`

- One field, **Email**, and a **Sign in** button. There is no password and no emailed code.
- If the email is registered for this event, sign the person in right away with a signed, httpOnly cookie that lasts 30 days, and send them to the live board.
- If it isn't registered, send them to registration with the email already filled in.
- Every page except registration and login sends signed-out visitors here. Add a Sign out link in the menu.
- **Facilitators**: an email listed in `ADMIN_EMAILS` also has to enter the shared `ADMIN_PIN` once before admin features turn on. Without the PIN, anyone who typed the facilitator's email would get admin access.
- Put a note in the README that email-only login trusts people to type their own email. That is fine for a closed session, but it is not strong security.

### A. Registration: `/e/[slug]/register`

- Mobile-first form with **Name, Email, Chapter, Need category, Need**. Add placeholder help text such as "What would move the needle for you in the next 90 days?"
- Optionally, a "Suggest a category" button that asks Claude to classify the need. The person always has the final choice.
- On submit:
  1. Create the participant and need records.
  2. Sign the person in, the same way as the login page.
  3. Show a confirmation screen with their need and an "Edit my need" button.
- If the email is already registered, sign the person in and open their existing registration for editing. Do not create a duplicate.
- Registering on a new phone or laptop, or logging in again with the same email, opens the same record.
- Autosave drafts and show a "Saved ✓" indicator.
- When the event is `registration_locked` or later, show a read-only message.

### B. QR code: `/e/[slug]/qr` (facilitator only)

- Full-screen, high-contrast QR code pointing to `APP_BASE_URL/e/[slug]/register`, with the short URL printed underneath for people who cannot scan.
- Buttons to download PNG (2048 px) and SVG, plus a print-friendly layout.

### C. Live session board: `/e/[slug]/live` (the main in-room screen)

- **Presenter view**: a large card for the current presenter showing name, chapter, category badge, and need. Add Previous and Next controls and a presenter list in `presentation_order`. The facilitator can drag to reorder.
- **My leads (lead capture)**: when the current presenter is the signed-in participant, show a **"Check your leads"** panel. A facilitator sees this panel on every presenter.
  - The panel is a searchable list of every other participant's name, each with a checkbox and large tap targets.
  - Checking a name opens a quick picker with five buttons, `5 Strong`, `4`, `3`, `2`, `1 Weak`. One tap saves it.
  - Unchecking a name removes that lead. Tapping the rating changes it.
  - Participants can also open this panel at any time from **My Need**, so they can check leads after they finish presenting.
  - Everyone else sees the presenter's checked leads as read-only chips with ratings, and cannot change them.
- **Realtime**: after each lead change, the server sends a "leads changed" message on a Supabase Realtime Broadcast channel for the event. The message carries no personal data, and clients refetch from the API when they receive it, so changes show up on every device within about 1 second. Use optimistic UI, retry on failure, and show an offline banner that queues writes in IndexedDB and syncs on reconnect.
- **Notes panel**: a notes box on each presenter card with a Shared/Private toggle. It autosaves after 800 ms of inactivity, with a "Saved ✓" indicator. Show shared notes from others underneath, with author and time.
- **Follow mode**: participants' screens can follow the facilitator's current presenter, or they can browse on their own.
- **Projector view** at `/e/[slug]/live?display=projector`: read-only, large type, showing the current presenter's need and a live count and list of leads.

### D. Index tab: `/e/[slug]/index`

- A tab in the main navigation that groups all needs under three headings: **Professional Services**, **Fundraising**, and **Other**.
- Each entry shows name, chapter, need title and description, number of leads, and average lead strength.
- Add search, a chapter filter, sorting (by name, chapter, or number of leads), and a "My notes" indicator.
- Clicking an entry opens the person's detail page with the full need, all leads, and notes (where the notes box is also editable).

### E. My need: `/e/[slug]/me`

- Lets a participant edit their need and category, **check and rate the leads for their need** (the same panel as the live board), and see the notes they have written.
- **Outreach drafts (cut and paste)**: next to each checked lead, a **Draft email** button.
  - Clicking it writes a short draft from the participant to that lead, based on the participant's need and the lead's name and chapter.
  - Show the draft in an editable box with separate **Copy subject** and **Copy body** buttons, plus an "Open in my email" mailto link with both pre-filled.
  - Save the draft, including the person's edits, so it is still there later. Add a **Redo draft** button.
  - The app never sends these emails. The person copies them into their own email.

### F. Facilitator admin: `/e/[slug]/admin`

- Participant table with edit, remove, and set presentation order, plus CSV export of participants, needs, leads, and notes.
- Event status controls: open registration, lock registration, start the live session, close the session.
- **Generate PowerPoint**: a single button. One click builds the deck on the server with `pptxgenjs` from the current data and downloads it as `YPL-Week2-Lead-Session-YYYY-MM-DD.pptx`. There are no other slides or versions.
  - A clean 16:9 deck in HBS crimson (`#A51C30`), white, and dark gray.
  - One slide per participant, in presentation order, showing:
    - **Name**, large
    - **Need**: title and description; shrink the font to fit long text
    - **Leads**: each lead's giver name and strength (5–1), sorted strongest first. If there are none yet, show "No leads yet".
  - Clicking again rebuilds the deck from the latest data.
- **Summaries workflow**:
  1. Generate all summaries.
  2. Show a preview list where each summary can be opened, edited inline, and approved.
  3. Offer a "Send all approved" button and a "Send test to me" button.
  4. Add an **auto-send option**: a Vercel Cron job (secured with `CRON_SECRET`) checks every 10 minutes. When an event's status is `closed`, or its `ends_at` plus a configurable delay (default 30 minutes) has passed, and summaries have not been sent yet, it generates and sends them automatically.
  5. Sending must be idempotent: never email the same person twice for the same event. Record each send's status in `summaries`, and offer a retry for failures.

## 5. AI generation (in `lib/ai/`, server-side only)

1. **`draftOutreachEmail(participant, need, lead)`**: a short, warm, specific email of 100–160 words from the participant to the person who offered the lead.
   - Include a subject line.
   - Refer to the YPL Week 2 Lead Session, say exactly what the need is, and make one clear, low-friction ask (for example, a 20-minute call or an introduction).
   - Return JSON: `{ subject, body }`.
2. **`generateParticipantSummary(participant, need, leads[], notes[])`**: return JSON with:
   - `need_recap` (2–3 sentences)
   - `leads[]`, each with `giver_name`, `giver_email`, `chapter`, `strength`, `suggested_next_step`, and `outreach_draft` (reuse the saved draft from `draftOutreachEmail` if there is one)
   - `top_3_actions`
   - `notes_digest`, built only from shared notes plus the participant's own private notes
   - Sort leads from strongest to weakest. If there are no leads, include encouragement and suggested next steps.
3. **`generateGroupDigest(event)`**: a short overview of all needs by category, with lead counts and the total number of connections made.

Outreach drafts are for copy and paste only; never send them from the app. Keep the prompts in versioned files. Never include anyone else's private notes in a prompt. Use prompt caching on the shared system prompt. Run generation for all participants in parallel with a concurrency limit of 5, and use exponential backoff on HTTP 429 and 5xx errors.

## 6. Emails (`emails/`)

- **Personal summary email**, subject "Your YPL Week 2 Lead Session summary: N leads":
  - Need recap
  - A table of leads with a ★ strength rating, each with a mailto link to the giver
  - Each lead's outreach draft in a plain, copy-friendly block
  - Top 3 actions
  - A link back to the app
- **Group digest email**: everyone's needs grouped by category, with lead counts.
- These two are the only emails the app sends. There is no registration confirmation email and no login email.

## 7. Quality bar

- Mobile-first and usable with one hand in a crowded room: tap targets of at least 44 px, fast loading, and WCAG AA contrast.
- Every change saves automatically. A participant can never lose input on refresh. Show a "Saved ✓" indicator everywhere.
- Navigation tabs: **Live · Index · My Need · (Admin)**.
- Tests:
  - Vitest unit tests for the Zod schemas, lead upsert and dedupe logic, and summary assembly, with Claude and Resend mocked
  - Playwright end-to-end tests: register → sign out → sign in with email only → edit need → check and rate own leads (and confirm a participant cannot change someone else's leads) → notes autosave → admin generates the PowerPoint → generate summaries → send (mocked)
- A seed script (`npm run seed`) that creates a demo event with 12 fake participants across 4 chapters, needs in all three categories, leads, and notes, so I can rehearse the session.
- README covering:
  - Setup
  - Supabase project creation
  - Running the migrations
  - Resend domain verification
  - Deploying to Vercel and setting up Cron
  - A **day-of-session runbook**:
    1. Open registration
    2. Project the QR code
    3. Lock registration
    4. Go live
    5. Close the session
    6. Click Generate PowerPoint
    7. Review and send the summaries

## 8. Delivery phases

1. Scaffold, database schema, email-only login, access rules, and seed data
2. Registration, My Need, and outreach drafts
3. QR code page
4. Live session board with leads, ratings, notes, and realtime
5. Index tab and participant detail pages
6. Admin dashboard, Generate PowerPoint button, summaries, emails, and cron
7. Tests, accessibility pass, and README/runbook

At the end, run the full test suite and a production build, and report what passed, what failed, and anything I need to configure (keys, domain, Supabase project).
