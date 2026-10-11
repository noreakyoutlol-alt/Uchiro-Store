-- UCHIRO V3 — safe to re-run
create table if not exists public.users (
  telegram_id          text primary key,
  username             text,
  first_name           text,
  points               integer     not null default 0 check (points >= 0),
  streak_count         integer     not null default 0 check (streak_count between 0 and 7),
  last_daily_claim_at  timestamptz,
  extra                jsonb       not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.point_ledger (
  id             bigint generated always as identity primary key,
  telegram_id    text        not null references public.users(telegram_id) on delete cascade,
  delta          integer     not null,
  reason         text        not null,
  balance_after  integer     not null,
  created_at     timestamptz not null default now()
);
create index if not exists point_ledger_user_idx on public.point_ledger(telegram_id, created_at desc);

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_code        text unique not null,
  telegram_id       text references public.users(telegram_id),
  items             jsonb         not null default '[]'::jsonb,
  total_amount      numeric(12,2) not null,
  currency          text          not null default 'USD',
  status            text          not null default 'pending'
                    check (status in ('pending','paid','failed','cancelled','refunded')),
  payment_provider  text          default 'khpay',
  payment_ref       text unique,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);
create index if not exists orders_user_idx on public.orders(telegram_id, created_at desc);

alter table public.users        enable row level security;
alter table public.point_ledger enable row level security;
alter table public.orders       enable row level security;

-- Atomic daily claim: row-locked, 24h rolling cooldown, 48h streak window, day 7 = +20, other days = +5
create or replace function public.claim_daily_reward(p_telegram_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        public.users%rowtype;
  v_now         timestamptz := now();
  v_elapsed     interval;
  v_prev_streak integer;
  v_streak      integer;
  v_awarded     integer;
begin
  insert into public.users (telegram_id) values (p_telegram_id)
  on conflict (telegram_id) do nothing;

  select * into v_user from public.users where telegram_id = p_telegram_id for update;

  v_prev_streak := coalesce(v_user.streak_count, 0);

  if v_user.last_daily_claim_at is null then
    v_streak := 1;
  else
    v_elapsed := v_now - v_user.last_daily_claim_at;
    if v_elapsed < interval '24 hours' then
      return jsonb_build_object(
        'success', false,
        'error', 'ALREADY_CLAIMED',
        'remaining_ms', floor(extract(epoch from (interval '24 hours' - v_elapsed)) * 1000)::bigint,
        'points', coalesce(v_user.points, 0),
        'streak', v_prev_streak,
        'server_now', v_now
      );
    elsif v_elapsed <= interval '48 hours' then
      v_streak := (v_prev_streak % 7) + 1;
    else
      v_streak := 1;
    end if;
  end if;

  v_awarded := case when v_streak = 7 then 20 else 5 end;

  update public.users
     set points              = coalesce(points, 0) + v_awarded,
         streak_count        = v_streak,
         last_daily_claim_at = v_now,
         updated_at          = v_now
   where telegram_id = p_telegram_id
   returning * into v_user;

  insert into public.point_ledger (telegram_id, delta, reason, balance_after)
  values (p_telegram_id, v_awarded, 'daily_claim_day_' || v_streak::text, v_user.points);

  return jsonb_build_object(
    'success', true,
    'points', v_user.points,
    'points_awarded', v_awarded,
    'streak', v_streak,
    'next_claim_at', v_now + interval '24 hours',
    'server_now', v_now
  );
end $$;

-- Atomic point changes for everything else (purchases, referrals, admin edits)
create or replace function public.adjust_points(p_telegram_id text, p_delta integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
begin
  insert into public.users (telegram_id) values (p_telegram_id)
  on conflict (telegram_id) do nothing;

  select * into v_user from public.users where telegram_id = p_telegram_id for update;

  if coalesce(v_user.points, 0) + p_delta < 0 then
    return jsonb_build_object('success', false, 'error', 'INSUFFICIENT_POINTS', 'points', coalesce(v_user.points, 0));
  end if;

  update public.users
     set points = coalesce(points, 0) + p_delta, updated_at = now()
   where telegram_id = p_telegram_id
   returning * into v_user;

  insert into public.point_ledger (telegram_id, delta, reason, balance_after)
  values (p_telegram_id, p_delta, p_reason, v_user.points);

  return jsonb_build_object('success', true, 'points', v_user.points);
end $$;

revoke all on function public.claim_daily_reward(text)                from public, anon, authenticated;
revoke all on function public.adjust_points(text, integer, text)      from public, anon, authenticated;
grant execute on function public.claim_daily_reward(text)             to service_role;
grant execute on function public.adjust_points(text, integer, text)   to service_role;
