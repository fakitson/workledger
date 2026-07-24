-- Work Ledger: one row per user holding the full ledger state.
-- The settings jsonb also carries a "_runtime" sub-object (running timer,
-- last project, savedAt) so an in-flight timer survives closing the browser.

create table if not exists public.ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  entries jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  world int[] not null default '{}',
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ledger_set_updated_at on public.ledger;
create trigger ledger_set_updated_at
  before update on public.ledger
  for each row execute function public.set_updated_at();

alter table public.ledger enable row level security;

create policy "Users can read own ledger"
  on public.ledger for select
  using (auth.uid() = user_id);

create policy "Users can insert own ledger"
  on public.ledger for insert
  with check (auth.uid() = user_id);

create policy "Users can update own ledger"
  on public.ledger for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own ledger"
  on public.ledger for delete
  using (auth.uid() = user_id);
