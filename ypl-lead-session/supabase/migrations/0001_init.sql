-- HBS YPL Lead Session app: initial schema.
-- All access goes through the app server using a privileged connection.
-- Row Level Security is enabled with no public policies, so the browser
-- (anon key) can never read or write these tables directly.

create extension if not exists pgcrypto;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'America/New_York',
  status text not null default 'registration_open'
    check (status in ('registration_open', 'registration_locked', 'live', 'closed')),
  current_presenter_id uuid,
  send_delay_minutes integer not null default 30 check (send_delay_minutes >= 0),
  closed_at timestamptz,
  send_due_at timestamptz,
  summaries_started_at timestamptz,
  summaries_sent_at timestamptz,
  digest_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text,
  chapter text not null default '',
  role text not null default 'participant' check (role in ('participant', 'facilitator', 'guest')),
  presentation_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Email is unique per event (guests may have no email).
create unique index if not exists participants_event_email_uq
  on participants (event_id, email) where email is not null;
create index if not exists participants_event_idx on participants (event_id);

alter table events
  drop constraint if exists events_current_presenter_fk;
alter table events
  add constraint events_current_presenter_fk
  foreign key (current_presenter_id) references participants(id) on delete set null;

create table if not exists needs (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references participants(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  category text not null check (category in ('professional_services', 'fundraising', 'other')),
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists needs_event_idx on needs (event_id);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references needs(id) on delete cascade,
  giver_participant_id uuid not null references participants(id) on delete cascade,
  strength integer check (strength between 1 and 5),
  source text not null check (source in ('owner', 'giver', 'facilitator')),
  giver_note text not null default '',
  outreach_subject text,
  outreach_body text,
  recorded_by uuid references participants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (need_id, giver_participant_id)
);

create table if not exists lead_history (
  id bigserial primary key,
  lead_id uuid,
  need_id uuid not null,
  giver_participant_id uuid not null,
  action text not null,
  strength integer,
  giver_note text,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references needs(id) on delete cascade,
  author_participant_id uuid not null references participants(id) on delete cascade,
  body text not null default '',
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (need_id, author_participant_id)
);

create table if not exists summaries (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  kind text not null default 'personal' check (kind in ('personal', 'digest')),
  content_json jsonb,
  html text,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  sent_at timestamptz,
  error text,
  updated_at timestamptz not null default now(),
  unique (event_id, participant_id, kind)
);

create table if not exists email_log (
  id bigserial primary key,
  event_id uuid,
  participant_id uuid,
  kind text not null,
  to_email text not null,
  subject text not null,
  html text,
  text_body text,
  provider_id text,
  mocked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table events enable row level security;
alter table participants enable row level security;
alter table needs enable row level security;
alter table leads enable row level security;
alter table lead_history enable row level security;
alter table notes enable row level security;
alter table summaries enable row level security;
alter table email_log enable row level security;

-- The real event, created on first run.
insert into events (slug, title, location, starts_at, ends_at, timezone)
values (
  'ypl-week-2-lead-session',
  'HBS YPL · Week 2 · Lead Session',
  'Tara Hall',
  timestamp '2027-01-20 12:30' at time zone 'America/New_York',
  timestamp '2027-01-20 13:30' at time zone 'America/New_York',
  'America/New_York'
)
on conflict (slug) do nothing;
