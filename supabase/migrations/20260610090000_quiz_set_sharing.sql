alter table public.quiz_sets add column if not exists visibility text not null default 'public';
alter table public.quiz_sets drop constraint if exists quiz_sets_visibility_check;
alter table public.quiz_sets add constraint quiz_sets_visibility_check check (visibility in ('private', 'shared', 'public'));

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

alter table public.quiz_set_shares enable row level security;

drop policy if exists "Public quiz sets are readable" on public.quiz_sets;
drop policy if exists "Readable quiz sets follow visibility and shares" on public.quiz_sets;
drop policy if exists "Public questions are readable" on public.questions;
drop policy if exists "Readable questions follow quiz set access" on public.questions;
drop policy if exists "Public set questions are readable" on public.quiz_set_questions;
drop policy if exists "Readable set questions follow quiz set access" on public.quiz_set_questions;
drop policy if exists "Public options are readable" on public.options;
drop policy if exists "Readable options follow quiz set access" on public.options;
drop policy if exists "Public keywords are readable" on public.keywords;
drop policy if exists "Readable keywords follow quiz set access" on public.keywords;
drop policy if exists "Users can read relevant quiz set shares" on public.quiz_set_shares;
drop policy if exists "Creators and admins can manage quiz set shares" on public.quiz_set_shares;

create policy "Readable quiz sets follow visibility and shares" on public.quiz_sets for select to anon, authenticated using (public.can_read_set(id));
create policy "Readable questions follow quiz set access" on public.questions for select to anon, authenticated using (public.can_read_question(id));
create policy "Readable set questions follow quiz set access" on public.quiz_set_questions for select to anon, authenticated using (public.can_read_set(set_id));
create policy "Readable options follow quiz set access" on public.options for select to anon, authenticated using (public.can_read_question(question_id));
create policy "Readable keywords follow quiz set access" on public.keywords for select to anon, authenticated using (public.can_read_question(question_id));

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
