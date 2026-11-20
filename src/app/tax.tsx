import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { DateField } from '../components/DateField';
import { Body, Button, Card, EmptyState, Field, Icon, LevelBadge, Muted, NumberField, Row, Screen, Segmented, SectionHeader } from '../components/ui';
import { todayISO } from '../lib/dates';
import { dateID, daysLabel, parseNumber, rupiah } from '../lib/format';
import { TaxRates, calculateTax, dueInfo, isFiveYearDue, nextDue } from '../lib/tax';
import { ensureNotificationPermission } from '../services/notifications';
import { useSettings } from '../store/settings';
import { useActiveVehicle, useVehicleStore } from '../store/vehicles';
import { colors, levelColor } from '../theme';

const RATE_FIELDS: { key: keyof TaxRates; label: string }[] = [
  { key: 'opsenPct', label: 'Opsen PKB (%)' },
  { key: 'swdkllj', label: 'SWDKLLJ (Rp)' },
  { key: 'stnkFee', label: 'PNBP STNK (Rp)' },
  { key: 'tnkbFee', label: 'PNBP TNKB/plat (Rp)' },
  { key: 'lateRatePctPerMonth', label: 'Denda PKB per bulan (%)' },
  { key: 'lateMaxMonths', label: 'Maks bulan denda' },
  { key: 'swdklljLate', label: 'Denda SWDKLLJ per tahun (Rp)' },
  { key: 'pkbRatePct', label: 'Tarif PKB dari NJKB (%)' },
  { key: 'bobot', label: 'Bobot kendaraan' },
];

