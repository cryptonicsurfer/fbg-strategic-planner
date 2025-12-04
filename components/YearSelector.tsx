import React from 'react';

interface YearSelectorProps {
  currentYear: number;
  selectedYear: number;
  onYearChange: (year: number) => void;
  onCopyYear?: () => void;
}

const YearSelector: React.FC<YearSelectorProps> = ({
  currentYear,
  selectedYear,
  onYearChange,
  onCopyYear,
}) => {
  // Show years from 2 years ago to 2 years ahead
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center bg-gray-100 rounded-full p-1">
        <button
          onClick={() => onYearChange(selectedYear - 1)}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
          title="Föregående år"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <select
          value={selectedYear}
          onChange={(e) => onYearChange(parseInt(e.target.value))}
          className="bg-transparent text-sm font-semibold text-gray-700 px-2 py-1 rounded-md focus:outline-none cursor-pointer hover:bg-gray-200 transition-colors"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
              {year === currentYear ? ' (nu)' : ''}
            </option>
          ))}
        </select>

        <button
          onClick={() => onYearChange(selectedYear + 1)}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
          title="Nästa år"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {onCopyYear && (
        <button
          onClick={onCopyYear}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          title="Kopiera aktiviteter från annat år"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="hidden lg:inline">Kopiera år</span>
        </button>
      )}
    </div>
  );
};

export default YearSelector;
