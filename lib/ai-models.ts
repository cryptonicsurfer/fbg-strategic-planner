// LLM-modeller valbara i AI-funktionerna. Mistral först → default när inget valts.
// Backend (server/services/llm.ts) avgör provider från model-id:t och faller
// tillbaka till default om värdet är okänt, så den här listan kan ligga "före"
// backend utan att något går sönder.
export interface AIModelOption {
  id: string;
  label: string;
}

export const AI_MODELS: AIModelOption[] = [
  { id: 'mistral-medium-3.5', label: 'Mistral Medium 3.5' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
];

export const DEFAULT_MODEL = AI_MODELS[0].id;
