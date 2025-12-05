import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { Activity, FocusArea } from '../types';
import { MONTHS, STATUS_LABELS, STATUS_COLORS, PURPOSE_OPTIONS, THEME_OPTIONS } from '../constants';

interface TooltipData {
  activity: Activity;
  x: number;
  y: number;
}

type EditableField = 'title' | 'responsible' | 'purpose' | 'theme' | 'target_group' | 'status';

interface EditingCell {
  activityId: string;
  field: EditableField;
}

interface SpreadsheetViewProps {
  activities: Activity[];
  focusAreas: FocusArea[];
  year: number;
  onActivityClick: (activity: Activity) => void;
  onActivityUpdate?: (activity: Activity) => void;
  onAddActivity?: (focusAreaId: string) => void;
}

// Field configuration for editing
const FIELD_CONFIG: Record<EditableField, {
  type: 'text' | 'select';
  options?: string[];
  placeholder?: string;
}> = {
  title: { type: 'text', placeholder: 'Aktivitetsnamn' },
  responsible: { type: 'text', placeholder: 'T.ex. MN' },
  purpose: { type: 'select', options: PURPOSE_OPTIONS },
  theme: { type: 'select', options: THEME_OPTIONS },
  target_group: { type: 'text', placeholder: 'T.ex. Alla företag' },
  status: { type: 'select', options: Object.keys(STATUS_LABELS) },
};

// Field order for tab navigation
const FIELD_ORDER: EditableField[] = ['title', 'responsible', 'purpose', 'theme', 'target_group'];

