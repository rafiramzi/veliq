// Component Lifespan Matrix: umur komponen berdasarkan km ATAU bulan,
// mana yang lebih dulu tercapai.
import type {
  ComponentKey,
  LifespanMatrix,
  LifespanSpec,
  ServiceRecord,
  Vehicle,
  VehicleType,
} from '../types';
import { DAYS_PER_MONTH, addDays, diffDays, parseISODate, toISODate } from './dates';

export interface ComponentMeta {
  key: ComponentKey;
  label: string;
  icon: string; // nama ikon MaterialCommunityIcons
}

export const COMPONENTS: ComponentMeta[] = [
  { key: 'servis_berkala', label: 'Servis Berkala', icon: 'wrench' },
  { key: 'oli_mesin', label: 'Oli Mesin', icon: 'oil' },
  { key: 'kampas_rem', label: 'Kampas Rem', icon: 'car-brake-alert' },
  { key: 'busi', label: 'Busi', icon: 'flash' },
  { key: 'filter_udara', label: 'Filter Udara', icon: 'air-filter' },
  { key: 'aki', label: 'Aki', icon: 'car-battery' },
  { key: 'ban', label: 'Ban', icon: 'tire' },
];

export const componentLabel = (key: string) =>
  COMPONENTS.find((c) => c.key === key)?.label ?? 'Lainnya';

/** Nilai default — bisa diubah pengguna di Pengaturan. Harga = estimasi pasar umum. */
export const DEFAULT_MATRIX: LifespanMatrix = {
  motor: {
    servis_berkala: { km: 4000, months: 4, price: 80_000 },
    oli_mesin: { km: 2500, months: 3, price: 65_000 },
    kampas_rem: { km: 12_000, months: 12, price: 75_000 },
    busi: { km: 8000, months: 12, price: 35_000 },
    filter_udara: { km: 12_000, months: 12, price: 60_000 },
    aki: { km: null, months: 24, price: 250_000 },
    ban: { km: 20_000, months: 36, price: 500_000 },
  },
  mobil: {
    servis_berkala: { km: 10_000, months: 6, price: 400_000 },
    oli_mesin: { km: 10_000, months: 6, price: 450_000 },
    kampas_rem: { km: 30_000, months: 24, price: 600_000 },
    busi: { km: 20_000, months: 24, price: 300_000 },
    filter_udara: { km: 20_000, months: 12, price: 150_000 },
    aki: { km: null, months: 24, price: 900_000 },
    ban: { km: 40_000, months: 48, price: 3_200_000 },
  },
};

export const DEFAULT_KM_PER_DAY: Record<VehicleType, number> = { motor: 30, mobil: 40 };
export const WARNING_RATIO = 0.85;

export type HealthLevel = 'good' | 'warning' | 'overdue';

export interface ComponentStatus extends ComponentMeta {
  spec: LifespanSpec;
  lastKm: number;
  lastDate: string;
  kmUsed: number;
  daysUsed: number;
  ratio: number;
  health: number; // 0..100
  remainingKm: number | null;
  remainingDays: number | null;
  dueBy: 'km' | 'time';
  level: HealthLevel;
  daysUntilDue: number;
  projectedDueDate: string;
}

export function currentOdometer(v: Vehicle, extraKm = 0): number {
  return v.odometerBaseKm + v.gpsKm + extraKm;
}

/** Penggantian terakhir: catatan servis terbaru yang memuat komponen, lalu baseline. */
export function lastReplacement(
  v: Vehicle,
  records: ServiceRecord[],
  key: ComponentKey,
): { km: number; date: string } {
  let best: { km: number; date: string } | null = null;
  for (const r of records) {
    if (r.vehicleId !== v.id) continue;
    // "servis_berkala" juga direset oleh servis apa pun yang mencantumkannya.
    if (!r.items.some((i) => i.component === key)) continue;
    if (!best || r.date > best.date || (r.date === best.date && r.odometerKm > best.km)) {
      best = { km: r.odometerKm, date: r.date };
    }
  }
  const base = v.baselines[key];
  if (base && (!best || base.date > best.date)) best = base;
  return best ?? { km: v.odometerBaseKm, date: v.createdAt.slice(0, 10) };
}

