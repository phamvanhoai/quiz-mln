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

create index if not exists quiz_set_questions_set_id_position_idx on public.quiz_set_questions(set_id, position);
create index if not exists options_question_id_position_idx on public.options(question_id, position);
create index if not exists keywords_question_id_idx on public.keywords(question_id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'quiz_sets' and column_name = 'questions'
  ) then
    insert into public.questions (id, question_text, correct_option_id, explanation, created_at, updated_at)
    select q.value->>'id', q.value->>'questionText', q.value->>'correctOptionId', nullif(q.value->>'explanation', ''), s.created_at, s.updated_at
    from public.quiz_sets s
    cross join lateral jsonb_array_elements(coalesce(s.questions, '[]'::jsonb)) as q(value)
    where q.value ? 'id'
    on conflict (id) do update set question_text = excluded.question_text, correct_option_id = excluded.correct_option_id, explanation = excluded.explanation, updated_at = excluded.updated_at;

    insert into public.quiz_set_questions (set_id, question_id, position)
    select s.id, q.value->>'id', q.ordinality::integer - 1
    from public.quiz_sets s
    cross join lateral jsonb_array_elements(coalesce(s.questions, '[]'::jsonb)) with ordinality as q(value, ordinality)
    where q.value ? 'id'
    on conflict (set_id, question_id) do update set position = excluded.position;

    insert into public.options (id, question_id, label, text, position)
    select o.value->>'id', q.value->>'id', o.value->>'label', o.value->>'text', o.ordinality::integer - 1
    from public.quiz_sets s
    cross join lateral jsonb_array_elements(coalesce(s.questions, '[]'::jsonb)) as q(value)
    cross join lateral jsonb_array_elements(coalesce(q.value->'options', '[]'::jsonb)) with ordinality as o(value, ordinality)
    where o.value ? 'id'
    on conflict (id) do update set question_id = excluded.question_id, label = excluded.label, text = excluded.text, position = excluded.position;

    insert into public.keywords (id, question_id, text, start_index, end_index)
    select k.value->>'id', q.value->>'id', k.value->>'text', nullif(k.value->>'startIndex', '')::integer, nullif(k.value->>'endIndex', '')::integer
    from public.quiz_sets s
    cross join lateral jsonb_array_elements(coalesce(s.questions, '[]'::jsonb)) as q(value)
    cross join lateral jsonb_array_elements(coalesce(q.value->'keywords', '[]'::jsonb)) as k(value)
    where k.value ? 'id'
    on conflict (id) do update set question_id = excluded.question_id, text = excluded.text, start_index = excluded.start_index, end_index = excluded.end_index;

    alter table public.quiz_sets drop column questions;
  end if;
end $$;

alter table public.questions enable row level security;
alter table public.quiz_set_questions enable row level security;
alter table public.options enable row level security;
alter table public.keywords enable row level security;

drop policy if exists "Public questions are readable" on public.questions;
drop policy if exists "Public questions are writable" on public.questions;
drop policy if exists "Public set questions are readable" on public.quiz_set_questions;
drop policy if exists "Public set questions are writable" on public.quiz_set_questions;
drop policy if exists "Public options are readable" on public.options;
drop policy if exists "Public options are writable" on public.options;
drop policy if exists "Public keywords are readable" on public.keywords;
drop policy if exists "Public keywords are writable" on public.keywords;

create policy "Public questions are readable" on public.questions for select to anon, authenticated using (true);
create policy "Public questions are writable" on public.questions for all to anon, authenticated using (true) with check (true);
create policy "Public set questions are readable" on public.quiz_set_questions for select to anon, authenticated using (true);
create policy "Public set questions are writable" on public.quiz_set_questions for all to anon, authenticated using (true) with check (true);
create policy "Public options are readable" on public.options for select to anon, authenticated using (true);
create policy "Public options are writable" on public.options for all to anon, authenticated using (true) with check (true);
create policy "Public keywords are readable" on public.keywords for select to anon, authenticated using (true);
create policy "Public keywords are writable" on public.keywords for all to anon, authenticated using (true) with check (true);
