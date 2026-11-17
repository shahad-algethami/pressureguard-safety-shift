-- Run once in the SQL editor of a new Supabase project.
create table if not exists public.simulation_sessions (
  id uuid primary key,
  payload jsonb not null,
  version integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.simulation_sessions enable row level security;
revoke all on public.simulation_sessions from anon, authenticated;
grant all on public.simulation_sessions to service_role;
-- Only explicitly consenting participants are copied here. No patient or session payload is public.
create table if not exists public.participants (
  id uuid primary key references public.simulation_sessions(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  created_at timestamptz not null default now()
);
alter table public.participants enable row level security;
revoke all on public.participants from anon, authenticated;
grant select on public.participants to anon, authenticated;
grant all on public.participants to service_role;
create policy "Consenting wall names are public" on public.participants for select to anon, authenticated using (true);
alter table public.participants replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='participants') then
    alter publication supabase_realtime add table public.participants;
  end if;
end $$;
-- Suggested event retention: after the exhibition, delete private sessions and wall entries.
-- delete from public.simulation_sessions where created_at < now() - interval '30 days';

-- Shared rate limits work across serverless instances. Only hashed keys are stored.
create table if not exists public.request_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (bucket_key, window_start)
);
alter table public.request_limits enable row level security;
revoke all on public.request_limits from anon, authenticated;
grant all on public.request_limits to service_role;
create or replace function public.consume_rate_limit(bucket_key text, max_requests integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare current_hits integer;
begin
  delete from public.request_limits where window_start < now() - interval '5 minutes';
  insert into public.request_limits as limits (bucket_key, window_start, hits)
    values (consume_rate_limit.bucket_key, date_trunc('minute', now()), 1)
    on conflict on constraint request_limits_pkey do update set hits = limits.hits + 1
    returning hits into current_hits;
  return current_hits <= max_requests;
end;
$$;
revoke all on function public.consume_rate_limit(text,integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,integer) to service_role;
