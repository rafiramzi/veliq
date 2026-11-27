// Login Google / Apple lewat Supabase OAuth.
// Native: sesi auth in-app (expo-web-browser) yang menangkap redirect `veliq://auth-callback`.
// Web: redirect halaman biasa, token dibaca saat halaman `/auth-callback` dimuat.
// Tanpa konfigurasi Supabase, hanya mode Tamu yang tersedia.
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from '../store/auth';

// Menutup jendela popup auth di web (no-op di native).
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';

export const AUTH_CALLBACK_PATH = 'auth-callback';

type AuthResult = { ok: boolean; message?: string };

/** URL redirect yang harus didaftarkan di Supabase → Authentication → URL Configuration → Redirect URLs. */
export function getRedirectUrl() {
  return Linking.createURL(AUTH_CALLBACK_PATH);
}

/** Mulai login OAuth. `ok: false` tanpa `message` berarti pengguna membatalkan. */
export async function signInWithProvider(provider: OAuthProvider): Promise<AuthResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ok: false,
      message:
        'Login akun belum dikonfigurasi (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY kosong). Gunakan "Lanjutkan sebagai Tamu".',
    };
  }
  const redirectTo = getRedirectUrl();
  // Salin URL ini ke daftar Redirect URLs di Supabase bila login kembali ke localhost/halaman error.
  if (__DEV__) console.log('[auth] redirectTo =', redirectTo);

  if (Platform.OS === 'web') {
    // supabase-js langsung mengarahkan halaman ke Google; sesi diproses saat kembali.
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    return error ? { ok: false, message: error.message } : { ok: true };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { ok: false, message: error?.message ?? 'Gagal memulai login.' };

  inFlight = null;
  signingIn = true;
  try {
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (__DEV__) console.log('[auth] hasil browser:', res.type);
    if (res.type === 'success') return await handleAuthUrl(res.url);

    // Android: browser "ditutup" (tombol X, atau aplikasi kembali ke depan lewat deep link).
    // Beri waktu sebentar agar listener deep link di startAuth sempat memproses token.
    await new Promise((r) => setTimeout(r, 600));
    if (inFlight) return await (inFlight as InFlight).promise;
    const { data: current } = await supabase.auth.getSession();
    if (current.session) {
      useAuth.getState().setUser(current.session.user.email ?? undefined);
      return { ok: true };
    }
    return { ok: false };
  } finally {
    signingIn = false;
  }
}

// Satu URL callback bisa datang dua kali (hasil openAuthSessionAsync + event deep link):
// keduanya menunggu proses yang sama.
type InFlight = { url: string; promise: Promise<AuthResult> };
let inFlight: InFlight | null = null;
let signingIn = false;

/**
 * Baca hasil callback lalu simpan sesi. Mendukung:
 * - implicit flow: `#access_token=...&refresh_token=...`
 * - PKCE flow: `?code=...`
 * - error dari Supabase/Google: `#error=...&error_description=...`
 */
export function handleAuthUrl(url: string | null): Promise<AuthResult> {
  if (!url || !supabase || !url.includes(AUTH_CALLBACK_PATH)) return Promise.resolve({ ok: false });
  if (inFlight?.url === url) return inFlight.promise;
  // Muncul di terminal Metro bila deep link berhasil masuk ke aplikasi.
  if (__DEV__) console.log('[auth] callback diterima:', url.split(/[?#]/)[0]);
  const promise = processAuthUrl(url).catch((e) => ({ ok: false, message: String(e?.message ?? e) }));
  inFlight = { url, promise };
  return promise;
}

async function processAuthUrl(url: string): Promise<AuthResult> {
  if (!supabase) return { ok: false };
  const params = new URLSearchParams();
  const [beforeHash, hash = ''] = url.split('#');
  const query = beforeHash.split('?')[1] ?? '';
  for (const part of [query, hash]) new URLSearchParams(part).forEach((v, k) => params.set(k, v));

  const errorDescription = params.get('error_description') ?? params.get('error');
  if (errorDescription) return { ok: false, message: errorDescription.replace(/\+/g, ' ') };

  const code = params.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, message: error.message };
    useAuth.getState().setUser(data.session?.user.email ?? undefined);
    return { ok: true };
  }

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) {
    return { ok: false, message: 'Login tidak mengembalikan token. Coba lagi.' };
  }
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) return { ok: false, message: error.message };
  useAuth.getState().setUser(data.session?.user.email ?? undefined);
  return { ok: true };
}

/** Pasang listener deep link + sinkronkan status auth dengan sesi Supabase. */
export function startAuth(): () => void {
  // Deep link yang masuk tanpa lewat tombol login (mis. app sempat ditutup sistem saat di browser).
  const onUrl = (url: string | null) =>
    handleAuthUrl(url)
      .then((res) => {
        if (!signingIn && res.message) Alert.alert('Tidak bisa masuk', res.message);
      })
      .catch(() => undefined);
  const linkSub = Linking.addEventListener('url', ({ url }) => onUrl(url));
  Linking.getInitialURL().then(onUrl).catch(() => undefined);

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