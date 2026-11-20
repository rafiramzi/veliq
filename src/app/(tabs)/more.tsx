import { router } from 'expo-router';
import React from 'react';
import { Card, ListItem, Muted, Screen, SectionHeader } from '../../components/ui';
import { useSyncStatus } from '../../services/sync';
import { useOutbox } from '../../store/outbox';
import { useDocStore } from '../../store/records';
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

export default function MoreScreen() {
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const docCount = useDocStore((s) => s.docs.length);
  const pending = useOutbox((s) => Object.keys(s.items).length);
  const status = useSyncStatus((s) => s.status);

  return (
    <Screen>
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
      <Muted style={{ textAlign: 'center', marginTop: 16 }}>VELIQ v1.0 · data tersimpan offline di perangkat</Muted>
    </Screen>
  );
}
