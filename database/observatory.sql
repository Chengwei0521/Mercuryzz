-- Application schema for the remote create_observatory_signals migration.
create table public.observatory_signals (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 32),
  message text not null check (char_length(btrim(message)) between 1 and 280),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  mood text not null default 'wonder' check (mood in ('wonder', 'hope', 'curiosity')),
  visitor_id uuid not null,
  is_observatory boolean not null default false,
  created_at timestamptz not null default now()
);
create index observatory_signals_created_idx on public.observatory_signals (created_at desc);
create index observatory_signals_visitor_idx on public.observatory_signals (visitor_id, created_at desc);
alter table public.observatory_signals enable row level security;
revoke all on public.observatory_signals from anon, authenticated;
grant select on public.observatory_signals to anon, authenticated;
grant insert (name, message, latitude, longitude, mood, visitor_id) on public.observatory_signals to anon, authenticated;
grant usage on sequence public.observatory_signals_id_seq to anon, authenticated;

create policy "Signals are a public guestbook" on public.observatory_signals
  for select to anon, authenticated using (true);
create policy "Visitors may leave bounded signals" on public.observatory_signals
  for insert to anon, authenticated with check (
    is_observatory = false and created_at = now()
    and char_length(btrim(name)) between 1 and 32
    and char_length(btrim(message)) between 1 and 280
  );

create function public.guard_observatory_signal() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(71809341);
  if (select count(*) from public.observatory_signals where created_at > now() - interval '1 day' and not is_observatory) >= 500 then
    raise exception 'The observatory has reached its daily signal capacity. Please return tomorrow.';
  end if;
  if (select count(*) from public.observatory_signals where created_at > now() - interval '1 minute' and not is_observatory) >= 20
    or (select count(*) from public.observatory_signals where visitor_id = new.visitor_id and created_at > now() - interval '1 minute') >= 3 then
    raise exception 'Signals are arriving too quickly. Please wait a minute.';
  end if;
  new.name := btrim(new.name);
  new.message := btrim(new.message);
  return new;
end;
$$;
revoke all on function public.guard_observatory_signal() from public, anon, authenticated;
create trigger guard_observatory_signal before insert on public.observatory_signals
  for each row execute function public.guard_observatory_signal();
alter publication supabase_realtime add table public.observatory_signals;
