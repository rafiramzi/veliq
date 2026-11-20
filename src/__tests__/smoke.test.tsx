// Smoke test: semua layar bisa dirender dengan data contoh tanpa error.
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useVehicleStore } from '../store/vehicles';
import { useDocStore, useServiceStore, useTripStore } from '../store/records';
import { createRecorderState, finalizeTrip, ingestFix } from '../lib/tripCore';

function seed() {
  const v = useVehicleStore.getState().addVehicle({
    name: 'Honda Vario 160',
    type: 'motor',
    plate: 'B 1234 XYZ',
    year: 2023,
    odometerBaseKm: 12_500,
    taxDueDate: '2026-12-10',
    stnkExpiryDate: '2028-12-10',
    pkbAmount: 250_000,
    baselines: { oli_mesin: { km: 9_500, date: '2026-07-01' } },
  });
  useServiceStore.getState().addRecord({
    vehicleId: v.id,
    date: '2026-09-01',
    odometerKm: 11_800,
    items: [
      { component: 'servis_berkala', cost: 80_000 },
      { component: 'busi', cost: 35_000 },
    ],
    totalCost: 115_000,
    workshop: 'AHASS',
  });
  let s = createRecorderState('trip-1', v.id, 0);
  for (let i = 0; i < 120; i++) {
    s = ingestFix(s, { lat: -6.2, lng: 106.8 + i * 0.0001, alt: 20 + i * 0.1, speed: 11, acc: 5, t: i * 1000 }).state;
  }
  useTripStore.getState().addTrip(finalizeTrip(s, 120_000));
  useDocStore.getState().addDoc({
    vehicleId: v.id,
    kind: 'stnk',
    title: 'STNK',
    uri: 'file:///tmp/stnk.jpg',
    format: 'jpeg',
    quality: 70,
    width: 1600,
    height: 1000,
    originalBytes: 3_000_000,
    compressedBytes: 250_000,
  });
  return v;
}

const ROUTES: [string, RegExp][] = [
  ['/', /ODOMETER/],
  ['/trip', /Mulai Perjalanan/],
  ['/trip/trip-1', /Kompresi data telemetri|JSON mentah/],
  ['/service', /Umur komponen/i],
  ['/service/edit', /Komponen diganti/i],
  ['/touring', /Buat Room Baru/],
  ['/more', /Kendaraan Saya/],
  ['/vehicles', /Honda Vario 160/],
  ['/vehicle/edit', /Nama kendaraan/],
  ['/odometer', /Simpan Odometer/],
  ['/tax', /Estimasi total bayar/],
  ['/documents', /Tersimpan/],
  ['/passport', /Buat & Bagikan PDF/],
  ['/settings', /Component Lifespan Matrix/i],
];

jest.setTimeout(60_000);

describe('smoke: render semua layar', () => {
  beforeAll(() => {
    seed();
  });

  it.each(ROUTES)('%s', async (url, expected) => {
    await renderRouter('./src/app', { initialUrl: url });
    expect((await screen.findAllByText(expected)).length).toBeGreaterThan(0);
  });

  it('layar kosong (tanpa kendaraan) menampilkan onboarding', async () => {
    useVehicleStore.setState({ vehicles: [], activeId: null });
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('Tambah Kendaraan')).toBeTruthy();
  });
});

describe('alur interaksi', () => {
  it('tambah kendaraan lalu catat servis oli', async () => {
    useVehicleStore.setState({ vehicles: [], activeId: null });
    useServiceStore.setState({ records: [] });

    await renderRouter('./src/app', { initialUrl: '/vehicle/edit' });
    await fireEvent.changeText(await screen.findByPlaceholderText('mis. Honda Vario 160'), 'Yamaha NMAX');
    await fireEvent.changeText(screen.getByPlaceholderText('B 1234 XYZ'), 'd 4321 abc');
    await fireEvent.changeText(screen.getByPlaceholderText('12500'), '8.000');
    await fireEvent.press(screen.getByText('Simpan'));
    const v = useVehicleStore.getState().vehicles[0];
    expect(v).toMatchObject({ name: 'Yamaha NMAX', plate: 'D 4321 ABC', odometerBaseKm: 8000 });

    await renderRouter('./src/app', { initialUrl: '/service/edit?component=oli_mesin' });
    expect(await screen.findByText(/Komponen diganti/i)).toBeTruthy();
    await fireEvent.press(screen.getByText('Simpan'));
    const recs = useServiceStore.getState().records;
    expect(recs).toHaveLength(1);
    expect(recs[0].items[0]).toMatchObject({ component: 'oli_mesin', cost: 65_000 });
    expect(recs[0].odometerKm).toBe(8000);
  });
});
