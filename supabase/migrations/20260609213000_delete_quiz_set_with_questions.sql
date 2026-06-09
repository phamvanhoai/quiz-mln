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