/** Rata-rata km/hari dari riwayat odometer; fallback ke default per jenis kendaraan. */
export function averageKmPerDay(v: Vehicle, records: ServiceRecord[], now = new Date()): number {
  const points: { date: Date; km: number }[] = [];
  for (const r of records) if (r.vehicleId === v.id) points.push({ date: parseISODate(r.date), km: r.odometerKm });
  for (const b of Object.values(v.baselines)) if (b) points.push({ date: parseISODate(b.date), km: b.km });
  points.push({ date: new Date(v.odometerBaseAt), km: v.odometerBaseKm });
  const nowKm = currentOdometer(v);
  const earliest = points.reduce((a, b) => (b.date < a.date ? b : a), points[0]);
  const spanDays = diffDays(earliest.date, now);
  const deltaKm = nowKm - earliest.km;
  if (spanDays >= 7 && deltaKm > 0) return deltaKm / spanDays;
  return DEFAULT_KM_PER_DAY[v.type];
}

export function componentStatus(
  v: Vehicle,
  records: ServiceRecord[],
  meta: ComponentMeta,
  spec: LifespanSpec,
  opts: { now?: Date; kmPerDay?: number; extraKm?: number } = {},
): ComponentStatus {
  const now = opts.now ?? new Date();
  const kmPerDay = opts.kmPerDay ?? DEFAULT_KM_PER_DAY[v.type];
  const odo = currentOdometer(v, opts.extraKm);
  const last = lastReplacement(v, records, meta.key);

  const kmUsed = Math.max(0, odo - last.km);
  const daysUsed = Math.max(0, diffDays(parseISODate(last.date), now));
  const intervalDays = spec.months != null ? spec.months * DAYS_PER_MONTH : null;

  const kmRatio = spec.km ? kmUsed / spec.km : 0;
  const timeRatio = intervalDays ? daysUsed / intervalDays : 0;
  const ratio = Math.max(kmRatio, timeRatio);

  const remainingKm = spec.km ? spec.km - kmUsed : null;
  const remainingDays = intervalDays != null ? Math.round(intervalDays - daysUsed) : null;

  const byKmDays = remainingKm != null ? remainingKm / Math.max(kmPerDay, 0.1) : Infinity;
  const byTimeDays = remainingDays ?? Infinity;
  const daysUntilDue = Math.round(Math.min(byKmDays, byTimeDays));

  return {
    ...meta,
    spec,
    lastKm: last.km,
    lastDate: last.date,
    kmUsed,
    daysUsed,
    ratio,
    health: Math.round(Math.min(1, Math.max(0, 1 - ratio)) * 100),
    remainingKm,
    remainingDays,
    dueBy: kmRatio >= timeRatio ? 'km' : 'time',
    level: ratio >= 1 ? 'overdue' : ratio >= WARNING_RATIO ? 'warning' : 'good',
    daysUntilDue: Number.isFinite(daysUntilDue) ? daysUntilDue : 9999,
    projectedDueDate: toISODate(addDays(now, Number.isFinite(daysUntilDue) ? daysUntilDue : 9999)),
  };
}

export function allComponentStatus(
  v: Vehicle,
  records: ServiceRecord[],
  matrix: LifespanMatrix,
  opts: { now?: Date; extraKm?: number } = {},
): ComponentStatus[] {
  const kmPerDay = averageKmPerDay(v, records, opts.now);
  return COMPONENTS.map((c) =>
    componentStatus(v, records, c, matrix[v.type][c.key], { ...opts, kmPerDay }),
  );
}

export function vehicleHealthScore(list: ComponentStatus[]): number {
  if (!list.length) return 100;
  // Rata-rata, tapi komponen yang sudah lewat menurunkan skor lebih tajam.
  const avg = list.reduce((s, c) => s + c.health, 0) / list.length;
  const overdue = list.filter((c) => c.level === 'overdue').length;
  return Math.max(0, Math.round(avg - overdue * 5));
}
