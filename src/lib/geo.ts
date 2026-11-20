// Perhitungan jarak & penyaringan noise GPS.

export const EARTH_RADIUS_M = 6_371_008.8;

/** Batas kecepatan yang dianggap outlier (m/s) ≈ 198 km/jam. */
export const MAX_SPEED_MS = 55;
/** Pergeseran di bawah ini dianggap jitter saat diam (m). */
export const MIN_MOVE_M = 1.5;
/** Fix dengan akurasi lebih buruk dari ini dibuang (m). */
export const MAX_ACCURACY_M = 50;
/** Setelah N outlier berturut-turut, jangkar dipindah ke fix terbaru. */
export const OUTLIER_RESET_COUNT = 5;
/** Ambang histeresis untuk menghitung tanjakan/turunan (m). */
export const ELEVATION_THRESHOLD_M = 3;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Jarak great-circle (meter) dengan rumus Haversine. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface GpsFix extends LatLng {
  /** Elevasi (m) atau null. */
  alt: number | null;
  /** Kecepatan dari sensor (m/s) atau null. */
  speed: number | null;
  /** Akurasi horizontal (m) atau null. */
  acc: number | null;
  /** Timestamp epoch ms. */
  t: number;
}

export type FixVerdict =
  | { kind: 'first' }
  | { kind: 'accept'; distanceM: number; dtS: number; speedMs: number }
  | { kind: 'reject'; reason: 'accuracy' | 'noise' | 'outlier' | 'time' }
  | { kind: 'reanchor' };

/**
 * Menilai satu fix GPS terhadap titik terakhir yang diterima.
 * Fungsi murni supaya mudah diuji.
 */
export function evaluateFix(
  last: GpsFix | null,
  fix: GpsFix,
  consecutiveOutliers: number,
): FixVerdict {
  if (fix.acc != null && fix.acc > MAX_ACCURACY_M) return { kind: 'reject', reason: 'accuracy' };
  if (!last) return { kind: 'first' };

  const dtS = (fix.t - last.t) / 1000;
  if (dtS <= 0) return { kind: 'reject', reason: 'time' };

  const distanceM = haversine(last, fix);
  const computed = distanceM / dtS;
  const reported = fix.speed != null && fix.speed >= 0 ? fix.speed : null;

  if (computed > MAX_SPEED_MS || (reported != null && reported > MAX_SPEED_MS)) {
    // Kalau terus-menerus "outlier", kemungkinan justru jangkar lama yang salah.
    if (consecutiveOutliers + 1 >= OUTLIER_RESET_COUNT) return { kind: 'reanchor' };
    return { kind: 'reject', reason: 'outlier' };
  }
  if (distanceM < MIN_MOVE_M) return { kind: 'reject', reason: 'noise' };

  return { kind: 'accept', distanceM, dtS, speedMs: reported ?? computed };
}
