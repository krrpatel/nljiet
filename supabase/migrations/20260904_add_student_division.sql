-- Registration-selected division used for branch/division filtering.
alter table public.students
  add column if not exists division text;
