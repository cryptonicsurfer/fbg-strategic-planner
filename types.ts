// ============================================
// New unified data model
// ============================================

export interface StrategicConcept {
  id: string;
  name: string;
  description: string | null;
  is_time_based: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  focus_areas?: FocusArea[];
}

export interface FocusArea {
  id: string;
  concept_id: string;
  name: string;
  color: string;
  start_month: number | null;  // 0-11, nullable for theme-based
  end_month: number | null;    // 0-11, nullable for theme-based
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export type ActivityStatus = 'ongoing' | 'decided' | 'completed';

export interface Activity {
  id: string;
  focus_area_id: string;
  title: string;
  description: string | null;
  start_date: string | null;  // YYYY-MM-DD
  end_date: string | null;    // YYYY-MM-DD
  responsible: string | null;
  purpose: string | null;     // Information/Dialog, Utbildning, Mässa, Workshop
  theme: string | null;       // Bransch, Tema, Utveckling
  target_group: string | null;
  status: ActivityStatus;
  weeks: number[];            // Week numbers 1-52
  created_at?: string;
  updated_at?: string;
  // Joined fields from queries
  focus_area_name?: string;
  focus_area_color?: string;
  concept_id?: string;
  concept_name?: string;
}

// ============================================
// View and UI types
// ============================================

export type ViewMode = 'wheel' | 'timeline' | 'spreadsheet';

export interface MonthDef {
  index: number;      // 0-11
  name: string;
  shortName: string;
  startWeek: number;  // 1-52
  endWeek: number;    // 1-52
}

// ============================================
// Auth types
// ============================================

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}

// ============================================
// Legacy types (for backward compatibility)
// ============================================

/** @deprecated Use Activity instead */
export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  monthIndex: number;
  year: number;
}

/** @deprecated Use FocusArea instead */
export interface TertialDef {
  id: number;
  name: string;
  color: string;
  startMonth: number;
  endMonth: number;
}
