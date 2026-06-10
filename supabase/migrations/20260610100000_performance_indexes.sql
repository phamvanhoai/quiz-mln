create index if not exists quiz_set_questions_question_id_idx
on public.quiz_set_questions(question_id);

create index if not exists quiz_sets_created_by_idx
on public.quiz_sets(created_by);

create index if not exists quiz_sets_visibility_idx
on public.quiz_sets(visibility);

create index if not exists quiz_set_shares_user_idx
on public.quiz_set_shares(shared_with_user_id)
where shared_with_user_id is not null;

create index if not exists quiz_set_shares_email_idx
on public.quiz_set_shares(lower(shared_with_email))
where shared_with_email is not null;
