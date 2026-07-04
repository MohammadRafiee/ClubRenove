-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste this > Run

create extension if not exists pgcrypto;

create table if not exists survey_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  duration_seconds integer,
  business_name text,
  business_type text,
  business_size text,
  employee_count text,
  ratings jsonb,
  challenges jsonb,
  challenges_other text,
  importance jsonb,
  future_interest jsonb,
  contact_name text,
  contact_phone text,
  contact_email text,
  preferred_contact text,
  comments text
);

create table if not exists survey_starts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table survey_submissions enable row level security;
alter table survey_starts enable row level security;

-- Anyone (customers on the kiosk, not logged in) can submit a survey.
create policy "anon can insert submissions"
  on survey_submissions for insert
  to anon
  with check (true);

-- Only a logged-in admin can read the submissions (protects contact info).
create policy "authenticated can read submissions"
  on survey_submissions for select
  to authenticated
  using (true);

-- Anyone can log a "survey started" event (used only for the completion-rate stat).
create policy "anon can insert starts"
  on survey_starts for insert
  to anon
  with check (true);

-- The started-count contains no personal data, so it's fine to read publicly.
create policy "anyone can read starts"
  on survey_starts for select
  using (true);
