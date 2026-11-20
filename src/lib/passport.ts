// Template HTML untuk Vehicle Passport (dicetak ke PDF oleh expo-print).
import type { ServiceRecord, Vehicle, VehicleDocument } from '../types';
import type { ComponentStatus } from './lifespan';
import { componentLabel } from './lifespan';
import { dateID, km, rupiah, thousands } from './format';
import { dueInfo } from './tax';

export interface PassportData {
  vehicle: Vehicle;
  odometerKm: number;
  health: ComponentStatus[];
  healthScore: number;
  records: ServiceRecord[];
  docs: VehicleDocument[];
  tripCount: number;
  tripKm: number;
  generatedAt: string;
  passportId: string;
}

const esc = (s: string | number | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const DOC_LABEL: Record<string, string> = {
  stnk: 'STNK',
  bpkb: 'BPKB',
  nota: 'Nota servis',
  sim: 'SIM',
  asuransi: 'Polis asuransi',
  lainnya: 'Lainnya',
};

function badge(level: string) {
  const map: Record<string, [string, string]> = {
    good: ['#DCFCE7', '#166534'],
    warning: ['#FEF3C7', '#92400E'],
    overdue: ['#FEE2E2', '#991B1B'],
  };
  const text: Record<string, string> = { good: 'Baik', warning: 'Segera', overdue: 'Lewat' };
  const [bg, fg] = map[level] ?? map.good;
  return `<span class="badge" style="background:${bg};color:${fg}">${text[level] ?? level}</span>`;
}

export function buildPassportHtml(d: PassportData): string {
  const v = d.vehicle;
  const tax = dueInfo(v.taxDueDate);
  const stnk = dueInfo(v.stnkExpiryDate);
  const records = [...d.records].sort((a, b) => b.date.localeCompare(a.date));
  const totalSpent = records.reduce((s, r) => s + r.totalCost, 0);

  const legalRow = (label: string, info: ReturnType<typeof dueInfo>) =>
    `<tr><td>${label}</td><td>${info ? dateID(info.date) : '-'}</td><td>${
      info ? badge(info.level === 'overdue' ? 'overdue' : 'good') : '-'
    }</td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  @page { margin: 28px; }
  body { font-family: -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif; color:#0F172A; font-size:11px; }
  .head { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #F97316; padding-bottom:10px; }
  h1 { font-size:22px; margin:0; letter-spacing:.5px; }
  h2 { font-size:13px; margin:20px 0 8px; text-transform:uppercase; letter-spacing:1px; color:#334155; }
  .muted { color:#64748B; }
  .grid { display:flex; gap:10px; margin-top:12px; }
  .box { flex:1; border:1px solid #E2E8F0; border-radius:8px; padding:10px; }
  .box .v { font-size:16px; font-weight:700; margin-top:2px; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; font-size:10px; text-transform:uppercase; color:#64748B; border-bottom:1px solid #CBD5E1; padding:6px 4px; }
  td { border-bottom:1px solid #F1F5F9; padding:6px 4px; vertical-align:top; }
  .badge { padding:2px 8px; border-radius:999px; font-size:10px; font-weight:600; }
  .foot { margin-top:24px; font-size:9px; color:#94A3B8; border-top:1px solid #E2E8F0; padding-top:8px; }
</style></head><body>
<div class="head">
  <div>
    <div class="muted">VEHICLE PASSPORT · VELIQ</div>
    <h1>${esc(v.name)}</h1>
    <div style="font-size:14px;font-weight:600;margin-top:2px">${esc(v.plate)} · ${v.type === 'motor' ? 'Sepeda Motor' : 'Mobil'}${v.year ? ' · ' + v.year : ''}</div>
  </div>
  <div style="text-align:right" class="muted">ID Paspor<br/><b style="color:#0F172A;font-size:12px">${esc(d.passportId)}</b><br/>Dibuat ${dateID(d.generatedAt)}</div>
</div>

<div class="grid">
  <div class="box"><div class="muted">Odometer</div><div class="v">${km(d.odometerKm)}</div></div>
  <div class="box"><div class="muted">Skor kesehatan</div><div class="v">${d.healthScore}/100</div></div>
  <div class="box"><div class="muted">Riwayat servis</div><div class="v">${records.length} kali</div></div>
  <div class="box"><div class="muted">Total biaya servis</div><div class="v">${rupiah(totalSpent)}</div></div>
</div>

<h2>Status Legalitas</h2>
<table><tr><th>Dokumen</th><th>Berlaku s.d.</th><th>Status</th></tr>
${legalRow('Pajak tahunan (STNK)', tax)}
${legalRow('STNK & plat 5 tahunan', stnk)}
</table>

<h2>Kondisi Komponen</h2>
<table><tr><th>Komponen</th><th>Terakhir diganti</th><th>Sisa</th><th>Kesehatan</th><th>Status</th></tr>
${d.health
  .map(
    (c) => `<tr><td>${esc(c.label)}</td><td>${dateID(c.lastDate)} · ${km(c.lastKm)}</td><td>${
      c.remainingKm != null ? km(Math.max(0, c.remainingKm)) + ' / ' : ''
    }${c.remainingDays != null ? Math.max(0, c.remainingDays) + ' hari' : ''}</td><td>${c.health}%</td><td>${badge(c.level)}</td></tr>`,
  )
  .join('')}
</table>

<h2>Riwayat Servis</h2>
${
  records.length
    ? `<table><tr><th>Tanggal</th><th>Odometer</th><th>Pekerjaan</th><th>Bengkel</th><th style="text-align:right">Biaya</th></tr>
${records
  .map(
    (r) => `<tr><td>${dateID(r.date)}</td><td>${km(r.odometerKm)}</td><td>${esc(
      r.items.map((i) => i.label || componentLabel(i.component)).join(', '),
    )}${r.notes ? `<div class="muted">${esc(r.notes)}</div>` : ''}</td><td>${esc(r.workshop || '-')}</td><td style="text-align:right">${rupiah(
      r.totalCost,
    )}</td></tr>`,
  )
  .join('')}</table>`
    : '<div class="muted">Belum ada catatan servis.</div>'
}

<h2>Pemakaian & Dokumen</h2>
<table>
<tr><td style="width:40%">Perjalanan terekam GPS</td><td>${d.tripCount} perjalanan · ${thousands(d.tripKm, 1)} km</td></tr>
<tr><td>Dokumen digital tersimpan</td><td>${
    d.docs.length ? esc(d.docs.map((x) => `${DOC_LABEL[x.kind] ?? x.kind} (${dateID(x.createdAt)})`).join(', ')) : '-'
  }</td></tr>
</table>

<div class="foot">Dokumen ini dibuat otomatis oleh aplikasi VELIQ dari data yang dicatat pemilik kendaraan.
Foto dokumen identitas tidak disertakan demi privasi. ID Paspor adalah sidik SHA-256 dari isi ringkasan.</div>
</body></html>`;
}
