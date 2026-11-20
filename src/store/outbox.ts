// Antrean sinkronisasi (outbox). Setiap perubahan data lokal dicatat di sini,
// lalu dikirim ke Supabase oleh src/services/sync.ts saat perangkat online.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { localStorage } from './storage';

export type SyncTable = 'vehicles' | 'service_records' | 'trips' | 'documents';

export interface OutboxItem {
  key: string; // `${table}:${recordId}` — satu entri per record (yang terbaru menang)
  table: SyncTable;
  op: 'upsert' | 'delete';
  recordId: string;
  payload?: Record<string, unknown>;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

interface OutboxState {
  items: Record<string, OutboxItem>;
  enqueue: (table: SyncTable, op: OutboxItem['op'], record: { id: string } & object) => void;
  remove: (key: string) => void;
  fail: (key: string, error: string) => void;
  clear: () => void;
}

export const useOutbox = create<OutboxState>()(
  persist(
    (set) => ({
      items: {},
      enqueue: (table, op, record) =>
        set((s) => {
          const key = `${table}:${record.id}`;
          return {
            items: {
              ...s.items,
              [key]: {
                key,
                table,
                op,
                recordId: record.id,
                payload: op === 'upsert' ? (record as Record<string, unknown>) : undefined,
                queuedAt: new Date().toISOString(),
                attempts: 0,
              },
            },
          };
        }),
      remove: (key) =>
        set((s) => {
          const { [key]: _, ...rest } = s.items;
          return { items: rest };
        }),
      fail: (key, error) =>
        set((s) =>
          s.items[key]
            ? { items: { ...s.items, [key]: { ...s.items[key], attempts: s.items[key].attempts + 1, lastError: error } } }
            : s,
        ),
      clear: () => set({ items: {} }),
    }),
    { name: 'VELIQ.outbox', storage: localStorage, version: 1 },
  ),
);

export const queueSync = (table: SyncTable, op: OutboxItem['op'], record: { id: string } & object) =>
  useOutbox.getState().enqueue(table, op, record);
