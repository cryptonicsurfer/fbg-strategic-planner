import React, { useState, useEffect, useCallback } from 'react';
import Wheel from './components/Wheel';
import Timeline from './components/Timeline';
import SpreadsheetView from './components/SpreadsheetView';
import ActivityModal from './components/ActivityModal';
import AIReportModal from './components/AIReportModal';
import ConceptSelector from './components/ConceptSelector';
import ViewToggle from './components/ViewToggle';
import YearSelector from './components/YearSelector';
import CopyYearModal from './components/CopyYearModal';
import ExportButton from './components/ExportButton';
import ThemeToggle from './components/ThemeToggle';
import LoginPage from './components/LoginPage';
import { conceptsApi, activitiesApi, authApi } from './api/client';
import { Activity, FocusArea, StrategicConcept, ViewMode, User } from './types';

const App: React.FC = () => {
  const currentYear = new Date().getFullYear();

  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // --- Data State ---
  const [concepts, setConcepts] = useState<StrategicConcept[]>([]);
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- UI State ---
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('wheel');
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isCopyYearModalOpen, setIsCopyYearModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);

  // --- Check Auth Status ---
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await authApi.check();
        setIsAuthenticated(result.authenticated);
        if (result.user) {
          setUser(result.user);
        } else if (result.canRefresh) {
          // Try to refresh token
          try {
            await authApi.refresh();
            const retryResult = await authApi.check();
            setIsAuthenticated(retryResult.authenticated);
            if (retryResult.user) setUser(retryResult.user);
          } catch {
            setIsAuthenticated(false);
          }
        }
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors
    }
    setIsAuthenticated(false);
    setUser(null);
  };

  // --- Load Data ---
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load concepts
      const conceptsData = await conceptsApi.getAll();
      setConcepts(conceptsData);

      // If a concept is selected, load its focus areas
      // Otherwise, load all focus areas
      let allFocusAreas: FocusArea[] = [];
      for (const concept of conceptsData) {
        const fas = await conceptsApi.getFocusAreas(concept.id);
        allFocusAreas = [...allFocusAreas, ...fas];
      }
      setFocusAreas(allFocusAreas);

      // Load activities (filtered if concept is selected)
      const activitiesData = await activitiesApi.getAll(
        selectedConceptId ? { concept_id: selectedConceptId, year: selectedYear } : { year: selectedYear }
      );
      setActivities(activitiesData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Kunde inte ladda data. Kontrollera din anslutning.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedConceptId, selectedYear]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [loadData, isAuthenticated]);

  // --- Filtered Data ---
  const filteredFocusAreas = selectedConceptId
    ? focusAreas.filter((fa) => fa.concept_id === selectedConceptId)
    : focusAreas;

  const filteredActivities = selectedConceptId
    ? activities.filter((a) => {
        const fa = focusAreas.find((f) => f.id === a.focus_area_id);
        return fa?.concept_id === selectedConceptId;
      })
    : activities;

  // --- Handlers ---
  const handleActivityClick = (activity: Activity) => {
    setSelectedActivity(activity);
    setIsActivityModalOpen(true);
  };

  const handleAddClick = () => {
    // Create new activity with default focus area
    const defaultFocusArea = filteredFocusAreas[0];
    if (!defaultFocusArea) {
      alert('Inga fokusområden tillgängliga. Välj ett koncept först.');
      return;
    }

    const newActivity: Activity = {
      id: `new_${Date.now()}`,
      focus_area_id: defaultFocusArea.id,
      title: '',
      description: null,
      start_date: null,
      end_date: null,
      responsible: null,
      purpose: null,
      theme: null,
      target_group: null,
      status: 'ongoing',
      weeks: [],
    };
    setSelectedActivity(newActivity);
    setIsActivityModalOpen(true);
  };

  const handleSaveActivity = async (activity: Activity) => {
    try {
      if (activity.id.startsWith('new')) {
        // Create new
        const { id, ...data } = activity;
        const created = await activitiesApi.create(data);
        setActivities((prev) => [...prev, created]);
      } else {
        // Update existing
        const updated = await activitiesApi.update(activity.id, activity);
        setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      }
      setIsActivityModalOpen(false);
      setSelectedActivity(null);
    } catch (err) {
      console.error('Failed to save activity:', err);
      alert('Kunde inte spara aktiviteten. Försök igen.');
    }
  };

  const handleDeleteActivity = async (id: string) => {
    try {
      await activitiesApi.delete(id);
      setActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to delete activity:', err);
      alert('Kunde inte ta bort aktiviteten. Försök igen.');
    }
  };

  // --- Get current concept name ---
  const currentConcept = concepts.find((c) => c.id === selectedConceptId);
  const headerTitle = currentConcept ? currentConcept.name : 'Strategisk Planering';

  // --- Handle copy year complete ---
  const handleCopyYearComplete = () => {
    loadData(); // Reload activities after copying
  };

  // --- Auth Loading State ---
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  // --- Login Page ---
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-900 flex flex-col relative overflow-hidden text-gray-800 dark:text-gray-200 transition-colors duration-200">
      {/* Header / Nav */}
      <header className="fixed top-0 left-0 right-0 z-40 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center md:gap-4 lg:gap-6">
          <div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {headerTitle}
            </h1>
            <p className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase">
              {selectedConceptId ? 'Fokusområde' : 'Alla koncept'}
            </p>
          </div>

          {/* Year Selector (Desktop) */}
          <div className="hidden md:block">
            <YearSelector
              currentYear={currentYear}
              selectedYear={selectedYear}
              onYearChange={setSelectedYear}
              onCopyYear={() => setIsCopyYearModalOpen(true)}
            />
          </div>

          {/* Concept Selector (Desktop) */}
          <div className="hidden lg:block">
            <ConceptSelector
              concepts={concepts}
              selectedConceptId={selectedConceptId}
              onSelect={setSelectedConceptId}
              isLoading={isLoading}
            />
          </div>

          {/* View Toggle (Desktop) */}
          <div className="hidden md:block">
            <ViewToggle currentView={viewMode} onViewChange={setViewMode} />
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {/* Mobile View Cycle */}
          <button
            onClick={() => {
              const views: ViewMode[] = ['wheel', 'timeline', 'spreadsheet'];
              const currentIndex = views.indexOf(viewMode);
              setViewMode(views[(currentIndex + 1) % views.length]);
            }}
            className="md:hidden p-2 text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Export Button */}
          <ExportButton
            activities={filteredActivities}
            focusAreas={filteredFocusAreas}
            concepts={concepts}
            year={selectedYear}
            selectedConceptId={selectedConceptId}
          />

          <button
            onClick={() => setIsAIModalOpen(true)}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-semibold rounded-full border border-blue-100 dark:border-blue-800 hover:border-blue-200 dark:hover:border-blue-700 transition-all shadow-sm"
          >
            <span className="text-lg">✨</span>
            <span className="hidden md:inline">AI Rapport</span>
          </button>

          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-black dark:bg-blue-600 text-white text-sm font-semibold rounded-full hover:bg-gray-800 dark:hover:bg-blue-700 transition-all shadow-lg shadow-gray-400/20 dark:shadow-blue-900/30"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden md:inline">Ny aktivitet</span>
          </button>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            title="Logga ut"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Concept Selector */}
      <div className="lg:hidden fixed top-[60px] left-0 right-0 z-30 px-4 py-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 overflow-x-auto">
        <ConceptSelector
          concepts={concepts}
          selectedConceptId={selectedConceptId}
          onSelect={setSelectedConceptId}
          isLoading={isLoading}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 pt-28 lg:pt-24 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : error ? (
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Försök igen
            </button>
          </div>
        ) : (
          <>
            {viewMode === 'wheel' && (
              <Wheel
                year={selectedYear}
                activities={filteredActivities}
                focusAreas={filteredFocusAreas}
                onActivityClick={handleActivityClick}
              />
            )}
            {viewMode === 'timeline' && (
              <Timeline
                year={selectedYear}
                activities={filteredActivities}
                focusAreas={filteredFocusAreas}
                onActivityClick={handleActivityClick}
              />
            )}
            {viewMode === 'spreadsheet' && (
              <SpreadsheetView
                year={selectedYear}
                activities={filteredActivities}
                focusAreas={filteredFocusAreas}
                onActivityClick={handleActivityClick}
                onActivityUpdate={async (activity) => {
                  try {
                    const updated = await activitiesApi.update(activity.id, activity);
                    setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
                  } catch (err) {
                    console.error('Failed to update activity:', err);
                  }
                }}
                onAddActivity={(focusAreaId) => {
                  const newActivity: Activity = {
                    id: `new_${Date.now()}`,
                    focus_area_id: focusAreaId,
                    title: '',
                    description: null,
                    start_date: null,
                    end_date: null,
                    responsible: null,
                    purpose: null,
                    theme: null,
                    target_group: null,
                    status: 'ongoing',
                    weeks: [],
                  };
                  setSelectedActivity(newActivity);
                  setIsActivityModalOpen(true);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Legend (Wheel view only) */}
      {viewMode === 'wheel' && filteredFocusAreas.length > 0 && (
        <div className="fixed bottom-6 left-6 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-white/50 dark:border-gray-700 hidden md:block">
          <h3 className="text-xs font-bold uppercase text-gray-400 dark:text-gray-500 mb-2">Fokusområden</h3>
          <div className="space-y-2">
            {filteredFocusAreas.map((fa) => (
              <div key={fa.id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: fa.color }} />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{fa.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <ActivityModal
        activity={selectedActivity}
        focusAreas={filteredFocusAreas}
        isOpen={isActivityModalOpen}
        onClose={() => {
          setIsActivityModalOpen(false);
          setSelectedActivity(null);
        }}
        onSave={handleSaveActivity}
        onDelete={handleDeleteActivity}
      />

      <AIReportModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        conceptId={selectedConceptId}
        currentYear={selectedYear}
      />

      <CopyYearModal
        isOpen={isCopyYearModalOpen}
        onClose={() => setIsCopyYearModalOpen(false)}
        targetYear={selectedYear}
        concepts={concepts}
        focusAreas={focusAreas}
        onCopyComplete={handleCopyYearComplete}
      />
    </div>
  );
};

export default App;
