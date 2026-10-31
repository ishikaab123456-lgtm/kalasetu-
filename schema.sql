-- KalaSetu AI — Supabase database schema
-- Run this once in Supabase Dashboard → SQL Editor.

create table if not exists public.profiles (
  id text primary key,
  name text not null default '',
  role text not null check (role in ('artisan','consumer')),
  login_method text not null default 'email',
  identifier text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.artisan_profiles (
  user_id text primary key,
  name text not null default '',
  craft text not null default 'Handicrafts',
  location text not null default '',
  language text not null default 'Hindi',
  bio text not null default '',
  years integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  status text not null default 'Published',
  category text not null default 'Handicrafts',
  price numeric not null default 0,
  views integer not null default 0,
  enquiries integer not null default 0,
  sales integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consumer_preferences (
  user_id text primary key,
  categories text[] not null default '{}',
  materials text[] not null default '{}',
  occasions text[] not null default '{}',
  styles text[] not null default '{}',
  regions text[] not null default '{}',
  budget_min numeric not null default 0,
  budget_max numeric not null default 999999,
  updated_at timestamptz not null default now()
);


create table if not exists public.enquiries (
  id text primary key,
  product_id text not null,
  product_name text not null,
  buyer_name text not null,
  contact text not null default '',
  message text not null default '',
  intent text not null default 'Ask a question',
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists public.interactions (
  id bigint generated always as identity primary key,
  user_id text not null,
  product_id text not null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_status on public.products(status);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_enquiries_product on public.enquiries(product_id);
create index if not exists idx_interactions_user on public.interactions(user_id);
create index if not exists idx_interactions_product on public.interactions(product_id);
create index if not exists idx_interactions_type on public.interactions(event_type);

-- This prototype writes to Supabase only from the Node.js backend using the
-- service-role key. Never expose the service-role key in public/app.js.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.artisan_profiles enable row level security;
alter table public.consumer_preferences enable row level security;
alter table public.interactions enable row level security;
alter table public.enquiries enable row level security;

-- No anonymous browser policies are required because the browser calls
-- the Node.js backend, and the backend uses the service-role key.
