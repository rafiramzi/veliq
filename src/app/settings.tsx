import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Body, Button, Card, Field, Icon, Label, Muted, NumberField, Row, Screen, Segmented, SectionHeader } from '../components/ui';
import { dateTimeID, distance } from '../lib/format';
import { COMPONENTS } from '../lib/lifespan';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { signOut } from '../services/auth';
import { ensureNotificationPermission } from '../services/notifications';
import { flushOutbox, useSyncStatus } from '../services/sync';
import { stopTrip } from '../services/recorder';
import { useAuth } from '../store/auth';
import { useOutbox } from '../store/outbox';
import { useDocStore, useServiceStore, useTripStore } from '../store/records';
import { useVehicleStore } from '../store/vehicles';
import { useSettings } from '../store/settings';
import { colors } from '../theme';
import type { VehicleType } from '../types';

export default function SettingsScreen() {
  const s = useSettings();
  const [type, setType] = useState<VehicleType>('motor');
  const [matrixKey, setMatrixKey] = useState(0);

  const auth = useAuth();

  return (
    <Screen>
      <SectionHeader title="Akun" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '600' }}>{auth.status === 'user' ? auth.email ?? 'Akun VELIQ' : 'Mode Tamu'}</Body>
            <Muted>{auth.status === 'user' ? 'Masuk dengan akun' : 'Data hanya tersimpan di perangkat ini.'}</Muted>
          </View>
          <Button
            title={auth.status === 'user' ? 'Keluar' : 'Masuk / Daftar'}
            variant="outline"
            small
            onPress={() => (auth.status === 'user' ? signOut() : auth.reset())}
          />
        </Row>
      </Card>

      <SectionHeader title="Component Lifespan Matrix" action="Reset" onAction={() =>
        Alert.alert('Kembalikan ke default?', '', [
          { text: 'Batal', style: 'cancel' },
          { text: 'Reset', onPress: () => { s.resetMatrix(); setMatrixKey((k) => k + 1); } },
        ])
      } />
      <Muted style={{ marginBottom: 8 }}>
        Komponen dianggap habis saat salah satu batas (km atau bulan) tercapai lebih dulu. Kosongkan km untuk komponen berbasis waktu
        saja.
      </Muted>
      <Segmented
        options={[
          { label: 'Motor', value: 'motor' },
          { label: 'Mobil', value: 'mobil' },
        ]}
        value={type}
        onChange={setType}
      />
      <View style={{ height: 12 }} />
      {COMPONENTS.map((c) => {
        const spec = s.matrix[type][c.key];
        return (
          <Card key={`${type}-${c.key}-${matrixKey}`} style={{ paddingBottom: 4 }}>
            <Row style={{ marginBottom: 8 }}>
              <Icon name={c.icon} color={colors.accent} />
              <Body style={{ fontWeight: '700' }}>{c.label}</Body>
            </Row>
            <Row gap={8} style={{ alignItems: 'flex-start' }}>
              <NumberField label="Km" value={spec.km} style={{ flex: 1 }} onCommit={(n) => s.setSpec(type, c.key, { ...useSettings.getState().matrix[type][c.key], km: n && n > 0 ? n : null })} />
              <NumberField label="Bulan" value={spec.months} style={{ flex: 1 }} onCommit={(n) => s.setSpec(type, c.key, { ...useSettings.getState().matrix[type][c.key], months: n && n > 0 ? n : null })} />
              <NumberField label="Harga (Rp)" value={spec.price} style={{ flex: 1.4 }} onCommit={(n) => s.setSpec(type, c.key, { ...useSettings.getState().matrix[type][c.key], price: n ?? 0 })} />
            </Row>
          </Card>
        );
      })}

      <SectionHeader title="Notifikasi" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '600' }}>Pengingat & alarm</Body>
            <Muted>Pajak, komponen jatuh tempo, anggota touring tertinggal, SOS.</Muted>
          </View>
          <Switch
            value={s.notificationsEnabled}
            onValueChange={async (v) => {
              if (v && !(await ensureNotificationPermission())) {
                Alert.alert('Izin notifikasi ditolak', 'Aktifkan dari pengaturan sistem Android.');
                return;
              }
              s.setNotifications(v);
            }}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#fff"
          />
        </Row>
      </Card>

      <SectionHeader title="Group touring" />
      <Card>
        <Label>Anggota dianggap tertinggal bila lebih dari</Label>
        <Segmented
          options={[300, 500, 1000, 2000].map((m) => ({ label: distance(m), value: m }))}
          value={s.separationM}
          onChange={s.setSeparation}
        />
        <Field label="Nama di radar" value={s.riderName} onChangeText={s.setRiderName} style={{ marginTop: 12 }} />
      </Card>

      <SectionHeader title="Sinkronisasi cloud" />
      <SyncCard />

      <SectionHeader title="Data" />
      <Button
        title="Hapus semua data di perangkat"
        variant="outline"
        icon="delete-forever"
        onPress={() =>
          Alert.alert('Hapus semua data?', 'Kendaraan, servis, rute, dan pengaturan di perangkat ini akan dihapus permanen.', [
            { text: 'Batal', style: 'cancel' },
            {
              text: 'Hapus semua',
              style: 'destructive',
              onPress: async () => {
                await stopTrip().catch(() => undefined);
                useDocStore.getState().docs.forEach((d) => useDocStore.getState().removeDoc(d.id));
                useVehicleStore.setState({ vehicles: [], activeId: null });
                useServiceStore.setState({ records: [] });
                useTripStore.setState({ trips: [] });
                useDocStore.setState({ docs: [] });
                useOutbox.getState().clear();
                useSettings.getState().resetMatrix();
                await AsyncStorage.removeItem('VELIQ.activeTrip.v1');
                router.back();
              },
            },
          ])
        }
      />
    </Screen>
  );
}

