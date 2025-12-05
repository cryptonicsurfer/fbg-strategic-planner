import React, { useMemo } from 'react';
import { Activity, FocusArea } from '../types';
import { MONTHS, getMonthFromWeek } from '../constants';

interface TimelineProps {
  year: number;
  activities: Activity[];
  focusAreas: FocusArea[];
  onActivityClick: (activity: Activity) => void;
}

const Timeline: React.FC<TimelineProps> = ({ year, activities, focusAreas, onActivityClick }) => {
  // Determine if focus areas are time-based
  const isTimeBased = focusAreas.some(fa => fa.start_month !== null && fa.end_month !== null);

  // Create focus area groups with their months
  const focusAreaGroups = useMemo(() => {
    if (isTimeBased) {
      return focusAreas.map(fa => ({
        ...fa,
        startMonth: fa.start_month ?? 0,
        endMonth: fa.end_month ?? 11,
        months: MONTHS.filter(m => m.index >= (fa.start_month ?? 0) && m.index <= (fa.end_month ?? 11)),
      }));
    } else {
      // For theme-based, show all months under each focus area
      // Or distribute evenly
      const sliceSize = 12 / focusAreas.length;
      return focusAreas.map((fa, i) => ({
        ...fa,
        startMonth: Math.round(i * sliceSize),
        endMonth: Math.round((i + 1) * sliceSize) - 1,
        months: MONTHS.filter(
          m => m.index >= Math.round(i * sliceSize) && m.index <= Math.round((i + 1) * sliceSize) - 1
        ),
      }));
    }
  }, [focusAreas, isTimeBased]);

  // Get activities for a specific month and focus area
  const getActivitiesForMonth = (monthIndex: number, focusAreaId?: string) => {
    return activities.filter(a => {
      // Check if activity is in this month
      let activityMonth: number | null = null;

      if (a.start_date) {
        activityMonth = new Date(a.start_date).getMonth();
      } else if (a.weeks.length > 0) {
        activityMonth = getMonthFromWeek(a.weeks[0]);
      }

      if (activityMonth !== monthIndex) return false;

      // If filtering by focus area
      if (focusAreaId && a.focus_area_id !== focusAreaId) return false;

      return true;
    }).sort((a, b) => {
      const dateA = a.start_date || '';
      const dateB = b.start_date || '';
      return dateA.localeCompare(dateB);
    });
  };

  return (
    <div className="w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm backdrop-blur-sm">
      <div className="min-w-max h-full flex flex-col">
        {/* Header: Year */}
        <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky left-0 z-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{year}</h2>
        </div>

        {/* Main Content Grid */}
        <div className="flex flex-1">
          {focusAreaGroups.map((focusArea) => (
            <div key={focusArea.id} className="flex flex-col border-r border-gray-200 dark:border-gray-700 last:border-r-0">
              {/* Focus Area Header */}
              <div
                className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-center border-b border-gray-200/50 dark:border-gray-700/50"
                style={{ backgroundColor: `${focusArea.color}20`, color: '#374151' }}
              >
                <span className="dark:text-gray-200">{focusArea.name}</span>
              </div>

              {/* Months Container */}
              <div className="flex flex-1">
                {focusArea.months.map((month) => {
                  const monthActivities = getActivitiesForMonth(month.index, focusArea.id);
                  const isEven = month.index % 2 === 0;

                  return (
                    <div
                      key={month.index}
                      className={`w-32 md:w-40 flex flex-col border-r border-gray-100/50 dark:border-gray-700/50 last:border-r-0 ${
                        isEven ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/30 dark:bg-gray-700/30'
                      }`}
                    >
                      {/* Month Name */}
                      <div className="py-3 text-center border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">
                          {month.shortName}
                        </span>
                      </div>

                      {/* Activities Column */}
                      <div className="flex-1 p-2 space-y-2 relative">
                        {monthActivities.length === 0 && (
                          <div className="h-full w-full opacity-0">.</div>
                        )}

                        {monthActivities.map((activity) => {
                          // Get display date
                          let displayDate = '';
                          if (activity.start_date) {
                            displayDate = `${new Date(activity.start_date).getDate()}e`;
                          } else if (activity.weeks.length > 0) {
                            displayDate = `v${activity.weeks[0]}`;
                          }

                          return (
                            <div
                              key={activity.id}
                              onClick={() => onActivityClick(activity)}
                              className="
                                group relative cursor-pointer
                                rounded-lg p-3
                                bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30
                                border border-gray-200 dark:border-gray-600 hover:border-blue-200 dark:hover:border-blue-700
                                shadow-sm hover:shadow-md
                                transition-all duration-200
                                min-h-[140px] flex items-center justify-center
                              "
                            >
                              <div
                                className="writing-vertical-rl rotate-180 flex items-center gap-2 w-full max-h-[200px]"
                                style={{ writingMode: 'vertical-rl' }}
                              >
                                <div
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: focusArea.color }}
                                />
                                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                  {displayDate}
                                </span>
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap truncate max-w-[160px]">
                                  {activity.title}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
