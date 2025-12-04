import { MonthDef, TertialDef, CalendarEvent } from './types';

// ============================================
// Month definitions with week numbers
// ============================================

export const MONTHS: MonthDef[] = [
  { index: 0, name: "Januari", shortName: "Jan", startWeek: 1, endWeek: 5 },
  { index: 1, name: "Februari", shortName: "Feb", startWeek: 6, endWeek: 9 },
  { index: 2, name: "Mars", shortName: "Mar", startWeek: 10, endWeek: 13 },
  { index: 3, name: "April", shortName: "Apr", startWeek: 14, endWeek: 18 },
  { index: 4, name: "Maj", shortName: "Maj", startWeek: 19, endWeek: 22 },
  { index: 5, name: "Juni", shortName: "Jun", startWeek: 23, endWeek: 26 },
  { index: 6, name: "Juli", shortName: "Jul", startWeek: 27, endWeek: 30 },
  { index: 7, name: "Augusti", shortName: "Aug", startWeek: 31, endWeek: 35 },
  { index: 8, name: "September", shortName: "Sep", startWeek: 36, endWeek: 39 },
  { index: 9, name: "Oktober", shortName: "Okt", startWeek: 40, endWeek: 44 },
  { index: 10, name: "November", shortName: "Nov", startWeek: 45, endWeek: 48 },
  { index: 11, name: "December", shortName: "Dec", startWeek: 49, endWeek: 52 },
];

// ============================================
// Purpose/Syfte options
// ============================================

export const PURPOSE_OPTIONS = [
  'Information/Dialog',
  'Utbildning',
  'Mässa',
  'Workshop',
  'Nätverkande',
  'Planering',
];

// ============================================
// Theme/Tema options
// ============================================

export const THEME_OPTIONS = [
  'Bransch',
  'Tema',
  'Utveckling',
  'Strategi',
];

// ============================================
// Status labels
// ============================================

export const STATUS_LABELS = {
  ongoing: 'Pågående',
  decided: 'Beslutad',
  completed: 'Genomförd',
} as const;

export const STATUS_COLORS = {
  ongoing: '#F59E0B',    // Amber
  decided: '#3B82F6',    // Blue
  completed: '#10B981',  // Emerald
} as const;

// ============================================
// Utility functions
// ============================================

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getMonthFromWeek(week: number): number {
  const month = MONTHS.find(m => week >= m.startWeek && week <= m.endWeek);
  return month?.index ?? 0;
}

// ============================================
// Legacy exports (deprecated)
// ============================================

/** @deprecated Use focus_areas from API instead */
export const TERTIALS: TertialDef[] = [
  { id: 1, name: "Service & Kompetens", color: "#93C5FD", startMonth: 0, endMonth: 3 },
  { id: 2, name: "Platsutveckling", color: "#86EFAC", startMonth: 4, endMonth: 7 },
  { id: 3, name: "Etablering & Innovation", color: "#FCA5A5", startMonth: 8, endMonth: 11 },
];

/** @deprecated Use activities from API instead */
const currentYear = new Date().getFullYear();

export const INITIAL_EVENTS: CalendarEvent[] = [
  { id: '1', title: 'Strategidagar', description: 'Årlig genomgång av verksamhetsplanen.', date: `${currentYear}-01-15`, monthIndex: 0, year: currentYear },
  { id: '2', title: 'Kompetensmässa', description: 'Mässa för rekrytering och utbildning.', date: `${currentYear}-03-10`, monthIndex: 2, year: currentYear },
  { id: '3', title: 'Sommarinvigning', description: 'Startskott för sommarsäsongen i centrum.', date: `${currentYear}-06-01`, monthIndex: 5, year: currentYear },
  { id: '4', title: 'Business Arena Stockholm', description: 'Fastighetsbranschens ledande mötesplats.', date: `${currentYear}-10-16`, monthIndex: 9, year: currentYear },
  { id: '5', title: 'Julmarknad', description: 'Planering och genomförande av torgets marknad.', date: `${currentYear}-12-05`, monthIndex: 11, year: currentYear },
];
