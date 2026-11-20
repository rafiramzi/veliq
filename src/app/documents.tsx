import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Card, Chip, EmptyState, Field, Icon, Label, Muted, Row, Screen, Segmented, SectionHeader } from '../components/ui';
import { bytes, dateID, thousands } from '../lib/format';
import { uuid } from '../lib/id';
import { CompressedImage, PickedImage, compressImage, persistCompressed, pickImage } from '../services/documents';
import { useDocStore } from '../store/records';
import { useActiveVehicle } from '../store/vehicles';
import { colors } from '../theme';
import type { DocKind, VehicleDocument } from '../types';

const KINDS: { value: DocKind; label: string; icon: string }[] = [
  { value: 'stnk', label: 'STNK', icon: 'card-account-details-outline' },
  { value: 'nota', label: 'Nota servis', icon: 'receipt' },
  { value: 'bpkb', label: 'BPKB', icon: 'book-outline' },
  { value: 'sim', label: 'SIM', icon: 'card-account-details-star-outline' },
  { value: 'asuransi', label: 'Asuransi', icon: 'shield-car' },
  { value: 'lainnya', label: 'Lainnya', icon: 'file-outline' },
];

interface Draft {
  picked: PickedImage;
  kind: DocKind;
  title: string;
  quality: 60 | 70 | 80;
  format: 'jpeg' | 'webp';
  rotate: number;
  result?: CompressedImage;
}

