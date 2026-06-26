alter table public.reservation_slots
  add column if not exists priority_order integer not null default 0;

update public.reservation_slots
set priority_order = ranked.priority_order
from (
  select
    id,
    row_number() over (
      partition by reservation_id
      order by start_at, created_at, id
    ) as priority_order
  from public.reservation_slots
) as ranked
where public.reservation_slots.id = ranked.id;

create index if not exists reservation_slots_reservation_priority_idx
  on public.reservation_slots(reservation_id, priority_order);
