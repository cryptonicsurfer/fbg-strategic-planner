import React, { useState } from 'react';
import { aiApi } from '../api/client';
import ReactMarkdown from 'react-markdown';

interface AIReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  conceptId: string | null;
  currentYear: number;
}

const AIReportModal: React.FC<AIReportModalProps> = ({
  isOpen,
  onClose,
  conceptId,
  currentYear,
}) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  const handleQuery = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResponse('');

    try {
      const result = await aiApi.generateReport({
        prompt,
        conceptId,
        year: currentYear,
      });
      setResponse(result.report);
    } catch (error) {
      console.error('AI Report error:', error);
      setResponse('Ett fel uppstod vid kontakt med AI-tjänsten. Försök igen senare.');
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    `Sammanfatta alla aktiviteter för ${currentYear}.`,
    `Lista alla pågående aktiviteter och deras ansvariga.`,
    `Skapa en punktlista för ledningsgruppen över planerade aktiviteter.`,
    `Vilka fokusområden har flest aktiviteter?`,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-white/50 animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">AI Assistent</h2>
            <p className="text-xs text-gray-500">Ställ frågor om din planering och få smarta rapporter.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {!response && !loading && (
             <div className="space-y-4 mb-8">
               <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Förslag</p>
               <div className="grid gap-2">
                 {suggestions.map((s, i) => (
                   <button
                    key={i}
                    onClick={() => setPrompt(s)}
                    className="text-left p-3 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                   >
                     {s}
                   </button>
                 ))}
               </div>
             </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
               <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
               <p className="text-sm text-gray-500 animate-pulse">Analyserar data med Gemini...</p>
            </div>
          )}

          {response && (
            <div className="relative">
              <button
                onClick={handleCopy}
                className="absolute top-0 right-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Kopiera till urklipp"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-600">Kopierat!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Kopiera</span>
                  </>
                )}
              </button>
              <div className="prose prose-sm prose-slate max-w-none pt-10">
                <ReactMarkdown>{response}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-gray-100 rounded-b-2xl">
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Fråga om din planering..."
              onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <button
              onClick={handleQuery}
              disabled={loading || !prompt}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30"
            >
              Skicka
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIReportModal;
