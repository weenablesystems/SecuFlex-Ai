import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const triageIncident = async (rawInput: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the following security incident report and extract structured data:
    "${rawInput}"
    
    Return a JSON object with:
    - type: (e.g., Intrusion, Medical, Fire, Panic, Suspicious Activity)
    - severity: (Low, Medium, High, Critical)
    - location: (Specific area if mentioned)
    - description: (Brief summary)
    - suggestedAction: (What should the control room do first?)`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          severity: { type: Type.STRING },
          location: { type: Type.STRING },
          description: { type: Type.STRING },
          suggestedAction: { type: Type.STRING },
        },
        required: ["type", "severity", "description"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
};

export const generateIncidentReport = async (incident: any) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a professional security incident report based on this data:
    ${JSON.stringify(incident)}
    
    The report should be structured for a client, POPIA compliant (no unnecessary PII), and include:
    - Executive Summary
    - Timeline of Events
    - Actions Taken
    - Final Outcome
    - Recommendations for Prevention`,
  });

  return response.text;
};

export const generateHandoverSummary = async (incidents: any[]) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a shift handover summary for a security control room supervisor.
    Review these incidents from the last shift:
    ${JSON.stringify(incidents)}
    
    Highlight:
    - Critical incidents still open
    - Recurring hotspots
    - Asset/Equipment issues
    - Key tasks for the next shift`,
  });

  return response.text;
};
