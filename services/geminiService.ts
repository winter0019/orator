
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { NYSCScenario, SpeechAnalysis, LeadershipStyle, SpeechOutline } from "../types";

export async function analyzeNYSCSpeech(
  audioBase64: string, 
  scenario: NYSCScenario,
  leadershipStyle: LeadershipStyle = LeadershipStyle.COMMANDING,
  mimeType: string = 'audio/webm'
): Promise<SpeechAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview'; // Using Flash for free key compatibility
  
  const prompt = `
    You are an elite Executive Public Speaking Coach for high-ranking officials of the NYSC (National Youth Service Corps) Nigeria.
    
    Context: The official is delivering a ${scenario} using a ${leadershipStyle} leadership style.
    
    Tasks:
    1. Transcribe the audio precisely.
    2. Analyze for: 
       - Leadership Alignment: How well the speech matches the ${leadershipStyle} style.
       - Tactical Precision: Correct use of NYSC administrative terms (SAED, PPA, LGI, CDM).
       - Presence: Does the speaker sound like an authority figure who commands respect while maintaining the welfare of corps members?
    3. Provide quantitative metrics for Clarity, Pacing, Authority, and Empathy.
    4. Suggest high-level improvements specifically for an official in a "higher position".
    
    Return the analysis strictly in JSON format.
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
    if (!text) throw new Error("Empty response from AI");
    return JSON.parse(text.trim());
  } catch (error: any) {
    console.error("Executive Speech analysis failed:", error);
    throw error;
  }
}

export async function generateExecutiveOutline(scenario: NYSCScenario, keyThemes: string[]): Promise<SpeechOutline> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a professional speech outline for an NYSC Zonal Inspector/Director for a ${scenario}. Key themes to incorporate: ${keyThemes.join(', ')}. Format as structured JSON.`,
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
    throw new Error("Failed to generate outline.");
  }
}

export async function askNYSCPolicy(question: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: question,
      config: {
        systemInstruction: `
          You are the Chief Legal and Administrative Advisor to the Director General of the NYSC. 
          Your audience is high-ranking officials (ZI, AD, Directors). 
          Provide strategic policy interpretations, reference the NYSC Act (1993/2004) and Bye-laws accurately.
        `
      }
    });
    return response.text || "Administrative database unreachable.";
  } catch (error) {
    return "Error querying policy database.";
  }
}

export async function getSuggestedPoints(scenario: NYSCScenario): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Suggest 5 executive-level points for a ${scenario} by an NYSC Zonal Inspector.`,
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
    return ["Uphold NYSC Core Values", "Ensure safety of corps members", "Drive SAED", "Stakeholder synergy", "Policy compliance"];
  }
}

export async function checkPointCoverage(transcript: string, points: string[]): Promise<boolean[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Compare transcript with points.
        Transcript: "${transcript}"
        Points: ${JSON.stringify(points)}
        Return JSON array of booleans.`,
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
