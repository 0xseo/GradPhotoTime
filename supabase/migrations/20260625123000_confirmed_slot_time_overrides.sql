alter table public.reservation_slots
  add column if not exists confirmed_start_at timestamptz,
  add column if not exists confirmed_end_at timestamptz,
  add constraint reservation_slots_confirmed_time_order
    check (
      (confirmed_start_at is null and confirmed_end_at is null)
      or (
        confirmed_start_at is not null
        and confirmed_end_at is not null
        and confirmed_start_at < confirmed_end_at
      )
    );

alter table public.reservation_slots
  drop constraint if exists reservation_slots_no_overlapping_confirmed;

alter table public.reservation_slots
  add constraint reservation_slots_no_overlapping_confirmed
  exclude using gist (
    event_id with =,
    tstzrange(
      coalesce(confirmed_start_at, start_at),
      coalesce(confirmed_end_at, end_at),
      '[)'
    ) with &&
  )
  where (is_confirmed);
