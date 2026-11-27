// Client Supabase OPSIONAL. Selama URL / key kosong, `supabase` bernilai null
// dan aplikasi berjalan sepenuhnya lokal.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Catatan: Expo hanya menyisipkan variabel `process.env.EXPO_PUBLIC_*` yang ditulis langsung
// (bukan lewat variabel/loop), jadi tiap nama ditulis eksplisit di sini.
// Key boleh anon key lama (`eyJ...`) maupun publishable key baru (`sb_publishable_...`).
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const anonKey = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  ''
).trim();

export const isSupabaseConfigured = url.startsWith('https://') && anonKey.length > 20;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** Nama bucket Storage privat untuk foto dokumen. */
export const DOCUMENT_BUCKET = 'documents';
