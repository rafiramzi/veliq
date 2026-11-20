import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  LevelBadge,
  Muted,
  ProgressBar,
  Row,
  Screen,
  SectionHeader,
} from '../../components/ui';
import { useVehicleData } from '../../hooks/useVehicleData';
import { dateID, km, rupiah, thousands } from '../../lib/format';
import { componentLabel } from '../../lib/lifespan';
import { useServiceStore } from '../../store/records';
import { useActiveVehicle } from '../../store/vehicles';
import { colors, levelColor } from '../../theme';

export default function ServiceScreen() {
  const vehicle = useActiveVehicle();
  const data = useVehicleData(vehicle);
  const removeRecord = useServiceStore((s) => s.removeRecord);

  if (!vehicle || !data) {
    return (
      <Screen>
        <EmptyState icon="car-off" title="Belum ada kendaraan" action="Tambah Kendaraan" onAction={() => router.push('/vehicle/edit')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.vName}>{vehicle.name}</Text>
          <Muted>
            {km(data.odometer)} · rata-rata {thousands(data.kmPerDay, 0)} km/hari
          </Muted>
        </View>
        <Button title="Catat" icon="plus" small onPress={() => router.push('/service/edit')} />
      </Row>

      <SectionHeader title="Umur komponen" action="Atur matrix" onAction={() => router.push('/settings')} />
      <Card style={{ paddingVertical: 8 }}>
        {data.health.map((c, idx) => (
          <Pressable
            key={c.key}
            onPress={() => router.push({ pathname: '/service/edit', params: { component: c.key } })}
            style={[s.comp, idx > 0 && s.compBorder]}
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <View style={[s.iconWrap, { backgroundColor: levelColor(c.level) + '1A' }]}>
                  <Icon name={c.icon} color={levelColor(c.level)} />
                </View>
                <View>
                  <Text style={s.compName}>{c.label}</Text>
                  <Muted style={{ fontSize: 12 }}>
                    {c.spec.km ? `${km(c.spec.km)}` : ''}
                    {c.spec.km && c.spec.months ? ' / ' : ''}
                    {c.spec.months ? `${c.spec.months} bln` : ''} · terakhir {dateID(c.lastDate)}
                  </Muted>
                </View>
              </Row>
              <LevelBadge level={c.level} text={`${c.health}%`} />
            </Row>
            <View style={{ marginTop: 8 }}>
              <ProgressBar value={c.health / 100} color={levelColor(c.level)} height={6} />
            </View>
            <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
              <Muted style={{ fontSize: 12 }}>
                {c.remainingKm != null ? `Sisa ${km(Math.max(0, c.remainingKm))}` : 'Berbasis waktu'}
                {c.remainingDays != null ? ` · ${Math.max(0, c.remainingDays)} hari` : ''}
              </Muted>
              <Muted style={{ fontSize: 12 }}>
                {c.level === 'overdue' ? `Lewat (${c.dueBy === 'km' ? 'jarak' : 'waktu'})` : `± ${dateID(c.projectedDueDate)}`}
              </Muted>
            </Row>
          </Pressable>
        ))}
      </Card>
      <Muted style={{ marginBottom: 4 }}>Ketuk komponen untuk mencatat penggantian. Mana yang lebih dulu tercapai — km atau bulan — dipakai.</Muted>

      {data.cost ? (
        <>
          <SectionHeader title="Estimasi biaya mendatang" />
          <Card>
            <Muted>Perlu disiapkan sebelum servis berkala ± {dateID(data.cost.dueDate)}</Muted>
            <Text style={s.money}>{rupiah(data.cost.total)}</Text>
            {data.cost.items.map((i) => (
              <Row key={i.key} style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
                <Row gap={6}>
                  <Text style={{ color: colors.ink }}>{i.label}</Text>
                  {i.overdue ? <Chip text="lewat" color={colors.bad} bg={colors.badSoft} /> : null}
                </Row>
                <Text style={{ color: colors.ink, fontWeight: '600' }}>{rupiah(i.price)}</Text>
              </Row>
            ))}
            <Muted style={{ marginTop: 6, fontSize: 12 }}>Harga = estimasi di matrix (bisa diubah di Pengaturan).</Muted>
          </Card>
        </>
      ) : null}

      <SectionHeader title={`Riwayat servis (${data.records.length})`} />
      {data.records.length === 0 ? (
        <Card>
          <Muted>Belum ada catatan. Catat servis pertama agar umur komponen akurat.</Muted>
        </Card>
      ) : (
        data.records.map((r) => (
          <Card
            key={r.id}
            onPress={() => router.push({ pathname: '/service/edit', params: { id: r.id } })}
          >
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={s.compName}>{dateID(r.date)}</Text>
              <Text style={{ fontWeight: '800', color: colors.ink }}>{rupiah(r.totalCost)}</Text>
            </Row>
            <Muted>
              {km(r.odometerKm)}
              {r.workshop ? ` · ${r.workshop}` : ''}
            </Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {r.items.map((i, idx) => (
                <Chip key={idx} text={i.label || componentLabel(i.component)} />
              ))}
            </View>
            <Row style={{ justifyContent: 'flex-end', marginTop: 6 }}>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  Alert.alert('Hapus catatan servis?', dateID(r.date), [
                    { text: 'Batal', style: 'cancel' },
                    { text: 'Hapus', style: 'destructive', onPress: () => removeRecord(r.id) },
                  ])
                }
              >
                <Icon name="trash-can-outline" color={colors.faint} size={18} />
              </Pressable>
            </Row>
          </Card>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  vName: { fontSize: 18, fontWeight: '800', color: colors.ink },
  comp: { paddingVertical: 12 },
  compBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  compName: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  money: { fontSize: 28, fontWeight: '800', color: colors.ink, marginVertical: 6, fontVariant: ['tabular-nums'] },
});
