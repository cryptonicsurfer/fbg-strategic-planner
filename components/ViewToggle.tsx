import React from 'react';
import { ViewMode } from '../types';

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ currentView, onViewChange }) => {
  const views: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    {
      mode: 'wheel',
      label: 'Årshjul',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      ),
    },
    {
      mode: 'timeline',
      label: 'Tidslinje',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
          <circle cx="6" cy="6" r="2" fill="currentColor" />
          <circle cx="14" cy="12" r="2" fill="currentColor" />
          <circle cx="10" cy="18" r="2" fill="currentColor" />
        </svg>
      ),
    },
    {
      mode: 'spreadsheet',
      label: 'Kalkylblad',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex bg-gray-200/50 p-1 rounded-lg">
      {views.map(({ mode, label, icon }) => (
        <button
          key={mode}
          onClick={() => onViewChange(mode)}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
            currentView === mode
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {icon}
          <span className="hidden md:inline">{label}</span>
        </button>
      ))}
    </div>
  );
};

export default ViewToggle;
