import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Vehicle } from '../types';
import { nowISO, uuid } from '../lib/id';
import { localStorage } from './storage';
import { queueSync } from './outbox';

export type VehicleInput = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'gpsKm' | 'odometerBaseAt'>;

interface VehicleState {
  vehicles: Vehicle[];
  activeId: string | null;
  addVehicle: (input: VehicleInput) => Vehicle;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => void;
  removeVehicle: (id: string) => void;
  setActive: (id: string) => void;
  /** Input odometer manual: menjadi basis baru, akumulasi GPS di-nol-kan. */
  setOdometer: (id: string, km: number) => void;
  /** Tambah jarak dari GPS (km). */
  addGpsKm: (id: string, km: number) => void;
}

export const useVehicleStore = create<VehicleState>()(
  persist(
    (set, get) => {
      const patch = (id: string, fn: (v: Vehicle) => Partial<Vehicle>) => {
        let updated: Vehicle | undefined;
        set((s) => ({
          vehicles: s.vehicles.map((v) => {
            if (v.id !== id) return v;
            updated = { ...v, ...fn(v), updatedAt: nowISO() };
            return updated;
          }),
        }));
        if (updated) queueSync('vehicles', 'upsert', updated);
      };

      return {
        vehicles: [],
        activeId: null,
        addVehicle: (input) => {
          const now = nowISO();
          const v: Vehicle = { ...input, id: uuid(), gpsKm: 0, odometerBaseAt: now, createdAt: now, updatedAt: now };
          set((s) => ({ vehicles: [...s.vehicles, v], activeId: s.activeId ?? v.id }));
          queueSync('vehicles', 'upsert', v);
          return v;
        },
        updateVehicle: (id, p) => patch(id, () => p),
        removeVehicle: (id) => {
          set((s) => {
            const vehicles = s.vehicles.filter((v) => v.id !== id);
            return { vehicles, activeId: s.activeId === id ? vehicles[0]?.id ?? null : s.activeId };
          });
          queueSync('vehicles', 'delete', { id });
        },
        setActive: (id) => set({ activeId: id }),
        setOdometer: (id, km) => patch(id, () => ({ odometerBaseKm: km, odometerBaseAt: nowISO(), gpsKm: 0 })),
        addGpsKm: (id, km) => {
          if (!get().vehicles.some((v) => v.id === id) || km <= 0) return;
          patch(id, (v) => ({ gpsKm: v.gpsKm + km }));
        },
      };
    },
    { name: 'VELIQ.vehicles', storage: localStorage, version: 1 },
  ),
);

export function useActiveVehicle(): Vehicle | undefined {
  return useVehicleStore((s) => s.vehicles.find((v) => v.id === s.activeId) ?? s.vehicles[0]);
}
