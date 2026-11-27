import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Chip, Field, ListItem, Muted, Row, Screen, SectionHeader } from '../../components/ui';
import { signOut } from '../../services/auth';
import { useSyncStatus } from '../../services/sync';
import { useAuth } from '../../store/auth';
import { useOutbox } from '../../store/outbox';
import { useDocStore, useTripStore } from '../../store/records';
import { useSettings } from '../../store/settings';
import { useVehicleStore } from '../../store/vehicles';
import { colors } from '../../theme';

const SYNC_TEXT: Record<string, string> = {
  disabled: 'Lokal saja · Supabase belum dikonfigurasi',
  offline: 'Offline · menunggu koneksi',
  signed_out: 'Belum login ke akun cloud',
  idle: 'Tersinkron',
  syncing: 'Menyinkronkan…',
  error: 'Gagal sinkron — akan dicoba lagi',
};

export default function ProfileScreen() {
  const auth = useAuth();
  const riderName = useSettings((s) => s.riderName);
  const setRiderName = useSettings((s) => s.setRiderName);
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const docCount = useDocStore((s) => s.docs.length);
  const tripCount = useTripStore((s) => s.trips.length);
  const pending = useOutbox((s) => Object.keys(s.items).length);
  const status = useSyncStatus((s) => s.status);

  const isUser = auth.status === 'user';
  const displayName = riderName.trim() || (isUser && auth.email ? auth.email.split('@')[0] : 'Pengguna VELIQ');
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Screen>
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>
        <Text style={s.name} numberOfLines={1}>{displayName}</Text>
        <Muted style={{ marginTop: 2 }}>{isUser ? auth.email ?? 'Akun VELIQ' : 'Mode Tamu · data hanya di perangkat ini'}</Muted>
        <View style={{ marginTop: 10 }}>
          <Chip
            text={isUser ? 'Akun terhubung' : 'Tamu'}
            color={isUser ? colors.good : colors.muted}
            bg={isUser ? colors.goodSoft : colors.border}
          />
        </View>
        <Row gap={8} style={{ marginTop: 18, width: '100%' }}>
          <Stat value={vehicleCount} label="Kendaraan" />
          <Stat value={tripCount} label="Perjalanan" />
          <Stat value={docCount} label="Dokumen" />
        </Row>
      </Card>

      <Field label="Nama tampilan" value={riderName} onChangeText={setRiderName} placeholder="Nama Anda (juga dipakai di radar touring)" />

      <SectionHeader title="Kendaraan & legalitas" />
      <Card style={{ paddingVertical: 4 }}>
        <ListItem icon="garage-variant" iconColor={colors.accent} iconBg={colors.accentSoft} title="Kendaraan Saya" subtitle={`${vehicleCount} kendaraan`} onPress={() => router.push('/vehicles')} chevron />
        <ListItem icon="file-certificate-outline" iconColor={colors.info} iconBg={colors.infoSoft} title="Pajak & Legalitas" subtitle="Pengingat STNK & kalkulator pajak" onPress={() => router.push('/tax')} chevron />
        <ListItem icon="file-image-outline" iconColor={colors.good} iconBg={colors.goodSoft} title="Dokumen Digital" subtitle={`${docCount} dokumen · STNK, nota, dll.`} onPress={() => router.push('/documents')} chevron />
        <ListItem icon="passport" iconColor={colors.warn} iconBg={colors.warnSoft} title="Vehicle Passport (PDF)" subtitle="Ringkasan riwayat untuk jual-beli" onPress={() => router.push('/passport')} chevron />
      </Card>

      <SectionHeader title="Aplikasi" />
      <Card style={{ paddingVertical: 4 }}>
        <ListItem icon="tune-variant" title="Pengaturan" subtitle="Lifespan matrix, notifikasi, touring" onPress={() => router.push('/settings')} chevron />
        <ListItem
          icon={status === 'disabled' ? 'cloud-off-outline' : status === 'error' ? 'cloud-alert' : 'cloud-check-outline'}
          title="Sinkronisasi"
          subtitle={`${SYNC_TEXT[status]} · ${pending} perubahan antre`}
          onPress={() => router.push('/settings')}
          chevron
        />
      </Card>

      <View style={{ marginTop: 8 }}>
        {isUser ? (
          <Button title="Keluar" variant="outline" icon="logout" onPress={() => signOut()} />
        ) : (
          <Button title="Masuk / Daftar" icon="account-plus-outline" onPress={() => auth.reset()} />
        )}
      </View>
      <Muted style={{ textAlign: 'center', marginTop: 16 }}>VELIQ v1.0 · data tersimpan offline di perangkat</Muted>
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accentSoft, borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accent, fontSize: 36, fontWeight: '800' },
  name: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 12, maxWidth: '90%' },
  stat: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  statValue: { color: colors.ink, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
