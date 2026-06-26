create or replace function app_private.assign_distinct_event_code()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  attempts integer := 0;
begin
  if new.event_code is null or new.event_code !~ '^[A-Z0-9]{6,10}$' then
    new.event_code := app_private.generate_code(8);
  end if;

  while exists (
    select 1
    from public.reservations
    where reservation_access_code = new.event_code
  ) or exists (
    select 1
    from public.events
    where event_code = new.event_code
      and id <> new.id
  ) loop
    attempts := attempts + 1;

    if attempts > 20 then
      raise exception 'could not generate a distinct event code';
    end if;

    new.event_code := app_private.generate_code(8);
  end loop;

  return new;
end;
$$;

create or replace function app_private.assign_distinct_reservation_access_code()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  attempts integer := 0;
begin
  if new.reservation_access_code is null
    or new.reservation_access_code !~ '^[A-Z0-9]{8,32}$'
  then
    new.reservation_access_code := app_private.generate_code(12);
  end if;

  while exists (
    select 1
    from public.events
    where event_code = new.reservation_access_code
  ) or exists (
    select 1
    from public.reservations
    where reservation_access_code = new.reservation_access_code
      and id <> new.id
  ) loop
    attempts := attempts + 1;

    if attempts > 20 then
      raise exception 'could not generate a distinct reservation access code';
    end if;

    new.reservation_access_code := app_private.generate_code(12);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_events_distinct_event_code on public.events;
create trigger trg_events_distinct_event_code
before insert or update of event_code on public.events
for each row execute function app_private.assign_distinct_event_code();

drop trigger if exists trg_reservations_distinct_access_code on public.reservations;
create trigger trg_reservations_distinct_access_code
before insert or update of reservation_access_code on public.reservations
for each row execute function app_private.assign_distinct_reservation_access_code();
