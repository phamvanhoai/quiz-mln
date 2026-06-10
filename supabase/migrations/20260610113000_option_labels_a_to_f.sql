alter table public.options drop constraint if exists options_label_check;
alter table public.options add constraint options_label_check check (label in ('A', 'B', 'C', 'D', 'E', 'F'));
