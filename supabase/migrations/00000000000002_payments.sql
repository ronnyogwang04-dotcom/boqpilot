-- Replaces the old Stripe billing table with a provider-agnostic payments
-- table, initially backed by PayFast.

drop table if exists public.stripe_customers;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'payfast',
  provider_payment_id text,
  -- The reference we hand to the gateway (m_payment_id for PayFast) so its
  -- notification can be correlated back to this row.
  m_payment_id text not null unique,
  amount numeric not null,
  currency text not null default 'ZAR',
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed', 'cancelled')),
  item_name text,
  raw_itn jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments (user_id);

alter table public.payments enable row level security;

create policy "Users can view their own payments"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "Users can create their own pending payments"
  on public.payments for insert
  with check (auth.uid() = user_id and status = 'pending');

-- Updates (marking a payment complete/failed from the ITN handler) are done
-- with the service-role key, which bypasses RLS entirely.
