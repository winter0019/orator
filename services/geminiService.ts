
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { NYSCScenario, SpeechAnalysis, LeadershipStyle, SpeechOutline } from "../types";

export async function analyzeNYSCSpeech(
  audioBase64: string, 
  scenario: NYSCScenario,
  leadershipStyle: LeadershipStyle = LeadershipStyle.MOTIVATIONAL,
  mimeType: string = 'audio/webm',
  frames: string[] = [] // Optional array of base64 image frames
): Promise<SpeechAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Switching to gemini-3-flash-preview for better multimodal stability and speed.
  // Flash models often resolve 500/Rpc errors that occur with Pro on large multimodal payloads.
  const model = 'gemini-3-flash-preview'; 
  
  const cleanMimeType = mimeType.split(';')[0];

  const contentParts: any[] = [
    { inlineData: { data: audioBase64, mimeType: cleanMimeType } }
  ];

  // Add video frames if available, limiting to ensure payload size stays safe
  frames.slice(-3).forEach(frame => {
    contentParts.push({ inlineData: { data: frame, mimeType: 'image/jpeg' } });
  });

  const prompt = `
    Conduct an NYSC Executive Oratory Audit for high-level officials (Zonal Inspectors, Assistant Directors, etc.).
    
    Context:
    Scenario: ${scenario}
    Leadership Style Target: ${leadershipStyle}
    Mode: ${frames.length > 0 ? 'Full Multi-modal (Audio + Visual)' : 'Audio-only'}
    
    Requirements:
    1. Transcribe the audio exactly. Support Nigerian accents and multi-lingual expressions (English, Pidgin, Local languages).
    2. Identify NYSC administrative terminology (Corper, PPA, SAED, CDS, LGI, ZI, DG).
    3. Evaluate performance metrics: Command, Tone, Pacing, and Clarity.
    4. Provide specific executive strengths and improvements based on the leadership style target.
    5. Generate a "suggestedPoints" list: 3-5 strategic talking points the speaker SHOULD include in this scenario.
    6. ${frames.length > 0 ? 'Analyze the visual frames to evaluate posture, hand gestures, eye contact, and emotional state.' : 'Analyze audio-based emotional markers.'}
    
    Respond strictly in JSON format.
  `;

  contentParts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: contentParts },
      config: {
        // Reduced thinking budget to improve response latency and prevent Rpc timeouts
        thinkingConfig: { thinkingBudget: 16000 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
            overallScore: { type: Type.NUMBER },
            leadershipAlignment: { type: Type.NUMBER },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedPoints: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Key talking points to improve the current address or for future sessions."
            },
            toneAnalysis: { type: Type.STRING },
            visualFeedback: {
              type: Type.OBJECT,
              properties: {
                posture: { type: Type.STRING },
                gestures: { type: Type.STRING },
                eyeContact: { type: Type.STRING },
                emotionalState: { type: Type.STRING }
              },
              required: ["posture", "gestures", "eyeContact", "emotionalState"]
            },
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
    if (!text) throw new Error("The model returned an empty audit response.");
    
    try {
      const parsed = JSON.parse(text.trim());
      return parsed;
    } catch (parseErr) {
      console.error("Audit Parse Failure:", text);
      throw new Error("Administrative data formatting failed. The system could not parse the executive audit.");
    }
  } catch (error: any) {
    console.error("Audit Service Error Details:", error);
    // Provide a more user-friendly message for 500/Rpc errors
    if (error?.message?.includes('Rpc failed') || error?.message?.includes('500')) {
      throw new Error("Network congestion at the Audit Bureau. Please try a shorter recording or check your connection.");
    }
    const errorMessage = error?.message || "Internal Signal Processing Error";
    throw new Error(errorMessage);
  }
}

export async function generateExecutiveOutline(scenario: NYSCScenario, keyThemes: string[]): Promise<SpeechOutline> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate an NYSC executive speech outline for a high-level official. Scenario: ${scenario}. Themes: ${keyThemes.join(', ')}. Return JSON.`,
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
        systemInstruction: "You are the Chief Administrative Officer for NYSC. Interpret policy according to the NYSC Act 2004."
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
      contents: `Provide 5 key strategic talking points for an NYSC official in this scenario: ${scenario}. Return JSON string array.`,
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
      contents: `Transcript: "${transcript}". Points: ${JSON.stringify(points)}. Check if each point was mentioned. Return JSON boolean array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.ARRAY, items: { type: Type.BOOLEAN } } // Schema fix for array response
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
