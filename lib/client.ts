import {
  StrategicConcept,
  FocusArea,
  Activity,
  User,
  GenerateActivitiesResponse,
  EditActivityResponse,
  BatchCreateResponse,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }

  return response.json();
}

// ============================================
// Auth API
// ============================================

export const authApi = {
  login: (email: string, password: string) =>
    request<{ success: boolean; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  check: () =>
    request<{ authenticated: boolean; user?: User; canRefresh?: boolean }>('/auth/check'),

  refresh: () =>
    request<{ success: boolean }>('/auth/refresh', { method: 'POST' }),
};

// ============================================
// Concepts API
// ============================================

export const conceptsApi = {
  getAll: () =>
    request<StrategicConcept[]>('/concepts'),

  getById: (id: string) =>
    request<StrategicConcept & { focus_areas: FocusArea[] }>(`/concepts/${id}`),

  getFocusAreas: (conceptId: string) =>
    request<FocusArea[]>(`/concepts/${conceptId}/focus-areas`),

  create: (data: Partial<StrategicConcept>) =>
    request<StrategicConcept>('/concepts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<StrategicConcept>) =>
    request<StrategicConcept>(`/concepts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/concepts/${id}`, { method: 'DELETE' }),

  createFocusArea: (conceptId: string, data: Partial<FocusArea>) =>
    request<FocusArea>(`/concepts/${conceptId}/focus-areas`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============================================
// Activities API
// ============================================

interface ActivityFilters {
  concept_id?: string;
  focus_area_id?: string;
  status?: string;
  year?: number;
}

export const activitiesApi = {
  getAll: (filters?: ActivityFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return request<Activity[]>(`/activities${query ? `?${query}` : ''}`);
  },

  getById: (id: string) =>
    request<Activity>(`/activities/${id}`),

  create: (data: Partial<Activity>) =>
    request<Activity>('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Activity>) =>
    request<Activity>(`/activities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/activities/${id}`, { method: 'DELETE' }),

  batchCreate: (activities: Partial<Activity>[]) =>
    request<BatchCreateResponse>('/activities/batch', {
      method: 'POST',
      body: JSON.stringify({ activities }),
    }),
};

// ============================================
// AI API
// ============================================

interface AIReportRequest {
  prompt: string;
  conceptId?: string | null;
  year?: number;
}

interface GenerateActivitiesRequest {
  description: string;
  conceptId?: string | null;
  year: number;
  images?: File[];
}

interface EditActivityRequest {
  activityId: string;
  instruction: string;
}

export const aiApi = {
  generateReport: (data: AIReportRequest) =>
    request<{ report: string }>('/ai/report', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  generateActivities: async (data: GenerateActivitiesRequest) => {
    // Use FormData if images are included
    if (data.images && data.images.length > 0) {
      const formData = new FormData();
      formData.append('description', data.description);
      formData.append('year', String(data.year));
      if (data.conceptId) formData.append('conceptId', data.conceptId);
      data.images.forEach((img, i) => {
        formData.append('images', img);
      });

      const response = await fetch(`${API_BASE}/ai/generate-activities`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new ApiError(response.status, error.error || 'Request failed');
      }

      return response.json() as Promise<GenerateActivitiesResponse>;
    }

    // Use JSON if no images
    return request<GenerateActivitiesResponse>('/ai/generate-activities', {
      method: 'POST',
      body: JSON.stringify({
        description: data.description,
        conceptId: data.conceptId,
        year: data.year,
      }),
    });
  },

  parseExcel: async (file: File, conceptId?: string | null, year?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    if (conceptId) formData.append('conceptId', conceptId);
    if (year) formData.append('year', String(year));

    const response = await fetch(`${API_BASE}/ai/parse-excel`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      const message = error.details
        ? `${error.error}: ${error.details}`
        : error.error || 'Request failed';
      throw new ApiError(response.status, message);
    }

    return response.json() as Promise<GenerateActivitiesResponse>;
  },

  editActivity: (data: EditActivityRequest) =>
    request<EditActivityResponse>('/ai/edit-activity', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ============================================
// Health check
// ============================================

export const healthCheck = () =>
  request<{ status: string; timestamp: string }>('/health');

export { ApiError };
