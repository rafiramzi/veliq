import { useSyncExternalStore } from 'react';
import { useVehicleStore } from './vehicles';
import { useDocStore, useServiceStore, useTripStore } from './records';
import { useSettings } from './settings';
import { useOutbox } from './outbox';

const STORES = [useVehicleStore, useServiceStore, useTripStore, useDocStore, useSettings, useOutbox];

const isHydrated = () => STORES.every((s) => s.persist.hasHydrated());

function subscribe(onChange: () => void) {
  const unsubs = STORES.map((s) => s.persist.onFinishHydration(onChange));
  return () => unsubs.forEach((u) => u());
}

/** true setelah semua store selesai dibaca dari penyimpanan lokal. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, isHydrated, isHydrated);
}
