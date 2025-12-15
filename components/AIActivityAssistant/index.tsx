import React, { useState, useRef, useEffect, useCallback } from 'react';
import { aiApi, activitiesApi } from '../../api/client';
import { GeneratedActivity, FocusArea, Activity } from '../../types';

interface AIActivityAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  conceptId: string | null;
  currentYear: number;
  focusAreas: FocusArea[];
  onActivitiesCreated: (activities: Activity[]) => void;
}

type TabType = 'text' | 'excel';

interface ImagePreview {
  file: File;
  url: string;
}

const AIActivityAssistant: React.FC<AIActivityAssistantProps> = ({
  isOpen,
  onClose,
  conceptId,
  currentYear,
  focusAreas,
  onActivitiesCreated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('text');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedActivities, setGeneratedActivities] = useState<GeneratedActivity[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cleanup image URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.url));
    };
  }, []);

  // Handle paste (Cmd+V)
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!isOpen || activeTab !== 'text') return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          addImage(file);
        }
        break;
      }
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const addImage = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Bilden är för stor (max 10MB)');
      return;
    }

    const url = URL.createObjectURL(file);
    setImages(prev => [...prev, { file, url }]);
    setError(null);
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev];
      URL.revokeObjectURL(newImages[index].url);
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(addImage);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (activeTab === 'text') {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (activeTab !== 'text') return;

    const files = e.dataTransfer.files;
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        addImage(file);
      }
    });
  };

  if (!isOpen) return null;

  const handleGenerateFromText = async () => {
    if (!description.trim() && images.length === 0) return;
    setLoading(true);
    setError(null);
    setGeneratedActivities([]);
    setSelectedIndexes(new Set());

    try {
      const imageFiles = images.map(img => img.file);
      const result = await aiApi.generateActivities({
        description,
        conceptId,
        year: currentYear,
        images: imageFiles.length > 0 ? imageFiles : undefined,
      });
      setGeneratedActivities(result.activities);
      // Auto-select activities that don't need review
      const autoSelect = new Set<number>();
      result.activities.forEach((a, i) => {
        if (!a.needs_review && a.matched_focus_area_id) {
          autoSelect.add(i);
        }
      });
      setSelectedIndexes(autoSelect);
    } catch (err) {
      console.error('Generate activities error:', err);
      setError('Kunde inte generera aktiviteter. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setGeneratedActivities([]);
    setSelectedIndexes(new Set());

    try {
      const result = await aiApi.parseExcel(file, conceptId, currentYear);
      setGeneratedActivities(result.activities);
      // Auto-select activities that don't need review
      const autoSelect = new Set<number>();
      result.activities.forEach((a, i) => {
        if (!a.needs_review && a.matched_focus_area_id) {
          autoSelect.add(i);
        }
      });
      setSelectedIndexes(autoSelect);
    } catch (err: any) {
      console.error('Parse Excel error:', err);
      const details = err?.message || '';
      setError(`Kunde inte tolka Excel-filen. ${details}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedIndexes);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      // Only allow selection if focus area is matched
      if (generatedActivities[index].matched_focus_area_id) {
        newSelected.add(index);
      }
    }
    setSelectedIndexes(newSelected);
  };

  const selectAll = () => {
    const allValid = new Set<number>();
    generatedActivities.forEach((a, i) => {
      if (a.matched_focus_area_id) {
        allValid.add(i);
      }
    });
    setSelectedIndexes(allValid);
  };

  const deselectAll = () => {
    setSelectedIndexes(new Set());
  };

  const updateFocusArea = (index: number, focusAreaId: string) => {
    const fa = focusAreas.find(f => f.id === focusAreaId);
    if (!fa) return;

    const updated = [...generatedActivities];
    updated[index] = {
      ...updated[index],
      matched_focus_area_id: focusAreaId,
      matched_focus_area_name: fa.name,
      needs_review: false,
      review_reason: undefined,
      confidence: 1,
    };
    setGeneratedActivities(updated);
  };

  const handleCreateActivities = async () => {
    const toCreate = generatedActivities
      .filter((_, i) => selectedIndexes.has(i))
      .map(a => ({
        focus_area_id: a.matched_focus_area_id!,
        title: a.title,
        description: a.description,
        start_date: a.start_date,
        end_date: a.end_date,
        weeks: a.weeks,
        responsible: a.responsible,
        purpose: a.purpose,
        theme: a.theme,
        target_group: a.target_group,
        status: a.status,
      }));

    if (toCreate.length === 0) return;

    setCreating(true);
    setError(null);

    try {
      const result = await activitiesApi.batchCreate(toCreate);
      onActivitiesCreated(result.created);

      const messages: string[] = [];

      if (result.created.length > 0) {
        messages.push(`${result.created.length} aktivitet${result.created.length !== 1 ? 'er' : ''} skapades`);
      }

      if (result.skipped && result.skipped.length > 0) {
        messages.push(`${result.skipped.length} hoppades över (redan finns)`);
      }

      if (result.failed.length > 0) {
        messages.push(`${result.failed.length} misslyckades`);
      }

      if (result.failed.length > 0 || (result.skipped && result.skipped.length > 0)) {
        setError(messages.join(', ') + '.');
        // Keep modal open if there were issues
        if (result.created.length === 0) {
          return;
        }
      }

      // Close if at least some were created successfully
      if (result.created.length > 0 && result.failed.length === 0) {
        onClose();
      }
    } catch (err) {
      console.error('Create activities error:', err);
      setError('Kunde inte skapa aktiviteter. Försök igen.');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setDescription('');
    setGeneratedActivities([]);
    setSelectedIndexes(new Set());
    setError(null);
    // Cleanup image URLs
    images.forEach(img => URL.revokeObjectURL(img.url));
    setImages([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-white/50">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">AI Aktivitetsassistent</h2>
            <p className="text-xs text-gray-500">Skapa aktiviteter från text eller Excel-fil</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('text')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'text'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Textbeskrivning
          </button>
          <button
            onClick={() => setActiveTab('excel')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'excel'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Excel-import
          </button>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto p-6 relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-xl z-10 flex items-center justify-center">
              <div className="text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-blue-600 font-medium">Släpp bilden här</p>
              </div>
            </div>
          )}

          {/* Input Section */}
          {generatedActivities.length === 0 && !loading && (
            <div className="space-y-4">
              {activeTab === 'text' ? (
                <>
                  <label className="block text-sm font-medium text-gray-700">
                    Beskriv aktiviteterna du vill skapa
                  </label>
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="T.ex. Vi ska ha strategidagar i januari vecka 2, en kompetensmässa i mars vecka 10-12... Du kan också klistra in eller dra bilder hit."
                      rows={6}
                      className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                    />
                    {/* Attachment button */}
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="absolute right-3 bottom-3 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Bifoga bild"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>

                  {/* Image previews */}
                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {images.map((img, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={img.url}
                            alt={`Uppladdad bild ${index + 1}`}
                            className="h-20 w-20 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-400">
                    Tips: Klistra in bilder med Cmd+V, dra och släpp, eller klicka på gem-ikonen
                  </p>

                  <button
                    onClick={handleGenerateFromText}
                    disabled={!description.trim() && images.length === 0}
                    className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Analysera med AI
                  </button>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700">
                    Ladda upp en Excel-fil (.xlsx)
                  </label>
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-300 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-gray-600 mb-2">Klicka för att välja fil eller dra och släpp</p>
                    <p className="text-xs text-gray-400">Max 5MB, .xlsx eller .xls</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-sm text-gray-500 animate-pulse">
                {activeTab === 'text' ? 'Analyserar beskrivning...' : 'Tolkar Excel-fil...'}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Generated Activities */}
          {generatedActivities.length > 0 && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  Föreslagna aktiviteter ({generatedActivities.length} st)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Välj alla
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Avmarkera alla
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {generatedActivities.map((activity, index) => (
                  <ActivityPreviewCard
                    key={index}
                    activity={activity}
                    isSelected={selectedIndexes.has(index)}
                    onToggle={() => toggleSelection(index)}
                    focusAreas={focusAreas}
                    onFocusAreaChange={(faId) => updateFocusArea(index, faId)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {generatedActivities.length > 0 && (
          <div className="p-4 bg-white border-t border-gray-100 rounded-b-2xl flex justify-between items-center">
            <button
              onClick={() => {
                setGeneratedActivities([]);
                setSelectedIndexes(new Set());
                setDescription('');
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Tillbaka
            </button>
            <button
              onClick={handleCreateActivities}
              disabled={selectedIndexes.size === 0 || creating}
              className="px-6 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {creating ? 'Skapar...' : `Skapa ${selectedIndexes.size} aktivitet${selectedIndexes.size !== 1 ? 'er' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Activity Preview Card Component
interface ActivityPreviewCardProps {
  activity: GeneratedActivity;
  isSelected: boolean;
  onToggle: () => void;
  focusAreas: FocusArea[];
  onFocusAreaChange: (focusAreaId: string) => void;
}

const ActivityPreviewCard: React.FC<ActivityPreviewCardProps> = ({
  activity,
  isSelected,
  onToggle,
  focusAreas,
  onFocusAreaChange,
}) => {
  const focusArea = focusAreas.find(fa => fa.id === activity.matched_focus_area_id);

  return (
    <div className={`p-4 rounded-xl border-2 transition-all ${
      activity.needs_review
        ? 'border-amber-200 bg-amber-50/50'
        : isSelected
          ? 'border-blue-300 bg-blue-50/50'
          : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'
    }`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          disabled={!activity.matched_focus_area_id}
          className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-gray-800 truncate">{activity.title}</h4>
            {activity.needs_review && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full whitespace-nowrap">
                Kräver granskning
              </span>
            )}
          </div>

          {activity.needs_review ? (
            <div className="mb-2">
              <p className="text-xs text-amber-600 mb-2">{activity.review_reason}</p>
              <select
                value={activity.matched_focus_area_id || ''}
                onChange={(e) => onFocusAreaChange(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                <option value="">Välj fokusområde...</option>
                {focusAreas.map(fa => (
                  <option key={fa.id} value={fa.id}>{fa.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: focusArea?.color || '#gray' }}
              />
              <span className="text-sm text-gray-600">{activity.matched_focus_area_name}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            {activity.start_date && (
              <span className="px-2 py-1 bg-gray-100 rounded">{activity.start_date}</span>
            )}
            {activity.weeks.length > 0 && (
              <span className="px-2 py-1 bg-gray-100 rounded">
                Vecka {activity.weeks.length > 3
                  ? `${activity.weeks[0]}-${activity.weeks[activity.weeks.length - 1]}`
                  : activity.weeks.join(', ')
                }
              </span>
            )}
            {activity.responsible && (
              <span className="px-2 py-1 bg-gray-100 rounded">{activity.responsible}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIActivityAssistant;
