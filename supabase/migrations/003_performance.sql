-- Performance: indexes on the columns every dashboard query filters by, and RLS policies rewritten so
-- Postgres evaluates auth.uid() / my_distributor_id() ONCE per query instead of once per row.
-- Safe to run more than once.

create index if not exists products_distributor_idx     on products (distributor_id);
create index if not exists groups_distributor_idx       on groups (distributor_id);
create index if not exists group_members_group_idx      on group_members (group_id);
create index if not exists offers_distributor_idx       on offers (distributor_id, status, created_at desc);
create index if not exists offer_clicks_offer_idx       on offer_clicks (offer_id);

drop policy if exists own_row on distributors;
create policy own_row on distributors for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists own_products on products;
create policy own_products on products for all
  using (distributor_id = (select my_distributor_id())) with check (distributor_id = (select my_distributor_id()));

drop policy if exists own_groups on groups;
create policy own_groups on groups for all
  using (distributor_id = (select my_distributor_id())) with check (distributor_id = (select my_distributor_id()));

drop policy if exists own_members on group_members;
create policy own_members on group_members for all
  using (group_id in (select id from groups where distributor_id = (select my_distributor_id())))
  with check (group_id in (select id from groups where distributor_id = (select my_distributor_id())));

drop policy if exists own_offers on offers;
create policy own_offers on offers for all
  using (distributor_id = (select my_distributor_id())) with check (distributor_id = (select my_distributor_id()));

drop policy if exists own_clicks_read on offer_clicks;
create policy own_clicks_read on offer_clicks for select
  using (offer_id in (select id from offers where distributor_id = (select my_distributor_id())));
