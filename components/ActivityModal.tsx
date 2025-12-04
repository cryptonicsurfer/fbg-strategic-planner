import React, { useState, useEffect } from 'react';
import { Activity, FocusArea, ActivityStatus } from '../types';
import { PURPOSE_OPTIONS, THEME_OPTIONS, STATUS_LABELS, getWeekNumber } from '../constants';

interface ActivityModalProps {
  activity: Activity | null;
  focusAreas: FocusArea[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (activity: Activity) => void;
  onDelete?: (id: string) => void;
}

const ActivityModal: React.FC<ActivityModalProps> = ({
  activity,
  focusAreas,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [formData, setFormData] = useState<Activity | null>(null);
  const [weeksInput, setWeeksInput] = useState('');

  useEffect(() => {
    if (activity) {
      setFormData({ ...activity });
      setWeeksInput(activity.weeks.join(', '));
    }
  }, [activity]);

  if (!isOpen || !formData) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => (prev ? { ...prev, [name]: value } : null));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (!prev) return null;
      const updated = { ...prev, [name]: value || null };

      // Auto-calculate weeks from dates
      // If only start_date, use just that week
      // If both dates, calculate range
      if (updated.start_date) {
        const start = new Date(updated.start_date);
        const startWeek = getWeekNumber(start);

        if (updated.end_date) {
          const end = new Date(updated.end_date);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
            const endWeek = getWeekNumber(end);
            const newWeeks: number[] = [];
            for (let w = startWeek; w <= endWeek; w++) {
              newWeeks.push(w);
            }
            updated.weeks = [...new Set(newWeeks)].sort((a, b) => a - b);
            setWeeksInput(updated.weeks.join(', '));
          }
        } else {
          // Only start date - single week
          updated.weeks = [startWeek];
          setWeeksInput(String(startWeek));
        }
      }
      return updated;
    });
  };

  const handleWeeksInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWeeksInput(e.target.value);
  };

  const parseWeeksInput = () => {
    // Parse weeks from input string - supports formats like "43, 44, 45" or "43-45" or "43,44,45"
    const val = weeksInput;
    const weeksSet = new Set<number>();

    // Split by comma or space
    const parts = val.split(/[,\s]+/).filter(Boolean);

    parts.forEach(part => {
      // Check for range like "43-45"
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(s => parseInt(s.trim()));
        if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= 52 && start <= end) {
          for (let w = start; w <= end; w++) {
            weeksSet.add(w);
          }
        }
      } else {
        const n = parseInt(part.trim());
        if (!isNaN(n) && n >= 1 && n <= 52) {
          weeksSet.add(n);
        }
      }
    });

    const weeksArr = Array.from(weeksSet).sort((a, b) => a - b);
    setFormData((prev) => (prev ? { ...prev, weeks: weeksArr } : null));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      // Parse weeks before saving
      parseWeeksInput();
      // Use updated formData after parsing
      const weeksSet = new Set<number>();
      const parts = weeksInput.split(/[,\s]+/).filter(Boolean);
      parts.forEach(part => {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(s => parseInt(s.trim()));
          if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= 52 && start <= end) {
            for (let w = start; w <= end; w++) weeksSet.add(w);
          }
        } else {
          const n = parseInt(part.trim());
          if (!isNaN(n) && n >= 1 && n <= 52) weeksSet.add(n);
        }
      });
      const weeks = Array.from(weeksSet).sort((a, b) => a - b);
      onSave({ ...formData, weeks });
    }
  };

  const handleDelete = () => {
    if (formData && onDelete && !formData.id.startsWith('new')) {
      if (confirm('Är du säker på att du vill ta bort denna aktivitet?')) {
        onDelete(formData.id);
        onClose();
      }
    }
  };

  const isNew = formData.id.startsWith('new');
  const selectedFocusArea = focusAreas.find((fa) => fa.id === formData.focus_area_id);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {isNew ? 'Skapa ny aktivitet' : 'Redigera aktivitet'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Uppdatera information, datum och status.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aktivitetsnamn *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fokusområde *
                </label>
                <select
                  name="focus_area_id"
                  value={formData.focus_area_id}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  {focusAreas.map((fa) => (
                    <option key={fa.id} value={fa.id}>
                      {fa.name}
                    </option>
                  ))}
                </select>
                {selectedFocusArea && (
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedFocusArea.color }}
                    />
                    <span className="text-xs text-gray-500">{selectedFocusArea.name}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ansvarig
                </label>
                <input
                  type="text"
                  name="responsible"
                  value={formData.responsible || ''}
                  onChange={handleChange}
                  placeholder="t.ex. MN"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Syfte
                </label>
                <select
                  name="purpose"
                  value={formData.purpose || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Välj syfte...</option>
                  {PURPOSE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tema
                </label>
                <select
                  name="theme"
                  value={formData.theme || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Välj tema...</option>
                  {THEME_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Målgrupp
                </label>
                <input
                  type="text"
                  name="target_group"
                  value={formData.target_group || ''}
                  onChange={handleChange}
                  placeholder="t.ex. Restauranger, Alla företag"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beskrivning
                </label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Date Section */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Tid & Datum
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Startdatum
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date || ''}
                  onChange={handleDateChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Slutdatum <span className="text-gray-400 font-normal">(valfritt)</span>
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date || ''}
                  onChange={handleDateChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">Lämna tomt för endagsevent</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Veckor (Manuellt)
                </label>
                <input
                  type="text"
                  name="weeks"
                  value={weeksInput}
                  onChange={handleWeeksInputChange}
                  onBlur={parseWeeksInput}
                  placeholder="t.ex. 12, 13, 14 eller 12-14"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">Separera med kommatecken eller använd intervall (12-14)</p>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-gray-100 mt-6">
            <div>
              {!isNew && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Ta bort
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Avbryt
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm text-sm font-medium transition-all transform active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Spara
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivityModal;
