import { Router, Response } from 'express';
import { query } from '../db';
import { AuthenticatedRequest, verifyDirectusToken } from '../middleware/auth';

const router = Router();

// Require authentication for all concept routes to avoid unauthenticated data access
router.use(verifyDirectusToken);

// Get all strategic concepts
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM strategic_concepts ORDER BY sort_order, name'
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching concepts:', error);
    return res.status(500).json({ error: 'Failed to fetch concepts' });
  }
});

// Get single concept with its focus areas
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const conceptResult = await query(
      'SELECT * FROM strategic_concepts WHERE id = $1',
      [id]
    );

    if (conceptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Concept not found' });
    }

    const focusAreasResult = await query(
      'SELECT * FROM focus_areas WHERE concept_id = $1 ORDER BY sort_order, name',
      [id]
    );

    return res.json({
      ...conceptResult.rows[0],
      focus_areas: focusAreasResult.rows
    });
  } catch (error) {
    console.error('Error fetching concept:', error);
    return res.status(500).json({ error: 'Failed to fetch concept' });
  }
});

// Get focus areas for a concept
router.get('/:id/focus-areas', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM focus_areas WHERE concept_id = $1 ORDER BY sort_order, name',
      [id]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching focus areas:', error);
    return res.status(500).json({ error: 'Failed to fetch focus areas' });
  }
});

// Create new concept (protected)
router.post('/', verifyDirectusToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, is_time_based, sort_order } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await query(
      `INSERT INTO strategic_concepts (name, description, is_time_based, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description || null, is_time_based || false, sort_order || 0]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating concept:', error);
    return res.status(500).json({ error: 'Failed to create concept' });
  }
});

// Update concept (protected)
router.put('/:id', verifyDirectusToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, is_time_based, sort_order } = req.body;

    const result = await query(
      `UPDATE strategic_concepts
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_time_based = COALESCE($3, is_time_based),
           sort_order = COALESCE($4, sort_order)
       WHERE id = $5
       RETURNING *`,
      [name, description, is_time_based, sort_order, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Concept not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating concept:', error);
    return res.status(500).json({ error: 'Failed to update concept' });
  }
});

// Delete concept (protected)
router.delete('/:id', verifyDirectusToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM strategic_concepts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Concept not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting concept:', error);
    return res.status(500).json({ error: 'Failed to delete concept' });
  }
});

// Create focus area within a concept (protected)
router.post('/:id/focus-areas', verifyDirectusToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color, start_month, end_month, sort_order } = req.body;

    if (!name || !color) {
      return res.status(400).json({ error: 'Name and color are required' });
    }

    const result = await query(
      `INSERT INTO focus_areas (concept_id, name, color, start_month, end_month, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, name, color, start_month ?? null, end_month ?? null, sort_order || 0]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating focus area:', error);
    return res.status(500).json({ error: 'Failed to create focus area' });
  }
});

export default router;
