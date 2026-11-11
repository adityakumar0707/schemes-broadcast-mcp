-- Scheme Broadcast schema. Run in Supabase SQL editor.
create extension if not exists pgcrypto;

-- Choice: link to Supabase Auth via user_id column (faster + safer than matching on email).
create table distributors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text unique not null,
  mcp_token text unique not null default encode(gen_random_bytes(24), 'hex'),
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributors(id) on delete cascade,
  name text not null,
  price numeric,
  unit text,
  image_url text,
  created_at timestamptz not null default now()
);
create unique index products_dist_name_uq on products (distributor_id, lower(name));

create table groups (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributors(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index groups_dist_name_uq on groups (distributor_id, lower(name));

create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  contact_name text not null,
  phone text not null
);
create unique index group_members_uq on group_members (group_id, phone);

create table offers (
  id uuid primary key default gen_random_uuid(),
  distributor_id uuid not null references distributors(id) on delete cascade,
  product_ids uuid[] not null,
  offer_text text not null,
  discount_detail text,
  share_message text,
  valid_from date,
  valid_to date,
  group_id uuid references groups(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  share_link_slug text unique,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table offer_clicks (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  interested boolean default false,
  contact_name text,
  phone text
);

-- RLS. Dashboard uses the logged-in user's session (policies below).
-- MCP routes and the public offer page use the service role server-side (bypasses RLS)
-- and scope every query manually. offer_clicks has no anon policies: public inserts go
-- through an API route.
create or replace function my_distributor_id() returns uuid
language sql stable security definer set search_path = public as
$$ select id from distributors where user_id = auth.uid() $$;

alter table distributors  enable row level security;
alter table products      enable row level security;
alter table groups        enable row level security;
alter table group_members enable row level security;
alter table offers        enable row level security;
alter table offer_clicks  enable row level security;

create policy own_row on distributors for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_products on products for all using (distributor_id = my_distributor_id()) with check (distributor_id = my_distributor_id());
create policy own_groups on groups for all using (distributor_id = my_distributor_id()) with check (distributor_id = my_distributor_id());
create policy own_members on group_members for all
  using (group_id in (select id from groups where distributor_id = my_distributor_id()))
  with check (group_id in (select id from groups where distributor_id = my_distributor_id()));
create policy own_offers on offers for all using (distributor_id = my_distributor_id()) with check (distributor_id = my_distributor_id());
create policy own_clicks_read on offer_clicks for select
  using (offer_id in (select id from offers where distributor_id = my_distributor_id()));
