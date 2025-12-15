import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Activity, FocusArea, StrategicConcept } from '../types';
import { MONTHS, getMonthFromWeek, STATUS_LABELS } from '../constants';

interface TimelineProps {
  year: number;
  activities: Activity[];
  focusAreas: FocusArea[];
  concepts?: StrategicConcept[];
  onActivityClick: (activity: Activity) => void;
}

// Week definitions for the year
const WEEKS = Array.from({ length: 52 }, (_, i) => i + 1);

// Get week number from date
const getWeekNumber = (date: Date): number => {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  const oneWeek = 604800000;
  return Math.ceil((diff / oneWeek) + start.getDay() / 7);
};

// Get which weeks belong to which month
const getMonthWeeks = (year: number) => {
  const monthWeeks: { month: number; weeks: number[] }[] = [];

  for (let month = 0; month < 12; month++) {
    const weeks: number[] = [];
    // Get first and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startWeek = getWeekNumber(firstDay);
    const endWeek = getWeekNumber(lastDay);

    for (let w = startWeek; w <= endWeek && w <= 52; w++) {
      if (!weeks.includes(w)) weeks.push(w);
    }

    monthWeeks.push({ month, weeks });
  }

  return monthWeeks;
};

interface TooltipData {
  activity: Activity;
  x: number;
  y: number;
}

