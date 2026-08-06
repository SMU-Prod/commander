alter table public.eventos add column tem_trilha boolean generated always as (trilha is not null) stored;
