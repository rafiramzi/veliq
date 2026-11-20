import { useMemo } from 'react';
import { upcomingCost } from '../lib/cost';
import { allComponentStatus, averageKmPerDay, currentOdometer, vehicleHealthScore } from '../lib/lifespan';
import { useRecorder } from '../services/recorder';
import { useServiceStore } from '../store/records';
import { useSettings } from '../store/settings';
import type { Vehicle } from '../types';

/** Km perjalanan yang sedang direkam (belum masuk odometer), dibulatkan 0,1 km. */
export function useLiveExtraKm(v?: Vehicle): number {
  return useRecorder((s) =>
    s.active && v && s.active.vehicleId === v.id ? Math.floor(s.active.stats.distanceM / 100) / 10 : 0,
  );
}

export function useVehicleData(v?: Vehicle) {
  const records = useServiceStore((s) => s.records);
  const matrix = useSettings((s) => s.matrix);
  const extraKm = useLiveExtraKm(v);

  return useMemo(() => {
    if (!v) return null;
    const vehicleRecords = records.filter((r) => r.vehicleId === v.id);
    const health = allComponentStatus(v, vehicleRecords, matrix, { extraKm });
    return {
      odometer: currentOdometer(v, extraKm),
      health,
      score: vehicleHealthScore(health),
      alarms: health.filter((c) => c.level !== 'good').sort((a, b) => b.ratio - a.ratio),
      cost: upcomingCost(health),
      kmPerDay: averageKmPerDay(v, vehicleRecords),
      records: vehicleRecords.sort((a, b) => b.date.localeCompare(a.date) || b.odometerKm - a.odometerKm),
    };
  }, [v, records, matrix, extraKm]);
}
