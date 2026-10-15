-- Rank checker raw snapshot cache.
-- This cache intentionally stores raw marks and raw totals only. It must not
-- store ceil(total_marks / 4), because the ceiling is applied by the rank
-- checker exactly once when it allocates divisions.

create table if not exists public.rank_cache_runs (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  branch text not null,
  semester integer not null,
  academic_year_id uuid,
  exam_scope text not null default 'midsem1+midsem2',
  source_signature text not null,
  row_count integer not null default 0,
  subject_count integer not null default 0,
  computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rank_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null,
  branch text not null,
  semester integer not null,
  academic_year_id uuid,
  enrollment_number text not null,
  roll_number integer,
  source_division text,
  full_name text,
  midsem1_total numeric not null default 0,
  midsem2_total numeric not null default 0,
  total_marks numeric not null default 0,
  subject_scores jsonb not null default '[]'::jsonb,
  source_signature text not null,
  computed_at timestamptz not null default now(),
  unique (cache_key, enrollment_number)
);

create index if not exists rank_cache_lookup_idx
  on public.rank_cache (cache_key, enrollment_number);

create index if not exists rank_cache_division_idx
  on public.rank_cache (cache_key, total_marks desc);

alter table public.rank_cache_runs enable row level security;
alter table public.rank_cache enable row level security;

comment on table public.rank_cache is
  'Raw rank snapshot. Stores source subject marks and totals only; no ceiling/normalized ranking marks.';
