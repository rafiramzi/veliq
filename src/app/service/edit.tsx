import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { DateField } from '../../components/DateField';
import { Body, Button, Card, Field, Icon, Muted, Row, Screen, SectionHeader } from '../../components/ui';
import { useVehicleData } from '../../hooks/useVehicleData';
import { todayISO } from '../../lib/dates';
import { bytes, parseNumber, rupiah } from '../../lib/format';
import { uuid } from '../../lib/id';
import { COMPONENTS } from '../../lib/lifespan';
import { CompressedImage, compressImage, persistCompressed, pickImage } from '../../services/documents';
import { useDocStore, useServiceStore } from '../../store/records';
import { useSettings } from '../../store/settings';
import { useActiveVehicle, useVehicleStore } from '../../store/vehicles';
import { colors } from '../../theme';
import type { ComponentKey, ServiceItem } from '../../types';

export default function ServiceEdit() {
  const params = useLocalSearchParams<{ id?: string; component?: string }>();
  const existing = useServiceStore((s) => s.records.find((r) => r.id === params.id));
  const active = useActiveVehicle();
  const vehicle = useVehicleStore((s) => s.vehicles.find((v) => v.id === (existing?.vehicleId ?? active?.id)));
  const data = useVehicleData(vehicle);
  const matrix = useSettings((s) => s.matrix);
  const { addRecord, updateRecord } = useServiceStore();
  const receiptDoc = useDocStore((s) => s.docs.find((d) => d.id === existing?.receiptDocId));

  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [odo, setOdo] = useState(String(Math.round(existing?.odometerKm ?? data?.odometer ?? 0)));
  const [workshop, setWorkshop] = useState(existing?.workshop ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (existing) {
      existing.items.filter((i) => i.component !== 'lainnya').forEach((i) => (init[i.component] = String(i.cost)));
    } else if (params.component && vehicle) {
      init[params.component] = String(matrix[vehicle.type][params.component as ComponentKey]?.price ?? 0);
    }
    return init;
  });
  const [extras, setExtras] = useState<{ label: string; cost: string }[]>(
    () => existing?.items.filter((i) => i.component === 'lainnya').map((i) => ({ label: i.label ?? '', cost: String(i.cost) })) ?? [],
  );
  const [receipt, setReceipt] = useState<{ img: CompressedImage; original: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const total = useMemo(
    () =>
      Object.values(selected).reduce((s, c) => s + parseNumber(c), 0) + extras.reduce((s, e) => s + parseNumber(e.cost), 0),
    [selected, extras],
  );

  if (!vehicle) return <Muted style={{ padding: 16 }}>Tambahkan kendaraan terlebih dahulu.</Muted>;

  const toggle = (key: ComponentKey, on: boolean) =>
    setSelected((s) => {
      const next = { ...s };
      if (on) next[key] = String(matrix[vehicle.type][key].price);
      else delete next[key];
      return next;
    });

  const attachReceipt = () =>
    Alert.alert('Lampirkan nota', 'Ambil foto nota servis dari…', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Galeri', onPress: () => doAttach('gallery') },
      { text: 'Kamera', onPress: () => doAttach('camera') },
    ]);

  const doAttach = async (src: 'camera' | 'gallery') => {
    const picked = await pickImage(src);
    if (!picked) return;
    if ('error' in picked) return Alert.alert('Gagal', picked.error);
    const img = await compressImage(picked, { quality: 70, format: 'jpeg', rotate: 0 });
    setReceipt({ img, original: picked.bytes });
  };

  const save = async () => {
    const items: ServiceItem[] = [
      ...Object.entries(selected).map(([component, cost]) => ({ component: component as ComponentKey, cost: parseNumber(cost) })),
      ...extras.filter((e) => e.label.trim()).map((e) => ({ component: 'lainnya' as const, label: e.label.trim(), cost: parseNumber(e.cost) })),
    ];
    if (!items.length) return Alert.alert('Belum ada pekerjaan', 'Pilih minimal satu komponen atau isi pekerjaan lain.');
    const odometerKm = parseNumber(odo);
    if (odometerKm <= 0) return Alert.alert('Odometer belum diisi');

    setSaving(true);
    try {
      const payload = {
        vehicleId: vehicle.id,
        date,
        odometerKm,
        items,
        totalCost: total,
        workshop: workshop.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      const record = existing ? { ...existing, ...payload } : addRecord(payload);
      if (existing) updateRecord(existing.id, payload);

      if (receipt) {
        const docId = uuid();
        const uri = await persistCompressed(receipt.img, docId, 'jpeg');
        useDocStore.getState().addDoc({
          id: docId,
          vehicleId: vehicle.id,
          kind: 'nota',
          title: `Nota servis ${date}`,
          uri,
          format: 'jpeg',
          quality: 70,
          width: receipt.img.width,
          height: receipt.img.height,
          originalBytes: receipt.original,
          compressedBytes: receipt.img.bytes,
          serviceId: record.id,
        });
        updateRecord(record.id, { receiptDocId: docId });
      }

      // Servis dengan odometer lebih tinggi dari catatan = koreksi odometer.
      if (data && odometerKm > data.odometer + 0.5) useVehicleStore.getState().setOdometer(vehicle.id, odometerKm);
      router.back();
    } catch (e: any) {
      Alert.alert('Gagal menyimpan', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Edit Servis' : 'Catat Servis' }} />
      <Muted style={{ marginBottom: 12 }}>{vehicle.name} · {vehicle.plate}</Muted>
      <DateField label="Tanggal servis" value={date} onChange={(d) => d && setDate(d)} />
      <Field label="Odometer saat servis (km)" value={odo} onChangeText={setOdo} numeric />

      <SectionHeader title="Komponen diganti / dikerjakan" />
      <Card style={{ paddingVertical: 4 }}>
        {COMPONENTS.map((c, idx) => {
          const on = c.key in selected;
          return (
            <View key={c.key} style={[s.row, idx > 0 && s.border]}>
              <Row style={{ flex: 1 }}>
                <Icon name={c.icon} color={on ? colors.accent : colors.faint} />
                <Body style={{ fontWeight: on ? '700' : '400' }}>{c.label}</Body>
              </Row>
              {on ? (
                <TextInput
                  value={selected[c.key]}
                  onChangeText={(t) => setSelected((s) => ({ ...s, [c.key]: t }))}
                  keyboardType="numeric"
                  style={s.cost}
                  placeholder="Biaya"
                />
              ) : null}
              <Switch
                value={on}
                onValueChange={(v) => toggle(c.key, v)}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
          );
        })}
      </Card>

      {extras.map((e, i) => (
        <Row key={i} style={{ marginBottom: 8 }}>
          <TextInput
            value={e.label}
            onChangeText={(t) => setExtras((x) => x.map((y, j) => (j === i ? { ...y, label: t } : y)))}
            placeholder="Pekerjaan lain (mis. ganti kabel gas)"
            style={[s.input, { flex: 1 }]}
            placeholderTextColor={colors.faint}
          />
          <TextInput
            value={e.cost}
            onChangeText={(t) => setExtras((x) => x.map((y, j) => (j === i ? { ...y, cost: t } : y)))}
            placeholder="Biaya"
            keyboardType="numeric"
            style={[s.input, { width: 100 }]}
            placeholderTextColor={colors.faint}
          />
          <Pressable onPress={() => setExtras((x) => x.filter((_, j) => j !== i))} hitSlop={8}>
            <Icon name="close" color={colors.muted} />
          </Pressable>
        </Row>
      ))}
      <Button title="Tambah pekerjaan lain" icon="plus" variant="outline" small onPress={() => setExtras((x) => [...x, { label: '', cost: '' }])} />

      <Spacer />
      <Field label="Bengkel" value={workshop} onChangeText={setWorkshop} placeholder="AHASS / Bengkel resmi / …" />
      <Field label="Catatan" value={notes} onChangeText={setNotes} multiline placeholder="Opsional" />

      <SectionHeader title="Nota / struk" />
      <Card>
        {receipt ? (
          <Row>
            <Image source={{ uri: receipt.img.uri }} style={s.thumb} />
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '600' }}>Nota siap disimpan</Body>
              <Muted>
                {bytes(receipt.original)} → {bytes(receipt.img.bytes)} (
                {receipt.img.bytes ? (receipt.original / receipt.img.bytes).toFixed(1) : '-'}:1)
              </Muted>
            </View>
            <Pressable onPress={() => setReceipt(null)} hitSlop={8}>
              <Icon name="close" color={colors.muted} />
            </Pressable>
          </Row>
        ) : receiptDoc ? (
          <Row>
            <Image source={{ uri: receiptDoc.uri }} style={s.thumb} />
            <Muted style={{ flex: 1 }}>Nota tersimpan di Dokumen ({bytes(receiptDoc.compressedBytes)})</Muted>
            <Button title="Ganti" small variant="outline" onPress={attachReceipt} />
          </Row>
        ) : (
          <Button title="Foto / pilih nota" icon="camera" variant="outline" onPress={attachReceipt} />
        )}
      </Card>

      <Card dark>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ color: colors.faint, fontWeight: '600' }}>Total biaya</Text>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{rupiah(total)}</Text>
        </Row>
      </Card>
      <Button title="Simpan" icon="content-save" onPress={save} loading={saving} />
    </Screen>
  );
}

const Spacer = () => <View style={{ height: 16 }} />;

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  cost: {
    width: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlign: 'right',
    color: colors.ink,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
  },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.bg },
});
