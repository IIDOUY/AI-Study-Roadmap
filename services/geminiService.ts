import { GoogleGenAI, Type } from "@google/genai";
import { Roadmap } from '../types';

export type GenerationInput = 
  | { type: 'file'; file: File }
  | { type: 'text'; text: string }
  | { type: 'youtube'; url: string };

// Helper to convert file to Base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const generateRoadmap = async (input: GenerationInput, apiKey?: string): Promise<Roadmap> => {
  // Use provided key or fallback to env (useful for dev)
  const key = apiKey || process.env.API_KEY;
  if (!key) throw new Error("Missing API Key");

  const ai = new GoogleGenAI({ apiKey: key });

  const systemInstruction = `
    You are a strict data extraction and planning engine. Your goal is to convert the provided content (PDF, Image, Text, or Video Context) into a structured JSON roadmap.

    RULES:
    1. Structure the content into "Modules".
    2. Extract "Tasks" based on the content.
    3. If a task has clear sub-steps, extract them as "subTasks".
    4. If URLs are found, extract them as "resources".
    5. **SCHEDULING**: Assume the user starts TODAY (${new Date().toISOString().split('T')[0]}). Assign a logical 'startDate' and 'endDate' to each task sequentially. Ensure the schedule is realistic.
    6. 'startDate' and 'endDate' must be in YYYY-MM-DD format.
    7. Assign realistic 'estimatedMinutes' and 'priority'.
  `;

  try {
    let contentsParts: any[] = [];
    let promptText = "Extract the study roadmap/tasks, including sub-steps, resources, and a proposed schedule starting today.";

    if (input.type === 'file') {
        const base64Data = await fileToGenerativePart(input.file);
        contentsParts = [
            {
                inlineData: {
                    mimeType: input.file.type,
                    data: base64Data
                }
            },
            { text: promptText }
        ];
    } else if (input.type === 'text') {
        contentsParts = [
            { text: `CONTEXT:\n${input.text}\n\nTASK:\n${promptText}` }
        ];
    } else if (input.type === 'youtube') {
        contentsParts = [
            { text: `CONTEXT: Create a comprehensive study roadmap based on the topic of this YouTube video: ${input.url}. Analyze the likely content based on the video metadata/topic and structure a learning path.\n\nTASK:\n${promptText}` }
        ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: contentsParts
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "The main title of the roadmap/project" },
            description: { type: Type.STRING, description: "A brief summary of what this roadmap achieves" },
            totalTimeEstimate: { type: Type.STRING, description: "A string estimate of total time (e.g., '4 weeks' or '20 hours')" },
            modules: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  tasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        estimatedMinutes: { type: Type.INTEGER },
                        isCompleted: { type: Type.BOOLEAN, description: "Always false initially" },
                        priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                        startDate: { type: Type.STRING, description: "YYYY-MM-DD" },
                        endDate: { type: Type.STRING, description: "YYYY-MM-DD" },
                        subTasks: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.STRING },
                              title: { type: Type.STRING },
                              isCompleted: { type: Type.BOOLEAN }
                            },
                            required: ["id", "title", "isCompleted"]
                          }
                        },
                        resources: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.STRING },
                              title: { type: Type.STRING, description: "Title or label for the link" },
                              url: { type: Type.STRING, description: "The actual URL" }
                            },
                            required: ["id", "title", "url"]
                          }
                        }
                      },
                      required: ["id", "title", "description", "estimatedMinutes", "isCompleted", "priority", "startDate", "endDate"]
                    }
                  }
                },
                required: ["id", "title", "description", "tasks"]
              }
            }
          },
          required: ["title", "description", "totalTimeEstimate", "modules"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }

    const roadmap: Roadmap = JSON.parse(text);
    return roadmap;

  } catch (error) {
    console.error("Error generating roadmap:", error);
    throw error;
  }
};

export const generateAIObservation = async (eventDescription: string, roadmap: Roadmap, apiKey?: string): Promise<string> => {
  const key = apiKey || process.env.API_KEY;
  if (!key) return "System update detected."; // Graceful degradation without key

  const ai = new GoogleGenAI({ apiKey: key });
  
  // Simplify roadmap for context
  const context = JSON.stringify({
    title: roadmap.title,
    modules: roadmap.modules.map(m => ({
      title: m.title,
      tasks: m.tasks.map(t => ({
        title: t.title,
        isCompleted: t.isCompleted,
        notes: t.notes || ""
      }))
    }))
  });

  const systemInstruction = `
    You are 'Cortexa AI', a highly interactive, witty, and attentive study coach.
    You do NOT chat. You ONLY provide short, one-paragraph real-time reactions (notifications) to the user's behavior.
    
    CONTEXT:
    Roadmap: "${roadmap.title}"
    Current State: ${context}
    
    TASK:
    The user just performed this action: "${eventDescription}".
    
    PERSONALITY:
    - You are like a gamer coach mixed with a supportive professor.
    - Use emojis.
    - Be reactive. If they are fast, comment on the speed. If they are slow, nudge them gently.
    
    SCENARIOS:
    1. **Module Finish**: "Boom! 💥 Module down. That covered [Topic Summary]. Ready for the next boss battle?"
    2. **High Priority Task**: "Critical hit! That was a tough one."
    3. **Order Violation**: "Whoa there, speedrunner! 🏃‍♂️ You skipped some steps. I recommend going back to [Skipped Task] to keep the lore consistent."
    4. **Rapid Clicking (Spam)**: "Whoops! Are we speed-reading or just clicking? Make sure to actually absorb the mana (knowledge)!"
    5. **Late Night**: "Grinding at [Time]? Respect. 🌙 But remember, sleep buffs your memory stats."
    6. **Streak (3+ tasks)**: "🔥 MULTI-TASKER! You're on a roll! Don't stop now!"
    7. **Idle (Inactivity)**: "User has gone AFK? 💤 I'm still here if you need me."
    
    OUTPUT:
    - Keep it under 35 words.
    - Direct address to the user.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Generate the reaction.",
      config: {
        systemInstruction: systemInstruction,
      }
    });

    return response.text || "Good update.";
  } catch (error) {
    console.error("AI Observation error:", error);
    return "System update detected.";
  }
};