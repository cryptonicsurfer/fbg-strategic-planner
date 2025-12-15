import React, { useMemo, useState } from 'react';
import { arc } from 'd3-shape';
import { Activity, FocusArea } from '../types';
import { MONTHS, getMonthFromWeek, STATUS_LABELS } from '../constants';

interface WheelProps {
  year: number;
  activities: Activity[];
  focusAreas: FocusArea[];
  onActivityClick: (activity: Activity) => void;
}

interface TooltipData {
  activity: Activity;
  x: number;
  y: number;
}

// Helper to adjust color for different rings - makes inner rings lighter
const adjustColorForRing = (hexColor: string, ringIndex: number, totalRings: number): string => {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Convert RGB to HSL
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
      case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
      case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
    }
  }

  // Adjust lightness based on ring position
  // Inner rings (lower index) get lighter, outer rings get more saturated
  const lightnessBoost = (totalRings - 1 - ringIndex) * 0.08; // More boost for inner rings
  const saturationBoost = ringIndex * 0.1; // More saturation for outer rings

  const newL = Math.min(0.85, l + lightnessBoost);
  const newS = Math.min(1, s + saturationBoost);

  // Convert back to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let rNew, gNew, bNew;
  if (newS === 0) {
    rNew = gNew = bNew = newL;
  } else {
    const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
    const p = 2 * newL - q;
    rNew = hue2rgb(p, q, h + 1/3);
    gNew = hue2rgb(p, q, h);
    bNew = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(rNew)}${toHex(gNew)}${toHex(bNew)}`;
};

const ZOOM_LEVELS = [0.6, 0.8, 1.0, 1.2, 1.5];
const ZOOM_LABELS = ['60%', '80%', '100%', '120%', '150%'];

const Wheel: React.FC<WheelProps> = ({ year, activities, focusAreas, onActivityClick }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [selectedFocusAreaId, setSelectedFocusAreaId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // For month zoom
  const [zoomIndex, setZoomIndex] = useState(4); // Default to 150%

  const zoom = ZOOM_LEVELS[zoomIndex];

  // Handle focus area click - toggle selection
  const handleFocusAreaClick = (focusAreaId: string) => {
    setSelectedFocusAreaId(prev => prev === focusAreaId ? null : focusAreaId);
  };

  // Handle month click - toggle month zoom
  const handleMonthClick = (monthIndex: number) => {
    setSelectedMonth(prev => prev === monthIndex ? null : monthIndex);
  };

  const handleZoomIn = () => {
    setZoomIndex(prev => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  };

  const handleZoomOut = () => {
    setZoomIndex(prev => Math.max(prev - 1, 0));
  };

  // Filter activities based on selected focus area
  const filteredActivities = useMemo(() => {
    if (!selectedFocusAreaId) return activities;
    return activities.filter(a => a.focus_area_id === selectedFocusAreaId);
  }, [activities, selectedFocusAreaId]);

  const size = 800;
  const radius = size / 2;
  const centerRadius = 60;
  const monthRadius = 190;
  const eventLineStartRadius = monthRadius + 10;
  const eventLineEndRadius = monthRadius + 50;

  // Center logic - show month name if zoomed on a month, otherwise year
  const centerText = selectedMonth !== null ? MONTHS[selectedMonth].name : year.toString();
  const hasActiveFilter = selectedFocusAreaId !== null || selectedMonth !== null;

  // Clear all filters
  const clearFilters = () => {
    setSelectedFocusAreaId(null);
    setSelectedMonth(null);
  };

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
      if (activity.end_date) {
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

  // Helper to get geometric angle for a specific month index (0-11)
  const getAngle = (index: number) => {
    return (index * (2 * Math.PI)) / 12 - Math.PI / 2;
  };

  const d3AngleOffset = Math.PI / 2;

  // Separate "Övrigt" from regular focus areas - it spans the entire year
  const { ovrigtArea, regularFocusAreas } = useMemo(() => {
    const ovrigt = focusAreas.find(fa => fa.name.toLowerCase() === 'övrigt');
    const regular = focusAreas.filter(fa => fa.name.toLowerCase() !== 'övrigt');
    return { ovrigtArea: ovrigt, regularFocusAreas: regular };
  }, [focusAreas]);

  // Group regular focus areas by concept_id
  const conceptGroups = useMemo(() => {
    const groups = new Map<string, FocusArea[]>();
    regularFocusAreas.forEach(fa => {
      const conceptId = fa.concept_id;
      if (!groups.has(conceptId)) {
        groups.set(conceptId, []);
      }
      groups.get(conceptId)!.push(fa);
    });
    return Array.from(groups.entries());
  }, [regularFocusAreas]);

  // Outer radius for focus areas (just inside the months ring)
  const focusAreasOuterRadius = monthRadius - 50;

  // Reserve space for Övrigt ring at the innermost position
  const ovrigtRingThickness = ovrigtArea ? 15 : 0;
  const ovrigtInnerRadius = centerRadius + 5;
  const ovrigtOuterRadius = ovrigtInnerRadius + ovrigtRingThickness;

  // Calculate radii for each concept ring (starting after Övrigt)
  const ringStartRadius = ovrigtArea ? ovrigtOuterRadius + 3 : centerRadius + 5;
  const ringThickness = (focusAreasOuterRadius - ringStartRadius) / Math.max(conceptGroups.length, 1);

  // Total number of rings for color adjustment
  const totalRings = conceptGroups.length;

  // For each concept group, create arcs with appropriate radii
  const focusAreaArcs = useMemo(() => {
    const arcs: Array<{
      id: string;
      name: string;
      color: string;
      adjustedColor: string;
      concept_id: string;
      startMonth: number;
      endMonth: number;
      innerRadius: number;
      outerRadius: number;
      ringIndex: number;
    }> = [];

    conceptGroups.forEach(([conceptId, fas], groupIndex) => {
      // Determine if this concept group is time-based
      const isTimeBased = fas.some(fa => fa.start_month !== null && fa.end_month !== null);

      // Calculate radii for this ring (outer rings for outer concepts)
      const innerR = ringStartRadius + groupIndex * ringThickness;
      const outerR = innerR + ringThickness - 5;

      if (isTimeBased) {
        // Time-based: use actual months
        fas.forEach(fa => {
          arcs.push({
            id: fa.id,
            name: fa.name,
            color: fa.color,
            adjustedColor: adjustColorForRing(fa.color, groupIndex, totalRings),
            concept_id: fa.concept_id,
            startMonth: fa.start_month ?? 0,
            endMonth: fa.end_month ?? 11,
            innerRadius: innerR,
            outerRadius: outerR,
            ringIndex: groupIndex,
          });
        });
      } else {
        // Theme-based: distribute evenly around the full circle
        const sliceSize = 12 / fas.length;
        fas.forEach((fa, i) => {
          arcs.push({
            id: fa.id,
            name: fa.name,
            color: fa.color,
            adjustedColor: adjustColorForRing(fa.color, groupIndex, totalRings),
            concept_id: fa.concept_id,
            startMonth: Math.round(i * sliceSize),
            endMonth: Math.round((i + 1) * sliceSize) - 1,
            innerRadius: innerR,
            outerRadius: outerR,
            ringIndex: groupIndex,
          });
        });
      }
    });

    return arcs;
  }, [conceptGroups, ringThickness, ringStartRadius, totalRings]);

  // Create arc generator function
  const createArcPath = (item: typeof focusAreaArcs[0]) => {
    const arcGen = arc<any>()
      .innerRadius(item.innerRadius)
      .outerRadius(item.outerRadius)
      .startAngle(getAngle(item.startMonth) + d3AngleOffset)
      .endAngle(getAngle(item.endMonth + 1) + d3AngleOffset)
      .padAngle(0.01)
      .cornerRadius(8);
    return arcGen(item);
  };

  const getArcCentroid = (item: typeof focusAreaArcs[0]) => {
    const midAngle = (getAngle(item.startMonth) + getAngle(item.endMonth + 1)) / 2 + d3AngleOffset;
    const midRadius = (item.innerRadius + item.outerRadius) / 2;
    return [Math.cos(midAngle - Math.PI / 2) * midRadius, Math.sin(midAngle - Math.PI / 2) * midRadius];
  };

  const monthArcGen = arc<any>()
    .innerRadius(focusAreasOuterRadius)
    .outerRadius(monthRadius)
    .startAngle((d) => getAngle(d.index) + d3AngleOffset)
    .endAngle((d) => getAngle(d.index + 1) + d3AngleOffset)
    .padAngle(0.01)
    .cornerRadius(4);

  // All activities will be rendered as dots
  // Activities with multiple weeks will show multiple dots (one per week)

  // Group all activities by month
  // For activities with multiple weeks, create an entry for each week
  const activitiesByMonth = useMemo(() => {
    const map = new Map<number, { activity: Activity; week?: number; label?: string }[]>();

    filteredActivities.forEach(activity => {
      if (activity.weeks.length > 0) {
        // For activities with weeks, add one entry per week
        activity.weeks.forEach(week => {
          const monthIndex = getMonthFromWeek(week);
          const list = map.get(monthIndex) || [];
          list.push({ activity, week, label: `${activity.title}, v${week}` });
          map.set(monthIndex, list);
        });
      } else if (activity.start_date) {
        // Use start_date for positioning
        const dateObj = new Date(activity.start_date);
        const monthIndex = dateObj.getMonth();
        const day = dateObj.getDate();
        const monthShort = MONTHS[monthIndex].shortName.toLowerCase();
        const list = map.get(monthIndex) || [];
        list.push({ activity, label: `${activity.title}, ${day}e ${monthShort}` });
        map.set(monthIndex, list);
      }
      // Skip activities without a date or weeks
    });
    return map;
  }, [filteredActivities]);


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
            <>
              <text
                y={selectedMonth !== null ? 28 : 20}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[9px] fill-sky-500 pointer-events-none font-medium"
              >
                ← Tillbaka
              </text>
            </>
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

          {/* Övrigt - Full year ring at innermost position */}
          {ovrigtArea && (
            <g
              className="group cursor-pointer"
              onClick={() => handleFocusAreaClick(ovrigtArea.id)}
            >
              <circle
                r={(ovrigtInnerRadius + ovrigtOuterRadius) / 2}
                fill="none"
                stroke={ovrigtArea.color}
                strokeWidth={ovrigtRingThickness}
                className={`${
                  selectedFocusAreaId === ovrigtArea.id
                    ? 'opacity-60'
                    : selectedFocusAreaId !== null
                      ? 'opacity-20 group-hover:opacity-40'
                      : 'opacity-30 group-hover:opacity-50'
                } transition-opacity duration-300`}
              />
              {/* Label for Övrigt - positioned at bottom */}
              <text
                x={0}
                y={(ovrigtInnerRadius + ovrigtOuterRadius) / 2 + 3}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[8px] font-semibold fill-gray-500 uppercase tracking-wide pointer-events-none"
              >
                Ö
              </text>
            </g>
          )}

          {/* Focus Areas Layer */}
          {focusAreaArcs.map((focusArea) => {
            const path = createArcPath(focusArea);
            const [x, y] = getArcCentroid(focusArea);

            const angleDeg = Math.atan2(y, x) * (180 / Math.PI);
            let textRot = angleDeg + 90;

            if (angleDeg > 0 && angleDeg < 180) {
              textRot -= 180;
            }

            // Calculate text size based on ring thickness
            const ringSize = focusArea.outerRadius - focusArea.innerRadius;
            const fontSize = ringSize < 40 ? 'text-[8px]' : 'text-xs';

            // Split name for display - use shorter version for thin rings
            let nameParts: string[];
            if (ringSize < 40) {
              // Abbreviate for thin rings
              nameParts = [focusArea.name.split(' ').map(w => w[0]).join('')];
            } else if (focusArea.name.includes('&')) {
              nameParts = [focusArea.name.split('&')[0].trim(), '& ' + focusArea.name.split('&')[1].trim()];
            } else {
              nameParts = [focusArea.name];
            }

            // Determine selection state
            const isSelected = selectedFocusAreaId === focusArea.id;
            const isOtherSelected = selectedFocusAreaId !== null && !isSelected;

            // Dynamic opacity based on selection state
            let opacityClass = 'opacity-25 group-hover:opacity-40';
            if (isSelected) {
              opacityClass = 'opacity-60';
            } else if (isOtherSelected) {
              opacityClass = 'opacity-10 group-hover:opacity-25';
            }

            return (
              <g
                key={focusArea.id}
                className="group cursor-pointer"
                onClick={() => handleFocusAreaClick(focusArea.id)}
              >
                <path
                  d={path || ""}
                  fill={focusArea.adjustedColor}
                  className={`${opacityClass} transition-opacity duration-300`}
                  stroke={isSelected ? focusArea.color : "white"}
                  strokeWidth={isSelected ? "3" : "2"}
                />
                <text
                  transform={`translate(${x},${y}) rotate(${textRot})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`${fontSize} font-semibold pointer-events-none uppercase tracking-wide ${isOtherSelected ? 'fill-gray-400' : 'fill-gray-700'}`}
                  style={{ textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}
                >
                  {nameParts.map((part, i) => (
                    <tspan key={i} x="0" dy={i === 0 ? (nameParts.length > 1 ? "-0.6em" : "0") : "1.2em"}>
                      {part}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}

          {/* Months Layer - or Days Layer when month is selected */}
          {selectedMonth !== null ? (
            // Show days of the selected month around the wheel
            (() => {
              const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
              const dayAngleStep = (2 * Math.PI) / daysInMonth;
              const startAngle = -Math.PI / 2; // Day 1 at top

              // Create arc generator for day segments
              const dayArcGen = arc<any>()
                .innerRadius(focusAreasOuterRadius)
                .outerRadius(monthRadius)
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

                    // Calculate centroid for label
                    const midAngle = (dayStartAngle + dayEndAngle) / 2;
                    const labelRadius = (focusAreasOuterRadius + monthRadius) / 2;
                    const x = Math.cos(midAngle) * labelRadius;
                    const y = Math.sin(midAngle) * labelRadius;

                    // Rotate text to be readable
                    const angleDeg = midAngle * (180 / Math.PI);
                    let rotate = angleDeg + 90;
                    if (angleDeg > 90 || angleDeg < -90) {
                      rotate += 180;
                    }

                    // Only show label for every 5th day or day 1
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
            // Normal months view
            MONTHS.map((month) => {
              const path = monthArcGen(month as any);
              const [x, y] = monthArcGen.centroid(month as any);

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

          {/* Activities Layer - All as dots */}
          {selectedMonth !== null ? (
            // Month zoom mode - position activities by day of month
            (() => {
              const monthEntries = activitiesByMonth.get(selectedMonth) || [];
              if (monthEntries.length === 0) return null;

              const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
              const dayAngleStep = (2 * Math.PI) / daysInMonth;
              const startAngle = -Math.PI / 2; // Day 1 at top

              // Group activities by day
              const activitiesByDay = new Map<number, typeof monthEntries>();
              monthEntries.forEach(entry => {
                let day = 1;
                if (entry.activity.start_date) {
                  const date = new Date(entry.activity.start_date);
                  if (date.getMonth() === selectedMonth) {
                    day = date.getDate();
                  }
                } else if (entry.week) {
                  // Approximate day from week number
                  // Week 1 of month ≈ days 1-7, etc.
                  const weekOfMonth = Math.ceil(entry.week - getWeekOfYear(new Date(year, selectedMonth, 1)) + 1);
                  day = Math.min(Math.max(1, (weekOfMonth - 1) * 7 + 4), daysInMonth);
                }
                const list = activitiesByDay.get(day) || [];
                list.push(entry);
                activitiesByDay.set(day, list);
              });

              // Helper to get week of year
              function getWeekOfYear(date: Date): number {
                const start = new Date(date.getFullYear(), 0, 1);
                const diff = date.getTime() - start.getTime();
                return Math.ceil((diff / (1000 * 60 * 60 * 24) + start.getDay() + 1) / 7);
              }

              return (
                <g>
                  {Array.from(activitiesByDay.entries()).map(([day, entries]) => {
                    const dayAngle = startAngle + (day - 1) * dayAngleStep + dayAngleStep / 2;

                    return entries.map((entry, idx) => {
                      const { activity, week, label } = entry;

                      const dist = eventLineEndRadius + idx * 18;
                      const xText = Math.cos(dayAngle) * dist;
                      const yText = Math.sin(dayAngle) * dist;

                      const x1 = Math.cos(dayAngle) * eventLineStartRadius;
                      const y1 = Math.sin(dayAngle) * eventLineStartRadius;

                      // Determine text anchor based on position
                      let normalizedAngle = dayAngle;
                      while (normalizedAngle <= -Math.PI) normalizedAngle += 2 * Math.PI;
                      while (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
                      const isRightSide = normalizedAngle > -Math.PI / 2 && normalizedAngle < Math.PI / 2;

                      const focusArea = focusAreas.find((fa) => fa.id === activity.focus_area_id);
                      const dotColor = focusArea?.color || '#6b7280';

                      const handleMouseEnter = (e: React.MouseEvent) => {
                        setTooltip({
                          activity,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      };

                      const key = week !== undefined ? `${activity.id}-w${week}` : activity.id;

                      // Show day in label when zoomed
                      const dayLabel = `${activity.title}, ${day}/${selectedMonth + 1}`;

                      return (
                        <g key={key}>
                          {idx === 0 && (
                            <line
                              x1={x1}
                              y1={y1}
                              x2={xText}
                              y2={yText}
                              stroke="#d1d5db"
                              strokeWidth="1"
                              strokeDasharray="2,2"
                            />
                          )}
                          <g
                            onClick={() => onActivityClick(activity)}
                            onMouseEnter={handleMouseEnter}
                            onMouseLeave={() => setTooltip(null)}
                            className="cursor-pointer hover:opacity-70 transition-opacity"
                          >
                            <circle cx={xText} cy={yText} r={5} fill={dotColor} />
                            <text
                              x={xText + (isRightSide ? 8 : -8)}
                              y={yText}
                              textAnchor={isRightSide ? 'start' : 'end'}
                              dominantBaseline="middle"
                              className="text-[11px] font-medium fill-gray-700"
                              style={{ fontFamily: '"Inter", sans-serif' }}
                            >
                              {dayLabel}
                            </text>
                          </g>
                        </g>
                      );
                    });
                  })}
                </g>
              );
            })()
          ) : (
            // Normal mode - activities grouped by month
            MONTHS.map((month) => {
              const monthEntries = activitiesByMonth.get(month.index);
              if (!monthEntries || monthEntries.length === 0) return null;

              const midAngleRad = getAngle(month.index) + (Math.PI / 12);

              const x1 = Math.cos(midAngleRad) * eventLineStartRadius;
              const y1 = Math.sin(midAngleRad) * eventLineStartRadius;
              const x2 = Math.cos(midAngleRad) * eventLineEndRadius;
              const y2 = Math.sin(midAngleRad) * eventLineEndRadius;

              let normalizedAngle = midAngleRad;
              while (normalizedAngle <= -Math.PI) normalizedAngle += 2 * Math.PI;
              while (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;

              const isRightSide = normalizedAngle > -Math.PI / 2 && normalizedAngle < Math.PI / 2;

              // Limit displayed activities to prevent overlap
              const MAX_VISIBLE = 6;
              const visibleEntries = monthEntries.slice(0, MAX_VISIBLE);
              const hiddenCount = monthEntries.length - MAX_VISIBLE;
              const baseSpacing = 16;

              return (
                <g key={`activities-${month.index}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#9ca3af"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />

                  {visibleEntries.map((entry, i) => {
                    const { activity, week, label } = entry;
                    const dist = eventLineEndRadius + i * baseSpacing;
                    const xText = Math.cos(midAngleRad) * dist;
                    const yText = Math.sin(midAngleRad) * dist;

                    const focusArea = focusAreas.find((fa) => fa.id === activity.focus_area_id);
                    const dotColor = focusArea?.color || '#6b7280';

                    const handleMouseEnter = (e: React.MouseEvent) => {
                      setTooltip({
                        activity,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    };

                    const key = week !== undefined ? `${activity.id}-w${week}` : activity.id;

                    return (
                      <g
                        key={key}
                        onClick={() => onActivityClick(activity)}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={() => setTooltip(null)}
                        className="cursor-pointer hover:opacity-70 transition-opacity"
                      >
                        <circle cx={xText} cy={yText} r={4} fill={dotColor} />

                        <text
                          x={xText + (isRightSide ? 6 : -6)}
                          y={yText}
                          textAnchor={isRightSide ? 'start' : 'end'}
                          dominantBaseline="middle"
                          className="text-[10px] font-medium fill-gray-700"
                          style={{ fontFamily: '"Inter", sans-serif' }}
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Show "+X more" indicator if there are hidden activities */}
                  {hiddenCount > 0 && (
                    <g
                      onClick={() => handleMonthClick(month.index)}
                      className="cursor-pointer hover:opacity-70"
                    >
                      {(() => {
                        const dist = eventLineEndRadius + MAX_VISIBLE * baseSpacing;
                        const xMore = Math.cos(midAngleRad) * dist;
                        const yMore = Math.sin(midAngleRad) * dist;
                        return (
                          <>
                            <circle cx={xMore} cy={yMore} r={10} fill="#e5e7eb" />
                            <text
                              x={xMore}
                              y={yMore}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className="text-[9px] font-bold fill-gray-600"
                            >
                              +{hiddenCount}
                            </text>
                          </>
                        );
                      })()}
                    </g>
                  )}
                </g>
              );
            })
          )}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed pointer-events-none z-[100] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-3 max-w-xs"
          style={{
            left: Math.min(tooltip.x, window.innerWidth - 280),
            top: Math.max(80, tooltip.y - 10), // Keep below navbar (80px from top minimum)
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