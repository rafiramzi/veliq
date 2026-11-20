import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LeafletMap } from '../../components/LeafletMap';
import { Button, Card, EmptyState, Icon, ListItem, Muted, Row, Screen, SectionHeader, StatTile } from '../../components/ui';
import { dateTimeID, distance, duration, speedKmh, thousands } from '../../lib/format';
import { decodePolyline } from '../../lib/polyline';
import { compressionRatio } from '../../lib/tripCore';
import { startTrip, stopTrip, useRecorder } from '../../services/recorder';
import { useTripStore } from '../../store/records';
import { useActiveVehicle } from '../../store/vehicles';
import { colors } from '../../theme';

export default function TripScreen() {
  const vehicle = useActiveVehicle();
  const active = useRecorder((s) => s.active);
  const mode = useRecorder((s) => s.mode);
  const trips = useTripStore((s) => s.trips);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const encoded = active?.latlng.encoded ?? '';
  const route = useMemo(() => decodePolyline(encoded), [encoded]);
  const vehicleTrips = trips.filter((t) => !vehicle || t.vehicleId === vehicle.id);

  if (!vehicle) {
    return (
      <Screen>
        <EmptyState icon="car-off" title="Belum ada kendaraan" action="Tambah Kendaraan" onAction={() => router.push('/vehicle/edit')} />
      </Screen>
    );
  }

  const onStart = async () => {
    setBusy(true);
    try {
      const res = await startTrip(vehicle.id);
      if (!res.ok) Alert.alert('Tidak bisa mulai', res.reason);
      else if (res.mode === 'foreground')
        Alert.alert(
          'Mode layar aktif',
          'Izin lokasi "Izinkan sepanjang waktu" belum diberikan, jadi perekaman hanya berjalan selama aplikasi terbuka. Aktifkan di Pengaturan > Aplikasi > VELIQ > Izin > Lokasi agar tetap merekam saat layar mati.',
        );
    } catch (e: any) {
      Alert.alert('Gagal memulai', e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const onStop = () =>
    Alert.alert('Selesai merekam?', 'Jarak perjalanan akan ditambahkan ke odometer.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Selesai',
        onPress: async () => {
          setBusy(true);
          const trip = await stopTrip().catch(() => null);
          setBusy(false);
          if (trip) router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
          else Alert.alert('Perjalanan tidak disimpan', 'Belum ada pergerakan yang terekam.');
        },
      },
    ]);

  if (active) {
    const st = active.stats;
    const elapsed = (now - active.startMs) / 1000;
    const avg = st.movingS > 0 ? st.distanceM / st.movingS : 0;
    const encBytes = active.latlng.encoded.length + active.tele.encoded.length;
    const ratio = compressionRatio(st, encBytes);
    const sinceFix = active.lastFixAt ? Math.round((now - active.lastFixAt) / 1000) : null;
    return (
      <Screen>
        <Card dark>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              <View style={s.dot} />
              <Text style={s.recLabel}>MEREKAM · {mode === 'background' ? 'LATAR BELAKANG' : 'LAYAR AKTIF'}</Text>
            </Row>
            <Text style={s.timer}>{duration(elapsed)}</Text>
          </Row>
          <Text style={s.bigDist}>{thousands(st.distanceM / 1000, 2)}<Text style={s.unit}> km</Text></Text>
          <Text style={s.speed}>{speedKmh(active.currentSpeedMs)}</Text>
          <Muted style={{ color: colors.faint, marginTop: 4 }}>
            {sinceFix == null ? 'Menunggu sinyal GPS…' : sinceFix > 5 ? `Sinyal GPS terakhir ${sinceFix} dtk lalu` : 'Sinyal GPS baik · 1 Hz'}
          </Muted>
        </Card>

        <LeafletMap route={route} follow height={240} />

        <View style={s.grid}>
          <StatTile label="Rata-rata" value={speedKmh(avg)} />
          <StatTile label="Maks" value={speedKmh(st.maxSpeedMs)} />
        </View>
        <View style={s.grid}>
          <StatTile label="Tanjakan" value={`${Math.round(st.elevGainM)} m`} sub={st.minAltM != null ? `${Math.round(st.minAltM)}–${Math.round(st.maxAltM ?? 0)} mdpl` : undefined} />
          <StatTile label="Kompresi" value={ratio ? `${thousands(ratio, 1)}:1` : '-'} sub={`${st.pointCount} titik`} />
        </View>
        <Muted style={{ marginVertical: 8 }}>
          Disaring: {st.rejectedNoise} jitter diam (&lt;1,5 m) · {st.rejectedOutlier} outlier (&gt;55 m/s) · {st.rejectedAccuracy} akurasi buruk
        </Muted>
        <Button title="Selesai & Simpan" icon="stop" variant="danger" onPress={onStop} loading={busy} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Row style={{ alignItems: 'flex-start' }} gap={12}>
          <Icon name="crosshairs-gps" size={28} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: colors.ink }}>Odometer GPS otomatis</Text>
            <Muted>
              GPS dibaca 1×/detik, jarak dihitung dengan Haversine, noise & lonjakan sinyal disaring. Hasilnya otomatis menambah
              odometer {vehicle.name}.
            </Muted>
          </View>
        </Row>
        <Button title="Mulai Perjalanan" icon="play" onPress={onStart} loading={busy} style={{ marginTop: 16 }} />
      </Card>

      <SectionHeader title={`Riwayat (${vehicleTrips.length})`} />
      {vehicleTrips.length === 0 ? (
        <Card>
          <Muted>Belum ada perjalanan terekam.</Muted>
        </Card>
      ) : (
        <Card style={{ paddingVertical: 6 }}>
          {vehicleTrips.map((t) => (
            <ListItem
              key={t.id}
              icon="map-marker-path"
              iconColor={colors.accent}
              iconBg={colors.accentSoft}
              title={distance(t.stats.distanceM)}
              subtitle={`${dateTimeID(t.startedAt)} · ${duration(t.stats.durationS)}`}
              onPress={() => router.push({ pathname: '/trip/[id]', params: { id: t.id } })}
              chevron
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F87171' },
  recLabel: { color: '#FECACA', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  timer: { color: '#fff', fontWeight: '700', fontVariant: ['tabular-nums'] },
  bigDist: { color: '#fff', fontSize: 52, fontWeight: '800', marginTop: 12, fontVariant: ['tabular-nums'] },
  unit: { color: colors.accent, fontSize: 20 },
  speed: { color: colors.faint, fontSize: 16, fontWeight: '600' },
  grid: { flexDirection: 'row', gap: 10, marginTop: 10 },
});