export default function TaxScreen() {
  const vehicle = useActiveVehicle();
  const updateVehicle = useVehicleStore((s) => s.updateVehicle);
  const ratesByType = useSettings((s) => s.taxRates);
  const setTaxRates = useSettings((s) => s.setTaxRates);

  const [fiveYear, setFiveYear] = useState(() => isFiveYearDue(vehicle?.taxDueDate, vehicle?.stnkExpiryDate));
  const [basis, setBasis] = useState<'pkb' | 'njkb'>('pkb');
  const [pkb, setPkb] = useState(vehicle?.pkbAmount ? String(vehicle.pkbAmount) : '');
  const [njkb, setNjkb] = useState('');
  const [payDate, setPayDate] = useState<string | undefined>(todayISO());
  const [showRates, setShowRates] = useState(false);

  const rates = vehicle ? ratesByType[vehicle.type] : null;
  const result = useMemo(
    () =>
      rates
        ? calculateTax({
            pkb: basis === 'pkb' ? parseNumber(pkb) : undefined,
            njkb: basis === 'njkb' ? parseNumber(njkb) : undefined,
            fiveYear,
            dueDate: vehicle?.taxDueDate,
            payDate,
            rates,
          })
        : null,
    [rates, basis, pkb, njkb, fiveYear, vehicle?.taxDueDate, payDate],
  );

  if (!vehicle || !rates || !result) {
    return <EmptyState icon="car-off" title="Belum ada kendaraan" action="Tambah" onAction={() => router.push('/vehicle/edit')} />;
  }

  const tax = dueInfo(vehicle.taxDueDate);
  const stnk = dueInfo(vehicle.stnkExpiryDate);

  const markPaid = () => {
    if (!vehicle.taxDueDate) return;
    const isFive = isFiveYearDue(vehicle.taxDueDate, vehicle.stnkExpiryDate);
    Alert.alert(
      'Tandai sudah bayar?',
      isFive
        ? 'Jatuh tempo pajak maju 1 tahun dan masa berlaku STNK maju 5 tahun.'
        : 'Jatuh tempo pajak tahunan maju 1 tahun.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Sudah bayar',
          onPress: () =>
            updateVehicle(vehicle.id, {
              taxDueDate: nextDue(vehicle.taxDueDate!, 1),
              stnkExpiryDate: isFive && vehicle.stnkExpiryDate ? nextDue(vehicle.stnkExpiryDate, 5) : vehicle.stnkExpiryDate,
              pkbAmount: basis === 'pkb' && parseNumber(pkb) > 0 ? parseNumber(pkb) : vehicle.pkbAmount,
            }),
        },
      ],
    );
  };

  const line = (label: string, value: number, strong = false) =>
    value ? (
      <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
        <Text style={{ color: strong ? colors.ink : colors.ink2 }}>{label}</Text>
        <Text style={{ color: colors.ink, fontWeight: strong ? '800' : '600' }}>{rupiah(value)}</Text>
      </Row>
    ) : null;

  return (
    <Screen>
      <Muted style={{ marginBottom: 8 }}>{vehicle.name} · {vehicle.plate}</Muted>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <DueCard title="Pajak tahunan" info={tax} />
        <DueCard title="STNK 5 tahunan" info={stnk} />
      </View>
      <Row style={{ marginBottom: 4 }}>
        <Button title="Tandai sudah bayar" icon="check" variant="dark" small onPress={markPaid} disabled={!vehicle.taxDueDate} style={{ flex: 1 }} />
        <Button title="Ubah tanggal" icon="calendar-edit" variant="outline" small onPress={() => router.push({ pathname: '/vehicle/edit', params: { id: vehicle.id } })} style={{ flex: 1 }} />
      </Row>
      <Pressable onPress={() => ensureNotificationPermission()}>
        <Muted style={{ fontSize: 12, marginTop: 6 }}>
          Pengingat otomatis dikirim H-30, H-7, H-1 dan hari H (STNK 5 tahunan: H-60 & H-30 juga). Ketuk untuk memastikan izin notifikasi aktif.
        </Muted>
      </Pressable>

      <SectionHeader title="Kalkulator estimasi pajak" />
      <Segmented
        options={[
          { label: 'Tahunan', value: 'annual' },
          { label: '5 Tahunan (ganti plat)', value: 'five' },
        ]}
        value={fiveYear ? 'five' : 'annual'}
        onChange={(v) => setFiveYear(v === 'five')}
      />
      <View style={{ height: 12 }} />
      <Segmented
        options={[
          { label: 'Dari PKB pokok', value: 'pkb' },
          { label: 'Dari NJKB', value: 'njkb' },
        ]}
        value={basis}
        onChange={setBasis}
      />
      <View style={{ height: 12 }} />
      {basis === 'pkb' ? (
        <Field label="PKB pokok di STNK (Rp)" value={pkb} onChangeText={setPkb} numeric placeholder="mis. 210000" />
      ) : (
        <Field
          label="NJKB (Rp)"
          value={njkb}
          onChangeText={setNjkb}
          numeric
          placeholder="Nilai Jual Kendaraan Bermotor"
          hint={`PKB = NJKB × bobot ${rates.bobot} × ${rates.pkbRatePct}%`}
        />
      )}
      <DateField label="Rencana tanggal bayar" value={payDate} onChange={setPayDate} hint={`Jatuh tempo: ${dateID(vehicle.taxDueDate)}`} />

      <Card dark>
        {result.lateMonths > 0 ? (
          <Row style={{ marginBottom: 8 }}>
            <Icon name="alert" color="#FCA5A5" size={18} />
            <Text style={{ color: '#FCA5A5', fontWeight: '700' }}>Terlambat {result.lateMonths} bulan — kena denda</Text>
          </Row>
        ) : null}
        <Text style={{ color: colors.faint, fontWeight: '600' }}>Estimasi total bayar</Text>
        <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{rupiah(result.total)}</Text>
      </Card>
      <Card>
        {line('PKB pokok', result.pkb)}
        {line(`Opsen PKB (${rates.opsenPct}%)`, result.opsen)}
        {line('SWDKLLJ', result.swdkllj)}
        {line('PNBP penerbitan STNK', result.stnkFee)}
        {line('PNBP plat nomor (TNKB)', result.tnkbFee)}
        {line(`Denda PKB (${result.lateMonths} bln × ${rates.lateRatePctPerMonth}%)`, result.pkbPenalty)}
        {line('Denda SWDKLLJ', result.swdklljPenalty)}
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
        {line('Total', result.total, true)}
      </Card>
      <Muted style={{ fontSize: 12 }}>
        Estimasi. Tarif PNBP mengacu PP 60/2016, opsen PKB 66% (UU HKPD), denda & tarif PKB berbeda tiap provinsi — sesuaikan di bawah. Cek
        tagihan resmi di aplikasi Samsat daerah Anda.
      </Muted>

      <Pressable onPress={() => setShowRates((v) => !v)}>
        <Row style={{ justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
          <Body style={{ fontWeight: '700' }}>Tarif ({vehicle.type === 'motor' ? 'motor' : 'mobil'})</Body>
          <Icon name={showRates ? 'chevron-up' : 'chevron-down'} color={colors.muted} />
        </Row>
      </Pressable>
      {showRates ? (
        <Card>
          {RATE_FIELDS.map((f) => (
            <NumberField
              key={`${vehicle.type}-${f.key}`}
              label={f.label}
              value={rates[f.key]}
              onCommit={(n) => setTaxRates(vehicle.type, { ...useSettings.getState().taxRates[vehicle.type], [f.key]: n ?? 0 })}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function DueCard({ title, info }: { title: string; info: ReturnType<typeof dueInfo> }) {
  return (
    <Card style={[s.due, info && { borderColor: levelColor(info.level) + '55' }]}>
      <Muted>{title}</Muted>
      <Text style={s.dueDate}>{info ? dateID(info.date) : 'Belum diatur'}</Text>
      {info ? <LevelBadge level={info.level} text={daysLabel(info.daysLeft)} /> : null}
    </Card>
  );
}

const s = StyleSheet.create({
  due: { flex: 1 },
  dueDate: { fontSize: 16, fontWeight: '800', color: colors.ink, marginVertical: 6 },
});
