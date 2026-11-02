-- Supabase → SQL Editor에 붙여넣고 Run (한 번만)
create table if not exists public.budgets (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  doc text not null,
  data jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, doc)
);
alter table public.budgets enable row level security;
drop policy if exists "own rows" on public.budgets;
create policy "own rows" on public.budgets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table public.budgets;
