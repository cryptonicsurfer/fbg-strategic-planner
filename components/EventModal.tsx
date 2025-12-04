import React, { useState, useEffect } from 'react';
import { CalendarEvent, MonthDef, TertialDef } from '../types';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  initialEvent?: CalendarEvent | null;
  months: MonthDef[];
  tertials: TertialDef[];
  currentYear: number;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialEvent,
  months,
  tertials,
  currentYear
}) => {
  const [formData, setFormData] = useState<Partial<CalendarEvent>>({
    title: '',
    description: '',
    date: '',
    year: currentYear
  });

  useEffect(() => {
    if (initialEvent) {
      setFormData(initialEvent);
    } else {
      setFormData({
        title: '',
        description: '',
        date: `${currentYear}-01-01`,
        year: currentYear
      });
    }
  }, [initialEvent, currentYear, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date) return;

    const dateObj = new Date(formData.date);
    const monthIndex = dateObj.getMonth();

    const newEvent: CalendarEvent = {
      id: initialEvent?.id || Date.now().toString(),
      title: formData.title,
      description: formData.description || '',
      date: formData.date,
      monthIndex: monthIndex,
      year: parseInt(formData.date.split('-')[0])
    };

    onSave(newEvent);
    onClose();
  };

  // Derive tertial from date
  const getTertialForDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    const m = new Date(dateStr).getMonth();
    const t = tertials.find(t => m >= t.startMonth && m <= t.endMonth);
    return t ? t.name : "-";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md p-6 border border-white/50 animate-in fade-in zoom-in duration-200">
        <h2 className="text-xl font-semibold text-gray-800 mb-1">
          {initialEvent ? 'Redigera Event' : 'Nytt Event'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {initialEvent ? 'Uppdatera detaljerna nedan.' : 'Lägg till en aktivitet i århjulet.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Rubrik (Label)
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-gray-800 placeholder-gray-400"
              placeholder="Ex. Business Arena"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Datum
            </label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-800"
            />
            <p className="text-xs text-gray-400 mt-1 pl-1">
              Tillhör: <span className="font-medium text-blue-500">{getTertialForDate(formData.date)}</span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Beskrivning
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-800 placeholder-gray-400 resize-none"
              placeholder="Kort beskrivning av eventet..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
             {initialEvent && (
              <button
                type="button"
                onClick={() => {
                    onDelete(initialEvent.id);
                    onClose();
                }}
                className="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors mr-auto"
              >
                Ta bort
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="px-6 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg shadow-lg shadow-gray-300/50 transition-all"
            >
              Spara
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;
