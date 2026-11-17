-- Family calendar schema for Supabase. Run once in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(encode(gen_random_bytes(4), 'hex')),
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id),
  unique (user_id)
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  details text check (details is null or char_length(details) <= 500),
  event_date date not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists calendar_events_family_date_idx on public.calendar_events(family_id, event_date);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.calendar_events enable row level security;

create policy "Members can view their family" on public.families for select to authenticated
  using (exists (select 1 from public.family_members m where m.family_id = id and m.user_id = auth.uid()));
create policy "Members can view family membership" on public.family_members for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.family_members m where m.family_id = family_members.family_id and m.user_id = auth.uid()));
create policy "Members can view family events" on public.calendar_events for select to authenticated
  using (exists (select 1 from public.family_members m where m.family_id = calendar_events.family_id and m.user_id = auth.uid()));
create policy "Members can add family events" on public.calendar_events for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.family_members m where m.family_id = calendar_events.family_id and m.user_id = auth.uid()));
create policy "Members can delete family events" on public.calendar_events for delete to authenticated
  using (exists (select 1 from public.family_members m where m.family_id = calendar_events.family_id and m.user_id = auth.uid()));

grant select on public.families, public.family_members, public.calendar_events to authenticated;
grant insert, delete on public.calendar_events to authenticated;

create or replace function public.create_family(family_name text)
returns public.families
language plpgsql
security definer
set search_path = ''
as $$
declare new_family public.families;
begin
  if auth.uid() is null then raise exception 'Zaloguj się, aby utworzyć kalendarz.'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'To konto jest już przypisane do rodziny.';
  end if;
  insert into public.families(name) values (btrim(family_name)) returning * into new_family;
  insert into public.family_members(family_id, user_id) values (new_family.id, auth.uid());
  return new_family;
end;
$$;

create or replace function public.join_family(code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare target_family_id uuid;
begin
  if auth.uid() is null then raise exception 'Zaloguj się, aby dołączyć do rodziny.'; end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'To konto jest już przypisane do rodziny.';
  end if;
  select id into target_family_id from public.families where invite_code = upper(btrim(code));
  if target_family_id is null then raise exception 'Nieprawidłowy kod zaproszenia.'; end if;
  insert into public.family_members(family_id, user_id) values (target_family_id, auth.uid());
end;
$$;

grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;

-- Realtime is used by the app to update phones immediately.
alter publication supabase_realtime add table public.calendar_events;
