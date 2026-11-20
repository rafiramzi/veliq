// Upcoming Cost Estimator: berapa uang yang perlu disiapkan sebelum servis berkala berikutnya.
import type { ComponentStatus } from './lifespan';

export interface UpcomingCostItem {
  key: string;
  label: string;
  price: number;
  overdue: boolean;
  daysUntilDue: number;
}

export interface UpcomingCost {
  horizonDays: number;
  dueDate: string;
  remainingKm: number | null;
  items: UpcomingCostItem[];
  total: number;
}

/** Toleransi: komponen yang jatuh tempo ≤ N hari setelah servis ikut dihitung. */
export const GRACE_DAYS = 14;

export function upcomingCost(list: ComponentStatus[]): UpcomingCost | null {
  const service = list.find((c) => c.key === 'servis_berkala');
  if (!service) return null;
  const horizonDays = Math.max(service.daysUntilDue, 0);

  const items = list
    .filter((c) => c.key === 'servis_berkala' || c.level === 'overdue' || c.daysUntilDue <= horizonDays + GRACE_DAYS)
    .map((c) => ({
      key: c.key,
      label: c.label,
      price: c.spec.price,
      overdue: c.level === 'overdue',
      daysUntilDue: c.daysUntilDue,
    }))
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  return {
    horizonDays,
    dueDate: service.projectedDueDate,
    remainingKm: service.remainingKm,
    items,
    total: items.reduce((s, i) => s + i.price, 0),
  };
}
