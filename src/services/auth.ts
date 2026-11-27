// Login Google / Apple lewat Supabase OAuth (browser sistem + deep link `veliq://auth-callback`).
// Tanpa konfigurasi Supabase, hanya mode Tamu yang tersedia.
import * as Linking from 'expo-linking';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from '../store/auth';

export type OAuthProvider = 'google' | 'apple';

export const AUTH_CALLBACK_PATH = 'auth-callback';

/** Mulai login OAuth. Sesi diselesaikan di `handleAuthUrl` saat app dibuka lewat deep link. */
export async function signInWithProvider(provider: OAuthProvider): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      message: 'Login akun belum dikonfigurasi (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY kosong). Gunakan "Lanjutkan sebagai Tamu".',
    };
  }
  const redirectTo = Linking.createURL(AUTH_CALLBACK_PATH);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { ok: false, message: error?.message ?? 'Gagal memulai login.' };
  await Linking.openURL(data.url);
  return { ok: true };
}

/** Baca token dari URL callback (`#access_token=...&refresh_token=...`) lalu simpan sesi. */
export async function handleAuthUrl(url: string | null): Promise<boolean> {
  if (!url || !supabase || !url.includes(AUTH_CALLBACK_PATH)) return false;
  const frag = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
  const params = new URLSearchParams(frag);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) return false;
  useAuth.getState().setUser(data.session?.user.email ?? undefined);
  return true;
}

/** Pasang listener deep link + sinkronkan status auth dengan sesi Supabase. */
export function startAuth(): () => void {
  const linkSub = Linking.addEventListener('url', ({ url }) => {
    handleAuthUrl(url).catch(() => undefined);
  });
  Linking.getInitialURL().then(handleAuthUrl).catch(() => undefined);

  let unsub = () => {};
  if (supabase) {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) useAuth.getState().setUser(data.session.user.email ?? undefined);
      else if (useAuth.getState().status === 'user') useAuth.getState().reset();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) useAuth.getState().setUser(session.user.email ?? undefined);
      else if (event === 'SIGNED_OUT' && useAuth.getState().status === 'user') useAuth.getState().reset();
    });
    unsub = () => data.subscription.unsubscribe();
  }
  return () => {
    linkSub.remove();
    unsub();
  };
}

export async function signOut() {
  await supabase?.auth.signOut().catch(() => undefined);
  useAuth.getState().reset();
}
