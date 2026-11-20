// Helper tanggal ringan (tanpa dependensi) — semua tanggal disimpan YYYY-MM-DD.

export const DAY_MS = 86_400_000;
export const DAYS_PER_MONTH = 30.4375;

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Parse YYYY-MM-DD sebagai tanggal lokal (bukan UTC). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}

export function addYears(date: Date, years: number): Date {
  return addMonths(date, years * 12);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Selisih hari kalender (b - a), dibulatkan. */
export function diffDays(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / DAY_MS);
}

/** Jumlah bulan penuh keterlambatan (dibulatkan ke atas, minimal 0). */
export function monthsLate(due: Date, now: Date): number {
  if (now <= due) return 0;
  let months = (now.getFullYear() - due.getFullYear()) * 12 + (now.getMonth() - due.getMonth());
  if (now.getDate() > due.getDate()) months += 1;
  return Math.max(1, months);
}
