import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import pool from '../db';

const router = Router();

// Helper to format activities for the AI
const formatDataForAI = (activities: any[], focusAreas: any[]) => {
  const focusAreaMap = new Map(focusAreas.map(fa => [fa.id, fa]));

  const STATUS_LABELS: Record<string, string> = {
    ongoing: 'Pågående',
    decided: 'Beslutad',
    completed: 'Genomförd',
  };

  const MONTHS = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ];

  return JSON.stringify({
    activities: activities.map(a => {
      const fa = focusAreaMap.get(a.focus_area_id);
      return {
        title: a.title,
        description: a.description,
        focusArea: fa?.name || 'Okänt',
        responsible: a.responsible,
        purpose: a.purpose,
        theme: a.theme,
        targetGroup: a.target_group,
        status: STATUS_LABELS[a.status] || a.status,
        startDate: a.start_date,
        endDate: a.end_date,
        weeks: a.weeks,
      };
    }),
    focusAreas: focusAreas.map(fa => ({
      name: fa.name,
      months: fa.start_month !== null && fa.end_month !== null
        ? `${MONTHS[fa.start_month]} - ${MONTHS[fa.end_month]}`
        : 'Temabaserat',
    })),
    summary: {
      totalActivities: activities.length,
      byStatus: {
        ongoing: activities.filter(a => a.status === 'ongoing').length,
        decided: activities.filter(a => a.status === 'decided').length,
        completed: activities.filter(a => a.status === 'completed').length,
      },
    },
  });
};

// POST /api/ai/report - Generate AI report
router.post('/report', async (req: Request, res: Response) => {
  try {
    const { prompt, conceptId, year } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI service not configured' });
    }

    // Build query for activities
    let activitiesQuery = `
      SELECT a.* FROM activities a
      JOIN focus_areas fa ON a.focus_area_id = fa.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (conceptId) {
      activitiesQuery += ` AND fa.concept_id = $${paramIndex++}`;
      params.push(conceptId);
    }

    if (year) {
      activitiesQuery += ` AND EXTRACT(YEAR FROM a.start_date) = $${paramIndex++}`;
      params.push(year);
    }

    // Fetch activities
    const activitiesResult = await pool.query(activitiesQuery, params);
    const activities = activitiesResult.rows;

    // Fetch focus areas
    let focusAreasQuery = 'SELECT * FROM focus_areas';
    if (conceptId) {
      focusAreasQuery += ' WHERE concept_id = $1';
    }
    const focusAreasResult = await pool.query(
      focusAreasQuery,
      conceptId ? [conceptId] : []
    );
    const focusAreas = focusAreasResult.rows;

    // Generate AI response
    const ai = new GoogleGenAI({ apiKey });
    const dataContext = formatDataForAI(activities, focusAreas);

    const systemInstruction = `
      Du är en strategisk AI-assistent för en organisations verksamhetsplanering.
      Du har tillgång till ett dataset av aktiviteter organiserade i fokusområden.

      Svara på användarens frågor baserat på datan.
      Använd Markdown för att formatera svaret snyggt (listor, bold text, headers).
      Håll tonen professionell, insiktsfull och hjälpsam på svenska.
      Om frågan handlar om en rapport, gruppera gärna datan logiskt.

      Statusar:
      - Pågående: Aktivitet under planering
      - Beslutad: Aktivitet som är beslutad men inte genomförd
      - Genomförd: Avslutad aktivitet
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Kontext-data: ${dataContext}\n\nAnvändarens fråga: ${prompt}`,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const text = response.text || 'Ingen analys kunde genereras.';
    res.json({ report: text });
  } catch (error) {
    console.error('AI Report Error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
