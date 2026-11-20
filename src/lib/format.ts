import { parseISODate } from './dates';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function rupiah(n: number): string {
  const v = Math.round(n || 0);
  return 'Rp' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function thousands(n: number, digits = 0): string {
  const fixed = (n || 0).toFixed(digits);
  const [int, dec] = fixed.split('.');
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec ? `${withDots},${dec}` : withDots;
}

export function km(n: number, digits = 0): string {
  return `${thousands(n, digits)} km`;
}

export function distance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${thousands(m / 1000, 2)} km`;
}

export function speedKmh(ms: number): string {
  return `${thousands(ms * 3.6, 1)} km/j`;
}

export function duration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}j ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(sec).padStart(2, '0')}d`;
}

export function dateID(iso?: string): string {
  if (!iso) return '-';
  const d = iso.length > 10 ? new Date(iso) : parseISODate(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export function dateTimeID(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dateID(iso)}, ${hh}.${mm}`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${thousands(n / 1024, 1)} KB`;
  return `${thousands(n / 1024 / 1024, 2)} MB`;
}

export function daysLabel(days: number): string {
  if (days === 0) return 'hari ini';
  if (days > 0) return `${days} hari lagi`;
  return `lewat ${Math.abs(days)} hari`;
}

/** Parse input angka gaya Indonesia ("12.500" / "12,5"). */
export function parseNumber(s: string): number {
  const clean = s.replace(/[^\d,.-]/g, '');
  if (!clean) return 0;
  // Koma = desimal. Titik = pemisah ribuan, kecuali satu titik yang tidak diikuti
  // tepat 3 digit (mis. "1.2" dari keyboard numerik) → dianggap desimal.
  const dots = clean.match(/\./g)?.length ?? 0;
  const dotIsDecimal = !clean.includes(',') && dots === 1 && !/\.\d{3}$/.test(clean);
  const normalized = dotIsDecimal ? clean : clean.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
