import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

// Semua store persisten memakai AsyncStorage (lokal di perangkat, offline-first).
// Saat pindah ke Supabase, store tetap menjadi cache lokal; perubahan dikirim lewat outbox.
export const localStorage = createJSONStorage(() => AsyncStorage);

type Persisted = {
  persist: { hasHydrated: () => boolean; rehydrate: () => Promise<void> | void };
};

/** Pastikan store sudah dibaca dari disk (penting di konteks background task). */
export async function ensureHydrated(...stores: Persisted[]) {
  await Promise.all(stores.map((s) => (s.persist.hasHydrated() ? undefined : s.persist.rehydrate())));
}
