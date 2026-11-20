// Riwayat servis, rute perjalanan, dan dokumen digital.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { File } from 'expo-file-system';
import type { ServiceRecord, Trip, VehicleDocument } from '../types';
import { nowISO, uuid } from '../lib/id';
import { localStorage } from './storage';
import { queueSync } from './outbox';

// ---------- Servis ----------
export type ServiceInput = Omit<ServiceRecord, 'id' | 'createdAt' | 'updatedAt'>;

interface ServiceState {
  records: ServiceRecord[];
  addRecord: (input: ServiceInput) => ServiceRecord;
  updateRecord: (id: string, patch: Partial<ServiceRecord>) => void;
  removeRecord: (id: string) => void;
  removeByVehicle: (vehicleId: string) => void;
}

export const useServiceStore = create<ServiceState>()(
  persist(
    (set, get) => ({
      records: [],
      addRecord: (input) => {
        const now = nowISO();
        const r: ServiceRecord = { ...input, id: uuid(), createdAt: now, updatedAt: now };
        set((s) => ({ records: [r, ...s.records] }));
        queueSync('service_records', 'upsert', r);
        return r;
      },
      updateRecord: (id, patch) => {
        const current = get().records.find((r) => r.id === id);
        if (!current) return;
        const r = { ...current, ...patch, updatedAt: nowISO() };
        set((s) => ({ records: s.records.map((x) => (x.id === id ? r : x)) }));
        queueSync('service_records', 'upsert', r);
      },
      removeRecord: (id) => {
        set((s) => ({ records: s.records.filter((r) => r.id !== id) }));
        queueSync('service_records', 'delete', { id });
      },
      removeByVehicle: (vehicleId) => {
        get().records.filter((r) => r.vehicleId === vehicleId).forEach((r) => get().removeRecord(r.id));
      },
    }),
    { name: 'VELIQ.services', storage: localStorage, version: 1 },
  ),
);

// ---------- Perjalanan ----------
interface TripState {
  trips: Trip[];
  addTrip: (t: Trip) => void;
  removeTrip: (id: string) => void;
  removeByVehicle: (vehicleId: string) => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      trips: [],
      addTrip: (t) => {
        set((s) => ({ trips: [t, ...s.trips.filter((x) => x.id !== t.id)] }));
        queueSync('trips', 'upsert', t);
      },
      removeTrip: (id) => {
        set((s) => ({ trips: s.trips.filter((t) => t.id !== id) }));
        queueSync('trips', 'delete', { id });
      },
      removeByVehicle: (vehicleId) => {
        get().trips.filter((t) => t.vehicleId === vehicleId).forEach((t) => get().removeTrip(t.id));
      },
    }),
    { name: 'VELIQ.trips', storage: localStorage, version: 1 },
  ),
);

// ---------- Dokumen ----------
export type DocInput = Omit<VehicleDocument, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

interface DocState {
  docs: VehicleDocument[];
  addDoc: (input: DocInput) => VehicleDocument;
  updateDoc: (id: string, patch: Partial<VehicleDocument>) => void;
  removeDoc: (id: string) => void;
  removeByVehicle: (vehicleId: string) => void;
}

export const useDocStore = create<DocState>()(
  persist(
    (set, get) => ({
      docs: [],
      addDoc: (input) => {
        const now = nowISO();
        const d: VehicleDocument = { ...input, id: input.id ?? uuid(), createdAt: now, updatedAt: now };
        set((s) => ({ docs: [d, ...s.docs] }));
        queueSync('documents', 'upsert', d);
        return d;
      },
      updateDoc: (id, patch) => {
        const cur = get().docs.find((d) => d.id === id);
        if (!cur) return;
        const d = { ...cur, ...patch, updatedAt: nowISO() };
        set((s) => ({ docs: s.docs.map((x) => (x.id === id ? d : x)) }));
        queueSync('documents', 'upsert', d);
      },
      removeDoc: (id) => {
        const doc = get().docs.find((d) => d.id === id);
        if (doc) {
          try {
            const f = new File(doc.uri);
            if (f.exists) f.delete();
          } catch {
            // file sudah tidak ada — abaikan
          }
        }
        set((s) => ({ docs: s.docs.filter((d) => d.id !== id) }));
        queueSync('documents', 'delete', { id });
      },
      removeByVehicle: (vehicleId) => {
        get().docs.filter((d) => d.vehicleId === vehicleId).forEach((d) => get().removeDoc(d.id));
      },
    }),
    { name: 'VELIQ.documents', storage: localStorage, version: 1 },
  ),
);
