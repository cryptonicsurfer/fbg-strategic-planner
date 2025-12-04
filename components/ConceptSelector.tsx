import React from 'react';
import { StrategicConcept } from '../types';

interface ConceptSelectorProps {
  concepts: StrategicConcept[];
  selectedConceptId: string | null;
  onSelect: (conceptId: string | null) => void;
  isLoading?: boolean;
}

const ConceptSelector: React.FC<ConceptSelectorProps> = ({
  concepts,
  selectedConceptId,
  onSelect,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 animate-pulse">
        <div className="h-8 w-32 bg-gray-200 rounded-lg" />
        <div className="h-8 w-32 bg-gray-200 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
      {/* View All option */}
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
          selectedConceptId === null
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        }`}
      >
        Alla
      </button>

      {/* Individual concepts */}
      {concepts.map((concept) => (
        <button
          key={concept.id}
          onClick={() => onSelect(concept.id)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
            selectedConceptId === concept.id
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          title={concept.description || undefined}
        >
          {concept.name}
        </button>
      ))}
    </div>
  );
};

export default ConceptSelector;
