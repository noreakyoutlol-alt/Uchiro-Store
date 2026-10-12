-- PIN brute-force protection + revenue summary for the Admin Bot. Safe to re-run.
create table if not exists public.admin_pin_attempts (
  id           bigint generated always as identity primary key,
  telegram_id  text        not null,
  success      boolean     not null,
  created_at   timestamptz not null default now()
);
create index if not exists admin_pin_attempts_idx on public.admin_pin_attempts(telegram_id, created_at desc);
alter table public.admin_pin_attempts enable row level security;

create or replace function public.admin_revenue_summary()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'today',
      coalesce(sum(total_amount) filter (
        where created_at >= (date_trunc('day', now() at time zone 'Asia/Phnom_Penh') at time zone 'Asia/Phnom_Penh')
      ), 0),
    'last7',  coalesce(sum(total_amount) filter (where created_at >= now() - interval '7 days'), 0),
    'last30', coalesce(sum(total_amount) filter (where created_at >= now() - interval '30 days'), 0),
    'all',    coalesce(sum(total_amount), 0),
    'paid_orders', count(*)
  )
  from public.orders
  where status = 'paid';
$$;

revoke all on function public.admin_revenue_summary() from public, anon, authenticated;
grant execute on function public.admin_revenue_summary() to service_role;
