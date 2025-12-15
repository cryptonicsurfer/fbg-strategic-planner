import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import * as XLSX from 'xlsx';
import pool from '../db.js';
import { AuthenticatedRequest, verifyDirectusToken } from '../middleware/auth.js';
import { matchFocusArea, formatFocusAreasForPrompt } from '../services/focusAreaMatcher.js';

// Swedish month names to month numbers
const SWEDISH_MONTHS: Record<string, number> = {
  'januari': 1, 'jan': 1,
  'februari': 2, 'feb': 2,
  'mars': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'maj': 5,
  'juni': 6, 'jun': 6,
  'juli': 7, 'jul': 7,
  'augusti': 8, 'aug': 8,
  'september': 9, 'sep': 9,
  'oktober': 10, 'okt': 10,
  'november': 11, 'nov': 11,
  'december': 12, 'dec': 12,
};

// Preprocess calendar-style Excel data with explicit column mappings
function preprocessCalendarExcelV2(
  rows: any[][],
  infoHeaders: { col: number; name: string }[],
  calendarColumns: Map<number, { month: number; week: number }>,
  year: number
): {
  activities: Array<{
    rowData: Record<string, any>;
    dates: Array<{ date: string; week: number }>;
    sectionHeader: string | null;
  }>;
  infoColumnNames: string[];
} {
  let currentSection: string | null = null;
  const activities: Array<{
    rowData: Record<string, any>;
    dates: Array<{ date: string; week: number }>;
    sectionHeader: string | null;
  }> = [];

  for (const row of rows) {
    // Extract info columns
    const rowData: Record<string, any> = {};
    let filledInfoColumns = 0;

    for (const header of infoHeaders) {
      const cellValue = row[header.col];
      if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
        rowData[header.name] = cellValue;
        filledInfoColumns++;
      }
    }

    // Check if first column (col 0) has value (for title or section header)
    const firstCellValue = row[0];
    const hasFirstCell = firstCellValue !== undefined && firstCellValue !== null && firstCellValue !== '';

    // Extract dates from calendar columns
    const dates: Array<{ date: string; week: number }> = [];
    for (const [colIndex, colInfo] of calendarColumns.entries()) {
      const cellValue = row[colIndex];
      if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
        // The cell value is the day of the month
        const day = parseInt(String(cellValue));
        if (!isNaN(day) && day >= 1 && day <= 31) {
          const dateStr = `${year}-${String(colInfo.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          dates.push({ date: dateStr, week: colInfo.week });
        }
      }
    }

    // Detect section header: has first cell value but very few other columns and no dates
    if (hasFirstCell && filledInfoColumns <= 1 && dates.length === 0) {
      currentSection = String(firstCellValue).trim();
      console.log('[Excel] Found section header:', currentSection);
      continue; // Skip section header rows
    }

    // Skip empty rows
    if (!hasFirstCell && filledInfoColumns === 0 && dates.length === 0) {
      continue;
    }

    // Add the first cell as title
    if (hasFirstCell) {
      rowData['Aktivitet'] = firstCellValue;
    }

    activities.push({
      rowData,
      dates,
      sectionHeader: currentSection
    });
  }

  return {
    activities,
    infoColumnNames: infoHeaders.map(h => h.name)
  };
}

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Configure multer for Excel file uploads
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Endast Excel-filer (.xlsx, .xls) är tillåtna'));
    }
  },
});

// Configure multer for image uploads
const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Endast bildfiler är tillåtna'));
    }
  },
});

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
router.post('/report', verifyDirectusToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, conceptId, year } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > 5000) {
      return res.status(400).json({ error: 'Prompt must be a non-empty string under 5000 characters' });
    }

    if (conceptId && typeof conceptId !== 'string') {
      return res.status(400).json({ error: 'Invalid conceptId' });
    }

    if (year && (typeof year !== 'number' || !Number.isInteger(year))) {
      return res.status(400).json({ error: 'Year must be an integer' });
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

// POST /api/ai/generate-activities - Generate activities from text description (with optional images)
router.post('/generate-activities', verifyDirectusToken, uploadImages.array('images', 5), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const description = req.body.description || '';
    const conceptId = req.body.conceptId;
    const year = parseInt(req.body.year, 10);
    const images = req.files as Express.Multer.File[] | undefined;

    const hasImages = images && images.length > 0;
    const hasDescription = description.trim().length > 0;

    if (!hasDescription && !hasImages) {
      return res.status(400).json({ error: 'Beskrivning eller bilder krävs' });
    }

    if (description.length > 10000) {
      return res.status(400).json({ error: 'Beskrivning får inte överstiga 10000 tecken' });
    }

    if (!year || isNaN(year)) {
      return res.status(400).json({ error: 'År krävs' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI-tjänsten är inte konfigurerad' });
    }

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

    if (focusAreas.length === 0) {
      return res.status(400).json({ error: 'Inga fokusområden tillgängliga' });
    }

    // Build AI prompt
    const focusAreasContext = formatFocusAreasForPrompt(focusAreas);

    const systemInstruction = `
Du är en AI-assistent för Århjulet verksamhetsplanering.
Din uppgift är att tolka användarens beskrivning och/eller bilder och extrahera aktiviteter.
Om bilder bifogas, analysera dem noggrant för att hitta information om aktiviteter, datum, ansvariga, etc.

TILLGÄNGLIGA FOKUSOMRÅDEN:
${focusAreasContext}

REGLER:
1. Returnera en JSON-array med aktiviteter
2. Varje aktivitet MÅSTE ha ett fokusområde från listan ovan (använd EXAKT namnet)
3. Datum ska vara i YYYY-MM-DD format
4. Veckonummer är 1-52
5. Status är alltid "ongoing" för nya aktiviteter
6. Om ingen tydlig matchning finns, välj det mest relevanta fokusområdet

OUTPUT FORMAT (endast JSON, ingen annan text):
[
  {
    "title": "Aktivitetens namn",
    "description": "Beskrivning eller null",
    "suggested_focus_area": "EXAKT namn från listan ovan",
    "start_date": "YYYY-MM-DD eller null",
    "end_date": "YYYY-MM-DD eller null",
    "weeks": [1, 2, 3],
    "responsible": "Ansvarig person eller null",
    "purpose": "Information/Dialog | Utbildning | Mässa | Workshop | Nätverkande | Planering | null",
    "theme": "Bransch | Tema | Utveckling | Strategi | null",
    "target_group": "Målgrupp eller null"
  }
]

Tolka beskrivningen och bilderna noggrant. Om datum/veckor nämns, beräkna korrekta värden för år ${year}.
`;

    const ai = new GoogleGenAI({ apiKey });

    // Build content parts
    const contentParts: any[] = [];

    // Add text description if provided
    if (hasDescription) {
      contentParts.push({ text: `Beskrivning att tolka:\n\n${description}` });
    } else {
      contentParts.push({ text: 'Analysera följande bild(er) och extrahera aktiviteter:' });
    }

    // Add images if provided
    if (hasImages) {
      for (const image of images) {
        const base64Data = image.buffer.toString('base64');
        contentParts.push({
          inlineData: {
            mimeType: image.mimetype,
            data: base64Data,
          },
        });
      }
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contentParts,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '[]';
    let parsedActivities: any[];

    try {
      parsedActivities = JSON.parse(responseText);
      if (!Array.isArray(parsedActivities)) {
        parsedActivities = [];
      }
    } catch {
      console.error('Failed to parse AI response:', responseText);
      return res.status(500).json({
        error: 'Kunde inte tolka AI-svaret',
        parsing_notes: ['AI returnerade ogiltigt JSON-format'],
      });
    }

    // Match focus areas and build response
    const activities = parsedActivities.map((a: any) => {
      const match = matchFocusArea(a.suggested_focus_area || '', focusAreas, conceptId);
      return {
        title: a.title || 'Namnlös aktivitet',
        description: a.description || null,
        suggested_focus_area: a.suggested_focus_area || '',
        matched_focus_area_id: match.focus_area_id,
        matched_focus_area_name: match.focus_area_name,
        confidence: match.confidence,
        start_date: a.start_date || null,
        end_date: a.end_date || null,
        weeks: Array.isArray(a.weeks) ? a.weeks.filter((w: any) => typeof w === 'number' && w >= 1 && w <= 52) : [],
        responsible: a.responsible || null,
        purpose: a.purpose || null,
        theme: a.theme || null,
        target_group: a.target_group || null,
        status: 'ongoing' as const,
        needs_review: match.needs_review,
        review_reason: match.review_reason,
      };
    });

    res.json({
      activities,
      parsing_notes: hasImages ? [`${images.length} bild(er) analyserades`] : [],
    });
  } catch (error) {
    console.error('Generate Activities Error:', error);
    res.status(500).json({ error: 'Kunde inte generera aktiviteter' });
  }
});

// POST /api/ai/parse-excel - Parse Excel file and generate activities
router.post('/parse-excel', verifyDirectusToken, uploadExcel.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const file = req.file;
    const conceptId = req.body.conceptId;
    const year = parseInt(req.body.year, 10);

    if (!file) {
      return res.status(400).json({ error: 'Ingen fil uppladdad' });
    }

    if (!year || isNaN(year)) {
      return res.status(400).json({ error: 'År krävs' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI-tjänsten är inte konfigurerad' });
    }

    // Parse Excel file
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (data.length < 4) {
      return res.status(400).json({ error: 'Excel-filen verkar vara tom eller har för få rader' });
    }

    // Detect the header structure:
    // This Excel has: Row 1 = Title, Row 2 = Empty, Row 3 = Info cols + Month names, Row 4 = Week numbers
    let dataStartRow = 0;
    let monthHeaderRow: any[] = [];
    let weekHeaderRow: any[] = [];
    let infoHeaders: { col: number; name: string }[] = [];
    let detectedYear: number | null = null;

    // Try to detect year from first few rows (title row often contains year like "2026")
    for (let i = 0; i < Math.min(3, data.length); i++) {
      const row = data[i] as any[];
      for (const cell of row) {
        if (cell) {
          const yearMatch = String(cell).match(/20\d{2}/);
          if (yearMatch) {
            detectedYear = parseInt(yearMatch[0]);
            console.log('[Excel] Detected year from title:', detectedYear);
            break;
          }
        }
      }
      if (detectedYear) break;
    }

    // Use detected year if available, otherwise use the provided year
    const effectiveYear = detectedYear || year;
    if (detectedYear && detectedYear !== year) {
      console.log(`[Excel] Warning: Excel contains year ${detectedYear} but UI selected ${year}. Using ${detectedYear}.`);
    }

    // Find the row with month names (contains "Januari" or "januari")
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i] as any[];
      const hasMonth = row.some(cell =>
        typeof cell === 'string' && SWEDISH_MONTHS[cell.toLowerCase().trim()]
      );
      if (hasMonth) {
        monthHeaderRow = row;
        weekHeaderRow = data[i + 1] || [];
        dataStartRow = i + 2; // Data starts after month row and week row

        // Extract info column headers (before calendar columns)
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (typeof cell === 'string' && cell.trim() && !SWEDISH_MONTHS[cell.toLowerCase().trim()]) {
            infoHeaders.push({ col: c, name: cell.trim() });
          } else if (SWEDISH_MONTHS[String(cell || '').toLowerCase().trim()]) {
            break; // Stop at first month column
          }
        }
        console.log('[Excel] Found month header at row', i + 1);
        break;
      }
    }

    if (monthHeaderRow.length === 0) {
      return res.status(400).json({ error: 'Kunde inte hitta månadsrubriker i Excel-filen' });
    }

    // Build calendar column mapping: col -> { month, week }
    const calendarColumns: Map<number, { month: number; week: number }> = new Map();
    let currentMonth = 0;

    for (let c = 0; c < Math.max(monthHeaderRow.length, weekHeaderRow.length); c++) {
      const monthCell = monthHeaderRow[c];
      const weekCell = weekHeaderRow[c];

      // Check if this column has a month name
      if (monthCell && typeof monthCell === 'string') {
        const monthNum = SWEDISH_MONTHS[monthCell.toLowerCase().trim()];
        if (monthNum) {
          currentMonth = monthNum;
        }
      }

      // Check if this column has a week number
      if (weekCell !== undefined && weekCell !== null && currentMonth > 0) {
        const week = parseInt(String(weekCell));
        if (!isNaN(week) && week >= 1 && week <= 52) {
          calendarColumns.set(c, { month: currentMonth, week });
        }
      }
    }

    console.log('[Excel] Info headers:', infoHeaders.map(h => h.name));
    console.log('[Excel] Calendar columns found:', calendarColumns.size);
    console.log('[Excel] Data starts at row:', dataStartRow + 1);

    const rows = data.slice(dataStartRow, dataStartRow + 100);
    const headers = monthHeaderRow; // For compatibility

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

    if (focusAreas.length === 0) {
      return res.status(400).json({ error: 'Inga fokusområden tillgängliga' });
    }

    // Build AI prompt
    const focusAreasContext = formatFocusAreasForPrompt(focusAreas);

    // Preprocess calendar-style Excel data
    const preprocessed = preprocessCalendarExcelV2(rows, infoHeaders, calendarColumns, effectiveYear);
    console.log('[Excel] Activities found:', preprocessed.activities.length);
    console.log('[Excel] Activities with dates:', preprocessed.activities.filter(a => a.dates.length > 0).length);

    // Format preprocessed data for AI
    const formattedActivities = preprocessed.activities.map((activity, index) => {
      const info = Object.entries(activity.rowData)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');

      const sectionInfo = activity.sectionHeader
        ? `SEKTION/FOKUSOMRÅDE: "${activity.sectionHeader}"`
        : 'SEKTION/FOKUSOMRÅDE: (ingen angiven)';

      const dateInfo = activity.dates.length > 0
        ? `DATUM: ${activity.dates.map(d => `${d.date} (vecka ${d.week})`).join(', ')}`
        : 'DATUM: (inga datum angivna)';

      return `[Rad ${index + 1}] ${info}\n  ${sectionInfo}\n  ${dateInfo}`;
    }).join('\n\n');

    console.log('[Excel] Sample formatted data:', formattedActivities.substring(0, 1000));

    const systemInstruction = `
Du är en AI-assistent för att tolka Excel-data och mappa till aktivitetsschema.

INFO-KOLUMNER I FILEN:
${preprocessed.infoColumnNames.join(', ')}

TILLGÄNGLIGA FOKUSOMRÅDEN (använd EXAKT dessa namn):
${focusAreasContext}

DATAN HAR FÖRBEHANDLATS:
- Kalenderkolumner har redan tolkats och konverterats till datum
- Varje aktivitet visar "DATUM:" med de extraherade datumen i YYYY-MM-DD format
- Varje aktivitet visar "SEKTION/FOKUSOMRÅDE:" med sektionsrubriken från Excel-filen
- VIKTIGT: Sektionsrubriken anger vilket fokusområde aktiviteten tillhör!

REGLER:
1. Returnera en JSON-array med en aktivitet per rad
2. Mappa kolumner intelligent till aktivitetsfält:
   - Första kolumnen (oftast namnlös) är vanligtvis aktivitetens titel
   - "Ansvarig" → responsible
   - "Syfte" → purpose (t.ex. "Information/Dialog", "Utbildning", "Inspiration/nätverk")
   - "Tema" → theme (t.ex. "Bransch", "Tema", "Område")
   - "Målgrupp" → target_group
   - "Typ av aktivitet" → description
3. FOKUSOMRÅDE: Matcha "SEKTION/FOKUSOMRÅDE" till närmaste fokusområde i listan:
   - "Företagsbesök" → "Service & Kompetens" (eller närmaste match)
   - "Mod att växa" → "Mod att växa"
   - "Framtidssäkring av företag" → "Framtidssäkring av företag"
   - "Falkenberg växer" eller "Falkenberg Växer" → "Falkenberg växer"
   - "Övrigt" → välj mest passande baserat på aktivitetens innehåll
   - Om osäker, använd "Service & Kompetens" som fallback
4. Använd datum från "DATUM:"-raden - de är redan i korrekt format
5. suggested_focus_area MÅSTE alltid ha ett värde från fokusområdeslistan!

OUTPUT FORMAT (endast JSON):
[
  {
    "title": "aktivitetens namn",
    "description": "typ av aktivitet eller beskrivning",
    "suggested_focus_area": "EXAKT namn från fokusområdeslistan - OBLIGATORISKT",
    "start_date": "första datumet från DATUM eller null",
    "end_date": "sista datumet från DATUM eller null",
    "weeks": [veckonummer från DATUM],
    "responsible": "från Ansvarig-kolumnen",
    "purpose": "från Syfte-kolumnen",
    "theme": "från Tema-kolumnen",
    "target_group": "från Målgrupp-kolumnen"
  }
]
`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Tolka följande förbehandlade Excel-data och returnera aktiviteter:\n\n${formattedActivities}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '[]';
    let parsedActivities: any[];

    try {
      parsedActivities = JSON.parse(responseText);
      if (!Array.isArray(parsedActivities)) {
        parsedActivities = [];
      }
    } catch {
      console.error('Failed to parse AI response:', responseText);
      return res.status(500).json({
        error: 'Kunde inte tolka AI-svaret',
        parsing_notes: ['AI returnerade ogiltigt JSON-format'],
      });
    }

    // Match focus areas
    const activities = parsedActivities.map((a: any) => {
      const match = matchFocusArea(a.suggested_focus_area || '', focusAreas, conceptId);
      return {
        title: a.title || 'Namnlös aktivitet',
        description: a.description || null,
        suggested_focus_area: a.suggested_focus_area || '',
        matched_focus_area_id: match.focus_area_id,
        matched_focus_area_name: match.focus_area_name,
        confidence: match.confidence,
        start_date: a.start_date || null,
        end_date: a.end_date || null,
        weeks: Array.isArray(a.weeks) ? a.weeks.filter((w: any) => typeof w === 'number' && w >= 1 && w <= 52) : [],
        responsible: a.responsible || null,
        purpose: a.purpose || null,
        theme: a.theme || null,
        target_group: a.target_group || null,
        status: 'ongoing' as const,
        needs_review: match.needs_review,
        review_reason: match.review_reason,
      };
    });

    res.json({
      activities,
      parsing_notes: rows.length > 100 ? ['Endast de första 100 raderna behandlades'] : [],
    });
  } catch (error: any) {
    console.error('Parse Excel Error:', error);
    console.error('Parse Excel Stack:', error?.stack);

    // Return more detailed error for debugging
    const errorMessage = error?.message || 'Okänt fel';
    res.status(500).json({
      error: 'Kunde inte tolka Excel-filen',
      details: process.env.NODE_ENV !== 'production' ? errorMessage : undefined,
    });
  }
});

// POST /api/ai/edit-activity - Edit activity with AI
router.post('/edit-activity', verifyDirectusToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { activityId, instruction } = req.body;

    if (!activityId || typeof activityId !== 'string') {
      return res.status(400).json({ error: 'Aktivitets-ID krävs' });
    }

    if (!instruction || typeof instruction !== 'string' || instruction.trim().length === 0) {
      return res.status(400).json({ error: 'Instruktion krävs' });
    }

    if (instruction.length > 2000) {
      return res.status(400).json({ error: 'Instruktion får inte överstiga 2000 tecken' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI-tjänsten är inte konfigurerad' });
    }

    // Fetch the activity
    const activityResult = await pool.query(
      `SELECT a.*, fa.name as focus_area_name, fa.color as focus_area_color
       FROM activities a
       JOIN focus_areas fa ON a.focus_area_id = fa.id
       WHERE a.id = $1`,
      [activityId]
    );

    if (activityResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aktivitet hittades inte' });
    }

    const original = activityResult.rows[0];

    // Fetch all focus areas for potential changes
    const focusAreasResult = await pool.query('SELECT * FROM focus_areas');
    const focusAreas = focusAreasResult.rows;

    const focusAreasContext = formatFocusAreasForPrompt(focusAreas);

    const systemInstruction = `
Du är en AI-assistent som hjälper till att redigera aktiviteter.

NUVARANDE AKTIVITET:
${JSON.stringify({
  title: original.title,
  description: original.description,
  focus_area: original.focus_area_name,
  start_date: original.start_date,
  end_date: original.end_date,
  weeks: original.weeks,
  responsible: original.responsible,
  purpose: original.purpose,
  theme: original.theme,
  target_group: original.target_group,
  status: original.status,
}, null, 2)}

TILLGÄNGLIGA FOKUSOMRÅDEN:
${focusAreasContext}

REGLER:
1. Applicera användarens instruktion på aktiviteten
2. Behåll alla fält som inte påverkas
3. Om fokusområde ändras, använd EXAKT namn från listan
4. Returnera den modifierade aktiviteten + lista med ändringar

OUTPUT FORMAT (endast JSON):
{
  "modified": {
    "title": "...",
    "description": "...",
    "suggested_focus_area": "...",
    "start_date": "YYYY-MM-DD eller null",
    "end_date": "YYYY-MM-DD eller null",
    "weeks": [],
    "responsible": "...",
    "purpose": "...",
    "theme": "...",
    "target_group": "...",
    "status": "ongoing | decided | completed"
  },
  "changes": ["Ändrade titel från X till Y", "Flyttade datum..."]
}
`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Instruktion: ${instruction}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsed: any;

    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse AI response:', responseText);
      return res.status(500).json({ error: 'Kunde inte tolka AI-svaret' });
    }

    const modified = parsed.modified || {};
    const changes = parsed.changes || [];

    // Match focus area if changed
    let focusAreaId = original.focus_area_id;
    let focusAreaName = original.focus_area_name;

    if (modified.suggested_focus_area && modified.suggested_focus_area !== original.focus_area_name) {
      const match = matchFocusArea(modified.suggested_focus_area, focusAreas);
      if (match.focus_area_id) {
        focusAreaId = match.focus_area_id;
        focusAreaName = match.focus_area_name;
      }
    }

    const modifiedActivity = {
      id: original.id,
      focus_area_id: focusAreaId,
      focus_area_name: focusAreaName,
      focus_area_color: original.focus_area_color,
      title: modified.title || original.title,
      description: modified.description !== undefined ? modified.description : original.description,
      start_date: modified.start_date !== undefined ? modified.start_date : original.start_date,
      end_date: modified.end_date !== undefined ? modified.end_date : original.end_date,
      weeks: Array.isArray(modified.weeks) ? modified.weeks : original.weeks,
      responsible: modified.responsible !== undefined ? modified.responsible : original.responsible,
      purpose: modified.purpose !== undefined ? modified.purpose : original.purpose,
      theme: modified.theme !== undefined ? modified.theme : original.theme,
      target_group: modified.target_group !== undefined ? modified.target_group : original.target_group,
      status: modified.status || original.status,
    };

    res.json({
      original,
      modified: modifiedActivity,
      changes,
    });
  } catch (error) {
    console.error('Edit Activity Error:', error);
    res.status(500).json({ error: 'Kunde inte redigera aktiviteten' });
  }
});

export default router;
