-- Migration: Simplify to 4 fixed categories
-- Run this on your VPS PostgreSQL server

-- Step 1: Remove all other strategic concepts and their focus areas
-- (This will cascade delete their focus areas and activities - back up first!)
-- DELETE FROM strategic_concepts WHERE id != '11111111-1111-1111-1111-111111111111';

-- Step 2: Update the Verksamhetsplanering concept to no longer be time-based
UPDATE strategic_concepts
SET is_time_based = false,
    name = 'Fokusområden',
    description = 'De fyra huvudsakliga fokusområdena för verksamhetsplanering'
WHERE id = '11111111-1111-1111-1111-111111111111';

-- Step 3: Remove time-binding from existing focus areas
UPDATE focus_areas
SET start_month = NULL, end_month = NULL
WHERE concept_id = '11111111-1111-1111-1111-111111111111';

-- Step 4: Add "Övrigt" as a fourth focus area if it doesn't exist
INSERT INTO focus_areas (concept_id, name, color, start_month, end_month, sort_order)
SELECT '11111111-1111-1111-1111-111111111111', 'Övrigt', '#9CA3AF', NULL, NULL, 4
WHERE NOT EXISTS (
    SELECT 1 FROM focus_areas
    WHERE concept_id = '11111111-1111-1111-1111-111111111111'
    AND LOWER(name) = 'övrigt'
);

-- Step 5: Update sort order for clarity
UPDATE focus_areas SET sort_order = 1 WHERE name = 'Service & Kompetens' AND concept_id = '11111111-1111-1111-1111-111111111111';
UPDATE focus_areas SET sort_order = 2 WHERE name = 'Platsutveckling' AND concept_id = '11111111-1111-1111-1111-111111111111';
UPDATE focus_areas SET sort_order = 3 WHERE name = 'Etablering & Innovation' AND concept_id = '11111111-1111-1111-1111-111111111111';
UPDATE focus_areas SET sort_order = 4 WHERE LOWER(name) = 'övrigt' AND concept_id = '11111111-1111-1111-1111-111111111111';

-- Optional: Delete other concepts (uncomment if you want to clean up)
-- WARNING: This will delete all activities associated with those concepts!
-- DELETE FROM strategic_concepts WHERE id != '11111111-1111-1111-1111-111111111111';

-- Verify the changes
SELECT 'Focus Areas after migration:' as info;
SELECT id, name, color, start_month, end_month, sort_order
FROM focus_areas
WHERE concept_id = '11111111-1111-1111-1111-111111111111'
ORDER BY sort_order;
