-- Assignment solutions and timetable storage.
-- Run this migration in Supabase SQL Editor before using the new admin pages.

alter table public.assignments add column if not exists branch text;
alter table public.assignments add column if not exists created_at timestamptz default now();
alter table public.assignments add column if not exists solution_link text;

alter table public.student_assignments add column if not exists solution_pdf_url text;
alter table public.student_assignments add column if not exists solution_file_name text;
alter table public.student_assignments add column if not exists solution_status text default 'none';
alter table public.student_assignments add column if not exists solution_submitted_at timestamptz;
alter table public.student_assignments add column if not exists solution_reviewed_at timestamptz;
alter table public.student_assignments add column if not exists solution_review_note text;
alter table public.student_assignments add column if not exists created_at timestamptz default now();

create table if not exists public.mid_sem_timetable (
  id uuid primary key default gen_random_uuid(),
  exam_number int not null,
  subject_id uuid,
  branch text not null,
  semester int not null,
  academic_year_id uuid,
  exam_date date not null,
  start_time time,
  end_time time,
  venue text,
  syllabus_pdf_url text,
  subject_code text,
  subject_name text,
  is_completed boolean default false,
  published boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.gtu_timetable (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid,
  branch text not null,
  semester int not null,
  academic_year_id uuid,
  exam_date date not null,
  start_time time,
  end_time time,
  venue text,
  subject_code text,
  subject_name text,
  is_completed boolean default false,
  published boolean default true,
  created_at timestamptz default now()
);

alter table public.gtu_timetable add column if not exists is_completed boolean default false;

create table if not exists public.timetable_syllabi (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  semester int not null,
  exam_number int not null,
  academic_year_id uuid,
  pdf_url text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into storage.buckets (id, name, public)
values ('portal-files', 'portal-files', true)
on conflict (id) do nothing;
update storage.buckets set public = true where id = 'portal-files';
