import React, { useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { LeafletMap, MapMarker } from '../../components/LeafletMap';
import { Body, Button, Card, Chip, Field, Icon, Muted, Row, Screen, SectionHeader } from '../../components/ui';
import { distance } from '../../lib/format';
import {
  createRoom,
  isOnlineTouringAvailable,
  joinRoom,
  leaveRoom,
  Member,
  setSos,
  simulateDemoSos,
  useTouring,
} from '../../services/touring/touring';
import { useSettings } from '../../store/settings';
import { colors } from '../../theme';

const STATUS: Record<Member['status'], { text: string; color: string; bg: string }> = {
  ok: { text: 'Dekat', color: colors.good, bg: colors.goodSoft },
  behind: { text: 'Terpisah', color: colors.warn, bg: colors.warnSoft },
  lost: { text: 'Sinyal hilang', color: colors.muted, bg: colors.border },
  sos: { text: 'SOS', color: '#fff', bg: colors.bad },
};

export default function TouringScreen() {
  const t = useTouring();
  const riderName = useSettings((s) => s.riderName);
  const setRiderName = useSettings((s) => s.setRiderName);
  const separationM = useSettings((s) => s.separationM);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const members = useMemo(
    () => Object.values(t.members).sort((a, b) => (b.sos ? 1 : 0) - (a.sos ? 1 : 0) || (a.distanceM ?? 0) - (b.distanceM ?? 0)),
    [t.members],
  );
  const markers = useMemo<MapMarker[]>(() => {
    const ms: MapMarker[] = members.map((m) => ({
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      label: m.name,
      color: m.sos ? colors.bad : m.status === 'behind' ? colors.warn : m.status === 'lost' ? colors.faint : colors.info,
      pulse: m.sos,
    }));
    if (t.me) ms.push({ id: 'me', lat: t.me.lat, lng: t.me.lng, label: 'Saya', color: t.mySos ? colors.bad : colors.accent, me: true, pulse: t.mySos });
    return ms;
  }, [members, t.me, t.mySos]);

  const avgLatency = members.length ? Math.round(members.reduce((s, m) => s + m.latencyMs, 0) / members.length) : null;

  const run = async (fn: () => Promise<{ ok: boolean; reason?: string }>) => {
    if (!riderName.trim()) return Alert.alert('Isi nama dulu', 'Nama tampil di radar anggota lain.');
    setBusy(true);
    const res = await fn().catch((e) => ({ ok: false, reason: String(e?.message ?? e) }));
    setBusy(false);
    if (!res.ok) Alert.alert('Gagal masuk room', res.reason);
  };

  if (!t.roomCode) {
    return (
      <Screen>
        <Card>
          <Row style={{ alignItems: 'flex-start' }} gap={12}>
            <Icon name="radar" size={28} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '700' }}>Pantau rombongan secara real-time</Body>
              <Muted>
                Posisi anggota diperbarui tiap 2 detik. Anda diberi tahu jika ada yang terpisah lebih dari {distance(separationM)},
                dan semua anggota menerima alarm saat tombol SOS ditekan.
              </Muted>
            </View>
          </Row>
        </Card>

        {!isOnlineTouringAvailable() ? (
          <Card style={{ backgroundColor: colors.infoSoft, borderColor: colors.infoSoft }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <Icon name="information" color={colors.info} />
              <Muted style={{ flex: 1, color: colors.ink2 }}>
                Mode demo: Supabase belum dikonfigurasi, jadi radar menampilkan 3 anggota simulasi. Isi EXPO_PUBLIC_SUPABASE_URL &
                ANON_KEY di .env untuk touring sungguhan.
              </Muted>
            </Row>
          </Card>
        ) : null}

        <Field label="Nama Anda di radar" value={riderName} onChangeText={setRiderName} placeholder="mis. Rizky – Vario Hitam" />
        <Button title="Buat Room Baru" icon="plus-circle" onPress={() => run(createRoom)} loading={busy} />

        <SectionHeader title="Atau gabung dengan kode" />
        <Field
          label="Private Room Code"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          placeholder="6 karakter, mis. K7Q2MX"
        />
        <Button title="Gabung Room" icon="login" variant="dark" onPress={() => run(() => joinRoom(code))} disabled={code.length !== 6} />
      </Screen>
    );
  }

  const onShare = () =>
    Share.share({ message: `Gabung rombongan touring di VELIQ. Private Room Code: ${t.roomCode}` });

  const onLeave = () =>
    Alert.alert('Keluar dari room?', 'Posisi Anda berhenti dibagikan.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => void leaveRoom() },
    ]);

  return (
    <Screen>
      <Card dark>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={s.codeLabel}>PRIVATE ROOM CODE</Text>
            <Text style={s.code}>{t.roomCode}</Text>
          </View>
          <Pressable onPress={onShare} style={s.shareBtn}>
            <Icon name="share-variant" color="#fff" />
          </Pressable>
        </Row>
        <Row style={{ marginTop: 8 }} gap={6}>
          <View style={[s.conn, { backgroundColor: t.connection === 'connected' ? colors.good : t.connection === 'error' ? colors.bad : colors.warn }]} />
          <Text style={s.connText}>
            {t.mode === 'demo' ? 'Mode demo' : 'Online'} · {t.connection === 'connected' ? 'terhubung' : t.connection}
            {avgLatency != null ? ` · latensi ±${avgLatency} ms` : ''}
          </Text>
        </Row>
      </Card>

      <LeafletMap markers={markers} fitAll height={300} />

      <SectionHeader title={`Anggota (${members.length + 1})`} />
      <Card style={{ paddingVertical: 4 }}>
        {members.length === 0 ? (
          <Muted style={{ paddingVertical: 12 }}>Menunggu anggota lain bergabung… Bagikan kode room di atas.</Muted>
        ) : (
          members.map((m, i) => {
            const st = STATUS[m.status];
            return (
              <Row key={m.id} style={[s.member, i > 0 && s.border]}>
                <Icon name={m.sos ? 'alert-octagon' : 'account-circle'} size={28} color={m.sos ? colors.bad : colors.ink2} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '600' }}>{m.name}</Body>
                  <Muted>
                    {m.distanceM != null ? distance(m.distanceM) + ' dari Anda' : 'jarak belum diketahui'}
                    {m.speed != null ? ` · ${Math.round(m.speed * 3.6)} km/j` : ''}
                  </Muted>
                </View>
                <Chip text={st.text} color={st.color} bg={st.bg} />
              </Row>
            );
          })
        )}
      </Card>

      {t.alerts.length ? (
        <>
          <SectionHeader title="Notifikasi" />
          <Card style={{ paddingVertical: 8 }}>
            {t.alerts.slice(0, 6).map((a) => (
              <Row key={a.id} style={{ paddingVertical: 4 }}>
                <Icon
                  name={a.level === 'danger' ? 'alert' : a.level === 'warning' ? 'alert-circle-outline' : 'information-outline'}
                  size={16}
                  color={a.level === 'danger' ? colors.bad : a.level === 'warning' ? colors.warn : colors.muted}
                />
                <Muted style={{ flex: 1 }}>{a.text}</Muted>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      {t.mySos ? (
        <Button title="Batalkan SOS" icon="close-octagon" variant="dark" onPress={() => setSos(false)} />
      ) : (
        <Button
          title="Tahan 1,5 detik untuk SOS"
          icon="alarm-light"
          variant="danger"
          onPress={() => Alert.alert('Tahan tombol', 'Tekan dan tahan tombol SOS selama 1,5 detik untuk mengirim sinyal darurat.')}
          onLongPress={() => setSos(true)}
          delayLongPress={1500}
          style={{ minHeight: 64 }}
        />
      )}
      {t.mode === 'demo' ? (
        <Button title="Simulasikan SOS dari anggota demo" variant="ghost" small onPress={simulateDemoSos} style={{ marginTop: 8 }} />
      ) : null}
      <Button title="Keluar dari room" icon="logout" variant="outline" onPress={onLeave} style={{ marginTop: 8 }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  codeLabel: { color: colors.faint, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  code: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: 6, fontVariant: ['tabular-nums'] },
  shareBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.navy2, alignItems: 'center', justifyContent: 'center' },
  conn: { width: 8, height: 8, borderRadius: 4 },
  connText: { color: colors.faint, fontSize: 12 },
  member: { paddingVertical: 10 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
