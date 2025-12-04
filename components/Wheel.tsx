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

const Wheel: React.FC<WheelProps> = ({ year, activities, focusAreas, onActivityClick }) => {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [selectedFocusAreaId, setSelectedFocusAreaId] = useState<string | null>(null);

  // Handle focus area click - toggle selection
  const handleFocusAreaClick = (focusAreaId: string) => {
    setSelectedFocusAreaId(prev => prev === focusAreaId ? null : focusAreaId);
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

  // Center logic
  const centerText = year.toString();

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

  // Group focus areas by concept_id
  const conceptGroups = useMemo(() => {
    const groups = new Map<string, FocusArea[]>();
    focusAreas.forEach(fa => {
      const conceptId = fa.concept_id;
      if (!groups.has(conceptId)) {
        groups.set(conceptId, []);
      }
      groups.get(conceptId)!.push(fa);
    });
    return Array.from(groups.entries());
  }, [focusAreas]);

  // Outer radius for focus areas (just inside the months ring)
  const focusAreasOuterRadius = monthRadius - 50;

  // Calculate radii for each concept ring
  const ringThickness = (focusAreasOuterRadius - centerRadius - 10) / Math.max(conceptGroups.length, 1);

  // For each concept group, create arcs with appropriate radii
  const focusAreaArcs = useMemo(() => {
    const arcs: Array<{
      id: string;
      name: string;
      color: string;
      concept_id: string;
      startMonth: number;
      endMonth: number;
      innerRadius: number;
      outerRadius: number;
    }> = [];

    conceptGroups.forEach(([conceptId, fas], groupIndex) => {
      // Determine if this concept group is time-based
      const isTimeBased = fas.some(fa => fa.start_month !== null && fa.end_month !== null);

      // Calculate radii for this ring (outer rings for outer concepts)
      const innerR = centerRadius + 5 + groupIndex * ringThickness;
      const outerR = innerR + ringThickness - 5;

      if (isTimeBased) {
        // Time-based: use actual months
        fas.forEach(fa => {
          arcs.push({
            id: fa.id,
            name: fa.name,
            color: fa.color,
            concept_id: fa.concept_id,
            startMonth: fa.start_month ?? 0,
            endMonth: fa.end_month ?? 11,
            innerRadius: innerR,
            outerRadius: outerR,
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
            concept_id: fa.concept_id,
            startMonth: Math.round(i * sliceSize),
            endMonth: Math.round((i + 1) * sliceSize) - 1,
            innerRadius: innerR,
            outerRadius: outerR,
          });
        });
      }
    });

    return arcs;
  }, [conceptGroups, ringThickness]);

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

  // Group activities by month (determined by start_date or first week)
  const activitiesByMonth = useMemo(() => {
    const map = new Map<number, Activity[]>();
    filteredActivities.forEach(activity => {
      let monthIndex: number;

      if (activity.start_date) {
        monthIndex = new Date(activity.start_date).getMonth();
      } else if (activity.weeks.length > 0) {
        monthIndex = getMonthFromWeek(activity.weeks[0]);
      } else {
        return; // Skip activities without a date
      }

      const list = map.get(monthIndex) || [];
      list.push(activity);
      map.set(monthIndex, list);
    });
    return map;
  }, [filteredActivities]);

  return (
    <div className="relative w-full h-full flex justify-center items-center overflow-hidden">
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        className="max-w-4xl max-h-[90vh] select-none"
      >
        <g transform={`translate(${radius},${radius})`}>
          
          {/* Center Year */}
          <circle
            r={centerRadius}
            fill="white"
            className={`shadow-lg drop-shadow-md ${selectedFocusAreaId ? 'cursor-pointer hover:fill-gray-50' : ''}`}
            onClick={() => selectedFocusAreaId && setSelectedFocusAreaId(null)}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            className={`font-bold fill-gray-800 tracking-tighter pointer-events-none ${selectedFocusAreaId ? 'text-2xl' : 'text-3xl'}`}
          >
            {centerText}
          </text>
          {selectedFocusAreaId && (
            <text
              y={20}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[8px] fill-gray-500 pointer-events-none"
            >
              Klicka för att visa alla
            </text>
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
                  fill={focusArea.color}
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

          {/* Months Layer */}
          {MONTHS.map((month) => {
            const path = monthArcGen(month as any);
            const [x, y] = monthArcGen.centroid(month as any);

            const angleDeg = Math.atan2(y, x) * (180 / Math.PI);
            let rotate = angleDeg + 90;
            if (angleDeg > 90 || angleDeg < -90) {
              rotate += 180;
            }

            return (
              <g key={month.index} className="group">
                <path
                  d={path || ""}
                  fill="white"
                  className="drop-shadow-sm group-hover:fill-gray-50 transition-colors duration-200"
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
          })}

          {/* Activities Layer */}
          {MONTHS.map((month) => {
            const monthActivities = activitiesByMonth.get(month.index);
            if (!monthActivities || monthActivities.length === 0) return null;

            const midAngleRad = getAngle(month.index) + (Math.PI / 12);

            const x1 = Math.cos(midAngleRad) * eventLineStartRadius;
            const y1 = Math.sin(midAngleRad) * eventLineStartRadius;
            const x2 = Math.cos(midAngleRad) * eventLineEndRadius;
            const y2 = Math.sin(midAngleRad) * eventLineEndRadius;

            let normalizedAngle = midAngleRad;
            while (normalizedAngle <= -Math.PI) normalizedAngle += 2 * Math.PI;
            while (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;

            const isRightSide = normalizedAngle > -Math.PI / 2 && normalizedAngle < Math.PI / 2;

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

                {monthActivities.map((activity, i) => {
                  const dist = eventLineEndRadius + i * 20;
                  const xText = Math.cos(midAngleRad) * dist;
                  const yText = Math.sin(midAngleRad) * dist;

                  // Format label
                  let label = activity.title;
                  if (activity.start_date) {
                    const dateObj = new Date(activity.start_date);
                    const day = dateObj.getDate();
                    const monthShort = MONTHS[dateObj.getMonth()].shortName.toLowerCase();
                    label = `${activity.title}, ${day}e ${monthShort}`;
                  } else if (activity.weeks.length > 0) {
                    label = `${activity.title}, v${activity.weeks[0]}`;
                  }

                  // Get focus area color for the dot
                  const focusArea = focusAreas.find((fa) => fa.id === activity.focus_area_id);
                  const dotColor = focusArea?.color || '#6b7280';

                  const handleMouseEnter = (e: React.MouseEvent) => {
                    const rect = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        activity,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      });
                    }
                  };

                  return (
                    <g
                      key={activity.id}
                      onClick={() => onActivityClick(activity)}
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={() => setTooltip(null)}
                      className="cursor-pointer hover:opacity-70 transition-opacity"
                    >
                      <circle cx={xText} cy={yText} r={4} fill={dotColor} className="hover:r-5" />

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
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 p-3 max-w-xs"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            transform: 'translateY(-100%)',
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