import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { localStorage } from './storage';

/** none = belum memilih (tampilkan login), guest = pakai lokal tanpa akun, user = login via Supabase. */
export type AuthStatus = 'none' | 'guest' | 'user';

interface AuthState {
  status: AuthStatus;
  email?: string;
  continueAsGuest: () => void;
  setUser: (email?: string) => void;
  /** Kembali ke layar login (data lokal tidak dihapus). */
  reset: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      status: 'none',
      email: undefined,
      continueAsGuest: () => set({ status: 'guest', email: undefined }),
      setUser: (email) => set({ status: 'user', email }),
      reset: () => set({ status: 'none', email: undefined }),
    }),
    {
      name: 'VELIQ.auth',
      storage: localStorage,
      version: 1,
      // Mode Tamu sengaja tidak disimpan: tiap aplikasi dibuka ulang, layar login tampil lagi.
      // Abaikan status Tamu lama yang mungkin masih tersimpan dari versi sebelumnya.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AuthState>;
        return p.status === 'user' ? { ...current, status: 'user', email: p.email } : current;
      },
      partialize: (s) => (s.status === 'user' ? { status: s.status, email: s.email } : { status: 'none' as AuthStatus }),
    },
  ),
);