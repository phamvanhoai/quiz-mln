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

create index if not exists admin_users_email_idx
on public.admin_users(lower(email));

alter table public.admin_users enable row level security;

drop policy if exists "Admins can read admin users" on public.admin_users;
drop policy if exists "Admins can write admin users" on public.admin_users;

create policy "Admins can read admin users"
on public.admin_users for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

create policy "Admins can write admin users"
on public.admin_users for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
