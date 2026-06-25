alter table public.events
  add column if not exists is_buffer_before_active boolean not null default true,
  add column if not exists is_buffer_after_active boolean not null default true;

update public.events
set
  is_buffer_before_active = is_buffer_active,
  is_buffer_after_active = is_buffer_active
where true;

create table if not exists public.event_buffer_overrides (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  reservation_slot_id uuid not null references public.reservation_slots(id) on delete cascade,
  side text not null check (side in ('BEFORE', 'AFTER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_buffer_overrides_slot_side_key unique (reservation_slot_id, side)
);

create trigger set_event_buffer_overrides_updated_at
before update on public.event_buffer_overrides
for each row execute function public.set_updated_at();

create index if not exists event_buffer_overrides_event_idx
  on public.event_buffer_overrides(event_id);

alter table public.event_buffer_overrides enable row level security;

create policy "hosts can read event buffer overrides"
on public.event_buffer_overrides for select to authenticated
using (app_private.is_event_host(event_id));

create policy "hosts can create event buffer overrides"
on public.event_buffer_overrides for insert to authenticated
with check (app_private.is_event_host(event_id));

create policy "hosts can update event buffer overrides"
on public.event_buffer_overrides for update to authenticated
using (app_private.is_event_host(event_id))
with check (app_private.is_event_host(event_id));

create policy "hosts can delete event buffer overrides"
on public.event_buffer_overrides for delete to authenticated
using (app_private.is_event_host(event_id));

grant select, insert, update, delete on public.event_buffer_overrides to authenticated;
