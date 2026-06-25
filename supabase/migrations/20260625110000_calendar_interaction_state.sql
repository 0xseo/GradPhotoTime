alter table public.event_buffer_overrides
  add column if not exists custom_start_at timestamptz,
  add column if not exists custom_end_at timestamptz,
  add constraint event_buffer_overrides_custom_range_check
    check (
      custom_start_at is null
      or custom_end_at is null
      or custom_start_at < custom_end_at
    );

create table if not exists public.event_active_dates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  active_date date not null,
  created_at timestamptz not null default now(),
  constraint event_active_dates_event_date_key unique (event_id, active_date)
);

insert into public.event_active_dates (event_id, active_date)
select
  events.id,
  series.active_date::date
from public.events
cross join lateral generate_series(
  events.date_start::timestamp,
  events.date_end::timestamp,
  interval '1 day'
) as series(active_date)
on conflict (event_id, active_date) do nothing;

create index if not exists event_active_dates_event_idx
  on public.event_active_dates(event_id, active_date);

alter table public.event_active_dates enable row level security;

create policy "public can read event active dates"
on public.event_active_dates for select
using (true);

create policy "hosts can create event active dates"
on public.event_active_dates for insert to authenticated
with check (app_private.is_event_host(event_id));

create policy "hosts can update event active dates"
on public.event_active_dates for update to authenticated
using (app_private.is_event_host(event_id))
with check (app_private.is_event_host(event_id));

create policy "hosts can delete event active dates"
on public.event_active_dates for delete to authenticated
using (app_private.is_event_host(event_id));

grant select on public.event_active_dates to anon, authenticated;
grant insert, update, delete on public.event_active_dates to authenticated;
