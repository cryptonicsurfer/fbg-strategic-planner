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
// AI-generated activity types
// ============================================

export interface GeneratedActivity {
  title: string;
  description: string | null;
  suggested_focus_area: string;       // Name suggested by AI
  matched_focus_area_id: string | null;  // Matched UUID or null
  matched_focus_area_name: string | null; // Matched name
  confidence: number;                 // 0-1 matching confidence
  start_date: string | null;          // YYYY-MM-DD
  end_date: string | null;
  weeks: number[];
  responsible: string | null;
  purpose: string | null;
  theme: string | null;
  target_group: string | null;
  status: ActivityStatus;
  needs_review: boolean;              // True if confidence < 0.8
  review_reason?: string;             // Why manual review needed
}

export interface GenerateActivitiesResponse {
  activities: GeneratedActivity[];
  parsing_notes: string[];
}

export interface EditActivityResponse {
  original: Activity;
  modified: Activity;
  changes: string[];
}

export interface BatchCreateResponse {
  created: Activity[];
  failed: { index: number; error: string }[];
  skipped?: { index: number; title: string; reason: string }[];
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
