// Sinkronisasi offline-first: kirim isi outbox ke Supabase (REST via supabase-js, HTTPS/TLS)
// setiap kali perangkat online. Tanpa konfigurasi Supabase, status = 'disabled'.
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { File } from 'expo-file-system';
import { create } from 'zustand';
import { DOCUMENT_BUCKET, isSupabaseConfigured, supabase } from '../lib/supabase';
import { OutboxItem, useOutbox } from '../store/outbox';

export type SyncStatus = 'disabled' | 'offline' | 'signed_out' | 'idle' | 'syncing' | 'error';

interface SyncState {
  status: SyncStatus;
  online: boolean;
  lastSyncAt?: string;
  lastError?: string;
}

export const useSyncStatus = create<SyncState>(() => ({
  status: isSupabaseConfigured ? 'idle' : 'disabled',
  online: true,
}));

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

/** camelCase -> snake_case (level atas saja; objek bersarang disimpan sebagai jsonb). */
export function toRow(item: OutboxItem, userId: string): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId };
  for (const [k, v] of Object.entries(item.payload ?? {})) {
    if (item.table === 'documents' && k === 'uri') continue; // path lokal tidak dikirim
    row[snake(k)] = v ?? null;
  }
  return row;
}

async function pushItem(item: OutboxItem, userId: string) {
  if (!supabase) return;
  if (item.op === 'delete') {
    if (item.table === 'documents') {
      await supabase.storage.from(DOCUMENT_BUCKET).remove([`${userId}/${item.recordId}.jpg`, `${userId}/${item.recordId}.webp`]);
    }
    const { error } = await supabase.from(item.table).delete().eq('id', item.recordId);
    if (error) throw error;
    return;
  }
  const row = toRow(item, userId);
  if (item.table === 'documents' && item.payload) {
    const uri = String(item.payload.uri);
    const format = String(item.payload.format ?? 'jpeg');
    const path = `${userId}/${item.recordId}.${format === 'webp' ? 'webp' : 'jpg'}`;
    const bytes = await new File(uri).bytes();
    // Supabase Storage mengenkripsi data at-rest dengan AES-256.
    const { error: upErr } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, bytes, { contentType: format === 'webp' ? 'image/webp' : 'image/jpeg', upsert: true });
    if (upErr) throw upErr;
    row.storage_path = path;
  }
  const { error } = await supabase.from(item.table).upsert(row);
  if (error) throw error;
}

let flushing = false;

export async function flushOutbox(): Promise<void> {
  if (!supabase || flushing) return;
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    useSyncStatus.setState({ status: 'offline', online: false });
    return;
  }
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) {
    useSyncStatus.setState({ status: 'signed_out', online: true });
    return;
  }
  flushing = true;
  useSyncStatus.setState({ status: 'syncing', online: true });
  try {
    // Urutkan supaya kendaraan dibuat sebelum data turunannya.
    const order = ['vehicles', 'service_records', 'trips', 'documents'];
    const items = Object.values(useOutbox.getState().items).sort(
      (a, b) => order.indexOf(a.table) - order.indexOf(b.table) || a.queuedAt.localeCompare(b.queuedAt),
    );
    let lastError: string | undefined;
    for (const item of items) {
      try {
        await pushItem(item, userId);
        // Hanya hapus kalau belum diganti versi lebih baru selama upload.
        if (useOutbox.getState().items[item.key]?.queuedAt === item.queuedAt) useOutbox.getState().remove(item.key);
      } catch (e: any) {
        lastError = e?.message ?? String(e);
        useOutbox.getState().fail(item.key, lastError!);
      }
    }
    useSyncStatus.setState({
      status: lastError ? 'error' : 'idle',
      lastError,
      lastSyncAt: new Date().toISOString(),
    });
  } finally {
    flushing = false;
  }
}

/** Mulai loop sinkronisasi: saat online kembali, saat app aktif, dan tiap 60 detik. */
export function startSync(): () => void {
  if (!supabase) return () => {};
  const unsubNet = NetInfo.addEventListener((s) => {
    useSyncStatus.setState({ online: !!s.isConnected });
    if (s.isConnected) flushOutbox();
  });
  const appSub = AppState.addEventListener('change', (st) => st === 'active' && flushOutbox());
  const authSub = supabase.auth.onAuthStateChange((_e, session) => session && flushOutbox());
  const timer = setInterval(flushOutbox, 60_000);
  flushOutbox();
  return () => {
    unsubNet();
    appSub.remove();
    authSub.data.subscription.unsubscribe();
    clearInterval(timer);
  };
}
