// Background task harus didefinisikan di scope modul (bukan di dalam komponen)
// dan diimpor sedini mungkin — lihat src/app/_layout.tsx.
import type { LocationObject } from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { LOCATION_TASK, ingestLocations } from './recorder';

if (!TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    await ingestLocations(data.locations);
  });
}
