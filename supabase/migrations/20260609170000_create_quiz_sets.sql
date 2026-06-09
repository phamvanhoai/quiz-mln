create table if not exists public.quiz_sets (
  id text primary key,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quiz_sets enable row level security;

drop policy if exists "Public quiz sets are readable" on public.quiz_sets;
drop policy if exists "Public quiz sets are writable" on public.quiz_sets;

create policy "Public quiz sets are readable"
on public.quiz_sets for select
to anon, authenticated
using (true);

create policy "Public quiz sets are writable"
on public.quiz_sets for all
to anon, authenticated
using (true)
with check (true);
