import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Body, Button, Card, EmptyState, Icon, LevelBadge, Muted, Row, Screen, SectionHeader } from '../components/ui';
import { useVehicleData } from '../hooks/useVehicleData';
import { dateID, km, rupiah } from '../lib/format';
import { dueInfo } from '../lib/tax';
import { exportPassportPdf } from '../services/exporter';
import { useDocStore, useTripStore } from '../store/records';
import { useActiveVehicle } from '../store/vehicles';
import { colors } from '../theme';

export default function PassportScreen() {
  const vehicle = useActiveVehicle();
  const data = useVehicleData(vehicle);
  const trips = useTripStore((s) => s.trips);
  const docs = useDocStore((s) => s.docs);
  const [busy, setBusy] = useState(false);

  if (!vehicle || !data) return <EmptyState icon="car-off" title="Belum ada kendaraan" />;

  const vTrips = trips.filter((t) => t.vehicleId === vehicle.id);
  const vDocs = docs.filter((d) => d.vehicleId === vehicle.id);
  const tripKm = vTrips.reduce((s, t) => s + t.stats.distanceM, 0) / 1000;
  const totalCost = data.records.reduce((s, r) => s + r.totalCost, 0);
  const tax = dueInfo(vehicle.taxDueDate);
  const stnk = dueInfo(vehicle.stnkExpiryDate);

  const generate = async () => {
    setBusy(true);
    try {
      await exportPassportPdf({
        vehicle,
        odometerKm: data.odometer,
        health: data.health,
        healthScore: data.score,
        records: data.records,
        docs: vDocs,
        tripCount: vTrips.length,
        tripKm,
        generatedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      Alert.alert('Gagal membuat PDF', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card dark style={{ padding: 20 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={s.kicker}>VEHICLE PASSPORT</Text>
          <Icon name="passport" color={colors.accent} size={26} />
        </Row>
        <Text style={s.name}>{vehicle.name}</Text>
        <Text style={s.plate}>{vehicle.plate}{vehicle.year ? ` · ${vehicle.year}` : ''}</Text>
        <View style={s.stats}>
          <Stat label="Odometer" value={km(data.odometer)} />
          <Stat label="Kesehatan" value={`${data.score}/100`} />
          <Stat label="Servis" value={`${data.records.length}×`} />
        </View>
      </Card>

      <SectionHeader title="Isi dokumen" />
      <Card>
        <Item icon="file-certificate-outline" text="Status pajak tahunan" right={tax ? <LevelBadge level={tax.level === 'overdue' ? 'overdue' : 'good'} text={dateID(tax.date)} /> : <Muted>-</Muted>} />
        <Item icon="card-account-details-outline" text="STNK 5 tahunan" right={stnk ? <LevelBadge level={stnk.level === 'overdue' ? 'overdue' : 'good'} text={dateID(stnk.date)} /> : <Muted>-</Muted>} />
        <Item icon="heart-pulse" text={`Kondisi ${data.health.length} komponen`} right={<Muted>{data.alarms.length} perlu perhatian</Muted>} />
        <Item icon="wrench" text="Riwayat servis lengkap" right={<Muted>{rupiah(totalCost)}</Muted>} />
        <Item icon="map-marker-path" text="Ringkasan pemakaian GPS" right={<Muted>{vTrips.length} trip</Muted>} />
        <Item icon="file-image-outline" text="Daftar dokumen digital" right={<Muted>{vDocs.length}</Muted>} />
      </Card>
      <Muted style={{ marginBottom: 12 }}>
        Foto STNK/BPKB tidak disertakan di PDF demi privasi. Setiap PDF diberi ID Paspor (sidik SHA-256 isi ringkasan) agar calon
        pembeli bisa memastikan dokumen tidak diubah.
      </Muted>
      <Button title="Buat & Bagikan PDF" icon="file-pdf-box" onPress={generate} loading={busy} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>{label.toUpperCase()}</Text>
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function Item({ icon, text, right }: { icon: string; text: string; right: React.ReactNode }) {
  return (
    <Row style={{ paddingVertical: 8, justifyContent: 'space-between' }}>
      <Row style={{ flex: 1 }}>
        <Icon name={icon} color={colors.ink2} size={18} />
        <Body style={{ flexShrink: 1 }}>{text}</Body>
      </Row>
      {right}
    </Row>
  );
}

const s = StyleSheet.create({
  kicker: { color: colors.accent, fontWeight: '800', letterSpacing: 2, fontSize: 12 },
  name: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 12 },
  plate: { color: colors.faint, fontWeight: '600', letterSpacing: 1, marginTop: 2 },
  stats: { flexDirection: 'row', marginTop: 20, gap: 8 },
});
