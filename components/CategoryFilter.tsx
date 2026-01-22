import React from 'react';
import { FocusArea } from '../types';

interface CategoryFilterProps {
  focusAreas: FocusArea[];
  selectedCategoryIds: string[];
  onToggleCategory: (categoryId: string) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  focusAreas,
  selectedCategoryIds,
  onToggleCategory,
  onClearAll,
  onSelectAll,
}) => {
  const allSelected = selectedCategoryIds.length === 0 || selectedCategoryIds.length === focusAreas.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* All/Clear button */}
      <button
        onClick={allSelected ? onClearAll : onSelectAll}
        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
          allSelected
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        Alla
      </button>

      {/* Category buttons */}
      {focusAreas.map((fa) => {
        const isSelected = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(fa.id);
        const isFiltered = selectedCategoryIds.length > 0 && selectedCategoryIds.includes(fa.id);

        return (
          <button
            key={fa.id}
            onClick={() => onToggleCategory(fa.id)}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full transition-all border ${
              isFiltered
                ? 'border-transparent shadow-sm'
                : isSelected
                  ? 'border-gray-200 bg-white hover:bg-gray-50'
                  : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'
            }`}
            style={isFiltered ? { backgroundColor: fa.color, color: getContrastColor(fa.color) } : {}}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: fa.color }}
            />
            <span>{fa.name}</span>
          </button>
        );
      })}
    </div>
  );
};

// Helper to determine text color based on background
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1f2937' : '#ffffff';
}

export default CategoryFilter;
