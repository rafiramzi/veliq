-- =====================================================================
-- Veliq — skema Supabase (jalankan di SQL Editor saat siap pindah ke cloud)
-- Kolom = versi snake_case dari model di src/types.ts (lihat src/services/sync.ts → toRow).
-- Semua tabel dilindungi Row Level Security: user hanya bisa membaca/menulis datanya sendiri.
-- Supabase mengenkripsi seluruh data at-rest (database & Storage) dengan AES-256,
-- dan semua koneksi dari aplikasi lewat HTTPS/TLS.
-- =====================================================================

create table if not exists public.vehicles (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  type text not null check (type in ('motor', 'mobil')),
  plate text not null,
  year int,
  odometer_base_km numeric not null default 0,
  odometer_base_at timestamptz not null default now(),
  gps_km numeric not null default 0,
  tax_due_date date,
  stnk_expiry_date date,
  pkb_amount numeric,
  baselines jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_records (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  date date not null,
  odometer_km numeric not null,
  items jsonb not null default '[]'::jsonb,
  total_cost numeric not null default 0,
  workshop text,
  notes text,
  receipt_doc_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  polyline text not null,      -- Google Encoded Polyline (lat,lng)
  telemetry text not null,     -- alt/waktu/kecepatan terkode (algoritma sama)
  stats jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  kind text not null,
  title text not null,
  format text not null,
  quality int,
  width int,
  height int,
  original_bytes bigint,
  compressed_bytes bigint,
  service_id uuid,
  storage_path text,           -- path di bucket privat "documents"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_records_vehicle_idx on public.service_records (vehicle_id, date desc);
create index if not exists trips_vehicle_idx on public.trips (vehicle_id, started_at desc);
create index if not exists documents_vehicle_idx on public.documents (vehicle_id);

-- ---------- Row Level Security ----------
do $$
declare t text;
begin
  foreach t in array array['vehicles', 'service_records', 'trips', 'documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner_all" on public.%I', t);
    execute format(
      'create policy "owner_all" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- ---------- Storage: bucket privat untuk foto STNK / nota ----------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "doc_owner_select" on storage.objects;
drop policy if exists "doc_owner_insert" on storage.objects;
drop policy if exists "doc_owner_update" on storage.objects;
drop policy if exists "doc_owner_delete" on storage.objects;

create policy "doc_owner_select" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "doc_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "doc_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "doc_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- (Opsional) Group Touring dengan private channel ----------
-- Saat ini radar touring memakai Realtime Broadcast pada channel "touring:<KODE>".
-- Kode 6 karakter acak sudah membatasi akses. Untuk pengamanan penuh, aktifkan
-- "Private channels" di Realtime Settings lalu daftarkan anggota room:
--
-- create table public.touring_members (
--   room_code text not null,
--   user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
--   joined_at timestamptz not null default now(),
--   primary key (room_code, user_id)
-- );
-- alter table public.touring_members enable row level security;
-- create policy "self_join" on public.touring_members for insert to authenticated
--   with check ((select auth.uid()) = user_id);
-- create policy "members_read" on public.touring_members for select to authenticated
--   using ((select auth.uid()) = user_id);
--
-- create policy "touring_members_rw" on realtime.messages for all to authenticated
--   using (exists (select 1 from public.touring_members m
--                  where m.user_id = (select auth.uid())
--                    and 'touring:' || m.room_code = (select realtime.topic())))
--   with check (exists (select 1 from public.touring_members m
--                  where m.user_id = (select auth.uid())
--                    and 'touring:' || m.room_code = (select realtime.topic())));
-- Lalu di src/services/touring/supabaseTransport.ts tambahkan `private: true` pada config channel.
