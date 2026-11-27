-- Runs the summary scheduler every 5 minutes from Supabase (works on Vercel's free plan).
-- Run this once in the Supabase SQL editor AFTER deploying. Replace the two placeholders first.
-- Requires the pg_cron and pg_net extensions (Database -> Extensions in the Supabase dashboard).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'ypo-send-summaries',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://YOUR-APP.vercel.app/api/cron/send-summaries',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);

-- To stop it later:  select cron.unschedule('ypo-send-summaries');
