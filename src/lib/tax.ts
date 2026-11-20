// Pengingat & kalkulator Pajak STNK (estimasi).
// Tarif PNBP mengacu PP 60/2016; SWDKLLJ mengacu tarif Jasa Raharja umum;
// opsen PKB 66% dari PKB berlaku sejak 2025 (UU HKPD). Tarif daerah berbeda-beda,
// jadi semua nilai bisa diubah di layar kalkulator.
import type { VehicleType } from '../types';
import { addYears, diffDays, monthsLate, parseISODate, toISODate } from './dates';

export interface TaxRates {
  /** Tarif PKB (% dari NJKB × bobot) bila menghitung dari NJKB. */
  pkbRatePct: number;
  bobot: number;
  /** Opsen PKB (% dari PKB). */
  opsenPct: number;
  swdkllj: number;
  /** PNBP penerbitan STNK (5 tahunan). */
  stnkFee: number;
  /** PNBP penerbitan TNKB / plat (5 tahunan). */
  tnkbFee: number;
  /** Denda PKB per bulan keterlambatan (%). */
  lateRatePctPerMonth: number;
  lateMaxMonths: number;
  /** Denda SWDKLLJ per tahun keterlambatan. */
  swdklljLate: number;
}

export const DEFAULT_TAX_RATES: Record<VehicleType, TaxRates> = {
  motor: {
    pkbRatePct: 1.2,
    bobot: 1,
    opsenPct: 66,
    swdkllj: 35_000,
    stnkFee: 100_000,
    tnkbFee: 60_000,
    lateRatePctPerMonth: 1,
    lateMaxMonths: 24,
    swdklljLate: 32_000,
  },
  mobil: {
    pkbRatePct: 1.2,
    bobot: 1.05,
    opsenPct: 66,
    swdkllj: 143_000,
    stnkFee: 200_000,
    tnkbFee: 100_000,
    lateRatePctPerMonth: 1,
    lateMaxMonths: 24,
    swdklljLate: 100_000,
  },
};

export interface TaxInput {
  /** PKB pokok dari STNK. Jika kosong, dihitung dari NJKB. */
  pkb?: number;
  njkb?: number;
  fiveYear: boolean;
  dueDate?: string;
  payDate?: string;
  rates: TaxRates;
}

export interface TaxBreakdown {
  pkb: number;
  opsen: number;
  swdkllj: number;
  stnkFee: number;
  tnkbFee: number;
  lateMonths: number;
  pkbPenalty: number;
  swdklljPenalty: number;
  total: number;
}

export function calculateTax(input: TaxInput): TaxBreakdown {
  const r = input.rates;
  const pkb = input.pkb && input.pkb > 0 ? input.pkb : ((input.njkb ?? 0) * r.bobot * r.pkbRatePct) / 100;
  const opsen = (pkb * r.opsenPct) / 100;

  let lateMonths = 0;
  if (input.dueDate) {
    const pay = input.payDate ? parseISODate(input.payDate) : new Date();
    lateMonths = Math.min(monthsLate(parseISODate(input.dueDate), pay), r.lateMaxMonths);
  }
  const pkbPenalty = ((pkb + opsen) * r.lateRatePctPerMonth * lateMonths) / 100;
  const swdklljPenalty = lateMonths > 0 ? r.swdklljLate * Math.ceil(lateMonths / 12) : 0;

  const stnkFee = input.fiveYear ? r.stnkFee : 0;
  const tnkbFee = input.fiveYear ? r.tnkbFee : 0;
  const total = pkb + opsen + r.swdkllj + stnkFee + tnkbFee + pkbPenalty + swdklljPenalty;

  return {
    pkb: Math.round(pkb),
    opsen: Math.round(opsen),
    swdkllj: r.swdkllj,
    stnkFee,
    tnkbFee,
    lateMonths,
    pkbPenalty: Math.round(pkbPenalty),
    swdklljPenalty,
    total: Math.round(total),
  };
}

export interface DueInfo {
  date: string;
  daysLeft: number;
  level: 'good' | 'warning' | 'overdue';
}

export function dueInfo(date: string | undefined, now = new Date(), warnDays = 30): DueInfo | null {
  if (!date) return null;
  const daysLeft = diffDays(now, parseISODate(date));
  return {
    date,
    daysLeft,
    level: daysLeft < 0 ? 'overdue' : daysLeft <= warnDays ? 'warning' : 'good',
  };
}

/** Apakah pembayaran tahunan berikutnya sekaligus 5 tahunan? */
export function isFiveYearDue(taxDue?: string, stnkExpiry?: string): boolean {
  if (!taxDue || !stnkExpiry) return false;
  return Math.abs(diffDays(parseISODate(taxDue), parseISODate(stnkExpiry))) <= 31;
}

/** Tanggal jatuh tempo berikutnya setelah dibayar (maju 1 atau 5 tahun). */
export function nextDue(date: string, years: number): string {
  return toISODate(addYears(parseISODate(date), years));
}
