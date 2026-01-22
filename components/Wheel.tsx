import React, { useMemo, useState } from 'react';
import { arc } from 'd3-shape';
import { Activity, FocusArea } from '../types';
import { MONTHS, STATUS_LABELS } from '../constants';

interface WheelProps {
  year: number;
  activities: Activity[];
  focusAreas: FocusArea[];
  onActivityClick: (activity: Activity) => void;
  visibleMonths?: number[]; // Optional: when set, only these months are shown expanded to 360°
}

interface TooltipData {
  activity: Activity;
  x: number;
  y: number;
}

const ZOOM_LEVELS = [0.6, 0.8, 1.0, 1.2, 1.5];
const ZOOM_LABELS = ['60%', '80%', '100%', '120%', '150%'];

const Wheel: React.FC<WheelProps> = ({ year, activities, focusAreas, onActivityClick, visibleMonths }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [zoomIndex, setZoomIndex] = useState(4); // Default to 150%

  const zoom = ZOOM_LEVELS[zoomIndex];

  // Determine which months to display
  const displayMonths = visibleMonths && visibleMonths.length > 0
    ? MONTHS.filter(m => visibleMonths.includes(m.index))
    : MONTHS;

  const isFilteredView = visibleMonths && visibleMonths.length > 0 && visibleMonths.length < 12;

  const handleMonthClick = (monthIndex: number) => {
    setSelectedMonth(prev => prev === monthIndex ? null : monthIndex);
  };

  const handleZoomIn = () => {
    setZoomIndex(prev => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  };

  const handleZoomOut = () => {
    setZoomIndex(prev => Math.max(prev - 1, 0));
  };

  const clearFilters = () => {
    setSelectedMonth(null);
  };

  const size = 800;
  const radius = size / 2;
  const centerRadius = 60;
  const monthInnerRadius = 80;
  const monthOuterRadius = 180;
  const activityRadius = monthOuterRadius + 15;

  // Get period label for center text when filtered
  const getPeriodLabel = () => {
    if (!isFilteredView) return year.toString();
    const months = visibleMonths!;
    if (months.length === 3) {
      if (months[0] === 0) return `Kv1 ${year}`;
      if (months[0] === 3) return `Kv2 ${year}`;
      if (months[0] === 6) return `Kv3 ${year}`;
      if (months[0] === 9) return `Kv4 ${year}`;
    }
    if (months.length === 4) {
      if (months[0] === 0) return `T1 ${year}`;
      if (months[0] === 4) return `T2 ${year}`;
      if (months[0] === 8) return `T3 ${year}`;
    }
    if (months.length === 6) {
      if (months[0] === 0) return `1H ${year}`;
      if (months[0] === 6) return `2H ${year}`;
    }
    return year.toString();
  };

  const centerText = selectedMonth !== null ? MONTHS[selectedMonth].name : getPeriodLabel();
  const hasActiveFilter = selectedMonth !== null;

  // Format tooltip content
  const formatTooltipContent = (activity: Activity) => {
    const focusArea = focusAreas.find(fa => fa.id === activity.focus_area_id);
    const lines: string[] = [];

    if (activity.description) {
      lines.push(activity.description);
    }

    if (activity.start_date) {
      const start = new Date(activity.start_date);
      const startStr = start.toLocaleDateString('sv-SE');
      if (activity.end_date && activity.end_date !== activity.start_date) {
        const end = new Date(activity.end_date);
        const endStr = end.toLocaleDateString('sv-SE');
        lines.push(`Datum: ${startStr} - ${endStr}`);
      } else {
        lines.push(`Datum: ${startStr}`);
      }
    }

    if (activity.weeks.length > 0) {
      if (activity.weeks.length === 1) {
        lines.push(`Vecka: ${activity.weeks[0]}`);
      } else if (activity.weeks.length <= 3) {
        lines.push(`Veckor: ${activity.weeks.join(', ')}`);
      } else {
        lines.push(`Veckor: ${activity.weeks[0]}-${activity.weeks[activity.weeks.length - 1]}`);
      }
    }

    if (activity.responsible) {
      lines.push(`Ansvarig: ${activity.responsible}`);
    }

    if (activity.status) {
      lines.push(`Status: ${STATUS_LABELS[activity.status] || activity.status}`);
    }

    return { focusArea, lines };
  };

  // D3 uses 12 o'clock as 0, clockwise
  const d3AngleOffset = Math.PI / 2;

  // Helper to get angle for month index in filtered view
  // Maps the visible months to fill 360 degrees
  const getFilteredAngle = (monthIndex: number, positionInMonth: number = 0) => {
    if (!isFilteredView) {
      // Normal view: each month is 1/12 of the circle
      return ((monthIndex + positionInMonth) * (2 * Math.PI)) / 12 - Math.PI / 2;
    }

    // Filtered view: visible months fill the entire circle
    const visibleIndex = visibleMonths!.indexOf(monthIndex);
    if (visibleIndex === -1) return 0;

    const anglePerMonth = (2 * Math.PI) / visibleMonths!.length;
    return (visibleIndex + positionInMonth) * anglePerMonth - Math.PI / 2;
  };

  // Helper to get angle for month index (0-11) - legacy, for normal view
  const getAngle = (index: number) => {
    return getFilteredAngle(index);
  };

  // Convert date to angle position (handles filtered view)
  const dateToAngle = (dateStr: string): number | null => {
    const date = new Date(dateStr);
    const month = date.getMonth();
    const day = date.getDate();
    const daysInMonth = new Date(date.getFullYear(), month + 1, 0).getDate();

    // Check if this month is visible
    if (isFilteredView && !visibleMonths!.includes(month)) {
      return null;
    }

    const positionInMonth = (day - 1) / daysInMonth;
    return getFilteredAngle(month, positionInMonth);
  };

  // Helper to get angle for a specific position in the year (0-1)
  const getAngleFromYearPosition = (position: number) => {
    if (!isFilteredView) {
      return position * 2 * Math.PI - Math.PI / 2;
    }

    // In filtered view, map position within the filtered period
    const firstMonth = visibleMonths![0];
    const lastMonth = visibleMonths![visibleMonths!.length - 1];
    const periodStart = firstMonth / 12;
    const periodEnd = (lastMonth + 1) / 12;

    // Check if position is within the filtered period
    if (position < periodStart || position > periodEnd) {
      return null as any;
    }

    // Map to 0-1 within the filtered period, then to angle
    const normalizedPos = (position - periodStart) / (periodEnd - periodStart);
    return normalizedPos * 2 * Math.PI - Math.PI / 2;
  };

  // Convert date to year position (0-1)
  const dateToYearPosition = (dateStr: string): number => {
    const date = new Date(dateStr);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const endOfYear = new Date(date.getFullYear(), 11, 31);
    const yearLength = endOfYear.getTime() - startOfYear.getTime();
    const dayOfYear = date.getTime() - startOfYear.getTime();
    return dayOfYear / yearLength;
  };

  // Create month arc generator for filtered view
  const createMonthArc = (displayIndex: number, totalMonths: number) => {
    const anglePerMonth = (2 * Math.PI) / totalMonths;
    const startAngle = displayIndex * anglePerMonth;
    const endAngle = (displayIndex + 1) * anglePerMonth;

    return arc<any>()
      .innerRadius(monthInnerRadius)
      .outerRadius(monthOuterRadius)
      .startAngle(startAngle)
      .endAngle(endAngle)
      .padAngle(0.02)
      .cornerRadius(4)({});
  };

  // Legacy month arc generator (for compatibility)
  const monthArcGen = arc<any>()
    .innerRadius(monthInnerRadius)
    .outerRadius(monthOuterRadius)
    .startAngle((d) => getAngle(d.index) + d3AngleOffset)
    .endAngle((d) => getAngle(d.index + 1) + d3AngleOffset)
    .padAngle(0.02)
    .cornerRadius(4);

  // Helper to check if an activity is within visible months
  const isActivityVisible = (activity: Activity): boolean => {
    if (!isFilteredView) return true;

    if (activity.start_date) {
      const month = new Date(activity.start_date).getMonth();
      if (visibleMonths!.includes(month)) return true;

      // For date ranges, also check end date
      if (activity.end_date) {
        const endMonth = new Date(activity.end_date).getMonth();
        // Check if any part of the range overlaps with visible months
        const startMonth = month;
        for (let m = startMonth; m <= endMonth; m++) {
          if (visibleMonths!.includes(m)) return true;
        }
      }
      return false;
    }

    if (activity.weeks.length > 0) {
      // Check if any week falls within visible months
      return activity.weeks.some(week => {
        const approxMonth = Math.floor(((week - 1) / 52) * 12);
        return visibleMonths!.includes(Math.min(11, approxMonth));
      });
    }

    return false;
  };

  // Process activities into display items
  const activityDisplayItems = useMemo(() => {
    const items: Array<{
      activity: Activity;
      type: 'dot' | 'arc';
      yearPosition?: number;  // For dots
      angle?: number;         // Pre-calculated angle for filtered view
      startPosition?: number; // For arcs
      endPosition?: number;   // For arcs
      label: string;
      color: string;
    }> = [];

    // Filter activities based on visible months
    const visibleActivities = isFilteredView
      ? activities.filter(isActivityVisible)
      : activities;

    visibleActivities.forEach(activity => {
      const focusArea = focusAreas.find(fa => fa.id === activity.focus_area_id);
      const color = focusArea?.color || '#6b7280';

      if (activity.start_date && activity.end_date && activity.start_date !== activity.end_date) {
        // Date range - show as arc
        const startPos = dateToYearPosition(activity.start_date);
        const endPos = dateToYearPosition(activity.end_date);
        items.push({
          activity,
          type: 'arc',
          startPosition: startPos,
          endPosition: endPos,
          label: activity.title,
          color,
        });
      } else if (activity.start_date) {
        // Single date - show as dot
        const pos = dateToYearPosition(activity.start_date);
        const angle = dateToAngle(activity.start_date);
        const date = new Date(activity.start_date);
        const day = date.getDate();
        const monthShort = MONTHS[date.getMonth()].shortName.toLowerCase();

        if (angle !== null) {
          items.push({
            activity,
            type: 'dot',
            yearPosition: pos,
            angle,
            label: `${activity.title}, ${day} ${monthShort}`,
            color,
          });
        }
      } else if (activity.weeks.length > 0) {
        // Multiple weeks - show multiple dots
        activity.weeks.forEach(week => {
          // Convert week to approximate year position
          const pos = (week - 0.5) / 52;
          const approxMonth = Math.floor(pos * 12);

          // Skip if not in visible months
          if (isFilteredView && !visibleMonths!.includes(Math.min(11, approxMonth))) {
            return;
          }

          // Calculate angle for filtered view
          const posInMonth = (pos * 12) - approxMonth;
          const angle = getFilteredAngle(approxMonth, posInMonth);

          items.push({
            activity,
            type: 'dot',
            yearPosition: pos,
            angle,
            label: `${activity.title}, v${week}`,
            color,
          });
        });
      }
    });

    return items;
  }, [activities, focusAreas, isFilteredView, visibleMonths]);

  // Group items by month for display
  const itemsByMonth = useMemo(() => {
    const map = new Map<number, typeof activityDisplayItems>();

    activityDisplayItems.forEach(item => {
      if (item.type === 'dot' && item.yearPosition !== undefined) {
        const monthIndex = Math.floor(item.yearPosition * 12);
        const validMonth = Math.max(0, Math.min(11, monthIndex));
        const list = map.get(validMonth) || [];
        list.push(item);
        map.set(validMonth, list);
      }
    });

    return map;
  }, [activityDisplayItems]);

  // Arc items (date ranges)
  const arcItems = useMemo(() => {
    return activityDisplayItems.filter(item => item.type === 'arc');
  }, [activityDisplayItems]);

  return (
    <div className="relative w-full h-full flex justify-center items-center overflow-hidden">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm border border-gray-200">
        <button
          onClick={handleZoomOut}
          disabled={zoomIndex === 0}
          className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Zooma ut"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <span className="text-xs font-medium text-gray-600 min-w-[40px] text-center">
          {ZOOM_LABELS[zoomIndex]}
        </span>
        <button
          onClick={handleZoomIn}
          disabled={zoomIndex === ZOOM_LEVELS.length - 1}
          className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Zooma in"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <svg
        width={`${100 * zoom}%`}
        height={`${100 * zoom}%`}
        viewBox={`0 0 ${size} ${size}`}
        className="max-h-[90vh] select-none transition-all duration-300"
        style={{ maxWidth: `${size * zoom}px` }}
      >
        <g transform={`translate(${radius},${radius})`}>

          {/* Center Year/Month */}
          <circle
            r={centerRadius}
            fill="white"
            className={`shadow-lg drop-shadow-md ${hasActiveFilter ? 'cursor-pointer hover:fill-sky-50' : ''}`}
            onClick={hasActiveFilter ? clearFilters : undefined}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            className={`font-bold fill-gray-800 tracking-tighter pointer-events-none ${hasActiveFilter ? 'text-xl' : 'text-3xl'}`}
          >
            {centerText}
          </text>
          {hasActiveFilter && (
            <text
              y={selectedMonth !== null ? 28 : 20}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[9px] fill-sky-500 pointer-events-none font-medium"
            >
              ← Tillbaka
            </text>
          )}
          {selectedMonth !== null && (
            <text
              y={-22}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-sm fill-gray-400 pointer-events-none"
            >
              {year}
            </text>
          )}

          {/* Months Layer */}
          {selectedMonth !== null ? (
            // Show days of the selected month around the wheel
            (() => {
              const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
              const dayAngleStep = (2 * Math.PI) / daysInMonth;
              const startAngle = -Math.PI / 2;

              const dayArcGen = arc<any>()
                .innerRadius(monthInnerRadius)
                .outerRadius(monthOuterRadius)
                .padAngle(0.01)
                .cornerRadius(2);

              return (
                <g>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dayStartAngle = startAngle + i * dayAngleStep;
                    const dayEndAngle = startAngle + (i + 1) * dayAngleStep;

                    const path = dayArcGen({
                      startAngle: dayStartAngle + Math.PI / 2,
                      endAngle: dayEndAngle + Math.PI / 2,
                    });

                    const midAngle = (dayStartAngle + dayEndAngle) / 2;
                    const labelRadius = (monthInnerRadius + monthOuterRadius) / 2;
                    const x = Math.cos(midAngle) * labelRadius;
                    const y = Math.sin(midAngle) * labelRadius;

                    const angleDeg = midAngle * (180 / Math.PI);
                    let rotate = angleDeg + 90;
                    if (angleDeg > 90 || angleDeg < -90) {
                      rotate += 180;
                    }

                    const showLabel = day === 1 || day % 5 === 0;

                    return (
                      <g key={day} className="cursor-pointer" onClick={clearFilters}>
                        <path
                          d={path || ""}
                          fill="white"
                          className="drop-shadow-sm hover:fill-gray-50 transition-colors"
                          stroke="#e5e7eb"
                          strokeWidth="0.5"
                        />
                        {showLabel && (
                          <text
                            transform={`translate(${x},${y}) rotate(${rotate})`}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="text-[9px] font-medium fill-gray-400 pointer-events-none"
                          >
                            {day}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })()
          ) : (
            // Months view (filtered or full year)
            displayMonths.map((month, displayIndex) => {
              // Create arc path for this month
              const path = createMonthArc(displayIndex, displayMonths.length);

              // Calculate centroid for label
              const anglePerMonth = (2 * Math.PI) / displayMonths.length;
              const midAngle = displayIndex * anglePerMonth + anglePerMonth / 2 - Math.PI / 2;
              const labelRadius = (monthInnerRadius + monthOuterRadius) / 2;
              const x = Math.cos(midAngle) * labelRadius;
              const y = Math.sin(midAngle) * labelRadius;

              const angleDeg = Math.atan2(y, x) * (180 / Math.PI);
              let rotate = angleDeg + 90;
              if (angleDeg > 90 || angleDeg < -90) {
                rotate += 180;
              }

              return (
                <g
                  key={month.index}
                  className="group cursor-pointer"
                  onClick={() => handleMonthClick(month.index)}
                >
                  <path
                    d={path || ""}
                    fill="white"
                    className="drop-shadow-sm group-hover:fill-gray-100 transition-colors duration-200"
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                  <text
                    transform={`translate(${x},${y}) rotate(${rotate})`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-xs font-medium fill-gray-500 uppercase tracking-widest pointer-events-none"
                  >
                    {month.shortName}
                  </text>
                </g>
              );
            })
          )}

          {/* Activity Arcs (date ranges) */}
          {selectedMonth === null && arcItems.map((item, arcIndex) => {
            if (item.startPosition === undefined || item.endPosition === undefined) return null;

            const arcRadius = activityRadius + arcIndex * 12;
            const startAngle = getAngleFromYearPosition(item.startPosition) + d3AngleOffset;
            const endAngle = getAngleFromYearPosition(item.endPosition) + d3AngleOffset;

            const activityArcGen = arc<any>()
              .innerRadius(arcRadius)
              .outerRadius(arcRadius + 8)
              .startAngle(startAngle)
              .endAngle(endAngle)
              .cornerRadius(4);

            const path = activityArcGen({});
            const [cx, cy] = activityArcGen.centroid({});

            const handleMouseEnter = (e: React.MouseEvent) => {
              setTooltip({
                activity: item.activity,
                x: e.clientX,
                y: e.clientY,
              });
            };

            return (
              <g
                key={`arc-${item.activity.id}-${arcIndex}`}
                onClick={() => onActivityClick(item.activity)}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setTooltip(null)}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                <path
                  d={path || ""}
                  fill={item.color}
                  opacity={0.8}
                />
                {/* Label on arc */}
                <text
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[8px] font-medium fill-gray-700 pointer-events-none"
                  style={{ textShadow: '0 1px 2px rgba(255,255,255,0.9)' }}
                >
                  {item.label.length > 15 ? item.label.slice(0, 15) + '...' : item.label}
                </text>
              </g>
            );
          })}

          {/* Activity Dots */}
          {selectedMonth !== null ? (
            // Month zoom mode - position by day
            (() => {
              const monthItems = itemsByMonth.get(selectedMonth) || [];
              if (monthItems.length === 0) return null;

              const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();

              // Group by day
              const itemsByDay = new Map<number, typeof monthItems>();
              monthItems.forEach(item => {
                let day = 1;
                if (item.activity.start_date) {
                  const date = new Date(item.activity.start_date);
                  if (date.getMonth() === selectedMonth) {
                    day = date.getDate();
                  }
                } else if (item.yearPosition !== undefined) {
                  // Approximate day from year position
                  const monthStart = selectedMonth / 12;
                  const monthEnd = (selectedMonth + 1) / 12;
                  const posInMonth = (item.yearPosition - monthStart) / (monthEnd - monthStart);
                  day = Math.max(1, Math.min(daysInMonth, Math.ceil(posInMonth * daysInMonth)));
                }
                const list = itemsByDay.get(day) || [];
                list.push(item);
                itemsByDay.set(day, list);
              });

              return (
                <g>
                  {Array.from(itemsByDay.entries()).map(([day, dayItems]) => {
                    const dayAngle = -Math.PI / 2 + ((day - 0.5) / daysInMonth) * 2 * Math.PI;

                    return dayItems.map((item, idx) => {
                      const dist = monthOuterRadius + 20 + idx * 18;
                      const xDot = Math.cos(dayAngle) * dist;
                      const yDot = Math.sin(dayAngle) * dist;

                      let normalizedAngle = dayAngle;
                      while (normalizedAngle <= -Math.PI) normalizedAngle += 2 * Math.PI;
                      while (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
                      const isRightSide = normalizedAngle > -Math.PI / 2 && normalizedAngle < Math.PI / 2;

                      const handleMouseEnter = (e: React.MouseEvent) => {
                        setTooltip({
                          activity: item.activity,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      };

                      return (
                        <g
                          key={`${item.activity.id}-d${day}-${idx}`}
                          onClick={() => onActivityClick(item.activity)}
                          onMouseEnter={handleMouseEnter}
                          onMouseLeave={() => setTooltip(null)}
                          className="cursor-pointer hover:opacity-70 transition-opacity"
                        >
                          {idx === 0 && (
                            <line
                              x1={Math.cos(dayAngle) * monthOuterRadius}
                              y1={Math.sin(dayAngle) * monthOuterRadius}
                              x2={xDot}
                              y2={yDot}
                              stroke="#d1d5db"
                              strokeWidth="1"
                              strokeDasharray="2,2"
                            />
                          )}
                          <circle cx={xDot} cy={yDot} r={5} fill={item.color} />
                          <text
                            x={xDot + (isRightSide ? 8 : -8)}
                            y={yDot}
                            textAnchor={isRightSide ? 'start' : 'end'}
                            dominantBaseline="middle"
                            className="text-[11px] font-medium fill-gray-700"
                          >
                            {item.label}
                          </text>
                        </g>
                      );
                    });
                  })}
                </g>
              );
            })()
          ) : (
            // Normal mode - dots positioned by actual date
            (() => {
              // Get all dot items and sort by angle
              const allDotItems = activityDisplayItems
                .filter(item => item.type === 'dot' && (item.angle !== undefined || item.yearPosition !== undefined))
                .sort((a, b) => {
                  const angleA = a.angle !== undefined ? a.angle : getAngleFromYearPosition(a.yearPosition || 0);
                  const angleB = b.angle !== undefined ? b.angle : getAngleFromYearPosition(b.yearPosition || 0);
                  return angleA - angleB;
                });

              // Group items that are very close together (within ~5 degrees)
              const groupedItems: Array<{ angle: number; items: typeof allDotItems }> = [];
              const ANGLE_THRESHOLD = 0.1; // ~5.7 degrees in radians

              allDotItems.forEach(item => {
                // Use pre-calculated angle if available, otherwise calculate from year position
                const angle = item.angle !== undefined ? item.angle : getAngleFromYearPosition(item.yearPosition || 0);

                // Find existing group within threshold
                const existingGroup = groupedItems.find(g => {
                  return Math.abs(g.angle - angle) < ANGLE_THRESHOLD;
                });

                if (existingGroup) {
                  existingGroup.items.push(item);
                } else {
                  groupedItems.push({ angle, items: [item] });
                }
              });

              return (
                <g>
                  {groupedItems.map((group, groupIndex) => {
                    const angleRad = group.angle;
                    const x1 = Math.cos(angleRad) * monthOuterRadius;
                    const y1 = Math.sin(angleRad) * monthOuterRadius;

                    let normalizedAngle = angleRad;
                    while (normalizedAngle <= -Math.PI) normalizedAngle += 2 * Math.PI;
                    while (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
                    const isRightSide = normalizedAngle > -Math.PI / 2 && normalizedAngle < Math.PI / 2;

                    const baseSpacing = 16;

                    return (
                      <g key={`group-${groupIndex}`}>
                        <line
                          x1={x1}
                          y1={y1}
                          x2={Math.cos(angleRad) * activityRadius}
                          y2={Math.sin(angleRad) * activityRadius}
                          stroke="#d1d5db"
                          strokeWidth="1"
                          strokeDasharray="2,2"
                        />

                        {group.items.map((item, i) => {
                          const dist = activityRadius + i * baseSpacing;
                          const xDot = Math.cos(angleRad) * dist;
                          const yDot = Math.sin(angleRad) * dist;

                          const handleMouseEnter = (e: React.MouseEvent) => {
                            setTooltip({
                              activity: item.activity,
                              x: e.clientX,
                              y: e.clientY,
                            });
                          };

                          return (
                            <g
                              key={`${item.activity.id}-${i}`}
                              onClick={() => onActivityClick(item.activity)}
                              onMouseEnter={handleMouseEnter}
                              onMouseLeave={() => setTooltip(null)}
                              className="cursor-pointer hover:opacity-70 transition-opacity"
                            >
                              <circle cx={xDot} cy={yDot} r={4} fill={item.color} />
                              <text
                                x={xDot + (isRightSide ? 6 : -6)}
                                y={yDot}
                                textAnchor={isRightSide ? 'start' : 'end'}
                                dominantBaseline="middle"
                                className="text-[10px] font-medium fill-gray-700"
                              >
                                {item.label}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </g>
              );
            })()
          )}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed pointer-events-none z-[100] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-3 max-w-xs"
          style={{
            left: Math.min(tooltip.x, window.innerWidth - 280),
            top: Math.max(80, tooltip.y - 10),
            transform: tooltip.y > 150 ? 'translateY(-100%)' : 'translateY(10px)',
          }}
        >
          {(() => {
            const { focusArea, lines } = formatTooltipContent(tooltip.activity);
            return (
              <>
                <div className="flex items-center gap-2 mb-2">
                  {focusArea && (
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: focusArea.color }}
                    />
                  )}
                  <span className="font-semibold text-sm text-gray-900">
                    {tooltip.activity.title}
                  </span>
                </div>
                {focusArea && (
                  <div className="text-xs text-gray-500 mb-2">{focusArea.name}</div>
                )}
                {lines.length > 0 && (
                  <div className="space-y-1">
                    {lines.map((line, i) => (
                      <div key={i} className="text-xs text-gray-600">{line}</div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default Wheel;
