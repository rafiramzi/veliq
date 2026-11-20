export const colors = {
  bg: '#F1F5F9',
  card: '#FFFFFF',
  border: '#E2E8F0',
  ink: '#0F172A',
  ink2: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',
  navy: '#0F172A',
  navy2: '#1E293B',
  accent: '#F97316',
  accentSoft: '#FFEDD5',
  good: '#16A34A',
  goodSoft: '#DCFCE7',
  warn: '#D97706',
  warnSoft: '#FEF3C7',
  bad: '#DC2626',
  badSoft: '#FEE2E2',
  info: '#2563EB',
  infoSoft: '#DBEAFE',
};

export const levelColor = (level: 'good' | 'warning' | 'overdue' | string) =>
  level === 'overdue' ? colors.bad : level === 'warning' ? colors.warn : colors.good;

export const levelSoft = (level: 'good' | 'warning' | 'overdue' | string) =>
  level === 'overdue' ? colors.badSoft : level === 'warning' ? colors.warnSoft : colors.goodSoft;

export const levelText = (level: string) => (level === 'overdue' ? 'Lewat' : level === 'warning' ? 'Segera' : 'Baik');

export const radius = { sm: 8, md: 12, lg: 16, xl: 24 };
