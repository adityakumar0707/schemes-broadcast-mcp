-- Run this in the Supabase SQL editor (safe to run more than once).
alter table products add column if not exists image_url text;
alter table offers   add column if not exists share_message text;