const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({
  activities,
  focusAreas,
  year,
  onActivityClick,
  onActivityUpdate,
  onAddActivity,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const isNavigatingRef = useRef(false); // Flag to prevent blur during Tab navigation

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editingCell]);

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

    if (activity.status) {
      lines.push(`Status: ${STATUS_LABELS[activity.status] || activity.status}`);
    }

    return { focusArea, lines };
  };

  const handleMouseEnter = (e: React.MouseEvent, activity: Activity) => {
    if (editingCell) return; // Don't show tooltip while editing
    const rect = scrollContainerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        activity,
        x: e.clientX - rect.left + scrollContainerRef.current!.scrollLeft,
        y: e.clientY - rect.top + scrollContainerRef.current!.scrollTop,
      });
    }
  };

  // Start editing a cell
  const startEditing = useCallback((activityId: string, field: EditableField, currentValue: string | null) => {
    setEditingCell({ activityId, field });
    setEditValue(currentValue || '');
    setTooltip(null);
  }, []);

  // Save the edit
  const saveEdit = useCallback(() => {
    if (!editingCell || !onActivityUpdate) {
      setEditingCell(null);
      return;
    }

    const activity = activities.find(a => a.id === editingCell.activityId);
    if (!activity) {
      setEditingCell(null);
      return;
    }

    // Check if value changed
    const currentValue = activity[editingCell.field];
    if (editValue !== (currentValue || '')) {
      const updatedActivity = {
        ...activity,
        [editingCell.field]: editValue || null,
      };
      onActivityUpdate(updatedActivity);
    }

    setEditingCell(null);
  }, [editingCell, editValue, activities, onActivityUpdate]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, activityId: string, currentField: EditableField) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      saveEdit();

      // Find next field or next activity
      const currentIndex = FIELD_ORDER.indexOf(currentField);
      const activityList = activities.filter(a => {
        const fa = focusAreas.find(f => f.id === a.focus_area_id);
        return fa !== undefined;
      });
      const activityIndex = activityList.findIndex(a => a.id === activityId);

      if (e.shiftKey) {
        // Move backward
        if (currentIndex > 0) {
          const prevField = FIELD_ORDER[currentIndex - 1];
          const activity = activityList[activityIndex];
          setTimeout(() => startEditing(activityId, prevField, activity[prevField] as string | null), 0);
        } else if (activityIndex > 0) {
          const prevActivity = activityList[activityIndex - 1];
          const lastField = FIELD_ORDER[FIELD_ORDER.length - 1];
          setTimeout(() => startEditing(prevActivity.id, lastField, prevActivity[lastField] as string | null), 0);
        }
      } else {
        // Move forward
        if (currentIndex < FIELD_ORDER.length - 1) {
          const nextField = FIELD_ORDER[currentIndex + 1];
          const activity = activityList[activityIndex];
          setTimeout(() => startEditing(activityId, nextField, activity[nextField] as string | null), 0);
        } else if (activityIndex < activityList.length - 1) {
          const nextActivity = activityList[activityIndex + 1];
          const firstField = FIELD_ORDER[0];
          setTimeout(() => startEditing(nextActivity.id, firstField, nextActivity[firstField] as string | null), 0);
        }
      }
    }
  }, [saveEdit, cancelEdit, activities, focusAreas, startEditing]);

  // Create an array of weeks 1-52
  const allWeeks = useMemo(() => Array.from({ length: 52 }, (_, i) => i + 1), []);

  // Group activities by focus area
  const activitiesByFocusArea = useMemo(() => {
    const map = new Map<string, Activity[]>();
    focusAreas.forEach((fa) => {
      map.set(fa.id, activities.filter((a) => a.focus_area_id === fa.id));
    });
    return map;
  }, [activities, focusAreas]);

  const getStatusColor = (status: string) => STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.ongoing;

  // Render editable cell - single click to edit
  const renderEditableCell = (
    activity: Activity,
    field: EditableField,
    displayValue: string,
    className: string,
    style?: React.CSSProperties
  ) => {
    const isEditing = editingCell?.activityId === activity.id && editingCell?.field === field;
    const config = FIELD_CONFIG[field];

    if (isEditing) {
      if (config.type === 'select') {
        const options = field === 'status'
          ? Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
          : (config.options || []).map(opt => ({ value: opt, label: opt }));

        // For select elements, save on change but keep editing open for Tab navigation
        const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
          const newValue = e.target.value;
          setEditValue(newValue);
          // Save immediately
          if (onActivityUpdate) {
            const updatedActivity = {
              ...activity,
              [field]: newValue || null,
            };
            onActivityUpdate(updatedActivity);
          }
          // Don't close editing - let Tab/Enter/blur handle that
        };

        // Handle keyboard for select - Tab navigation
        const handleSelectKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setEditingCell(null);
          } else if (e.key === 'Tab') {
            e.preventDefault();

            // Set navigating flag to prevent blur from closing
            isNavigatingRef.current = true;

            // Save current value first
            if (onActivityUpdate && editValue !== (activity[field] || '')) {
              const updatedActivity = {
                ...activity,
                [field]: editValue || null,
              };
              onActivityUpdate(updatedActivity);
            }

            // Navigate to next/prev field
            const currentIndex = FIELD_ORDER.indexOf(field);
            const activityList = activities.filter(a => {
              const fa = focusAreas.find(f => f.id === a.focus_area_id);
              return fa !== undefined;
            });
            const activityIndex = activityList.findIndex(a => a.id === activity.id);

            if (e.shiftKey) {
              // Move backward
              if (currentIndex > 0) {
                const prevField = FIELD_ORDER[currentIndex - 1];
                const act = activityList[activityIndex];
                setTimeout(() => {
                  startEditing(activity.id, prevField, act[prevField] as string | null);
                  isNavigatingRef.current = false;
                }, 0);
              } else if (activityIndex > 0) {
                const prevActivity = activityList[activityIndex - 1];
                const lastField = FIELD_ORDER[FIELD_ORDER.length - 1];
                setTimeout(() => {
                  startEditing(prevActivity.id, lastField, prevActivity[lastField] as string | null);
                  isNavigatingRef.current = false;
                }, 0);
              } else {
                isNavigatingRef.current = false;
                setEditingCell(null);
              }
            } else {
              // Move forward
              if (currentIndex < FIELD_ORDER.length - 1) {
                const nextField = FIELD_ORDER[currentIndex + 1];
                const act = activityList[activityIndex];
                setTimeout(() => {
                  startEditing(activity.id, nextField, act[nextField] as string | null);
                  isNavigatingRef.current = false;
                }, 0);
              } else if (activityIndex < activityList.length - 1) {
                const nextActivity = activityList[activityIndex + 1];
                const firstField = FIELD_ORDER[0];
                setTimeout(() => {
                  startEditing(nextActivity.id, firstField, nextActivity[firstField] as string | null);
                  isNavigatingRef.current = false;
                }, 0);
              } else {
                isNavigatingRef.current = false;
                setEditingCell(null);
              }
            }
          } else if (e.key === 'Enter') {
            e.preventDefault();
            // Save and close
            if (onActivityUpdate && editValue !== (activity[field] || '')) {
              const updatedActivity = {
                ...activity,
                [field]: editValue || null,
              };
              onActivityUpdate(updatedActivity);
            }
            setEditingCell(null);
          }
        };

        // Handle blur - only close if not navigating
        const handleSelectBlur = () => {
          if (!isNavigatingRef.current) {
            setEditingCell(null);
          }
        };

        return (
          <td className={`${className} p-0`} style={style}>
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={editValue}
              onChange={handleSelectChange}
              onBlur={handleSelectBlur}
              onKeyDown={handleSelectKeyDown}
              className="w-full h-full px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white border-2 border-blue-500 rounded outline-none"
            >
              <option value="">Välj...</option>
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </td>
        );
      }

      return (
        <td className={`${className} p-0`} style={style}>
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => handleKeyDown(e, activity.id, field)}
            placeholder={config.placeholder}
            className="w-full h-full px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-white border-2 border-blue-500 rounded outline-none"
          />
        </td>
      );
    }

    return (
      <td
        className={`${className} cursor-text hover:bg-blue-50/50`}
        style={style}
        onClick={(e) => {
          e.stopPropagation();
          if (onActivityUpdate) {
            startEditing(activity.id, field, activity[field] as string | null);
          }
        }}
        title={onActivityUpdate ? 'Klicka för att redigera' : undefined}
      >
        {displayValue}
      </td>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto custom-scrollbar flex-1 relative"
      >
        <table className="border-collapse min-w-max text-sm text-left">
          <thead className="sticky top-0 z-20 bg-gray-100 text-gray-700 font-semibold shadow-sm">
            {/* Month Header Row */}
            <tr>
              <th className="sticky left-0 z-30 bg-gray-100 border-b border-r border-gray-300 min-w-[280px] p-2">
                Aktivitet / Kategori
              </th>
              <th className="bg-gray-100 border-b border-r border-gray-300 w-20 p-2 text-center">
                Ansvarig
              </th>
              <th className="bg-gray-100 border-b border-r border-gray-300 w-28 p-2">
                Syfte
              </th>
              <th className="bg-gray-100 border-b border-r border-gray-300 w-24 p-2">
                Tema
              </th>
              <th className="bg-gray-100 border-b border-r border-gray-300 w-36 p-2">
                Målgrupp
              </th>

              {MONTHS.map((month) => {
                const colSpan = month.endWeek - month.startWeek + 1;
                return (
                  <th
                    key={month.name}
                    colSpan={colSpan}
                    className="border-b border-r border-gray-300 text-center bg-gray-200 px-1 py-2 text-xs uppercase tracking-wider font-bold"
                  >
                    {month.shortName}
                  </th>
                );
              })}
            </tr>

            {/* Week Header Row */}
            <tr className="text-xs text-gray-500">
              <th className="sticky left-0 z-30 bg-gray-50 border-b border-r border-gray-300 p-2 font-normal italic">
                Vecka
              </th>
              <th className="bg-gray-50 border-b border-r border-gray-300" />
              <th className="bg-gray-50 border-b border-r border-gray-300" />
              <th className="bg-gray-50 border-b border-r border-gray-300" />
              <th className="bg-gray-50 border-b border-r border-gray-300" />

              {allWeeks.map((week) => (
                <th
                  key={week}
                  className="border-b border-r border-gray-300 text-center w-8 bg-gray-50 p-1 font-mono"
                >
                  {week}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {focusAreas.map((focusArea) => {
              const faActivities = activitiesByFocusArea.get(focusArea.id) || [];

              // Generate light background color from focus area color
              const lightBg = focusArea.color + '20'; // Add alpha for light version

              return (
                <React.Fragment key={focusArea.id}>
                  {/* Focus Area Header Row */}
                  <tr style={{ backgroundColor: focusArea.color + '40' }}>
                    <td
                      className="sticky left-0 z-20 border-b border-r border-gray-400 p-2 font-bold text-gray-800"
                      style={{ backgroundColor: focusArea.color + '40' }}
                    >
                      {focusArea.name}
                    </td>
                    <td className="border-b border-r border-gray-400" />
                    <td className="border-b border-r border-gray-400" />
                    <td className="border-b border-r border-gray-400" />
                    <td className="border-b border-r border-gray-400" />

                    {allWeeks.map((week) => (
                      <td
                        key={`fa-${focusArea.id}-w${week}`}
                        className="border-b border-r border-gray-400"
                      />
                    ))}
                  </tr>

                  {/* Activity Rows */}
                  {faActivities.map((activity) => {
                    const isEditingThisRow = editingCell?.activityId === activity.id;
                    const isEditingTitle = editingCell?.activityId === activity.id && editingCell?.field === 'title';

                    return (
                      <tr
                        key={activity.id}
                        onMouseEnter={(e) => handleMouseEnter(e, activity)}
                        onMouseLeave={() => setTooltip(null)}
                        className={`transition-colors ${isEditingThisRow ? '' : 'hover:brightness-95'} group`}
                        style={{ backgroundColor: lightBg }}
                      >
                        {/* Title cell with status indicator and open-modal button */}
                        <td
                          className="sticky left-0 z-10 border-b border-r border-gray-300 p-0 text-gray-800 group-hover:brightness-95"
                          style={{ backgroundColor: lightBg }}
                        >
                          {isEditingTitle ? (
                            <div className="flex items-center gap-2 p-0">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0 ml-2"
                                style={{ backgroundColor: getStatusColor(activity.status) }}
                              />
                              <input
                                ref={inputRef as React.RefObject<HTMLInputElement>}
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={(e) => handleKeyDown(e, activity.id, 'title')}
                                placeholder="Aktivitetsnamn"
                                className="flex-1 h-full px-2 py-1.5 text-sm bg-white border-2 border-blue-500 rounded outline-none"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-2">
                              {/* Status indicator - click to cycle status */}
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0 cursor-pointer hover:scale-125 transition-transform"
                                style={{ backgroundColor: getStatusColor(activity.status) }}
                                title={`${STATUS_LABELS[activity.status]} - Klicka för att ändra`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onActivityUpdate) {
                                    const statuses = Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>;
                                    const currentIndex = statuses.indexOf(activity.status);
                                    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                                    onActivityUpdate({ ...activity, status: nextStatus });
                                  }
                                }}
                              />
                              {/* Title - click to edit inline */}
                              <span
                                className="truncate max-w-[180px] cursor-text hover:bg-blue-50/50 px-1 rounded flex-1"
                                onClick={() => {
                                  if (onActivityUpdate) {
                                    startEditing(activity.id, 'title', activity.title);
                                  }
                                }}
                                title={onActivityUpdate ? 'Klicka för att redigera' : undefined}
                              >
                                {activity.title}
                              </span>
                              {/* Expand button to open modal */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onActivityClick(activity);
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Öppna detaljer"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>

                        {renderEditableCell(
                          activity,
                          'responsible',
                          activity.responsible || '',
                          'border-b border-r border-gray-300 p-2 text-center text-xs font-medium'
                        )}

                        {renderEditableCell(
                          activity,
                          'purpose',
                          activity.purpose || '',
                          'border-b border-r border-gray-300 p-2 text-xs truncate max-w-[120px]'
                        )}

                        {renderEditableCell(
                          activity,
                          'theme',
                          activity.theme || '',
                          'border-b border-r border-gray-300 p-2 text-xs'
                        )}

                        {renderEditableCell(
                          activity,
                          'target_group',
                          activity.target_group || '',
                          'border-b border-r border-gray-300 p-2 text-xs truncate max-w-[140px]'
                        )}

                        {allWeeks.map((week) => {
                          const isActive = activity.weeks.includes(week);
                          const isNextActive = activity.weeks.includes(week + 1);
                          const isPrevActive = activity.weeks.includes(week - 1);

                          let cellClass = '';
                          let borderClass = 'border-r border-gray-300';
                          let roundedClass = '';

                          if (isActive) {
                            cellClass = 'text-white font-bold';

                            if (isNextActive) {
                              borderClass = 'border-r';
                            }

                            if (!isPrevActive && isNextActive) roundedClass = 'rounded-l-md';
                            if (isPrevActive && !isNextActive) roundedClass = 'rounded-r-md';
                            if (!isPrevActive && !isNextActive) roundedClass = 'rounded-md mx-0.5';
                          }

                          // Toggle week on click
                          const handleWeekClick = () => {
                            if (!onActivityUpdate) return;

                            let newWeeks: number[];
                            if (isActive) {
                              // Remove week
                              newWeeks = activity.weeks.filter(w => w !== week);
                            } else {
                              // Add week and sort
                              newWeeks = [...activity.weeks, week].sort((a, b) => a - b);
                            }

                            onActivityUpdate({
                              ...activity,
                              weeks: newWeeks,
                            });
                          };

                          return (
                            <td
                              key={`act-${activity.id}-w${week}`}
                              className={`border-b ${borderClass} text-center text-[10px] ${cellClass} ${roundedClass} ${onActivityUpdate ? 'cursor-pointer' : ''} ${onActivityUpdate && !isActive ? 'hover:bg-gray-200/50' : ''} ${onActivityUpdate && isActive ? 'hover:opacity-75' : ''}`}
                              style={isActive ? { backgroundColor: focusArea.color } : undefined}
                              onClick={onActivityUpdate ? handleWeekClick : undefined}
                              title={onActivityUpdate ? (isActive ? `Ta bort vecka ${week}` : `Lägg till vecka ${week}`) : undefined}
                            >
                              {isActive ? week : ''}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Add new activity row */}
                  {onAddActivity && (
                    <tr
                      onClick={() => onAddActivity(focusArea.id)}
                      className="hover:brightness-95 cursor-pointer group transition-colors"
                      style={{ backgroundColor: lightBg }}
                    >
                      <td
                        className="sticky left-0 z-10 border-b border-r border-gray-300 p-2 text-gray-400 group-hover:text-gray-600 group-hover:brightness-95"
                        style={{ backgroundColor: lightBg }}
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="text-xs italic">Lägg till aktivitet...</span>
                        </div>
                      </td>
                      <td className="border-b border-r border-gray-300" />
                      <td className="border-b border-r border-gray-300" />
                      <td className="border-b border-r border-gray-300" />
                      <td className="border-b border-r border-gray-300" />
                      {allWeeks.map((week) => (
                        <td key={`add-${focusArea.id}-w${week}`} className="border-b border-r border-gray-300" />
                      ))}
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Tooltip */}
        {tooltip && !editingCell && (
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

      {/* Footer */}
      <div className="p-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
        <span>Visar kalenderår {year}</span>
        <div className="flex items-center gap-4">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[key as keyof typeof STATUS_COLORS] }}
              />
              {label}
            </div>
          ))}
        </div>
        <span className="hidden md:inline">
          {onActivityUpdate ? 'Klicka på cell för att redigera · ' : ''}
          Scrolla horisontellt för att se hela året &rarr;
        </span>
      </div>
    </div>
  );
};

export default SpreadsheetView;
