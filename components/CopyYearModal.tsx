import React, { useState, useEffect, useMemo } from 'react';
import { Activity, FocusArea, StrategicConcept } from '../types';
import { activitiesApi } from '../api/client';

interface CopyYearModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetYear: number;
  concepts: StrategicConcept[];
  focusAreas: FocusArea[];
  onCopyComplete: () => void;
}

const CopyYearModal: React.FC<CopyYearModalProps> = ({
  isOpen,
  onClose,
  targetYear,
  concepts,
  focusAreas,
  onCopyComplete,
}) => {
  const [sourceYear, setSourceYear] = useState(targetYear - 1);
  const [sourceActivities, setSourceActivities] = useState<Activity[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  // Load activities from source year
  useEffect(() => {
    if (!isOpen) return;

    const loadSourceActivities = async () => {
      setIsLoading(true);
      try {
        const activities = await activitiesApi.getAll({ year: sourceYear });
        setSourceActivities(activities);
        // Select all by default
        setSelectedActivityIds(new Set(activities.map(a => a.id)));
      } catch (err) {
        console.error('Failed to load source activities:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSourceActivities();
  }, [isOpen, sourceYear]);

  // Group activities by focus area
  const activitiesByFocusArea = useMemo(() => {
    const map = new Map<string, Activity[]>();
    sourceActivities.forEach(activity => {
      const list = map.get(activity.focus_area_id) || [];
      list.push(activity);
      map.set(activity.focus_area_id, list);
    });
    return map;
  }, [sourceActivities]);

  // Toggle single activity
  const toggleActivity = (id: string) => {
    setSelectedActivityIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle all activities in a focus area
  const toggleFocusArea = (focusAreaId: string) => {
    const faActivities = activitiesByFocusArea.get(focusAreaId) || [];
    const allSelected = faActivities.every(a => selectedActivityIds.has(a.id));

    setSelectedActivityIds(prev => {
      const next = new Set(prev);
      faActivities.forEach(a => {
        if (allSelected) {
          next.delete(a.id);
        } else {
          next.add(a.id);
        }
      });
      return next;
    });
  };

  // Select/deselect all
  const toggleAll = () => {
    if (selectedActivityIds.size === sourceActivities.length) {
      setSelectedActivityIds(new Set());
    } else {
      setSelectedActivityIds(new Set(sourceActivities.map(a => a.id)));
    }
  };

  // Handle copy
  const handleCopy = async () => {
    if (selectedActivityIds.size === 0) return;

    setIsCopying(true);
    try {
      const activitiesToCopy = sourceActivities.filter(a => selectedActivityIds.has(a.id));

      // Copy each activity to target year
      for (const activity of activitiesToCopy) {
        const { id, ...data } = activity;

        // Adjust dates to target year
        let newStartDate = data.start_date;
        let newEndDate = data.end_date;

        if (newStartDate) {
          const date = new Date(newStartDate);
          date.setFullYear(targetYear);
          newStartDate = date.toISOString().split('T')[0];
        }

        if (newEndDate) {
          const date = new Date(newEndDate);
          date.setFullYear(targetYear);
          newEndDate = date.toISOString().split('T')[0];
        }

        await activitiesApi.create({
          ...data,
          start_date: newStartDate,
          end_date: newEndDate,
          status: 'ongoing', // Reset status for new year
        });
      }

      onCopyComplete();
      onClose();
    } catch (err) {
      console.error('Failed to copy activities:', err);
      alert('Kunde inte kopiera aktiviteter. Försök igen.');
    } finally {
      setIsCopying(false);
    }
  };

  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i).filter(y => y !== targetYear);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Kopiera aktiviteter till {targetYear}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Välj vilka aktiviteter du vill kopiera från ett annat år
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Source year selector */}
          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Kopiera från:</label>
            <select
              value={sourceYear}
              onChange={(e) => setSourceYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <span className="text-gray-400">→</span>
            <span className="font-semibold text-gray-900 dark:text-white">{targetYear}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
            </div>
          ) : sourceActivities.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              Inga aktiviteter hittades för {sourceYear}
            </div>
          ) : (
            <>
              {/* Select all toggle */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <input
                    type="checkbox"
                    checked={selectedActivityIds.size === sourceActivities.length}
                    onChange={toggleAll}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                  />
                  Välj alla ({sourceActivities.length} aktiviteter)
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedActivityIds.size} valda
                </span>
              </div>

              {/* Activities grouped by focus area */}
              <div className="space-y-4">
                {focusAreas.map(focusArea => {
                  const faActivities = activitiesByFocusArea.get(focusArea.id) || [];
                  if (faActivities.length === 0) return null;

                  const allSelected = faActivities.every(a => selectedActivityIds.has(a.id));
                  const someSelected = faActivities.some(a => selectedActivityIds.has(a.id));

                  return (
                    <div key={focusArea.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      {/* Focus area header */}
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        style={{ backgroundColor: focusArea.color + '15' }}
                        onClick={() => toggleFocusArea(focusArea.id)}
                      >
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={() => toggleFocusArea(focusArea.id)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        />
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: focusArea.color }}
                        />
                        <span className="font-medium text-gray-800 dark:text-white">{focusArea.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">({faActivities.length})</span>
                      </div>

                      {/* Activities */}
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {faActivities.map(activity => (
                          <label
                            key={activity.id}
                            className="flex items-center gap-3 p-3 pl-10 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
                          >
                            <input
                              type="checkbox"
                              checked={selectedActivityIds.has(activity.id)}
                              onChange={() => toggleActivity(activity.id)}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                {activity.title}
                              </div>
                              {activity.start_date && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(activity.start_date).toLocaleDateString('sv-SE')}
                                  {activity.weeks.length > 0 && ` (v${activity.weeks[0]}${activity.weeks.length > 1 ? `-${activity.weeks[activity.weeks.length - 1]}` : ''})`}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleCopy}
            disabled={selectedActivityIds.size === 0 || isCopying}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-all"
          >
            {isCopying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Kopierar...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Kopiera {selectedActivityIds.size} aktiviteter
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CopyYearModal;
