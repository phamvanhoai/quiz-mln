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

create index if not exists user_question_progress_user_id_idx
on public.user_question_progress(user_id);

alter table public.user_question_progress enable row level security;

drop policy if exists "Users can read own progress" on public.user_question_progress;
drop policy if exists "Users can write own progress" on public.user_question_progress;

create policy "Users can read own progress"
on public.user_question_progress for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can write own progress"
on public.user_question_progress for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
