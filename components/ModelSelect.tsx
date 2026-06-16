import React from 'react';
import { AI_MODELS } from '../lib/ai-models';

interface ModelSelectProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  className?: string;
}

/** Liten dropdown för att välja LLM-modell (Mistral / Gemini). */
const ModelSelect: React.FC<ModelSelectProps> = ({ value, onChange, disabled, className }) => (
  <label className={`flex items-center gap-2 text-xs text-gray-500 ${className ?? ''}`}>
    <span className="whitespace-nowrap">Modell</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50"
    >
      {AI_MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  </label>
);

export default ModelSelect;
