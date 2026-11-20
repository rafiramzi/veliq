// Model data inti. Nama field sengaja camelCase; saat sinkron ke Supabase
// dipetakan ke snake_case oleh src/services/sync.ts.

export type VehicleType = 'motor' | 'mobil';

export type ComponentKey =
  | 'oli_mesin'
  | 'kampas_rem'
  | 'aki'
  | 'busi'
  | 'ban'
  | 'filter_udara'
  | 'servis_berkala';

export interface ComponentBaseline {
  /** Odometer (km) saat komponen terakhir diganti sebelum memakai aplikasi. */
  km: number;
  /** Tanggal ISO (YYYY-MM-DD) saat komponen terakhir diganti. */
  date: string;
}

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  plate: string;
  year?: number;
  /** Odometer hasil input manual terakhir. */
  odometerBaseKm: number;
  /** Tanggal input manual terakhir (ISO datetime). */
  odometerBaseAt: string;
  /** Jarak yang terkumpul dari GPS sejak input manual terakhir. */
  gpsKm: number;
  /** Jatuh tempo pajak tahunan (YYYY-MM-DD). */
  taxDueDate?: string;
  /** Masa berlaku STNK / ganti plat 5 tahunan (YYYY-MM-DD). */
  stnkExpiryDate?: string;
  /** PKB pokok yang tertera di STNK (Rp). */
  pkbAmount?: number;
  baselines: Partial<Record<ComponentKey, ComponentBaseline>>;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceItem {
  component: ComponentKey | 'lainnya';
  label?: string;
  cost: number;
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  date: string; // YYYY-MM-DD
  odometerKm: number;
  items: ServiceItem[];
  totalCost: number;
  workshop?: string;
  notes?: string;
  receiptDocId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripStats {
  distanceM: number;
  durationS: number;
  movingS: number;
  maxSpeedMs: number;
  elevGainM: number;
  elevLossM: number;
  minAltM: number | null;
  maxAltM: number | null;
  pointCount: number;
  rejectedNoise: number;
  rejectedOutlier: number;
  rejectedAccuracy: number;
  /** Ukuran JSON mentah titik yang diterima (byte) — pembanding rasio kompresi. */
  rawJsonBytes: number;
}

export interface Trip {
  id: string;
  vehicleId: string;
  startedAt: string;
  endedAt: string;
  /** Google Encoded Polyline (lat,lng; presisi 1e-5). */
  polyline: string;
  /** Telemetri terkode (alt m, detik relatif, kecepatan dm/s) dengan algoritma yang sama. */
  telemetry: string;
  stats: TripStats;
  createdAt: string;
  updatedAt: string;
}

export type DocKind = 'stnk' | 'bpkb' | 'nota' | 'sim' | 'asuransi' | 'lainnya';

export interface VehicleDocument {
  id: string;
  vehicleId: string;
  kind: DocKind;
  title: string;
  /** URI file lokal hasil kompresi. */
  uri: string;
  format: 'jpeg' | 'webp';
  quality: number;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
  serviceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifespanSpec {
  /** Interval km; null = hanya berbasis waktu (mis. aki). */
  km: number | null;
  /** Interval bulan; null = hanya berbasis km. */
  months: number | null;
  /** Estimasi harga (Rp) suku cadang + jasa. */
  price: number;
}

export type LifespanMatrix = Record<VehicleType, Record<ComponentKey, LifespanSpec>>;
