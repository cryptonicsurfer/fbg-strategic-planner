import { Router, Response } from 'express';
import { query } from '../db';
import { AuthenticatedRequest, verifyDirectusToken } from '../middleware/auth';

const router = Router();

// Get activities with optional filters
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { concept_id, focus_area_id, status, year } = req.query;

    let sql = `
      SELECT a.*, fa.name as focus_area_name, fa.color as focus_area_color,
             sc.id as concept_id, sc.name as concept_name
      FROM activities a
      JOIN focus_areas fa ON a.focus_area_id = fa.id
      JOIN strategic_concepts sc ON fa.concept_id = sc.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (concept_id) {
      sql += ` AND sc.id = $${paramIndex}`;
      params.push(concept_id);
      paramIndex++;
    }

    if (focus_area_id) {
      sql += ` AND a.focus_area_id = $${paramIndex}`;
      params.push(focus_area_id);
      paramIndex++;
    }

    if (status) {
      sql += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (year) {
      sql += ` AND (EXTRACT(YEAR FROM a.start_date) = $${paramIndex} OR EXTRACT(YEAR FROM a.end_date) = $${paramIndex})`;
      params.push(year);
      paramIndex++;
    }

    sql += ' ORDER BY a.start_date NULLS LAST, a.title';

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get single activity
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT a.*, fa.name as focus_area_name, fa.color as focus_area_color,
              sc.id as concept_id, sc.name as concept_name
       FROM activities a
       JOIN focus_areas fa ON a.focus_area_id = fa.id
       JOIN strategic_concepts sc ON fa.concept_id = sc.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching activity:', error);
    return res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Create activity (protected)
router.post('/', verifyDirectusToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      focus_area_id,
      title,
      description,
      start_date,
      end_date,
      responsible,
      purpose,
      theme,
      target_group,
      status,
      weeks
    } = req.body;

    if (!focus_area_id || !title) {
      return res.status(400).json({ error: 'focus_area_id and title are required' });
    }

    const result = await query(
      `INSERT INTO activities (
        focus_area_id, title, description, start_date, end_date,
        responsible, purpose, theme, target_group, status, weeks
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        focus_area_id,
        title,
        description || null,
        start_date || null,
        end_date || null,
        responsible || null,
        purpose || null,
        theme || null,
        target_group || null,
        status || 'ongoing',
        weeks || []
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating activity:', error);
    return res.status(500).json({ error: 'Failed to create activity' });
  }
});

// Update activity (protected)
router.put('/:id', verifyDirectusToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      focus_area_id,
      title,
      description,
      start_date,
      end_date,
      responsible,
      purpose,
      theme,
      target_group,
      status,
      weeks
    } = req.body;

    const result = await query(
      `UPDATE activities
       SET focus_area_id = COALESCE($1, focus_area_id),
           title = COALESCE($2, title),
           description = COALESCE($3, description),
           start_date = $4,
           end_date = $5,
           responsible = COALESCE($6, responsible),
           purpose = COALESCE($7, purpose),
           theme = COALESCE($8, theme),
           target_group = COALESCE($9, target_group),
           status = COALESCE($10, status),
           weeks = COALESCE($11, weeks)
       WHERE id = $12
       RETURNING *`,
      [
        focus_area_id,
        title,
        description,
        start_date || null,
        end_date || null,
        responsible,
        purpose,
        theme,
        target_group,
        status,
        weeks,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating activity:', error);
    return res.status(500).json({ error: 'Failed to update activity' });
  }
});

// Delete activity (protected)
router.delete('/:id', verifyDirectusToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM activities WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return res.status(500).json({ error: 'Failed to delete activity' });
  }
});

export default router;
