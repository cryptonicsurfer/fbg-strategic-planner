import { GoogleGenAI } from "@google/genai";
import { Activity, FocusArea } from "../types";
import { MONTHS, STATUS_LABELS } from "../constants";

// Helper to format activities for the AI
const formatDataForAI = (activities: Activity[], focusAreas: FocusArea[]) => {
  const focusAreaMap = new Map(focusAreas.map(fa => [fa.id, fa]));

  return JSON.stringify({
    activities: activities.map(a => {
      const fa = focusAreaMap.get(a.focus_area_id);
      return {
        title: a.title,
        description: a.description,
        focusArea: fa?.name || "Okänt",
        responsible: a.responsible,
        purpose: a.purpose,
        theme: a.theme,
        targetGroup: a.target_group,
        status: STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] || a.status,
        startDate: a.start_date,
        endDate: a.end_date,
        weeks: a.weeks,
      };
    }),
    focusAreas: focusAreas.map(fa => ({
      name: fa.name,
      months: fa.start_month !== null && fa.end_month !== null
        ? `${MONTHS[fa.start_month].name} - ${MONTHS[fa.end_month].name}`
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

export const generateReport = async (
  prompt: string,
  activities: Activity[],
  focusAreas: FocusArea[]
): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return "Error: API Key saknas. Kontrollera dina miljövariabler.";
  }

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

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Kontext-data: ${dataContext}\n\nAnvändarens fråga: ${prompt}`,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    return response.text || "Ingen analys kunde genereras.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Ett fel uppstod vid kontakt med AI-tjänsten. Försök igen senare.";
  }
};
