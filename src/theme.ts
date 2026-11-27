// Tema gelap (hitam pekat + aksen biru), mengikuti desain layar login/onboarding.
export const colors = {
  bg: '#0A0B0D',
  card: '#1C1C1E',
  border: '#2C2C2E',
  ink: '#FFFFFF',
  ink2: '#D1D1D6',
  muted: '#8E8E93',
  faint: '#636366',
  navy: '#0C2038',
  navy2: '#12304F',
  accent: '#0A8CFF',
  accentSoft: '#0A2A4D',
  good: '#30D158',
  goodSoft: '#0F2E1B',
  warn: '#FF9F0A',
  warnSoft: '#33240A',
  bad: '#FF453A',
  badSoft: '#3A1512',
  info: '#64B5FF',
  infoSoft: '#0F2A47',
};

export const levelColor = (level: 'good' | 'warning' | 'overdue' | string) =>
  level === 'overdue' ? colors.bad : level === 'warning' ? colors.warn : colors.good;

export const levelSoft = (level: 'good' | 'warning' | 'overdue' | string) =>
  level === 'overdue' ? colors.badSoft : level === 'warning' ? colors.warnSoft : colors.goodSoft;

export const levelText = (level: string) => (level === 'overdue' ? 'Lewat' : level === 'warning' ? 'Segera' : 'Baik');

export const radius = { sm: 8, md: 12, lg: 16, xl: 24 };
