import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Body,
  Button,
  Card,
  EmptyState,
  Icon,
  IconName,
  LevelBadge,
  Muted,
  ProgressBar,
  Row,
  Screen,
  SectionHeader,
} from '../../components/ui';
import { useVehicleData } from '../../hooks/useVehicleData';
import { dateID, daysLabel, km, rupiah, thousands } from '../../lib/format';
import { dueInfo, isFiveYearDue } from '../../lib/tax';
import { useRecorder } from '../../services/recorder';
import { useActiveVehicle, useVehicleStore } from '../../store/vehicles';
import { colors, levelColor } from '../../theme';

export default function Dashboard() {
  const vehicle = useActiveVehicle();
  const vehicleCount = useVehicleStore((s) => s.vehicles.length);
  const data = useVehicleData(vehicle);
  const recording = useRecorder((s) => (s.active && vehicle && s.active.vehicleId === vehicle.id ? s.active : null));

  if (!vehicle || !data) {
    return (
      <Screen>
        <EmptyState
          icon="garage-variant"
          title="Selamat datang di VELIQ"
          text="Tambahkan kendaraan pertama Anda untuk mulai melacak odometer, kesehatan komponen, pajak, dan rute."
          action="Tambah Kendaraan"
          onAction={() => router.push('/vehicle/edit')}
        />
      </Screen>
    );
  }

  const tax = dueInfo(vehicle.taxDueDate);
  const stnk = dueInfo(vehicle.stnkExpiryDate);
  const fiveYear = isFiveYearDue(vehicle.taxDueDate, vehicle.stnkExpiryDate);
  const scoreColor = data.score >= 70 ? colors.good : data.score >= 40 ? colors.warn : colors.bad;

  return (
    <Screen>
      {/* Hero: kendaraan + odometer */}
      <Card dark style={{ padding: 20 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => router.push(vehicleCount > 1 ? '/vehicles' : { pathname: '/vehicle/edit', params: { id: vehicle.id } })}
            style={{ flex: 1 }}
          >
            <Row>
              <Icon name={vehicle.type === 'motor' ? 'motorbike' : 'car-side'} color={colors.accent} size={22} />
              <Text style={s.heroName} numberOfLines={1}>{vehicle.name}</Text>
              {vehicleCount > 1 ? <Icon name="chevron-down" color={colors.faint} /> : null}
            </Row>
            <Text style={s.plate}>{vehicle.plate}</Text>
          </Pressable>
          {recording ? (
            <View style={s.recPill}>
              <View style={s.recDot} />
              <Text style={s.recText}>REKAM</Text>
            </View>
          ) : null}
        </Row>

        <Text style={s.odoLabel}>ODOMETER</Text>
        <Row style={{ alignItems: 'flex-end' }} gap={6}>
          <Text style={s.odo}>{thousands(data.odometer, 0)}</Text>
          <Text style={s.odoUnit}>km</Text>
        </Row>
        <Text style={s.heroSub}>
          {recording
            ? `Sedang merekam +${thousands(recording.stats.distanceM / 1000, 2)} km`
            : `GPS +${thousands(vehicle.gpsKm, 1)} km sejak input manual ${dateID(vehicle.odometerBaseAt)}`}
        </Text>
        <Row style={{ marginTop: 16 }}>
          <Button
            title={recording ? 'Lihat Perjalanan' : 'Mulai Lacak'}
            icon={recording ? 'map-marker-path' : 'play'}
            onPress={() => router.push('/trip')}
            style={{ flex: 1 }}
            small
          />
          <Button title="Atur Manual" icon="pencil" variant="outline" small onPress={() => router.push('/odometer')} style={{ flex: 1, borderColor: colors.navy2 }} />
        </Row>
      </Card>

      {/* Kesehatan */}
      <Card onPress={() => router.push('/service')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Muted>Skor kesehatan kendaraan</Muted>
            <Row gap={4} style={{ alignItems: 'flex-end' }}>
              <Text style={[s.score, { color: scoreColor }]}>{data.score}</Text>
              <Muted style={{ marginBottom: 6 }}>/100</Muted>
            </Row>
          </View>
          <Icon name="heart-pulse" size={36} color={scoreColor} />
        </Row>
        <ProgressBar value={data.score / 100} color={scoreColor} />
        {data.alarms.length ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            {data.alarms.slice(0, 3).map((c) => (
              <Row key={c.key} style={s.alarm}>
                <Icon name={c.icon} color={levelColor(c.level)} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>{c.label}</Body>
                  <Muted>
                    {c.level === 'overdue'
                      ? `Lewat batas (${c.dueBy === 'km' ? 'jarak' : 'waktu'})`
                      : c.remainingKm != null && c.dueBy === 'km'
                        ? `Sisa ${km(Math.max(0, c.remainingKm))}`
                        : `Sisa ${Math.max(0, c.remainingDays ?? 0)} hari`}
                  </Muted>
                </View>
                <LevelBadge level={c.level} />
              </Row>
            ))}
          </View>
        ) : (
          <Row style={{ marginTop: 12 }}>
            <Icon name="check-circle" color={colors.good} />
            <Muted>Semua komponen dalam kondisi baik.</Muted>
          </Row>
        )}
      </Card>

      {/* Estimasi biaya */}
      {data.cost ? (
        <Card onPress={() => router.push('/service')}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Muted>Siapkan dana sebelum servis berikutnya</Muted>
              <Text style={s.money}>{rupiah(data.cost.total)}</Text>
              <Muted>
                Servis ± {dateID(data.cost.dueDate)}
                {data.cost.remainingKm != null ? ` · ${km(Math.max(0, data.cost.remainingKm))} lagi` : ''}
              </Muted>
            </View>
            <Icon name="cash-multiple" size={30} color={colors.accent} />
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {data.cost.items.map((i) => (
              <View key={i.key} style={[s.costChip, i.overdue && { backgroundColor: colors.badSoft }]}>
                <Text style={[s.costChipText, i.overdue && { color: colors.bad }]}>
                  {i.label} · {rupiah(i.price)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {/* Pajak */}
      <Card onPress={() => router.push('/tax')}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Body style={{ fontWeight: '700' }}>Pajak & Legalitas</Body>
          <Icon name="file-certificate-outline" color={colors.muted} />
        </Row>
        <TaxRow label={fiveYear ? 'Pajak + ganti STNK 5 th' : 'Pajak tahunan'} info={tax} />
        <TaxRow label="STNK & plat 5 tahunan" info={stnk} />
      </Card>

      <SectionHeader title="Akses cepat" />
      <View style={s.grid}>
        <Quick icon="wrench-outline" label="Catat Servis" onPress={() => router.push('/service/edit')} />
        <Quick icon="file-image-outline" label="Dokumen" onPress={() => router.push('/documents')} />
        <Quick icon="radar" label="Touring" onPress={() => router.push('/touring')} />
        <Quick icon="passport" label="Paspor PDF" onPress={() => router.push('/passport')} />
      </View>
    </Screen>
  );
}

function TaxRow({ label, info }: { label: string; info: ReturnType<typeof dueInfo> }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
      <View>
        <Body>{label}</Body>
        <Muted>{info ? dateID(info.date) : 'Belum diatur'}</Muted>
      </View>
      {info ? <LevelBadge level={info.level} text={daysLabel(info.daysLeft)} /> : <Muted>Atur →</Muted>}
    </Row>
  );
}

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.quick, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={26} color={colors.accent} />
      <Text style={s.quickText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  heroName: { color: '#fff', fontSize: 18, fontWeight: '700', flexShrink: 1 },
  plate: { color: colors.faint, marginTop: 2, fontWeight: '600', letterSpacing: 1 },
  odoLabel: { color: colors.faint, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 20 },
  odo: { color: '#fff', fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  odoUnit: { color: colors.accent, fontSize: 18, fontWeight: '700', marginBottom: 10 },
  heroSub: { color: colors.faint, fontSize: 13 },
  recPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7F1D1D', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F87171' },
  recText: { color: '#FECACA', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  score: { fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  alarm: { backgroundColor: colors.bg, borderRadius: 12, padding: 10 },
  money: { fontSize: 28, fontWeight: '800', color: colors.ink, marginVertical: 2, fontVariant: ['tabular-nums'] },
  costChip: { backgroundColor: colors.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  costChipText: { fontSize: 12, fontWeight: '600', color: colors.ink2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quick: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  quickText: { fontWeight: '700', color: colors.ink },
});
