import Fuse from 'fuse.js';

interface FocusArea {
  id: string;
  name: string;
  concept_id: string;
  color: string;
  start_month: number | null;
  end_month: number | null;
}

interface MatchResult {
  focus_area_id: string | null;
  focus_area_name: string;
  confidence: number;
  needs_review: boolean;
  review_reason?: string;
}

const CONFIDENCE_THRESHOLD = 0.8;

/**
 * Fuzzy matches a suggested focus area name against available focus areas.
 * Returns the best match with a confidence score.
 */
export function matchFocusArea(
  suggestedName: string,
  focusAreas: FocusArea[],
  conceptId?: string
): MatchResult {
  if (!suggestedName || suggestedName.trim() === '') {
    return {
      focus_area_id: null,
      focus_area_name: suggestedName,
      confidence: 0,
      needs_review: true,
      review_reason: 'Inget fokusområde angivet',
    };
  }

  // Filter by concept if provided
  const availableFocusAreas = conceptId
    ? focusAreas.filter((fa) => fa.concept_id === conceptId)
    : focusAreas;

  if (availableFocusAreas.length === 0) {
    return {
      focus_area_id: null,
      focus_area_name: suggestedName,
      confidence: 0,
      needs_review: true,
      review_reason: 'Inga fokusområden tillgängliga',
    };
  }

  // Try exact match first (case-insensitive)
  const exactMatch = availableFocusAreas.find(
    (fa) => fa.name.toLowerCase() === suggestedName.toLowerCase()
  );

  if (exactMatch) {
    return {
      focus_area_id: exactMatch.id,
      focus_area_name: exactMatch.name,
      confidence: 1.0,
      needs_review: false,
    };
  }

  // Fuzzy search with Fuse.js
  const fuse = new Fuse(availableFocusAreas, {
    keys: ['name'],
    includeScore: true,
    threshold: 0.4, // Allow fairly loose matches
    ignoreLocation: true,
  });

  const results = fuse.search(suggestedName);

  if (results.length === 0) {
    return {
      focus_area_id: null,
      focus_area_name: suggestedName,
      confidence: 0,
      needs_review: true,
      review_reason: `Kunde inte matcha "${suggestedName}" till något fokusområde`,
    };
  }

  const bestMatch = results[0];
  // Fuse.js score is 0 (perfect) to 1 (no match), so we invert it
  const confidence = 1 - (bestMatch.score || 0);

  if (confidence >= CONFIDENCE_THRESHOLD) {
    return {
      focus_area_id: bestMatch.item.id,
      focus_area_name: bestMatch.item.name,
      confidence,
      needs_review: false,
    };
  }

  return {
    focus_area_id: bestMatch.item.id,
    focus_area_name: bestMatch.item.name,
    confidence,
    needs_review: true,
    review_reason: `Osäker matchning: "${suggestedName}" → "${bestMatch.item.name}" (${Math.round(confidence * 100)}% säkerhet)`,
  };
}

/**
 * Matches multiple focus area suggestions at once.
 */
export function matchFocusAreas(
  suggestions: string[],
  focusAreas: FocusArea[],
  conceptId?: string
): MatchResult[] {
  return suggestions.map((name) => matchFocusArea(name, focusAreas, conceptId));
}

/**
 * Formats focus areas for inclusion in AI prompts.
 */
export function formatFocusAreasForPrompt(focusAreas: FocusArea[]): string {
  return focusAreas
    .map((fa) => {
      const months =
        fa.start_month !== null && fa.end_month !== null
          ? ` (månad ${fa.start_month + 1}-${fa.end_month + 1})`
          : ' (temabaserat)';
      return `- ${fa.name}${months}`;
    })
    .join('\n');
}
