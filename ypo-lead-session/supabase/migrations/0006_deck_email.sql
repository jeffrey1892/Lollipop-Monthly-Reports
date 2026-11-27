-- Email the PowerPoint to the facilitator(s) shortly before the session starts.
alter table events add column if not exists deck_minutes_before integer not null default 30 check (deck_minutes_before >= 0);
alter table events add column if not exists deck_sent_at timestamptz;
alter table email_log add column if not exists attachment_names text;
