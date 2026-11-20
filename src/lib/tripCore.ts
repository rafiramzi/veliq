// Mesin status perekam perjalanan (fungsi murni, tanpa React/Expo).
// Setiap fix GPS -> filter noise/outlier -> Haversine -> statistik -> encode polyline inkremental.
import type { Trip, TripStats } from '../types';
import { ELEVATION_THRESHOLD_M, GpsFix, evaluateFix, FixVerdict } from './geo';
import { DeltaEncoder, LATLNG_FACTORS, TELEMETRY_FACTORS } from './polyline';

export interface RecorderState {
  id: string;
  vehicleId: string;
  startedAt: string;
  startMs: number;
  last: GpsFix | null;
  consecutiveOutliers: number;
  eleRef: number | null;
  lastAlt: number;
  stats: TripStats;
  latlng: { encoded: string; prev: number[] };
  tele: { encoded: string; prev: number[] };
  currentSpeedMs: number;
  lastFixAt: number | null;
}

export const emptyStats = (): TripStats => ({
  distanceM: 0,
  durationS: 0,
  movingS: 0,
  maxSpeedMs: 0,
  elevGainM: 0,
  elevLossM: 0,
  minAltM: null,
  maxAltM: null,
  pointCount: 0,
  rejectedNoise: 0,
  rejectedOutlier: 0,
  rejectedAccuracy: 0,
  rawJsonBytes: 0,
});

export function createRecorderState(id: string, vehicleId: string, nowMs = Date.now()): RecorderState {
  return {
    id,
    vehicleId,
    startedAt: new Date(nowMs).toISOString(),
    startMs: nowMs,
    last: null,
    consecutiveOutliers: 0,
    eleRef: null,
    lastAlt: 0,
    stats: emptyStats(),
    latlng: { encoded: '', prev: [0, 0] },
    tele: { encoded: '', prev: [0, 0, 0] },
    currentSpeedMs: 0,
    lastFixAt: null,
  };
}

/** Representasi JSON mentah seperti yang dikirim sensor — pembanding rasio kompresi. */
export function rawJsonSize(fix: GpsFix): number {
  return (
    JSON.stringify({
      latitude: fix.lat,
      longitude: fix.lng,
      altitude: fix.alt,
      speed: fix.speed,
      timestamp: fix.t,
    }).length + 1 // koma pemisah array
  );
}

function appendPoint(s: RecorderState, fix: GpsFix, speedMs: number) {
  const alt = fix.alt ?? s.lastAlt;
  s.lastAlt = alt;
  const ll = new DeltaEncoder(LATLNG_FACTORS, s.latlng.encoded, s.latlng.prev);
  ll.push([fix.lat, fix.lng]);
  s.latlng = ll.snapshot();
  const te = new DeltaEncoder(TELEMETRY_FACTORS, s.tele.encoded, s.tele.prev);
  te.push([alt, Math.round((fix.t - s.startMs) / 1000), speedMs]);
  s.tele = te.snapshot();
  s.stats.pointCount += 1;
  s.stats.rawJsonBytes += rawJsonSize(fix);

  if (fix.alt != null) {
    s.stats.minAltM = s.stats.minAltM == null ? fix.alt : Math.min(s.stats.minAltM, fix.alt);
    s.stats.maxAltM = s.stats.maxAltM == null ? fix.alt : Math.max(s.stats.maxAltM, fix.alt);
    if (s.eleRef == null) s.eleRef = fix.alt;
    const diff = fix.alt - s.eleRef;
    // Histeresis supaya noise elevasi GPS tidak menumpuk jadi "tanjakan palsu".
    if (diff >= ELEVATION_THRESHOLD_M) {
      s.stats.elevGainM += diff;
      s.eleRef = fix.alt;
    } else if (diff <= -ELEVATION_THRESHOLD_M) {
      s.stats.elevLossM += -diff;
      s.eleRef = fix.alt;
    }
  }
}

export function ingestFix(prev: RecorderState, fix: GpsFix): { state: RecorderState; verdict: FixVerdict } {
  const s: RecorderState = { ...prev, stats: { ...prev.stats } };
  const verdict = evaluateFix(s.last, fix, s.consecutiveOutliers);
  s.lastFixAt = fix.t;
  s.stats.durationS = Math.max(s.stats.durationS, (fix.t - s.startMs) / 1000);

  switch (verdict.kind) {
    case 'first':
    case 'reanchor':
      appendPoint(s, fix, fix.speed ?? 0);
      s.last = fix;
      s.consecutiveOutliers = 0;
      s.currentSpeedMs = fix.speed ?? 0;
      break;
    case 'accept':
      s.stats.distanceM += verdict.distanceM;
      if (verdict.speedMs > 0.5) s.stats.movingS += verdict.dtS;
      s.stats.maxSpeedMs = Math.max(s.stats.maxSpeedMs, verdict.speedMs);
      appendPoint(s, fix, verdict.speedMs);
      s.last = fix;
      s.consecutiveOutliers = 0;
      s.currentSpeedMs = verdict.speedMs;
      break;
    case 'reject':
      if (verdict.reason === 'noise') {
        s.stats.rejectedNoise += 1;
        s.currentSpeedMs = 0;
      } else if (verdict.reason === 'outlier') {
        s.stats.rejectedOutlier += 1;
        s.consecutiveOutliers += 1;
      } else if (verdict.reason === 'accuracy') {
        s.stats.rejectedAccuracy += 1;
      }
      break;
  }
  return { state: s, verdict };
}

export function compressionRatio(stats: TripStats, encodedBytes: number): number {
  return encodedBytes > 0 ? stats.rawJsonBytes / encodedBytes : 0;
}

export function finalizeTrip(s: RecorderState, endMs = Date.now()): Trip {
  const now = new Date(endMs).toISOString();
  return {
    id: s.id,
    vehicleId: s.vehicleId,
    startedAt: s.startedAt,
    endedAt: now,
    polyline: s.latlng.encoded,
    telemetry: s.tele.encoded,
    stats: { ...s.stats, durationS: Math.max(s.stats.durationS, (endMs - s.startMs) / 1000) },
    createdAt: now,
    updatedAt: now,
  };
}
