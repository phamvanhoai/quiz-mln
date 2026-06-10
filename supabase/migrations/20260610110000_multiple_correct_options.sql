alter table public.questions add column if not exists correct_option_ids text[] not null default '{}';

update public.questions
set correct_option_ids = array[correct_option_id]
where cardinality(correct_option_ids) = 0;
