alter table public.quiz_sets add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.quiz_sets add column if not exists created_by_email text;

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

drop policy if exists "Public quiz sets are writable" on public.quiz_sets;
drop policy if exists "Creators and admins can insert quiz sets" on public.quiz_sets;
drop policy if exists "Creators and admins can update quiz sets" on public.quiz_sets;
drop policy if exists "Creators and admins can delete quiz sets" on public.quiz_sets;
drop policy if exists "Public questions are writable" on public.questions;
drop policy if exists "Authenticated users can insert questions" on public.questions;
drop policy if exists "Creators and admins can update questions" on public.questions;
drop policy if exists "Creators and admins can delete questions" on public.questions;
drop policy if exists "Public set questions are writable" on public.quiz_set_questions;
drop policy if exists "Creators and admins can insert set questions" on public.quiz_set_questions;
drop policy if exists "Creators and admins can update set questions" on public.quiz_set_questions;
drop policy if exists "Creators and admins can delete set questions" on public.quiz_set_questions;
drop policy if exists "Public options are writable" on public.options;
drop policy if exists "Creators and admins can insert options" on public.options;
drop policy if exists "Creators and admins can update options" on public.options;
drop policy if exists "Creators and admins can delete options" on public.options;
drop policy if exists "Public keywords are writable" on public.keywords;
drop policy if exists "Creators and admins can insert keywords" on public.keywords;
drop policy if exists "Creators and admins can update keywords" on public.keywords;
drop policy if exists "Creators and admins can delete keywords" on public.keywords;

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

create policy "Authenticated users can insert questions" on public.questions for insert to authenticated with check (true);
create policy "Creators and admins can update questions" on public.questions for update to authenticated using (public.can_manage_question(id)) with check (public.can_manage_question(id));
create policy "Creators and admins can delete questions" on public.questions for delete to authenticated using (public.can_manage_question(id));

create policy "Creators and admins can insert set questions" on public.quiz_set_questions for insert to authenticated with check (public.can_manage_set(set_id));
create policy "Creators and admins can update set questions" on public.quiz_set_questions for update to authenticated using (public.can_manage_set(set_id)) with check (public.can_manage_set(set_id));
create policy "Creators and admins can delete set questions" on public.quiz_set_questions for delete to authenticated using (public.can_manage_set(set_id));

create policy "Creators and admins can insert options" on public.options for insert to authenticated with check (public.can_manage_question(question_id));
create policy "Creators and admins can update options" on public.options for update to authenticated using (public.can_manage_question(question_id)) with check (public.can_manage_question(question_id));
create policy "Creators and admins can delete options" on public.options for delete to authenticated using (public.can_manage_question(question_id));

create policy "Creators and admins can insert keywords" on public.keywords for insert to authenticated with check (public.can_manage_question(question_id));
create policy "Creators and admins can update keywords" on public.keywords for update to authenticated using (public.can_manage_question(question_id)) with check (public.can_manage_question(question_id));
create policy "Creators and admins can delete keywords" on public.keywords for delete to authenticated using (public.can_manage_question(question_id));
