// Layanan perekam perjalanan + odometer otomatis.
// Mode utama: background (foreground service Android) via expo-location + TaskManager, 1 Hz.
// Fallback: watchPositionAsync saat izin "selalu" ditolak (hanya saat aplikasi terbuka).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import type { GpsFix } from '../lib/geo';
import { uuid } from '../lib/id';
import { RecorderState, createRecorderState, finalizeTrip, ingestFix } from '../lib/tripCore';
import { useTripStore } from '../store/records';
import { useVehicleStore } from '../store/vehicles';
import { ensureHydrated } from '../store/storage';
import type { Trip } from '../types';

export const LOCATION_TASK = 'VELIQ-location-task';
const ACTIVE_KEY = 'VELIQ.activeTrip.v1';
const SAVE_EVERY_MS = 3000;

export type RecorderMode = 'background' | 'foreground';

interface LiveRecorder {
  active: RecorderState | null;
  mode: RecorderMode | null;
}

/** Mirror untuk UI (tidak dipersist; sumber kebenaran ada di AsyncStorage). */
export const useRecorder = create<LiveRecorder>(() => ({ active: null, mode: null }));

let state: RecorderState | null = null;
let loaded = false;
let lastSave = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let fgSub: Location.LocationSubscription | null = null;

async function ensureLoaded() {
  if (loaded) return;
  const raw = await AsyncStorage.getItem(ACTIVE_KEY);
  state = raw ? (JSON.parse(raw) as RecorderState) : null;
  loaded = true;
  useRecorder.setState({ active: state });
}

async function saveNow() {
  lastSave = Date.now();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (state) await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(state));
  else await AsyncStorage.removeItem(ACTIVE_KEY);
}

function scheduleSave() {
  const wait = SAVE_EVERY_MS - (Date.now() - lastSave);
  if (wait <= 0) void saveNow();
  else if (!saveTimer) saveTimer = setTimeout(() => void saveNow(), wait);
}

export function toFix(l: Location.LocationObject): GpsFix {
  return {
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    alt: l.coords.altitude ?? null,
    speed: l.coords.speed != null && l.coords.speed >= 0 ? l.coords.speed : null,
    acc: l.coords.accuracy ?? null,
    t: l.timestamp,
  };
}

/** Dipanggil oleh background task maupun watcher foreground. */
export async function ingestLocations(locations: Location.LocationObject[]) {
  await ensureLoaded();
  if (!state) return;
  const sorted = [...locations].sort((a, b) => a.timestamp - b.timestamp);
  for (const l of sorted) state = ingestFix(state, toFix(l)).state;
  useRecorder.setState({ active: state });
  scheduleSave();
}

export type StartResult = { ok: true; mode: RecorderMode } | { ok: false; reason: string };

export async function startTrip(vehicleId: string): Promise<StartResult> {
  await ensureLoaded();
  if (state) return { ok: true, mode: useRecorder.getState().mode ?? 'foreground' };

  if (!(await Location.hasServicesEnabledAsync())) {
    return { ok: false, reason: 'GPS/Lokasi perangkat sedang mati. Aktifkan dulu di pengaturan.' };
  }
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { ok: false, reason: 'Izin lokasi ditolak.' };
  // Android 13+: notifikasi foreground service butuh izin notifikasi.
  await Notifications.requestPermissionsAsync().catch(() => undefined);

  let bgGranted = false;
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    bgGranted = bg.status === 'granted';
  } catch {
    bgGranted = false;
  }

  state = createRecorderState(uuid(), vehicleId);
  await saveNow();

  if (bgGranted) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000, // 1 Hz
      distanceInterval: 0,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'VELIQ merekam perjalanan',
        notificationBody: 'Odometer GPS aktif. Ketuk untuk membuka.',
        notificationColor: '#F97316',
        killServiceOnDestroy: false,
      },
    });
    useRecorder.setState({ active: state, mode: 'background' });
    return { ok: true, mode: 'background' };
  }

  fgSub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
    (l) => void ingestLocations([l]),
  );
  useRecorder.setState({ active: state, mode: 'foreground' });
  return { ok: true, mode: 'foreground' };
}

async function stopUpdates() {
  fgSub?.remove();
  fgSub = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // task belum terdaftar — abaikan
  }
}

/** Hentikan perekaman: simpan trip & tambahkan jarak ke odometer kendaraan. */
export async function stopTrip(): Promise<Trip | null> {
  await stopUpdates();
  await ensureLoaded();
  if (!state) {
    useRecorder.setState({ active: null, mode: null });
    return null;
  }
  const trip = finalizeTrip(state);
  await ensureHydrated(useTripStore, useVehicleStore);
  const saved = trip.stats.pointCount >= 2 && trip.stats.distanceM > 0;
  if (saved) {
    useTripStore.getState().addTrip(trip);
    useVehicleStore.getState().addGpsKm(trip.vehicleId, trip.stats.distanceM / 1000);
  }
  state = null;
  await saveNow();
  useRecorder.setState({ active: null, mode: null });
  return saved ? trip : null;
}

/** Saat aplikasi dibuka: lanjutkan trip background yang masih jalan, atau tutup trip yatim. */
export async function recoverActiveTrip() {
  await ensureLoaded();
  if (!state) return;
  let running = false;
  try {
    running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    running = false;
  }
  if (running) {
    useRecorder.setState({ active: state, mode: 'background' });
    return;
  }
  // Aplikasi sempat ditutup saat mode foreground → simpan apa yang sudah terekam.
  await stopTrip();
}
