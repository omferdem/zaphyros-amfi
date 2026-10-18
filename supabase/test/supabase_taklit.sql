-- YALNIZCA YEREL TEST İÇİN. Supabase'de çalıştırma.
-- Boş bir Postgres 16 veritabanında Supabase'in rollerini ve auth şemasını asgari düzeyde taklit eder.
-- Kullanım:
--   createdb amfi_test
--   psql -d amfi_test -f supabase/test/supabase_taklit.sql -f supabase/migrations/0001_saglik.sql -f supabase/migrations/0002_yoklama.sql
--   psql -d amfi_test -X -A -t -f supabase/test/0002_yoklama_test.sql
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
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
