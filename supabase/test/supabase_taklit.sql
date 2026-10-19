-- YALNIZCA YEREL TEST İÇİN. Supabase'de çalıştırma.
-- Boş bir Postgres 16 veritabanında Supabase'in rollerini ve auth şemasını asgari düzeyde taklit eder.
-- Kullanım:
--   createdb amfi_test
--   psql -d amfi_test -f supabase/test/supabase_taklit.sql -f supabase/migrations/0001_saglik.sql -f supabase/migrations/0002_yoklama.sql
--   psql -d amfi_test -X -A -t -f supabase/test/0002_yoklama_test.sql
do $$ begin
  -- Roller küme genelindedir; aynı sunucuda ikinci test veritabanı açılırsa zaten vardır.
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt()->>'sub','')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
create publication supabase_realtime;
-- Depo (Storage): yalnızca kova ve nesne tablolarının iskeleti
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
