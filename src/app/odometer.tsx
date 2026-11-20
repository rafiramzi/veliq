import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Body, Button, Card, Field, Muted, Row, Screen } from '../components/ui';
import { useLiveExtraKm } from '../hooks/useVehicleData';
import { dateTimeID, km, parseNumber, thousands } from '../lib/format';
import { currentOdometer } from '../lib/lifespan';
import { useActiveVehicle, useVehicleStore } from '../store/vehicles';

export default function OdometerScreen() {
  const vehicle = useActiveVehicle();
  const setOdometer = useVehicleStore((s) => s.setOdometer);
  const extra = useLiveExtraKm(vehicle);
  const [value, setValue] = useState('');

  if (!vehicle) return <Muted style={{ padding: 16 }}>Belum ada kendaraan.</Muted>;
  const current = currentOdometer(vehicle, extra);

  const save = () => {
    const n = parseNumber(value);
    if (n <= 0) return Alert.alert('Angka tidak valid');
    const apply = () => {
      setOdometer(vehicle.id, n);
      router.back();
    };
    if (n < current - 50) {
      Alert.alert('Odometer lebih kecil', `Angka baru ${km(n)} lebih kecil dari catatan ${km(current)}. Tetap simpan?`, [
        { text: 'Batal', style: 'cancel' },
        { text: 'Simpan', onPress: apply },
      ]);
    } else apply();
  };

  return (
    <Screen>
      <Card>
        <Muted>Catatan saat ini</Muted>
        <Body style={{ fontSize: 28, fontWeight: '800' }}>{km(current, 1)}</Body>
        <Row style={{ marginTop: 8 }}>
          <Muted>
            Input manual terakhir {km(vehicle.odometerBaseKm)} ({dateTimeID(vehicle.odometerBaseAt)}) + GPS{' '}
            {thousands(vehicle.gpsKm + extra, 1)} km
          </Muted>
        </Row>
      </Card>
      <Field
        label="Odometer di speedometer (km)"
        value={value}
        onChangeText={setValue}
        numeric
        autoFocus
        placeholder={String(Math.round(current))}
        hint="Menyamakan angka dengan speedometer akan me-reset akumulasi GPS. Riwayat perjalanan tetap tersimpan."
      />
      <Button title="Simpan Odometer" icon="content-save" onPress={save} />
    </Screen>
  );
}
