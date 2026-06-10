drop policy if exists "Creators and admins can insert quiz sets" on public.quiz_sets;

create policy "Creators and admins can insert quiz sets"
on public.quiz_sets for insert
to authenticated
with check (
  created_by = auth.uid()
  or public.is_admin()
);

