import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OAuthProvider, signInWithProvider } from '../services/auth';
import { useAuth } from '../store/auth';
import { colors, radius } from '../theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/veliq-logo.png');

function GoogleG() {
  return <MaterialCommunityIcons name="google" size={22} color="#EA4335" />;
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const continueAsGuest = useAuth((s) => s.continueAsGuest);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const verb = mode === 'signup' ? 'Daftar' : 'Masuk';

  const start = async (provider: OAuthProvider) => {
    setBusy(provider);
    const res = await signInWithProvider(provider).catch((e) => ({ ok: false, message: String(e?.message ?? e) }));
    setBusy(null);
    if (!res.ok) Alert.alert('Tidak bisa masuk', res.message);
  };

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={s.hero}>
        <Image source={LOGO} style={s.logo} resizeMode="contain" accessibilityLabel="Logo VELIQ" />
        <Text style={s.title}>Selamat datang di{'\n'}VELIQ</Text>
        <Text style={s.subtitle}>
          {mode === 'signup'
            ? 'Buat akun untuk menyimpan kendaraan dan data Anda dengan aman.'
            : 'Masuk untuk memulihkan kendaraan dan data Anda.'}
        </Text>
      </View>

      <View style={s.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => start('google')}
          disabled={!!busy}
          style={({ pressed }) => [s.btn, s.btnGoogle, pressed && { opacity: 0.8 }, !!busy && { opacity: 0.6 }]}
        >
          {busy === 'google' ? <ActivityIndicator color="#fff" /> : <GoogleG />}
          <Text style={[s.btnText, { color: '#fff' }]}>{verb} dengan Google</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => start('apple')}
          disabled={!!busy}
          style={({ pressed }) => [s.btn, s.btnApple, pressed && { opacity: 0.8 }, !!busy && { opacity: 0.6 }]}
        >
          {busy === 'apple' ? <ActivityIndicator color="#000" /> : <MaterialCommunityIcons name="apple" size={24} color="#000" />}
          <Text style={[s.btnText, { color: '#000' }]}>{verb} dengan Apple</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={continueAsGuest} hitSlop={8} style={s.guest}>
          <Text style={s.guestText}>Lanjutkan sebagai Tamu</Text>
        </Pressable>

        <Text style={s.switchRow}>
          {mode === 'signup' ? 'Sudah punya akun? ' : 'Belum punya akun? '}
          <Text style={s.link} onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')} accessibilityRole="link">
            {mode === 'signup' ? 'Masuk' : 'Daftar'}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 24 },
  logo: { width: 150, height: 118, marginBottom: 48 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', textAlign: 'center', lineHeight: 38 },
  subtitle: { color: colors.muted, fontSize: 16, textAlign: 'center', marginTop: 12, lineHeight: 24, paddingHorizontal: 8 },
  actions: { gap: 14 },
  btn: {
    minHeight: 56,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  btnGoogle: { backgroundColor: colors.card },
  btnApple: { backgroundColor: '#FFFFFF' },
  btnText: { fontSize: 17, fontWeight: '700' },
  guest: { alignItems: 'center', paddingVertical: 14 },
  guestText: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  switchRow: { color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: 6 },
  link: { color: colors.accent, fontWeight: '700' },
});