export default function DocumentsScreen() {
  const vehicle = useActiveVehicle();
  const allDocs = useDocStore((s) => s.docs);
  const { addDoc, removeDoc } = useDocStore();
  const docs = allDocs.filter((d) => d.vehicleId === vehicle?.id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [working, setWorking] = useState(false);
  const [viewing, setViewing] = useState<VehicleDocument | null>(null);

  const jobRef = useRef(0);

  /** Terapkan perubahan opsi lalu kompres ulang (kualitas / format / rotasi). */
  const updateDraft = (next: Draft) => {
    const job = ++jobRef.current;
    setDraft({ ...next, result: undefined });
    setWorking(true);
    compressImage(next.picked, { quality: next.quality, format: next.format, rotate: next.rotate })
      .then((result) => job === jobRef.current && setDraft((d) => (d ? { ...d, result } : d)))
      .catch((e) => Alert.alert('Gagal kompres', String(e?.message ?? e)))
      .finally(() => job === jobRef.current && setWorking(false));
  };

  if (!vehicle) return <EmptyState icon="car-off" title="Belum ada kendaraan" />;

  const start = async (src: 'camera' | 'gallery') => {
    const picked = await pickImage(src);
    if (!picked) return;
    if ('error' in picked) return Alert.alert('Izin ditolak', picked.error);
    updateDraft({ picked, kind: 'stnk', title: 'STNK', quality: 70, format: 'jpeg', rotate: 0 });
  };

  const save = async () => {
    if (!draft?.result) return;
    setWorking(true);
    try {
      const id = uuid();
      const uri = await persistCompressed(draft.result, id, draft.format);
      addDoc({
        id,
        vehicleId: vehicle.id,
        kind: draft.kind,
        title: draft.title.trim() || KINDS.find((k) => k.value === draft.kind)!.label,
        uri,
        format: draft.format,
        quality: draft.quality,
        width: draft.result.width,
        height: draft.result.height,
        originalBytes: draft.picked.bytes,
        compressedBytes: draft.result.bytes,
      });
      setDraft(null);
    } catch (e: any) {
      Alert.alert('Gagal menyimpan', e?.message ?? String(e));
    } finally {
      setWorking(false);
    }
  };

  if (draft) {
    const r = draft.result;
    const ratio = r && r.bytes ? draft.picked.bytes / r.bytes : 0;
    return (
      <Screen>
        <View style={s.previewWrap}>
          {r ? <Image source={{ uri: r.uri }} style={s.preview} resizeMode="contain" /> : null}
          {working ? <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.accent} /> : null}
        </View>
        <Row style={{ justifyContent: 'center', marginVertical: 8 }}>
          <Button title="Putar kiri" icon="rotate-left" variant="outline" small onPress={() => updateDraft({ ...draft, rotate: (draft.rotate + 270) % 360 })} />
          <Button title="Putar kanan" icon="rotate-right" variant="outline" small onPress={() => updateDraft({ ...draft, rotate: (draft.rotate + 90) % 360 })} />
        </Row>

        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Muted>Asli</Muted>
              <Text style={s.kpi}>{bytes(draft.picked.bytes)}</Text>
              <Muted style={{ fontSize: 12 }}>{draft.picked.width}×{draft.picked.height}</Muted>
            </View>
            <Icon name="arrow-right" color={colors.faint} />
            <View>
              <Muted>Terkompresi</Muted>
              <Text style={s.kpi}>{r ? bytes(r.bytes) : '…'}</Text>
              <Muted style={{ fontSize: 12 }}>{r ? `${r.width}×${r.height}` : ''}</Muted>
            </View>
            <View>
              <Muted>Hemat</Muted>
              <Text style={[s.kpi, { color: colors.good }]}>{ratio ? `${thousands(ratio, 1)}:1` : '…'}</Text>
            </View>
          </Row>
        </Card>

        <Label>Kualitas (cek teks tetap terbaca)</Label>
        <Segmented
          options={[
            { label: '60', value: 60 },
            { label: '70', value: 70 },
            { label: '80', value: 80 },
          ]}
          value={draft.quality}
          onChange={(quality) => updateDraft({ ...draft, quality })}
        />
        <View style={{ height: 12 }} />
        <Label>Format</Label>
        <Segmented
          options={[
            { label: 'JPEG', value: 'jpeg' },
            { label: 'WebP', value: 'webp' },
          ]}
          value={draft.format}
          onChange={(format) => updateDraft({ ...draft, format })}
        />
        <View style={{ height: 12 }} />
        <Label>Jenis dokumen</Label>
        <View style={s.kinds}>
          {KINDS.map((k) => {
            const on = draft.kind === k.value;
            return (
              <Pressable
                key={k.value}
                onPress={() => setDraft({ ...draft, kind: k.value, title: k.label })}
                style={[s.kind, on && { backgroundColor: colors.navy, borderColor: colors.navy }]}
              >
                <Icon name={k.icon} size={16} color={on ? '#fff' : colors.ink2} />
                <Text style={{ color: on ? '#fff' : colors.ink2, fontWeight: '600', fontSize: 13 }}>{k.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Judul" value={draft.title} onChangeText={(title) => setDraft({ ...draft, title })} />
        <Button title="Simpan Dokumen" icon="content-save" onPress={save} disabled={!r} loading={working && !!r} />
        <Button title="Batal" variant="ghost" onPress={() => setDraft(null)} style={{ marginTop: 8 }} />
      </Screen>
    );
  }

  const totalSaved = docs.reduce((s, d) => s + Math.max(0, d.originalBytes - d.compressedBytes), 0);

  return (
    <Screen>
      <Row>
        <Button title="Kamera" icon="camera" onPress={() => start('camera')} style={{ flex: 1 }} />
        <Button title="Galeri" icon="image-multiple" variant="dark" onPress={() => start('gallery')} style={{ flex: 1 }} />
      </Row>
      <Muted style={{ marginTop: 8 }}>
        Foto diperkecil (maks 1600 px), orientasinya dirapikan, lalu dikompres ke JPEG/WebP. Disimpan di perangkat; saat sinkron
        cloud aktif, file dikirim lewat HTTPS ke bucket privat terenkripsi.
      </Muted>

      <SectionHeader title={`Tersimpan (${docs.length})`} />
      {docs.length === 0 ? (
        <Card>
          <Muted>Belum ada dokumen untuk {vehicle.name}.</Muted>
        </Card>
      ) : (
        <>
          <View style={s.grid}>
            {docs.map((d) => (
              <Pressable key={d.id} style={s.tile} onPress={() => setViewing(d)}>
                <Image source={{ uri: d.uri }} style={s.thumb} />
                <View style={{ padding: 8 }}>
                  <Body numberOfLines={1} style={{ fontWeight: '600', fontSize: 14 }}>{d.title}</Body>
                  <Row gap={4} style={{ marginTop: 4 }}>
                    <Chip text={d.format.toUpperCase()} />
                    <Muted style={{ fontSize: 11 }}>{bytes(d.compressedBytes)}</Muted>
                  </Row>
                </View>
              </Pressable>
            ))}
          </View>
          <Muted style={{ textAlign: 'center', marginTop: 8 }}>Total hemat ruang: {bytes(totalSaved)}</Muted>
        </>
      )}

      <DocViewer
        doc={viewing}
        onClose={() => setViewing(null)}
        onDelete={(d) =>
          Alert.alert('Hapus dokumen?', d.title, [
            { text: 'Batal', style: 'cancel' },
            {
              text: 'Hapus',
              style: 'destructive',
              onPress: () => {
                removeDoc(d.id);
                setViewing(null);
              },
            },
          ])
        }
      />
    </Screen>
  );
}

function DocViewer({ doc, onClose, onDelete }: { doc: VehicleDocument | null; onClose: () => void; onDelete: (d: VehicleDocument) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!doc} animationType="fade" onRequestClose={onClose} transparent>
      <View style={[s.viewer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16 }}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Icon name="close" color="#fff" size={26} />
          </Pressable>
          <Text style={{ color: '#fff', fontWeight: '700', flex: 1, textAlign: 'center' }} numberOfLines={1}>
            {doc?.title}
          </Text>
          <Pressable onPress={() => doc && onDelete(doc)} hitSlop={10}>
            <Icon name="trash-can-outline" color="#fff" size={24} />
          </Pressable>
        </Row>
        {doc ? <Image source={{ uri: doc.uri }} style={{ flex: 1, marginVertical: 12 }} resizeMode="contain" /> : null}
        {doc ? (
          <Text style={{ color: colors.faint, textAlign: 'center' }}>
            {dateID(doc.createdAt)} · {doc.width}×{doc.height} · {bytes(doc.originalBytes)} → {bytes(doc.compressedBytes)} · kualitas {doc.quality}
          </Text>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  previewWrap: { height: 280, backgroundColor: colors.navy, borderRadius: 16, overflow: 'hidden', justifyContent: 'center' },
  preview: { width: '100%', height: '100%' },
  kpi: { fontSize: 18, fontWeight: '800', color: colors.ink },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  kind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  thumb: { width: '100%', height: 120, backgroundColor: colors.bg },
  viewer: { flex: 1, backgroundColor: 'rgba(2,6,23,0.96)' },
});
