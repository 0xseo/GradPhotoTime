create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create schema if not exists app_private;

create type public.time_block_type as enum ('AVAILABLE', 'BLOCKED');
create type public.reservation_status as enum (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

create or replace function app_private.generate_code(code_length integer default 8)
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  output text := '';
  index integer;
begin
  if code_length < 6 or code_length > 32 then
    raise exception 'code_length must be between 6 and 32';
  end if;

  bytes := gen_random_bytes(code_length);

  for index in 0..code_length - 1 loop
    output := output || substr(
      alphabet,
      (get_byte(bytes, index) % length(alphabet)) + 1,
      1
    );
  end loop;

  return output;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  event_code text not null default app_private.generate_code(8),
  title text not null check (char_length(trim(title)) between 1 and 80),
  description text,
  date_start date not null,
  date_end date not null,
  daily_start_time time not null,
  daily_end_time time not null,
  timezone text not null default 'Asia/Seoul',
  buffer_time_minutes integer not null default 30 check (
    buffer_time_minutes between 0 and 180
  ),
  is_buffer_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_event_code_key unique (event_code),
  constraint events_event_code_format check (event_code ~ '^[A-Z0-9]{6,10}$'),
  constraint events_date_order check (date_start <= date_end),
  constraint events_daily_time_order check (daily_start_time < daily_end_time)
);

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  type public.time_block_type not null,
  note text,
  created_at timestamptz not null default now(),
  constraint time_blocks_time_order check (start_at < end_at)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  creator_id uuid references auth.users(id) on delete set null,
  reservation_access_code text not null default app_private.generate_code(12),
  password_hash text,
  headcount integer not null check (headcount between 1 and 30),
  status public.reservation_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_access_code_key unique (reservation_access_code),
  constraint reservations_access_code_format check (
    reservation_access_code ~ '^[A-Z0-9]{8,32}$'
  )
);

create table public.reservation_participants (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  guest_name text not null check (char_length(trim(guest_name)) > 0),
  is_creator boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reservation_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reservation_slots_time_order check (start_at < end_at)
);

create or replace function app_private.ensure_reservation_slot_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_event_id uuid;
begin
  select event_id
    into expected_event_id
  from public.reservations
  where id = new.reservation_id;

  if expected_event_id is null then
    raise exception 'reservation % does not exist', new.reservation_id;
  end if;

  if new.event_id <> expected_event_id then
    raise exception 'reservation slot event_id must match reservation event_id';
  end if;

  return new;
end;
$$;

create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger set_reservations_updated_at
before update on public.reservations
for each row execute function public.set_updated_at();

create trigger ensure_reservation_slot_event
before insert or update of event_id, reservation_id on public.reservation_slots
for each row execute function app_private.ensure_reservation_slot_event();

