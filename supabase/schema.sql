create table if not exists public.quiz_sets (
  id text primary key,
  title text not null,
  visibility text not null default 'public' check (visibility in ('private', 'shared', 'public')),
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quiz_sets add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.quiz_sets add column if not exists created_by_email text;
alter table public.quiz_sets add column if not exists visibility text not null default 'public';
alter table public.quiz_sets drop constraint if exists quiz_sets_visibility_check;
alter table public.quiz_sets add constraint quiz_sets_visibility_check check (visibility in ('private', 'shared', 'public'));

create table if not exists public.questions (
  id text primary key,
  question_text text not null,
  correct_option_id text not null,
  correct_option_ids text[] not null default '{}',
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

alter table public.questions add column if not exists correct_option_ids text[] not null default '{}';
update public.questions
set correct_option_ids = array[correct_option_id]
where cardinality(correct_option_ids) = 0;

create table if not exists public.options (
  id text primary key,
  question_id text not null references public.questions(id) on delete cascade,
  label text not null check (label in ('A', 'B', 'C', 'D', 'E', 'F')),
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

alter table public.options drop constraint if exists options_label_check;
alter table public.options add constraint options_label_check check (label in ('A', 'B', 'C', 'D', 'E', 'F'));

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

create table if not exists public.quiz_set_shares (
  id uuid primary key default gen_random_uuid(),
  set_id text not null references public.quiz_sets(id) on delete cascade,
  shared_with_user_id uuid references auth.users(id) on delete cascade,
  shared_with_email text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint quiz_set_shares_target_check check (shared_with_user_id is not null or nullif(shared_with_email, '') is not null)
);

create unique index if not exists quiz_set_shares_set_user_idx
on public.quiz_set_shares(set_id, shared_with_user_id)
where shared_with_user_id is not null;

create unique index if not exists quiz_set_shares_set_email_idx
on public.quiz_set_shares(set_id, lower(shared_with_email))
where shared_with_email is not null;

create index if not exists quiz_set_shares_user_idx
on public.quiz_set_shares(shared_with_user_id)
where shared_with_user_id is not null;

create index if not exists quiz_set_shares_email_idx
on public.quiz_set_shares(lower(shared_with_email))
where shared_with_email is not null;

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

create or replace function public.can_manage_set(target_set_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quiz_sets
    where id = target_set_id
      and (created_by = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.can_manage_question(target_question_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quiz_set_questions qsq
    join public.quiz_sets qs on qs.id = qsq.set_id
    where qsq.question_id = target_question_id
      and (qs.created_by = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.can_read_set(target_set_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quiz_sets qs
    where qs.id = target_set_id
      and (
        qs.visibility = 'public'
        or qs.created_by = auth.uid()
        or public.is_admin()
        or exists (
          select 1
          from public.quiz_set_shares share
          where share.set_id = qs.id
            and (
              share.shared_with_user_id = auth.uid()
              or lower(coalesce(share.shared_with_email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
            )
        )
      )
  );
$$;

create or replace function public.can_read_question(target_question_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quiz_set_questions qsq
    where qsq.question_id = target_question_id
      and public.can_read_set(qsq.set_id)
  );
$$;

create or replace function public.delete_quiz_set_with_questions(target_set_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  question_ids text[];
begin
  if not public.can_manage_set(target_set_id) then
    raise exception 'Not allowed to delete quiz set %', target_set_id using errcode = '42501';
  end if;

  select coalesce(array_agg(question_id), array[]::text[])
  into question_ids
  from public.quiz_set_questions
  where set_id = target_set_id;

  delete from public.quiz_sets
  where id = target_set_id;

  delete from public.questions
  where id = any(question_ids);
end;
$$;

create or replace function public.save_quiz_set(payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_email text := auth.jwt()->>'email';
  target_set_id text := payload->>'id';
  question_item jsonb;
  option_item jsonb;
  keyword_item jsonb;
  old_question_ids text[];
  correct_ids text[];
  question_position integer := 0;
  option_position integer := 0;
begin
  if actor is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if nullif(target_set_id, '') is null then
    raise exception 'Missing quiz set id' using errcode = '22023';
  end if;

  if exists (select 1 from public.quiz_sets where id = target_set_id) and not public.can_manage_set(target_set_id) then
    raise exception 'Not allowed to save quiz set %', target_set_id using errcode = '42501';
  end if;

  select coalesce(array_agg(question_id), array[]::text[])
  into old_question_ids
  from public.quiz_set_questions
  where set_id = target_set_id;

  delete from public.quiz_set_questions
  where set_id = target_set_id;

  delete from public.questions
  where id = any(old_question_ids);

  insert into public.quiz_sets (
    id,
    title,
    visibility,
    created_by,
    created_by_email,
    created_at,
    updated_at
  )
  values (
    target_set_id,
    coalesce(nullif(payload->>'title', ''), 'Bộ đề mới'),
    coalesce(nullif(payload->>'visibility', ''), 'private'),
    actor,
    coalesce(nullif(actor_email, ''), nullif(payload->>'createdByEmail', '')),
    coalesce(nullif(payload->>'createdAt', '')::timestamptz, now()),
    coalesce(nullif(payload->>'updatedAt', '')::timestamptz, now())
  )
  on conflict (id) do update set
    title = excluded.title,
    visibility = excluded.visibility,
    updated_at = excluded.updated_at,
    created_by = coalesce(public.quiz_sets.created_by, actor),
    created_by_email = coalesce(public.quiz_sets.created_by_email, excluded.created_by_email);

  for question_item in
    select value from jsonb_array_elements(coalesce(payload->'questions', '[]'::jsonb))
  loop
    correct_ids := coalesce(
      array(
        select jsonb_array_elements_text(question_item->'correctOptionIds')
      ),
      array[question_item->>'correctOptionId']
    );

    insert into public.questions (
      id,
      question_text,
      correct_option_id,
      correct_option_ids,
      explanation,
      updated_at
    )
    values (
      question_item->>'id',
      coalesce(question_item->>'questionText', ''),
      coalesce(nullif(question_item->>'correctOptionId', ''), correct_ids[1]),
      correct_ids,
      nullif(question_item->>'explanation', ''),
      now()
    )
    on conflict (id) do update set
      question_text = excluded.question_text,
      correct_option_id = excluded.correct_option_id,
      correct_option_ids = excluded.correct_option_ids,
      explanation = excluded.explanation,
      updated_at = excluded.updated_at;

    insert into public.quiz_set_questions (set_id, question_id, position)
    values (target_set_id, question_item->>'id', question_position)
    on conflict (set_id, question_id) do update set position = excluded.position;

    option_position := 0;
    for option_item in
      select value from jsonb_array_elements(coalesce(question_item->'options', '[]'::jsonb))
    loop
      insert into public.options (id, question_id, label, text, position)
      values (
        option_item->>'id',
        question_item->>'id',
        option_item->>'label',
        coalesce(option_item->>'text', ''),
        option_position
      )
      on conflict (id) do update set
        question_id = excluded.question_id,
        label = excluded.label,
        text = excluded.text,
        position = excluded.position;

      option_position := option_position + 1;
    end loop;

    for keyword_item in
      select value from jsonb_array_elements(coalesce(question_item->'keywords', '[]'::jsonb))
    loop
      insert into public.keywords (id, question_id, text, start_index, end_index)
      values (
        keyword_item->>'id',
        question_item->>'id',
        coalesce(keyword_item->>'text', ''),
        nullif(keyword_item->>'startIndex', '')::integer,
        nullif(keyword_item->>'endIndex', '')::integer
      )
      on conflict (id) do update set
        question_id = excluded.question_id,
        text = excluded.text,
        start_index = excluded.start_index,
        end_index = excluded.end_index;
    end loop;

    question_position := question_position + 1;
  end loop;

  return target_set_id;
end;
$$;

create index if not exists quiz_set_questions_set_id_position_idx
on public.quiz_set_questions(set_id, position);

create index if not exists quiz_set_questions_question_id_idx
on public.quiz_set_questions(question_id);

create index if not exists quiz_sets_created_by_idx
on public.quiz_sets(created_by);

create index if not exists quiz_sets_visibility_idx
on public.quiz_sets(visibility);

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
    insert into public.questions (id, question_text, correct_option_id, correct_option_ids, explanation, created_at, updated_at)
    select
      question_item.value->>'id',
      question_item.value->>'questionText',
      question_item.value->>'correctOptionId',
      array[question_item.value->>'correctOptionId'],
      nullif(question_item.value->>'explanation', ''),
      quiz_sets.created_at,
      quiz_sets.updated_at
    from public.quiz_sets
    cross join lateral jsonb_array_elements(coalesce(quiz_sets.questions, '[]'::jsonb)) as question_item(value)
    where question_item.value ? 'id'
    on conflict (id) do update set
      question_text = excluded.question_text,
      correct_option_id = excluded.correct_option_id,
      correct_option_ids = excluded.correct_option_ids,
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
alter table public.quiz_set_shares enable row level security;

drop policy if exists "Public quiz sets are readable" on public.quiz_sets;
drop policy if exists "Readable quiz sets follow visibility and shares" on public.quiz_sets;
drop policy if exists "Public quiz sets are writable" on public.quiz_sets;
drop policy if exists "Creators and admins can insert quiz sets" on public.quiz_sets;
drop policy if exists "Creators and admins can update quiz sets" on public.quiz_sets;
drop policy if exists "Creators and admins can delete quiz sets" on public.quiz_sets;
drop policy if exists "Public questions are readable" on public.questions;
drop policy if exists "Readable questions follow quiz set access" on public.questions;
drop policy if exists "Public questions are writable" on public.questions;
drop policy if exists "Authenticated users can insert questions" on public.questions;
drop policy if exists "Creators and admins can update questions" on public.questions;
drop policy if exists "Creators and admins can delete questions" on public.questions;
drop policy if exists "Public set questions are readable" on public.quiz_set_questions;
drop policy if exists "Readable set questions follow quiz set access" on public.quiz_set_questions;
drop policy if exists "Public set questions are writable" on public.quiz_set_questions;
drop policy if exists "Creators and admins can insert set questions" on public.quiz_set_questions;
drop policy if exists "Creators and admins can update set questions" on public.quiz_set_questions;
drop policy if exists "Creators and admins can delete set questions" on public.quiz_set_questions;
drop policy if exists "Public options are readable" on public.options;
drop policy if exists "Readable options follow quiz set access" on public.options;
drop policy if exists "Public options are writable" on public.options;
drop policy if exists "Creators and admins can insert options" on public.options;
drop policy if exists "Creators and admins can update options" on public.options;
drop policy if exists "Creators and admins can delete options" on public.options;
drop policy if exists "Public keywords are readable" on public.keywords;
drop policy if exists "Readable keywords follow quiz set access" on public.keywords;
drop policy if exists "Public keywords are writable" on public.keywords;
drop policy if exists "Creators and admins can insert keywords" on public.keywords;
drop policy if exists "Creators and admins can update keywords" on public.keywords;
drop policy if exists "Creators and admins can delete keywords" on public.keywords;
drop policy if exists "Users can read own progress" on public.user_question_progress;
drop policy if exists "Users can write own progress" on public.user_question_progress;
drop policy if exists "Admins can read admin users" on public.admin_users;
drop policy if exists "Admins can write admin users" on public.admin_users;
drop policy if exists "Users can read relevant quiz set shares" on public.quiz_set_shares;
drop policy if exists "Creators and admins can manage quiz set shares" on public.quiz_set_shares;

create policy "Readable quiz sets follow visibility and shares" on public.quiz_sets for select to anon, authenticated using (public.can_read_set(id));

create policy "Creators and admins can insert quiz sets"
on public.quiz_sets for insert
to authenticated
with check (created_by = auth.uid() or public.is_admin());

create policy "Creators and admins can update quiz sets"
on public.quiz_sets for update
to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());

create policy "Creators and admins can delete quiz sets"
on public.quiz_sets for delete
to authenticated
using (created_by = auth.uid() or public.is_admin());

create policy "Readable questions follow quiz set access" on public.questions for select to anon, authenticated using (public.can_read_question(id));
create policy "Authenticated users can insert questions" on public.questions for insert to authenticated with check (true);
create policy "Creators and admins can update questions" on public.questions for update to authenticated using (public.can_manage_question(id)) with check (public.can_manage_question(id));
create policy "Creators and admins can delete questions" on public.questions for delete to authenticated using (public.can_manage_question(id));

create policy "Readable set questions follow quiz set access" on public.quiz_set_questions for select to anon, authenticated using (public.can_read_set(set_id));
create policy "Creators and admins can insert set questions" on public.quiz_set_questions for insert to authenticated with check (public.can_manage_set(set_id));
create policy "Creators and admins can update set questions" on public.quiz_set_questions for update to authenticated using (public.can_manage_set(set_id)) with check (public.can_manage_set(set_id));
create policy "Creators and admins can delete set questions" on public.quiz_set_questions for delete to authenticated using (public.can_manage_set(set_id));

create policy "Readable options follow quiz set access" on public.options for select to anon, authenticated using (public.can_read_question(question_id));
create policy "Creators and admins can insert options" on public.options for insert to authenticated with check (public.can_manage_question(question_id));
create policy "Creators and admins can update options" on public.options for update to authenticated using (public.can_manage_question(question_id)) with check (public.can_manage_question(question_id));
create policy "Creators and admins can delete options" on public.options for delete to authenticated using (public.can_manage_question(question_id));

create policy "Readable keywords follow quiz set access" on public.keywords for select to anon, authenticated using (public.can_read_question(question_id));
create policy "Creators and admins can insert keywords" on public.keywords for insert to authenticated with check (public.can_manage_question(question_id));
create policy "Creators and admins can update keywords" on public.keywords for update to authenticated using (public.can_manage_question(question_id)) with check (public.can_manage_question(question_id));
create policy "Creators and admins can delete keywords" on public.keywords for delete to authenticated using (public.can_manage_question(question_id));

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

create policy "Users can read relevant quiz set shares"
on public.quiz_set_shares for select
to authenticated
using (
  public.can_manage_set(set_id)
  or shared_with_user_id = auth.uid()
  or lower(coalesce(shared_with_email, '')) = lower(coalesce(auth.jwt()->>'email', ''))
);

create policy "Creators and admins can manage quiz set shares"
on public.quiz_set_shares for all
to authenticated
using (public.can_manage_set(set_id))
with check (public.can_manage_set(set_id));
