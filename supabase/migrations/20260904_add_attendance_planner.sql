-- Attendance planner total-lecture ceiling.
-- Run this once in the Supabase SQL editor for an existing project.
alter table public.admin_settings
  add column if not exists maximum_lectures integer not null default 250;

alter table public.admin_settings
  add constraint admin_settings_maximum_lectures_range
  check (maximum_lectures between 1 and 250);