const Timeline: React.FC<TimelineProps> = ({ year, activities, focusAreas, concepts, onActivityClick }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const monthWeeks = useMemo(() => getMonthWeeks(year), [year]);

  // Group focus areas by concept
  const focusAreasByConceptId = useMemo(() => {
    const map = new Map<string, FocusArea[]>();
    focusAreas.forEach(fa => {
      const list = map.get(fa.concept_id) || [];
      list.push(fa);
      map.set(fa.concept_id, list);
    });
    return map;
  }, [focusAreas]);

  // Check if weeks are consecutive
  const areWeeksConsecutive = (weeks: number[]): boolean => {
    if (weeks.length <= 1) return true;
    const sorted = [...weeks].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > 1) return false;
    }
    return true;
  };

  // Get activity segments (for non-consecutive weeks, return multiple segments)
  const getActivitySegments = (activity: Activity): { startWeek: number; endWeek: number }[] => {
    if (activity.weeks.length > 0) {
      // Check if weeks are consecutive
      if (areWeeksConsecutive(activity.weeks)) {
        const startWeek = Math.min(...activity.weeks);
        const endWeek = Math.max(...activity.weeks);
        return [{ startWeek, endWeek }];
      } else {
        // Non-consecutive weeks - return individual segments
        return activity.weeks.map(week => ({ startWeek: week, endWeek: week }));
      }
    } else if (activity.start_date) {
      const startDate = new Date(activity.start_date);
      const startWeek = getWeekNumber(startDate);
      let endWeek = startWeek;

      if (activity.end_date) {
        const endDate = new Date(activity.end_date);
        endWeek = getWeekNumber(endDate);
      }

      return [{ startWeek, endWeek }];
    }

    return [{ startWeek: 1, endWeek: 1 }];
  };

  // Get the overall bounds for row assignment purposes
  const getActivityBounds = (activity: Activity) => {
    const segments = getActivitySegments(activity);
    const startWeek = Math.min(...segments.map(s => s.startWeek));
    const endWeek = Math.max(...segments.map(s => s.endWeek));
    return { startWeek, endWeek };
  };

  // Get activities for a focus area
  const getActivitiesForFocusArea = (focusAreaId: string) => {
    return activities
      .filter(a => a.focus_area_id === focusAreaId)
      .sort((a, b) => {
        const boundsA = getActivityBounds(a);
        const boundsB = getActivityBounds(b);
        return boundsA.startWeek - boundsB.startWeek;
      });
  };

  // Calculate row assignments to avoid overlaps
  const getRowAssignments = (focusAreaActivities: Activity[]) => {
    const rows: { endWeek: number }[] = [];
    const assignments = new Map<string, number>();

    focusAreaActivities.forEach(activity => {
      const { startWeek, endWeek } = getActivityBounds(activity);

      // Find first available row
      let rowIndex = rows.findIndex(row => row.endWeek < startWeek);

      if (rowIndex === -1) {
        rowIndex = rows.length;
        rows.push({ endWeek });
      } else {
        rows[rowIndex].endWeek = endWeek;
      }

      assignments.set(activity.id, rowIndex);
    });

    return { assignments, rowCount: Math.max(rows.length, 1) };
  };

  const WEEK_WIDTH = 28;
  const ROW_HEIGHT = 32;
  const HEADER_HEIGHT = 60;

  // Scroll to current week on mount
  useEffect(() => {
    if (containerRef.current) {
      const currentWeek = getWeekNumber(new Date());
      const scrollPosition = (currentWeek - 4) * WEEK_WIDTH;
      containerRef.current.scrollLeft = Math.max(0, scrollPosition);
    }
  }, []);

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Year Header */}
      <div className="px-6 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">{year}</h2>
        <div className="text-xs text-gray-500">
          Vecka 1-52 • Scrolla horisontellt
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Focus Areas */}
        <div className="w-48 flex-shrink-0 border-r border-gray-200 bg-gray-50/50">
          {/* Empty header space */}
          <div style={{ height: HEADER_HEIGHT }} className="border-b border-gray-200" />

          {/* Focus area labels */}
          {focusAreas.map((fa) => {
            const faActivities = getActivitiesForFocusArea(fa.id);
            const { rowCount } = getRowAssignments(faActivities);
            const height = Math.max(rowCount * ROW_HEIGHT + 16, 60);

            return (
              <div
                key={fa.id}
                className="border-b border-gray-100 px-3 py-2 flex items-center gap-2"
                style={{ height }}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: fa.color }}
                />
                <span className="text-sm font-medium text-gray-700 truncate">
                  {fa.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Main timeline grid */}
        <div ref={containerRef} className="flex-1 overflow-x-auto overflow-y-auto">
          <div style={{ width: WEEKS.length * WEEK_WIDTH, minHeight: '100%' }}>
            {/* Header: Months and Weeks */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200" style={{ height: HEADER_HEIGHT }}>
              {/* Month row */}
              <div className="flex h-8 border-b border-gray-100">
                {monthWeeks.map(({ month, weeks }) => (
                  <div
                    key={month}
                    className="flex items-center justify-center text-xs font-semibold text-gray-600 uppercase tracking-wide border-r border-gray-100"
                    style={{ width: weeks.length * WEEK_WIDTH }}
                  >
                    {MONTHS[month].name}
                  </div>
                ))}
              </div>

              {/* Week row */}
              <div className="flex h-7">
                {WEEKS.map((week) => {
                  const isCurrentWeek = week === getWeekNumber(new Date());
                  const isHovered = week === hoveredWeek;

                  return (
                    <div
                      key={week}
                      className={`flex items-center justify-center text-[10px] border-r border-gray-50 transition-colors ${
                        isCurrentWeek
                          ? 'bg-blue-500 text-white font-bold'
                          : isHovered
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-400'
                      }`}
                      style={{ width: WEEK_WIDTH }}
                      onMouseEnter={() => setHoveredWeek(week)}
                      onMouseLeave={() => setHoveredWeek(null)}
                    >
                      {week}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Activity rows by focus area */}
            {focusAreas.map((fa) => {
              const faActivities = getActivitiesForFocusArea(fa.id);
              const { assignments, rowCount } = getRowAssignments(faActivities);
              const height = Math.max(rowCount * ROW_HEIGHT + 16, 60);

              return (
                <div
                  key={fa.id}
                  className="relative border-b border-gray-100"
                  style={{ height }}
                >
                  {/* Week grid lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {WEEKS.map((week) => {
                      const isCurrentWeek = week === getWeekNumber(new Date());
                      return (
                        <div
                          key={week}
                          className={`border-r ${
                            week % 4 === 0
                              ? 'border-gray-200'
                              : 'border-gray-50'
                          } ${isCurrentWeek ? 'bg-blue-50/30' : ''}`}
                          style={{ width: WEEK_WIDTH }}
                        />
                      );
                    })}
                  </div>

                  {/* Activity bars */}
                  {faActivities.map((activity) => {
                    const segments = getActivitySegments(activity);
                    const rowIndex = assignments.get(activity.id) || 0;
                    const top = 8 + rowIndex * ROW_HEIGHT;
                    const isMultiSegment = segments.length > 1;

                    return (
                      <React.Fragment key={activity.id}>
                        {/* Connecting line for multi-segment activities */}
                        {isMultiSegment && (
                          <div
                            className="absolute pointer-events-none"
                            style={{
                              left: (segments[0].startWeek - 1) * WEEK_WIDTH + WEEK_WIDTH / 2,
                              top: top + (ROW_HEIGHT - 6) / 2 - 1,
                              width: (segments[segments.length - 1].endWeek - segments[0].startWeek) * WEEK_WIDTH,
                              height: 2,
                              backgroundColor: fa.color,
                              opacity: 0.3,
                            }}
                          />
                        )}

                        {/* Segments */}
                        {segments.map((segment, segIndex) => {
                          const left = (segment.startWeek - 1) * WEEK_WIDTH;
                          const width = Math.max((segment.endWeek - segment.startWeek + 1) * WEEK_WIDTH - 4, WEEK_WIDTH - 4);
                          const isFirstSegment = segIndex === 0;

                          return (
                            <div
                              key={`${activity.id}-${segment.startWeek}`}
                              className="absolute cursor-pointer group"
                              style={{
                                left: left + 2,
                                top,
                                width,
                                height: ROW_HEIGHT - 6,
                              }}
                              onClick={() => onActivityClick(activity)}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setTooltip({
                                  activity,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                });
                              }}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              <div
                                className={`h-full px-1.5 flex items-center gap-1 text-white text-xs font-medium shadow-sm group-hover:shadow-md transition-shadow overflow-hidden ${
                                  isMultiSegment ? 'rounded-full' : 'rounded-md'
                                }`}
                                style={{ backgroundColor: fa.color }}
                              >
                                {isFirstSegment && !isMultiSegment && (
                                  <span className="truncate">
                                    {activity.title}
                                  </span>
                                )}
                                {isFirstSegment && isMultiSegment && (
                                  <span className="truncate text-[10px]">
                                    {activity.title.length > 15
                                      ? activity.title.substring(0, 1).toUpperCase()
                                      : activity.title}
                                  </span>
                                )}
                                {!isFirstSegment && isMultiSegment && (
                                  <span className="text-[10px]">
                                    {activity.title.substring(0, 1).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 max-w-xs pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 10,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold text-gray-900 mb-1">{tooltip.activity.title}</div>
          {tooltip.activity.description && (
            <div className="text-xs text-gray-600 mb-2">{tooltip.activity.description}</div>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            {tooltip.activity.start_date && (
              <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                {new Date(tooltip.activity.start_date).toLocaleDateString('sv-SE')}
                {tooltip.activity.end_date && tooltip.activity.end_date !== tooltip.activity.start_date && (
                  <> → {new Date(tooltip.activity.end_date).toLocaleDateString('sv-SE')}</>
                )}
              </span>
            )}
            {tooltip.activity.weeks.length > 0 && (
              <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                v{tooltip.activity.weeks.join(', ')}
              </span>
            )}
            <span className="bg-blue-100 px-2 py-0.5 rounded text-blue-700">
              {STATUS_LABELS[tooltip.activity.status] || tooltip.activity.status}
            </span>
          </div>
          {tooltip.activity.responsible && (
            <div className="text-xs text-gray-500 mt-2">
              Ansvarig: {tooltip.activity.responsible}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Timeline;
