-- How long people stay signed in: through the end of this date, in the event's time zone.
alter table events add column if not exists sign_in_until date;

update events set sign_in_until = date '2027-01-30'
where slug = 'ypo-week-2-lead-session' and sign_in_until is null;
