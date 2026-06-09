create table if not exists public.quiz_sets (
  id text primary key,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id text primary key,
  question_text text not null,
  correct_option_id text not null,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_set_questions (
  set_id text not null references public.quiz_sets(id) on delete cascade,
  question_id text not null references public.questions(id) on delete cascade,
  position integer not null default 0,
  primary key (set_id, question_id)
);

create table if not exists public.options (
  id text primary key,
  question_id text not null references public.questions(id) on delete cascade,
  label text not null check (label in ('A', 'B', 'C', 'D')),
  text text not null,
  position integer not null default 0
);

create table if not exists public.keywords (
  id text primary key,
  question_id text not null references public.questions(id) on delete cascade,
  text text not null,
  start_index integer,
  end_index integer
);

create table if not exists public.user_question_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.questions(id) on delete cascade,
  learned boolean not null default false,
  starred boolean not null default false,
  wrong_count integer not null default 0,
  correct_streak integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

create index if not exists quiz_set_questions_set_id_position_idx
on public.quiz_set_questions(set_id, position);

create index if not exists options_question_id_position_idx
on public.options(question_id, position);

create index if not exists keywords_question_id_idx
on public.keywords(question_id);

create index if not exists user_question_progress_user_id_idx
on public.user_question_progress(user_id);

create index if not exists admin_users_email_idx
on public.admin_users(lower(email));

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quiz_sets'
      and column_name = 'questions'
  ) then
    insert into public.questions (id, question_text, correct_option_id, explanation, created_at, updated_at)
    select
      question_item.value->>'id',
      question_item.value->>'questionText',
      question_item.value->>'correctOptionId',
      nullif(question_item.value->>'explanation', ''),
      quiz_sets.created_at,
      quiz_sets.updated_at
    from public.quiz_sets
    cross join lateral jsonb_array_elements(coalesce(quiz_sets.questions, '[]'::jsonb)) as question_item(value)
    where question_item.value ? 'id'
    on conflict (id) do update set
      question_text = excluded.question_text,
      correct_option_id = excluded.correct_option_id,
      explanation = excluded.explanation,
      updated_at = excluded.updated_at;

    insert into public.quiz_set_questions (set_id, question_id, position)
    select
      quiz_sets.id,
      question_item.value->>'id',
      question_item.ordinality::integer - 1
    from public.quiz_sets
    cross join lateral jsonb_array_elements(coalesce(quiz_sets.questions, '[]'::jsonb)) with ordinality as question_item(value, ordinality)
    where question_item.value ? 'id'
    on conflict (set_id, question_id) do update set position = excluded.position;

    insert into public.options (id, question_id, label, text, position)
    select
      option_item.value->>'id',
      question_item.value->>'id',
      option_item.value->>'label',
      option_item.value->>'text',
      option_item.ordinality::integer - 1
    from public.quiz_sets
    cross join lateral jsonb_array_elements(coalesce(quiz_sets.questions, '[]'::jsonb)) as question_item(value)
    cross join lateral jsonb_array_elements(coalesce(question_item.value->'options', '[]'::jsonb)) with ordinality as option_item(value, ordinality)
    where option_item.value ? 'id'
    on conflict (id) do update set
      question_id = excluded.question_id,
      label = excluded.label,
      text = excluded.text,
      position = excluded.position;

    insert into public.keywords (id, question_id, text, start_index, end_index)
    select
      keyword_item.value->>'id',
      question_item.value->>'id',
      keyword_item.value->>'text',
      nullif(keyword_item.value->>'startIndex', '')::integer,
      nullif(keyword_item.value->>'endIndex', '')::integer
    from public.quiz_sets
    cross join lateral jsonb_array_elements(coalesce(quiz_sets.questions, '[]'::jsonb)) as question_item(value)
    cross join lateral jsonb_array_elements(coalesce(question_item.value->'keywords', '[]'::jsonb)) as keyword_item(value)
    where keyword_item.value ? 'id'
    on conflict (id) do update set
      question_id = excluded.question_id,
      text = excluded.text,
      start_index = excluded.start_index,
      end_index = excluded.end_index;

    alter table public.quiz_sets drop column questions;
  end if;
end $$;

alter table public.quiz_sets enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_set_questions enable row level security;
alter table public.options enable row level security;
alter table public.keywords enable row level security;
alter table public.user_question_progress enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Public quiz sets are readable" on public.quiz_sets;
drop policy if exists "Public quiz sets are writable" on public.quiz_sets;
drop policy if exists "Public questions are readable" on public.questions;
drop policy if exists "Public questions are writable" on public.questions;
drop policy if exists "Public set questions are readable" on public.quiz_set_questions;
drop policy if exists "Public set questions are writable" on public.quiz_set_questions;
drop policy if exists "Public options are readable" on public.options;
drop policy if exists "Public options are writable" on public.options;
drop policy if exists "Public keywords are readable" on public.keywords;
drop policy if exists "Public keywords are writable" on public.keywords;
drop policy if exists "Users can read own progress" on public.user_question_progress;
drop policy if exists "Users can write own progress" on public.user_question_progress;
drop policy if exists "Admins can read admin users" on public.admin_users;
drop policy if exists "Admins can write admin users" on public.admin_users;

create policy "Public quiz sets are readable" on public.quiz_sets for select to anon, authenticated using (true);
create policy "Public quiz sets are writable" on public.quiz_sets for all to anon, authenticated using (true) with check (true);

create policy "Public questions are readable" on public.questions for select to anon, authenticated using (true);
create policy "Public questions are writable" on public.questions for all to anon, authenticated using (true) with check (true);

create policy "Public set questions are readable" on public.quiz_set_questions for select to anon, authenticated using (true);
create policy "Public set questions are writable" on public.quiz_set_questions for all to anon, authenticated using (true) with check (true);

create policy "Public options are readable" on public.options for select to anon, authenticated using (true);
create policy "Public options are writable" on public.options for all to anon, authenticated using (true) with check (true);

create policy "Public keywords are readable" on public.keywords for select to anon, authenticated using (true);
create policy "Public keywords are writable" on public.keywords for all to anon, authenticated using (true) with check (true);

create policy "Users can read own progress"
on public.user_question_progress for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can write own progress"
on public.user_question_progress for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Admins can read admin users"
on public.admin_users for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "Admins can write admin users"
on public.admin_users for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
