// Harus diimpor paling awal: mendefinisikan background task lokasi.
import '../services/locationTask';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  checkComponentAlerts,
  ensureNotificationPermission,
  initNotifications,
  rescheduleTaxReminders,
} from '../services/notifications';
import { recoverActiveTrip } from '../services/recorder';
import { startSync } from '../services/sync';
import { useHydrated } from '../store/hydration';
import { useServiceStore } from '../store/records';
import { useSettings } from '../store/settings';
import { useVehicleStore } from '../store/vehicles';
import { allComponentStatus } from '../lib/lifespan';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const hydrated = useHydrated();
  const vehicles = useVehicleStore((s) => s.vehicles);
  const records = useServiceStore((s) => s.records);
  const matrix = useSettings((s) => s.matrix);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);

  useEffect(() => {
    if (!hydrated) return;
    SplashScreen.hideAsync().catch(() => undefined);
    initNotifications().catch(() => undefined);
    recoverActiveTrip().catch(() => undefined);
    return startSync();
  }, [hydrated]);

  // Jadwalkan ulang pengingat pajak bila tanggal berubah.
  const taxKey = vehicles.map((v) => `${v.id}:${v.plate}:${v.taxDueDate}:${v.stnkExpiryDate}`).join('|');
  useEffect(() => {
    if (!hydrated) return;
    const list = useVehicleStore.getState().vehicles;
    (async () => {
      // Minta izin notifikasi (Android 13+) begitu ada tanggal pajak yang perlu diingatkan.
      if (notificationsEnabled && list.some((v) => v.taxDueDate || v.stnkExpiryDate)) await ensureNotificationPermission();
      await rescheduleTaxReminders(list);
    })().catch(() => undefined);
  }, [hydrated, taxKey, notificationsEnabled]);

  // Alarm komponen (dicek saat odometer / riwayat servis berubah).
  useEffect(() => {
    if (!hydrated) return;
    for (const v of vehicles) {
      const list = allComponentStatus(v, records.filter((r) => r.vehicleId === v.id), matrix);
      checkComponentAlerts(v, list).catch(() => undefined);
    }
  }, [hydrated, vehicles, records, matrix]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
          headerBackTitle: 'Kembali',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle/edit" options={{ title: 'Kendaraan' }} />
        <Stack.Screen name="vehicles" options={{ title: 'Kendaraan Saya' }} />
        <Stack.Screen name="odometer" options={{ title: 'Atur Odometer', presentation: 'modal' }} />
        <Stack.Screen name="service/edit" options={{ title: 'Catat Servis' }} />
        <Stack.Screen name="trip/[id]" options={{ title: 'Detail Perjalanan' }} />
        <Stack.Screen name="tax" options={{ title: 'Pajak & Legalitas' }} />
        <Stack.Screen name="documents" options={{ title: 'Dokumen Digital' }} />
        <Stack.Screen name="passport" options={{ title: 'Vehicle Passport' }} />
        <Stack.Screen name="settings" options={{ title: 'Pengaturan' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
