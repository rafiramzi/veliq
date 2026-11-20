import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { DateField } from '../../components/DateField';
import { Body, Button, Card, Field, Icon, Label, Muted, Row, Screen, Segmented, SectionHeader } from '../../components/ui';
import { todayISO } from '../../lib/dates';
import { km, parseNumber } from '../../lib/format';
import { COMPONENTS, currentOdometer } from '../../lib/lifespan';
import { useDocStore, useServiceStore, useTripStore } from '../../store/records';
import { useVehicleStore } from '../../store/vehicles';
import { colors } from '../../theme';
import type { ComponentBaseline, ComponentKey, VehicleType } from '../../types';

export default function VehicleEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useVehicleStore((s) => s.vehicles.find((v) => v.id === id));
  const { addVehicle, updateVehicle, removeVehicle } = useVehicleStore();

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<VehicleType>(existing?.type ?? 'motor');
  const [plate, setPlate] = useState(existing?.plate ?? '');
  const [year, setYear] = useState(existing?.year ? String(existing.year) : '');
  const [odo, setOdo] = useState('');
  const [taxDue, setTaxDue] = useState(existing?.taxDueDate);
  const [stnkExp, setStnkExp] = useState(existing?.stnkExpiryDate);
  const [pkb, setPkb] = useState(existing?.pkbAmount ? String(existing.pkbAmount) : '');
  const [showBase, setShowBase] = useState(false);
  const [baselines, setBaselines] = useState<Partial<Record<ComponentKey, { km: string; date?: string }>>>(() => {
    const out: Partial<Record<ComponentKey, { km: string; date?: string }>> = {};
    for (const [k, b] of Object.entries(existing?.baselines ?? {})) if (b) out[k as ComponentKey] = { km: String(b.km), date: b.date };
    return out;
  });

  const save = () => {
    if (!name.trim() || !plate.trim()) return Alert.alert('Lengkapi data', 'Nama dan plat nomor wajib diisi.');
    const odometer = parseNumber(odo);
    if (!existing && odometer <= 0) return Alert.alert('Odometer', 'Isi angka odometer saat ini (lihat di speedometer).');

    const base: Partial<Record<ComponentKey, ComponentBaseline>> = {};
    for (const [k, b] of Object.entries(baselines)) {
      if (b && b.km.trim() && b.date) base[k as ComponentKey] = { km: parseNumber(b.km), date: b.date };
    }
    const fields = {
      name: name.trim(),
      type,
      plate: plate.trim().toUpperCase(),
      year: year ? parseNumber(year) : undefined,
      taxDueDate: taxDue,
      stnkExpiryDate: stnkExp,
      pkbAmount: pkb ? parseNumber(pkb) : undefined,
      baselines: base,
    };
    if (existing) updateVehicle(existing.id, fields);
    else addVehicle({ ...fields, odometerBaseKm: odometer });
    router.back();
  };

  const onDelete = () =>
    existing &&
    Alert.alert('Hapus kendaraan?', `Semua riwayat servis, rute, dan dokumen ${existing.name} ikut terhapus.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          useServiceStore.getState().removeByVehicle(existing.id);
          useTripStore.getState().removeByVehicle(existing.id);
          useDocStore.getState().removeByVehicle(existing.id);
          removeVehicle(existing.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Edit Kendaraan' : 'Tambah Kendaraan' }} />
      <Label>Jenis</Label>
      <Segmented
        options={[
          { label: 'Sepeda Motor', value: 'motor' },
          { label: 'Mobil', value: 'mobil' },
        ]}
        value={type}
        onChange={setType}
      />
      <View style={{ height: 12 }} />
      <Field label="Nama kendaraan" value={name} onChangeText={setName} placeholder="mis. Honda Vario 160" />
      <Row gap={10}>
        <Field label="Plat nomor" value={plate} onChangeText={setPlate} autoCapitalize="characters" placeholder="B 1234 XYZ" style={{ flex: 2 }} />
        <Field label="Tahun" value={year} onChangeText={setYear} numeric placeholder="2023" style={{ flex: 1 }} />
      </Row>
      {existing ? (
        <Card onPress={() => router.push('/odometer')}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Muted>Odometer saat ini</Muted>
              <Body style={{ fontWeight: '700' }}>{km(currentOdometer(existing))}</Body>
            </View>
            <Muted>Atur manual →</Muted>
          </Row>
        </Card>
      ) : (
        <Field label="Odometer saat ini (km)" value={odo} onChangeText={setOdo} numeric placeholder="12500" hint="Lihat angka di speedometer. Selanjutnya bertambah otomatis dari GPS." />
      )}

      <SectionHeader title="Pajak & STNK" />
      <DateField label="Jatuh tempo pajak tahunan" value={taxDue} onChange={setTaxDue} optional hint="Tertera di lembar pengesahan STNK." />
      <DateField label="Masa berlaku STNK (5 tahunan)" value={stnkExp} onChange={setStnkExp} optional />
      <Field label="PKB pokok (Rp)" value={pkb} onChangeText={setPkb} numeric placeholder="Opsional, untuk kalkulator pajak" />

      <Pressable onPress={() => setShowBase((s) => !s)}>
        <Row style={{ justifyContent: 'space-between', marginTop: 12, marginBottom: 8 }}>
          <Body style={{ fontWeight: '700' }}>Penggantian terakhir sebelum pakai aplikasi</Body>
          <Icon name={showBase ? 'chevron-up' : 'chevron-down'} color={colors.muted} />
        </Row>
      </Pressable>
      {showBase ? (
        <Card>
          <Muted style={{ marginBottom: 8 }}>
            Opsional. Jika kosong, komponen dianggap baru diganti saat kendaraan ditambahkan.
          </Muted>
          {COMPONENTS.map((c) => {
            const b = baselines[c.key];
            return (
              <View key={c.key} style={s.baseRow}>
                <Row style={{ marginBottom: 6 }}>
                  <Icon name={c.icon} color={colors.ink2} size={18} />
                  <Body style={{ fontWeight: '600' }}>{c.label}</Body>
                </Row>
                <Row gap={8}>
                  <TextInput
                    value={b?.km ?? ''}
                    onChangeText={(t) => setBaselines((x) => ({ ...x, [c.key]: { ...x[c.key], km: t } }))}
                    placeholder="km saat ganti"
                    keyboardType="numeric"
                    style={s.input}
                    placeholderTextColor={colors.faint}
                  />
                  <View style={{ flex: 1 }}>
                    <DateField
                      label=""
                      value={b?.date}
                      optional
                      onChange={(d) => setBaselines((x) => ({ ...x, [c.key]: { km: x[c.key]?.km ?? '', date: d } }))}
                    />
                  </View>
                </Row>
              </View>
            );
          })}
          <Button
            title="Isi semua dengan odometer & tanggal hari ini"
            variant="ghost"
            small
            onPress={() => {
              const k = existing ? String(Math.round(currentOdometer(existing))) : odo;
              const all: typeof baselines = {};
              COMPONENTS.forEach((c) => (all[c.key] = { km: k, date: todayISO() }));
              setBaselines(all);
            }}
          />
        </Card>
      ) : null}

      <Button title="Simpan" icon="content-save" onPress={save} style={{ marginTop: 8 }} />
      {existing ? <Button title="Hapus kendaraan" variant="ghost" onPress={onDelete} style={{ marginTop: 8 }} /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  baseRow: { marginBottom: 4 },
  input: {
    width: 130,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
    marginBottom: 12,
    fontSize: 16,
  },
});