alter table public.reservation_slots
  add constraint reservation_slots_no_overlapping_confirmed
  exclude using gist (
    event_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (is_confirmed);

create index events_host_id_idx on public.events(host_id);
create index events_date_range_idx on public.events(date_start, date_end);
create index time_blocks_event_time_idx on public.time_blocks(
  event_id,
  start_at,
  end_at
);
create index reservations_event_status_idx on public.reservations(
  event_id,
  status
);
create index reservations_creator_id_idx on public.reservations(creator_id);
create index reservation_participants_reservation_idx on public.reservation_participants(
  reservation_id
);
create index reservation_participants_user_id_idx on public.reservation_participants(
  user_id
);
create unique index reservation_participants_user_once_idx
  on public.reservation_participants(reservation_id, user_id)
  where user_id is not null;
create index reservation_slots_event_time_idx on public.reservation_slots(
  event_id,
  start_at,
  end_at
);
create index reservation_slots_reservation_idx on public.reservation_slots(
  reservation_id
);

create or replace function app_private.is_event_host(target_event_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.events event
    where event.id = target_event_id
      and event.host_id = (select auth.uid())
  );
$$;

create or replace function app_private.can_access_reservation(
  target_reservation_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.reservations reservation
    where reservation.id = target_reservation_id
      and (
        reservation.creator_id = (select auth.uid())
        or exists (
          select 1
          from public.events event
          where event.id = reservation.event_id
            and event.host_id = (select auth.uid())
        )
        or exists (
          select 1
          from public.reservation_participants participant
          where participant.reservation_id = reservation.id
            and participant.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function app_private.can_access_event(target_event_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.events event
    where event.id = target_event_id
      and event.host_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.reservations reservation
    where reservation.event_id = target_event_id
      and (
        reservation.creator_id = (select auth.uid())
        or exists (
          select 1
          from public.reservation_participants participant
          where participant.reservation_id = reservation.id
            and participant.user_id = (select auth.uid())
        )
      )
  );
$$;

alter table public.events enable row level security;
alter table public.time_blocks enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_participants enable row level security;
alter table public.reservation_slots enable row level security;

create policy "event actors can read events"
on public.events for select to authenticated
using (app_private.can_access_event(id));

create policy "hosts can create events"
on public.events for insert to authenticated
with check (host_id = (select auth.uid()));

create policy "hosts can update events"
on public.events for update to authenticated
using (app_private.is_event_host(id))
with check (app_private.is_event_host(id));

create policy "hosts can delete events"
on public.events for delete to authenticated
using (app_private.is_event_host(id));

create policy "event actors can read time blocks"
on public.time_blocks for select to authenticated
using (app_private.can_access_event(event_id));

create policy "hosts can create time blocks"
on public.time_blocks for insert to authenticated
with check (app_private.is_event_host(event_id));

create policy "hosts can update time blocks"
on public.time_blocks for update to authenticated
using (app_private.is_event_host(event_id))
with check (app_private.is_event_host(event_id));

create policy "hosts can delete time blocks"
on public.time_blocks for delete to authenticated
using (app_private.is_event_host(event_id));

create policy "reservation actors can read reservations"
on public.reservations for select to authenticated
using (app_private.can_access_reservation(id));

create policy "authenticated users can create pending reservations"
on public.reservations for insert to authenticated
with check (
  creator_id = (select auth.uid())
  and status = 'PENDING'
);

create policy "hosts can update reservations"
on public.reservations for update to authenticated
using (app_private.is_event_host(event_id))
with check (app_private.is_event_host(event_id));

create policy "reservation actors can read participants"
on public.reservation_participants for select to authenticated
using (app_private.can_access_reservation(reservation_id));

create policy "reservation actors can create participants"
on public.reservation_participants for insert to authenticated
with check (app_private.can_access_reservation(reservation_id));

create policy "reservation actors can update participants"
on public.reservation_participants for update to authenticated
using (app_private.can_access_reservation(reservation_id))
with check (app_private.can_access_reservation(reservation_id));

create policy "reservation actors can delete participants"
on public.reservation_participants for delete to authenticated
using (app_private.can_access_reservation(reservation_id));

create policy "reservation actors can read slots"
on public.reservation_slots for select to authenticated
using (app_private.can_access_reservation(reservation_id));

create policy "hosts can manage slots"
on public.reservation_slots for all to authenticated
using (app_private.is_event_host(event_id))
with check (app_private.is_event_host(event_id));

create policy "reservation actors can create pending slots"
on public.reservation_slots for insert to authenticated
with check (
  is_confirmed = false
  and app_private.can_access_reservation(reservation_id)
);

create policy "reservation actors can update pending slots"
on public.reservation_slots for update to authenticated
using (
  is_confirmed = false
  and app_private.can_access_reservation(reservation_id)
)
with check (
  is_confirmed = false
  and app_private.can_access_reservation(reservation_id)
);

create policy "reservation actors can delete pending slots"
on public.reservation_slots for delete to authenticated
using (
  is_confirmed = false
  and app_private.can_access_reservation(reservation_id)
);

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
grant execute on all functions in schema app_private to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.time_blocks to authenticated;
grant select, insert, update, delete on public.reservations to authenticated;
grant select, insert, update, delete on public.reservation_participants to authenticated;
grant select, insert, update, delete on public.reservation_slots to authenticated;
