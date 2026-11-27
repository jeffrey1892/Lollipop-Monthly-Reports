-- A fixed day and time to email summaries (instead of a delay after closing).
-- Week 2: the Saturday after the session, so people have time to enter leads from their photos.
alter table events add column if not exists summaries_send_at timestamptz;

update events set summaries_send_at = timestamp '2027-01-23 09:00' at time zone 'America/New_York'
where slug = 'ypo-week-2-lead-session' and summaries_send_at is null;
