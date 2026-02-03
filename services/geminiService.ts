
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { NYSCScenario, SpeechAnalysis, LeadershipStyle, SpeechOutline } from "../types";

export async function analyzeNYSCSpeech(
  audioBase64: string, 
  scenario: NYSCScenario,
  leadershipStyle: LeadershipStyle = LeadershipStyle.COMMANDING,
  mimeType: string = 'audio/webm'
): Promise<SpeechAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-3-flash-preview for faster response and lower timeout probability
  const model = 'gemini-3-flash-preview'; 
  
  const prompt = `
    Conduct an NYSC Executive Oratory Audit.
    
    Context:
    Scenario: ${scenario}
    Leadership Style Target: ${leadershipStyle}
    
    Requirements:
    1. Transcribe the audio exactly.
    2. Identify NYSC administrative terminology (Corper, PPA, SAED, CDS, LGI, ZI, DG).
    3. Evaluate performance metrics: Command, Tone, Pacing, and Clarity.
    4. Provide specific executive strengths and improvements.
    
    Respond strictly in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { data: audioBase64, mimeType } },
          { text: prompt }
        ]
      },
      config: {
        // Reduced thinking budget to optimize for speed and prevent timeouts
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
            overallScore: { type: Type.NUMBER },
            leadershipAlignment: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            toneAnalysis: { type: Type.STRING },
            metrics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  feedback: { type: Type.STRING }
                },
                required: ["label", "score", "feedback"]
              }
            }
          },
          required: ["transcript", "overallScore", "leadershipAlignment", "strengths", "improvements", "suggestedPoints", "metrics", "toneAnalysis"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Null response from generative model.");
    
    try {
      return JSON.parse(text.trim());
    } catch (parseErr) {
      console.error("Audit Parse Failure. Raw Payload:", text);
      throw new Error("Failed to parse administrative audit data.");
    }
  } catch (error: any) {
    console.error("Audit Service Error:", error);
    const errorMessage = error?.message || "Internal Signal Processing Error";
    throw new Error(errorMessage);
  }
}

export async function generateExecutiveOutline(scenario: NYSCScenario, keyThemes: string[]): Promise<SpeechOutline> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate an NYSC executive speech outline. Scenario: ${scenario}. Themes: ${keyThemes.join(', ')}. Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            hook: { type: Type.STRING },
            keyPillars: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  talkingPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "talkingPoints"]
              }
            },
            callToAction: { type: Type.STRING },
            closingStatement: { type: Type.STRING }
          },
          required: ["title", "hook", "keyPillars", "callToAction", "closingStatement"]
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch (err) {
    throw new Error("Outline generator unavailable.");
  }
}

export async function askNYSCPolicy(question: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: question,
      config: {
        systemInstruction: "You are the Chief Administrative Officer for NYSC. Interpret policy according to the NYSC Act."
      }
    });
    return response.text || "No response from policy advisor.";
  } catch (error) {
    return "Policy query failed.";
  }
}

export async function getSuggestedPoints(scenario: NYSCScenario): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide 5 key points for ${scenario}. Return JSON string array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch (error) {
    return ["Uphold NYSC Values", "Security awareness", "SAED participation", "Discipline", "Service to nation"];
  }
}

export async function checkPointCoverage(transcript: string, points: string[]): Promise<boolean[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Transcript: "${transcript}". Points: ${JSON.stringify(points)}. Return JSON boolean array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.BOOLEAN }
        }
      }
    });
    return JSON.parse(response.text.trim());
  } catch (err) {
    return points.map(() => false);
  }
}

export async function getWordPronunciation(word: string): Promise<string | undefined> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Pronounce: ${word}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    return undefined;
  }
}
