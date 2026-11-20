import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LeafletMap } from '../../components/LeafletMap';
import { Button, Card, EmptyState, Muted, Row, Screen, SectionHeader, StatTile } from '../../components/ui';
import { bytes, dateTimeID, distance, duration, speedKmh, thousands } from '../../lib/format';
import { decodeTrip } from '../../lib/gpx';
import { compressionRatio } from '../../lib/tripCore';
import { exportTripGpx } from '../../services/exporter';
import { useTripStore } from '../../store/records';
import { useVehicleStore } from '../../store/vehicles';
import { colors } from '../../theme';

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trip = useTripStore((s) => s.trips.find((t) => t.id === id));
  const vehicle = useVehicleStore((s) => s.vehicles.find((v) => v.id === trip?.vehicleId));
  const removeTrip = useTripStore((s) => s.removeTrip);
  const [exporting, setExporting] = useState(false);

  const points = useMemo(() => (trip ? decodeTrip(trip) : []), [trip]);
  const route = useMemo(() => points.map((p) => [p.lat, p.lng] as [number, number]), [points]);

  if (!trip) return <EmptyState icon="map-marker-off" title="Perjalanan tidak ditemukan" />;

  const st = trip.stats;
  const enc = trip.polyline.length + trip.telemetry.length;
  const ratio = compressionRatio(st, enc);
  const avg = st.movingS > 0 ? st.distanceM / st.movingS : 0;
  const name = `${vehicle?.name ?? 'Perjalanan'} ${dateTimeID(trip.startedAt)}`;

  const onExport = async () => {
    setExporting(true);
    try {
      await exportTripGpx(trip, name);
    } catch (e: any) {
      Alert.alert('Gagal ekspor', e?.message ?? String(e));
    } finally {
      setExporting(false);
    }
  };

  const onDelete = () =>
    Alert.alert('Hapus perjalanan?', 'Pilih apakah jaraknya juga dikurangi dari odometer.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus saja',
        onPress: () => {
          removeTrip(trip.id);
          router.back();
        },
      },
      {
        text: 'Hapus & kurangi odometer',
        style: 'destructive',
        onPress: () => {
          useVehicleStore.getState().updateVehicle(trip.vehicleId, {
            gpsKm: Math.max(0, (vehicle?.gpsKm ?? 0) - st.distanceM / 1000),
          });
          removeTrip(trip.id);
          router.back();
        },
      },
    ]);

  // Profil elevasi sederhana (maks 60 batang)
  const alts = points.map((p) => p.alt);
  const step = Math.max(1, Math.ceil(alts.length / 60));
  const bars = alts.filter((_, i) => i % step === 0);
  const minA = bars.length ? Math.min(...bars) : 0;
  const maxA = Math.max(bars.length ? Math.max(...bars) : 0, minA + 1);

  return (
    <Screen>
      <Stack.Screen options={{ title: distance(st.distanceM) }} />
      <Muted style={{ marginBottom: 8 }}>{dateTimeID(trip.startedAt)} · {vehicle?.name}</Muted>
      <LeafletMap route={route} fitAll height={280} />

      <View style={s.grid}>
        <StatTile label="Jarak" value={distance(st.distanceM)} />
        <StatTile label="Durasi" value={duration(st.durationS)} sub={`bergerak ${duration(st.movingS)}`} />
      </View>
      <View style={s.grid}>
        <StatTile label="Rata-rata" value={speedKmh(avg)} />
        <StatTile label="Maks" value={speedKmh(st.maxSpeedMs)} />
      </View>
      <View style={s.grid}>
        <StatTile label="Naik / Turun" value={`${Math.round(st.elevGainM)} / ${Math.round(st.elevLossM)} m`} />
        <StatTile
          label="Elevasi"
          value={st.minAltM != null ? `${Math.round(st.minAltM)}–${Math.round(st.maxAltM ?? 0)} m` : '-'}
        />
      </View>

      {bars.length > 3 ? (
        <>
          <SectionHeader title="Profil elevasi" />
          <Card>
            <View style={s.chart}>
              {bars.map((a, i) => (
                <View key={i} style={[s.bar, { height: `${8 + ((a - minA) / (maxA - minA)) * 92}%` }]} />
              ))}
            </View>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Muted>{Math.round(minA)} m</Muted>
              <Muted>{Math.round(maxA)} m</Muted>
            </Row>
          </Card>
        </>
      ) : null}

      <SectionHeader title="Kompresi data telemetri" />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Muted>JSON mentah</Muted>
            <Text style={s.kpi}>{bytes(st.rawJsonBytes)}</Text>
          </View>
          <View>
            <Muted>Encoded Polyline</Muted>
            <Text style={s.kpi}>{bytes(enc)}</Text>
          </View>
          <View>
            <Muted>Rasio</Muted>
            <Text style={[s.kpi, { color: ratio >= 10 ? colors.good : colors.warn }]}>{thousands(ratio, 1)}:1</Text>
          </View>
        </Row>
        <Muted style={{ marginTop: 8 }}>
          {st.pointCount} titik · disaring {st.rejectedNoise} jitter, {st.rejectedOutlier} outlier, {st.rejectedAccuracy} akurasi buruk
        </Muted>
        <Text style={s.code} numberOfLines={2}>{trip.polyline}</Text>
      </Card>

      <Button title="Ekspor GPX" icon="export-variant" onPress={onExport} loading={exporting} />
      <Button title="Hapus" icon="trash-can-outline" variant="ghost" onPress={onDelete} style={{ marginTop: 8 }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 10, marginTop: 10 },
  chart: { height: 80, flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  bar: { flex: 1, backgroundColor: colors.accent, borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: 0.8 },
  kpi: { fontSize: 18, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  code: { fontFamily: 'monospace', fontSize: 11, color: colors.muted, marginTop: 8, backgroundColor: colors.bg, padding: 8, borderRadius: 8 },
});
