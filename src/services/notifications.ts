// Notifikasi lokal: pengingat pajak (terjadwal), alarm komponen, dan SOS touring.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ComponentStatus } from '../lib/lifespan';
import { addDays, parseISODate } from '../lib/dates';
import { useSettings } from '../store/settings';
import type { Vehicle } from '../types';

export const CHANNELS = { reminders: 'reminders', alerts: 'alerts', sos: 'sos' } as const;

export async function initNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNELS.reminders, {
      name: 'Pengingat pajak & servis',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.alerts, {
      name: 'Peringatan touring',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.sos, {
      name: 'SOS darurat',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 800, 300, 800, 300, 800],
      bypassDnd: true,
    });
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function notifyNow(title: string, body: string, channelId: string = CHANNELS.alerts) {
  if (!useSettings.getState().notificationsEnabled) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { type: 'instant' } },
    trigger: Platform.OS === 'android' ? { channelId } : null,
  });
}

const TAX_OFFSETS = [30, 7, 1, 0];
const STNK_OFFSETS = [60, 30, 7, 0];

/** Jadwalkan ulang semua pengingat pajak tahunan & STNK 5 tahunan (H-30, H-7, H-1, H). */
export async function rescheduleTaxReminders(vehicles: Vehicle[]) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { type?: string } | undefined)?.type === 'tax')
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (!useSettings.getState().notificationsEnabled) return;

  const now = Date.now();
  const jobs: Promise<string>[] = [];
  const plan = (v: Vehicle, date: string | undefined, offsets: number[], label: string) => {
    if (!date) return;
    for (const off of offsets) {
      const at = addDays(parseISODate(date), -off);
      at.setHours(8, 0, 0, 0);
      if (at.getTime() <= now) continue;
      const when = off === 0 ? 'jatuh tempo HARI INI' : `jatuh tempo ${off} hari lagi`;
      jobs.push(
        Notifications.scheduleNotificationAsync({
          content: {
            title: `${label} ${v.plate}`,
            body: `${label} ${v.name} ${when}. Siapkan dokumen & biayanya.`,
            data: { type: 'tax', vehicleId: v.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: at,
            channelId: CHANNELS.reminders,
          },
        }),
      );
    }
  };
  for (const v of vehicles) {
    plan(v, v.taxDueDate, TAX_OFFSETS, 'Pajak tahunan');
    plan(v, v.stnkExpiryDate, STNK_OFFSETS, 'Ganti STNK & plat 5 tahunan');
  }
  await Promise.all(jobs);
}

/** Kirim notifikasi saat komponen berubah status menjadi "segera" / "lewat" (tidak berulang). */
export async function checkComponentAlerts(v: Vehicle, list: ComponentStatus[]) {
  const settings = useSettings.getState();
  for (const c of list) {
    const key = `${v.id}:${c.key}`;
    const prev = settings.notifiedLevels[key] ?? 'good';
    if (c.level === prev) continue;
    settings.setNotified(key, c.level);
    if (c.level === 'good') continue;
    const msg =
      c.level === 'overdue'
        ? `${c.label} sudah melewati batas pakai. Segera ganti.`
        : `${c.label} hampir habis umur pakainya (${c.health}% tersisa).`;
    await notifyNow(`${v.name}: ${c.label}`, msg, CHANNELS.reminders);
  }
}
