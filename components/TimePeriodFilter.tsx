import React from 'react';

export interface TimePeriod {
  id: string;
  label: string;
  months: number[]; // 0-indexed month numbers
}

export const TIME_PERIODS: { [key: string]: TimePeriod[] } = {
  quarters: [
    { id: 'q1', label: 'Kv1', months: [0, 1, 2] },
    { id: 'q2', label: 'Kv2', months: [3, 4, 5] },
    { id: 'q3', label: 'Kv3', months: [6, 7, 8] },
    { id: 'q4', label: 'Kv4', months: [9, 10, 11] },
  ],
  tertials: [
    { id: 't1', label: 'T1', months: [0, 1, 2, 3] },
    { id: 't2', label: 'T2', months: [4, 5, 6, 7] },
    { id: 't3', label: 'T3', months: [8, 9, 10, 11] },
  ],
  halves: [
    { id: 'h1', label: '1H', months: [0, 1, 2, 3, 4, 5] },
    { id: 'h2', label: '2H', months: [6, 7, 8, 9, 10, 11] },
  ],
};

interface TimePeriodFilterProps {
  selectedPeriod: string | null;
  onSelectPeriod: (periodId: string | null) => void;
}

const TimePeriodFilter: React.FC<TimePeriodFilterProps> = ({
  selectedPeriod,
  onSelectPeriod,
}) => {
  const allPeriods = [
    ...TIME_PERIODS.halves,
    ...TIME_PERIODS.tertials,
    ...TIME_PERIODS.quarters,
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-400 mr-1">Visa:</span>

      {/* Full year button */}
      <button
        onClick={() => onSelectPeriod(null)}
        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
          selectedPeriod === null
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        Helår
      </button>

      <span className="text-gray-300 mx-1">|</span>

      {/* Half year buttons */}
      {TIME_PERIODS.halves.map((period) => (
        <button
          key={period.id}
          onClick={() => onSelectPeriod(selectedPeriod === period.id ? null : period.id)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
            selectedPeriod === period.id
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {period.label}
        </button>
      ))}

      <span className="text-gray-300 mx-1">|</span>

      {/* Tertial buttons */}
      {TIME_PERIODS.tertials.map((period) => (
        <button
          key={period.id}
          onClick={() => onSelectPeriod(selectedPeriod === period.id ? null : period.id)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
            selectedPeriod === period.id
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {period.label}
        </button>
      ))}

      <span className="text-gray-300 mx-1">|</span>

      {/* Quarter buttons */}
      {TIME_PERIODS.quarters.map((period) => (
        <button
          key={period.id}
          onClick={() => onSelectPeriod(selectedPeriod === period.id ? null : period.id)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
            selectedPeriod === period.id
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
};

export default TimePeriodFilter;
