import { haversine, evaluateFix, GpsFix, MAX_SPEED_MS } from '../geo';
import { encodePolyline, decodePolyline, decodeDelta, TELEMETRY_FACTORS } from '../polyline';
import { createRecorderState, ingestFix, finalizeTrip, compressionRatio } from '../tripCore';
import { decodeTrip, tripToGpx } from '../gpx';
import { componentStatus, COMPONENTS, DEFAULT_MATRIX, allComponentStatus } from '../lifespan';
import { upcomingCost } from '../cost';
import { calculateTax, DEFAULT_TAX_RATES, isFiveYearDue } from '../tax';
import { monthsLate, parseISODate } from '../dates';
import { parseNumber, rupiah } from '../format';
import type { ServiceRecord, Vehicle } from '../../types';

describe('haversine', () => {
  it('Monas -> Bundaran HI ≈ 2,2 km', () => {
    const d = haversine({ lat: -6.175392, lng: 106.827153 }, { lat: -6.194939, lng: 106.823049 });
    expect(d).toBeGreaterThan(2100);
    expect(d).toBeLessThan(2300);
  });
  it('titik sama = 0', () => {
    expect(haversine({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
});

describe('polyline (Google)', () => {
  it('cocok dengan contoh resmi Google', () => {
    const pts: [number, number][] = [
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ];
    expect(encodePolyline(pts)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual(pts);
  });
});

const fix = (lat: number, lng: number, t: number, extra: Partial<GpsFix> = {}): GpsFix => ({
  lat,
  lng,
  t,
  alt: 10,
  speed: null,
  acc: 5,
  ...extra,
});

describe('filter noise & outlier', () => {
  it('membuang kecepatan > 55 m/s', () => {
    const a = fix(-6.2, 106.8, 0);
    const b = fix(-6.2, 106.801, 1000); // ~110 m dalam 1 detik
    expect(evaluateFix(a, b, 0)).toEqual({ kind: 'reject', reason: 'outlier' });
    expect(evaluateFix(a, fix(-6.2, 106.8001, 1000, { speed: MAX_SPEED_MS + 1 }), 0).kind).toBe('reject');
  });
  it('mengabaikan pergeseran < 1,5 m', () => {
    const a = fix(-6.2, 106.8, 0);
    const b = fix(-6.2, 106.80001, 1000); // ~1,1 m
    expect(evaluateFix(a, b, 0)).toEqual({ kind: 'reject', reason: 'noise' });
  });
  it('membuang akurasi buruk', () => {
    expect(evaluateFix(null, fix(0, 0, 0, { acc: 200 }), 0)).toEqual({ kind: 'reject', reason: 'accuracy' });
  });
  it('re-anchor setelah 5 outlier berturut-turut', () => {
    const a = fix(-6.2, 106.8, 0);
    expect(evaluateFix(a, fix(-6.3, 106.8, 1000), 4).kind).toBe('reanchor');
  });
});

describe('perekam perjalanan', () => {
  // Simulasi 10 menit @1 Hz, ~12 m/s ke timur, dengan jitter dan beberapa outlier.
  function simulate() {
    let s = createRecorderState('t1', 'v1', 0);
    const dLng = 12 / 110_574 / Math.cos((-6.2 * Math.PI) / 180) * (110_574 / 111_320);
    for (let i = 0; i < 600; i++) {
      let lng = 106.8 + i * dLng;
      let alt = 20 + Math.sin(i / 30) * 15 + (i % 2 ? 0.8 : -0.8);
      if (i % 97 === 50) lng += 0.01; // lompatan GPS (outlier)
      const r = ingestFix(s, fix(-6.2, lng, i * 1000, { alt, speed: 12 + (i % 3) * 0.1 }));
      s = r.state;
    }
    // Diam 60 detik dengan jitter kecil
    for (let i = 600; i < 660; i++) {
      s = ingestFix(s, fix(-6.2 + (i % 2) * 0.000003, 106.8 + 599 * dLng, i * 1000, { speed: 0 })).state;
    }
    return s;
  }

  it('menghitung jarak, membuang outlier & noise', () => {
    const s = simulate();
    expect(s.stats.distanceM).toBeGreaterThan(7000);
    expect(s.stats.distanceM).toBeLessThan(7400);
    expect(s.stats.rejectedOutlier).toBeGreaterThanOrEqual(6);
    expect(s.stats.rejectedNoise).toBeGreaterThan(50);
    expect(s.stats.maxSpeedMs).toBeLessThanOrEqual(MAX_SPEED_MS);
    expect(s.stats.elevGainM).toBeGreaterThan(20);
  });

  it('rasio kompresi ≥ 10:1 dan bisa didecode', () => {
    const s = simulate();
    const trip = finalizeTrip(s, 660_000);
    const ratio = compressionRatio(trip.stats, trip.polyline.length + trip.telemetry.length);
    expect(ratio).toBeGreaterThanOrEqual(10);
    const pts = decodeTrip(trip);
    expect(pts.length).toBe(trip.stats.pointCount);
    expect(decodeDelta(trip.telemetry, TELEMETRY_FACTORS).length).toBe(pts.length);
    expect(tripToGpx(trip, 'Uji')).toContain('<trkpt');
  });
});

const baseVehicle = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  name: 'Vario',
  type: 'motor',
  plate: 'B 1 AA',
  odometerBaseKm: 10_000,
  odometerBaseAt: '2026-01-01T00:00:00.000Z',
  gpsKm: 0,
  baselines: {},
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('lifespan matrix (km atau bulan, mana duluan)', () => {
  const oli = COMPONENTS.find((c) => c.key === 'oli_mesin')!;
  const spec = DEFAULT_MATRIX.motor.oli_mesin; // 2500 km / 3 bulan

  it('jatuh tempo karena km', () => {
    const v = baseVehicle({ baselines: { oli_mesin: { km: 10_000, date: '2026-03-01' } }, gpsKm: 2600 });
    const st = componentStatus(v, [], oli, spec, { now: parseISODate('2026-03-15') });
    expect(st.level).toBe('overdue');
    expect(st.dueBy).toBe('km');
  });
  it('jatuh tempo karena waktu walau km sedikit', () => {
    const v = baseVehicle({ baselines: { oli_mesin: { km: 10_000, date: '2026-01-01' } }, gpsKm: 300 });
    const st = componentStatus(v, [], oli, spec, { now: parseISODate('2026-04-15') });
    expect(st.level).toBe('overdue');
    expect(st.dueBy).toBe('time');
  });
  it('catatan servis mereset komponen', () => {
    const v = baseVehicle({ gpsKm: 3000 });
    const rec: ServiceRecord = {
      id: 's1',
      vehicleId: 'v1',
      date: '2026-03-01',
      odometerKm: 12_900,
      items: [{ component: 'oli_mesin', cost: 60000 }],
      totalCost: 60000,
      createdAt: '',
      updatedAt: '',
    };
    const st = componentStatus(v, [rec], oli, spec, { now: parseISODate('2026-03-10') });
    expect(st.level).toBe('good');
    expect(st.remainingKm).toBe(2400);
  });
  it('estimasi biaya mencakup servis berkala + komponen lewat', () => {
    const v = baseVehicle({ gpsKm: 3000, baselines: { servis_berkala: { km: 12_500, date: '2026-03-01' } } });
    const list = allComponentStatus(v, [], DEFAULT_MATRIX, { now: parseISODate('2026-03-10') });
    const est = upcomingCost(list)!;
    expect(est.items.some((i) => i.key === 'servis_berkala')).toBe(true);
    expect(est.items.some((i) => i.key === 'oli_mesin' && i.overdue)).toBe(true);
    expect(est.total).toBeGreaterThan(0);
  });
});

describe('pajak', () => {
  it('tahunan tepat waktu', () => {
    const r = calculateTax({ pkb: 200_000, fiveYear: false, rates: DEFAULT_TAX_RATES.motor });
    expect(r.opsen).toBe(132_000);
    expect(r.total).toBe(200_000 + 132_000 + 35_000);
  });
  it('5 tahunan + telat 3 bulan', () => {
    const r = calculateTax({
      pkb: 200_000,
      fiveYear: true,
      dueDate: '2026-01-10',
      payDate: '2026-04-05',
      rates: DEFAULT_TAX_RATES.motor,
    });
    expect(r.lateMonths).toBe(3);
    expect(r.pkbPenalty).toBe(Math.round(332_000 * 0.03));
    expect(r.stnkFee + r.tnkbFee).toBe(160_000);
    expect(r.swdklljPenalty).toBe(32_000);
  });
  it('monthsLate & deteksi 5 tahunan', () => {
    expect(monthsLate(parseISODate('2026-01-10'), parseISODate('2026-01-10'))).toBe(0);
    expect(monthsLate(parseISODate('2026-01-10'), parseISODate('2026-01-11'))).toBe(1);
    expect(isFiveYearDue('2027-05-01', '2027-05-01')).toBe(true);
  });
});

describe('format', () => {
  it('rupiah & parse angka', () => {
    expect(rupiah(1250000)).toBe('Rp1.250.000');
    expect(parseNumber('12.500')).toBe(12500);
    expect(parseNumber('12,5')).toBe(12.5);
    expect(parseNumber('1.2')).toBe(1.2);
    expect(parseNumber('1.250.000')).toBe(1250000);
    expect(parseNumber('Rp 75.000')).toBe(75000);
  });
});