function SyncCard() {
  const status = useSyncStatus();
  const pendingCount = useOutbox((s) => Object.keys(s.items).length);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUserEmail(data.session?.user.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setUserEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured || !supabase) {
    return (
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Icon name="cloud-off-outline" color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '600' }}>Mode lokal (offline-first)</Body>
            <Muted>
              Semua data aman di perangkat. {pendingCount} perubahan sudah dicatat di antrean dan akan otomatis terkirim begitu
              Supabase disambungkan (isi .env lalu build ulang).
            </Muted>
          </View>
        </Row>
      </Card>
    );
  }

  const auth = async (mode: 'in' | 'up') => {
    setBusy(true);
    const fn = mode === 'in' ? supabase!.auth.signInWithPassword({ email, password }) : supabase!.auth.signUp({ email, password });
    const { error } = await fn;
    setBusy(false);
    if (error) Alert.alert('Gagal', error.message);
    else if (mode === 'up') Alert.alert('Cek email', 'Konfirmasi email Anda lalu masuk.');
  };

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={st.status}>
          {status.status === 'syncing' ? 'Menyinkronkan…' : status.status === 'error' ? 'Gagal sinkron' : status.online ? 'Online' : 'Offline'}
        </Text>
        <Muted>{pendingCount} antre</Muted>
      </Row>
      {status.lastSyncAt ? <Muted>Terakhir: {dateTimeID(status.lastSyncAt)}</Muted> : null}
      {status.lastError ? <Muted style={{ color: colors.bad }}>{status.lastError}</Muted> : null}
      <View style={{ height: 12 }} />
      {userEmail ? (
        <>
          <Muted>Masuk sebagai {userEmail}</Muted>
          <Row style={{ marginTop: 8 }}>
            <Button title="Sinkron sekarang" icon="cloud-sync" small onPress={() => flushOutbox()} style={{ flex: 1 }} />
            <Button title="Keluar" variant="outline" small onPress={() => supabase!.auth.signOut()} style={{ flex: 1 }} />
          </Row>
        </>
      ) : (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label="Kata sandi" value={password} onChangeText={setPassword} secureTextEntry />
          <Row>
            <Button title="Masuk" small onPress={() => auth('in')} loading={busy} style={{ flex: 1 }} />
            <Button title="Daftar" small variant="outline" onPress={() => auth('up')} style={{ flex: 1 }} />
          </Row>
        </>
      )}
    </Card>
  );
}

const st = StyleSheet.create({
  status: { fontWeight: '700', color: colors.ink },
});
