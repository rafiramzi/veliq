import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ComponentKey, LifespanMatrix, LifespanSpec, VehicleType } from '../types';
import { DEFAULT_MATRIX } from '../lib/lifespan';
import { DEFAULT_TAX_RATES, TaxRates } from '../lib/tax';
import { uuid } from '../lib/id';
import { localStorage } from './storage';

interface SettingsState {
  deviceId: string;
  riderName: string;
  matrix: LifespanMatrix;
  taxRates: Record<VehicleType, TaxRates>;
  /** Jarak (m) anggota touring dianggap tertinggal. */
  separationM: number;
  notificationsEnabled: boolean;
  /** Level peringatan terakhir yang sudah dinotifikasi, per `${vehicleId}:${component}`. */
  notifiedLevels: Record<string, string>;
  setRiderName: (name: string) => void;
  setSpec: (type: VehicleType, key: ComponentKey, spec: LifespanSpec) => void;
  resetMatrix: () => void;
  setTaxRates: (type: VehicleType, rates: TaxRates) => void;
  setSeparation: (m: number) => void;
  setNotifications: (on: boolean) => void;
  setNotified: (key: string, level: string) => void;
}

const cloneMatrix = (): LifespanMatrix => JSON.parse(JSON.stringify(DEFAULT_MATRIX));

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      deviceId: uuid(),
      riderName: '',
      matrix: cloneMatrix(),
      taxRates: JSON.parse(JSON.stringify(DEFAULT_TAX_RATES)),
      separationM: 500,
      notificationsEnabled: true,
      notifiedLevels: {},
      setRiderName: (riderName) => set({ riderName }),
      setSpec: (type, key, spec) =>
        set((s) => ({ matrix: { ...s.matrix, [type]: { ...s.matrix[type], [key]: spec } } })),
      resetMatrix: () => set({ matrix: cloneMatrix() }),
      setTaxRates: (type, rates) => set((s) => ({ taxRates: { ...s.taxRates, [type]: rates } })),
      setSeparation: (separationM) => set({ separationM }),
      setNotifications: (notificationsEnabled) => set({ notificationsEnabled }),
      setNotified: (key, level) => set((s) => ({ notifiedLevels: { ...s.notifiedLevels, [key]: level } })),
    }),
    {
      name: 'VELIQ.settings',
      storage: localStorage,
      version: 1,
      // Pastikan komponen baru di DEFAULT_MATRIX tetap muncul setelah update aplikasi.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        const matrix = cloneMatrix();
        for (const t of ['motor', 'mobil'] as VehicleType[]) Object.assign(matrix[t], p.matrix?.[t] ?? {});
        return { ...current, ...p, matrix };
      },
    },
  ),
);
