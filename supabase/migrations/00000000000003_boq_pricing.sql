-- Page-based BOQ pricing + one-time free trial + provider-independent payments.
--
-- The uploaded PDF itself is never stored anywhere (app or DB) — only its
-- page count and the pricing decision derived from it.

-- Per-user free trial and lifetime usage tracking.
alter table public.profiles
  add column if not exists free_boq_used boolean not null default false,
  add column if not exists free_boq_used_at timestamptz,
  add column if not exists paid_boq_count integer not null default 0,
  add column if not exists total_pages_processed integer not null default 0,
  add column if not exists lifetime_spend numeric not null default 0;

-- One row per uploaded BOQ document (metadata + pricing decision only).
create table if not exists public.boqs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  filename text not null,
  page_count integer not null check (page_count > 0),
  pricing_tier text not null,
  price numeric not null default 0,
  currency text not null default 'ZAR',
  is_free boolean not null default false,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'processing', 'complete', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boqs_user_id_idx on public.boqs (user_id);

alter table public.boqs enable row level security;

create policy "Users can manage their own BOQs"
  on public.boqs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Payments: rename to the provider-independent field names and link to boqs.
-- Column renames automatically carry over dependent indexes, RLS policies,
-- and check constraints — no need to redefine them.
alter table public.payments rename column provider to payment_provider;
alter table public.payments rename column provider_payment_id to provider_transaction_id;
alter table public.payments rename column status to payment_status;

alter table public.payments
  add column if not exists boq_id uuid references public.boqs (id) on delete set null,
  add column if not exists pricing_tier text,
  add column if not exists payment_date timestamptz;

-- payments.id is now the single reference we hand to the provider (PayFast's
-- m_payment_id) — a separate generated reference was redundant.
alter table public.payments drop column if exists m_payment_id;

create index if not exists payments_boq_id_idx on public.payments (boq_id);
