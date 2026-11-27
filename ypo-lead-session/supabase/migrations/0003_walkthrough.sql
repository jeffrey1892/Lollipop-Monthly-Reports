-- The short "How it works" walkthrough opens automatically the first time each person signs in.
alter table participants add column if not exists walkthrough_seen_at timestamptz;
