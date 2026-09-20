import { GoogleGenAI } from '@google/genai';

/**
 * Executes a Gemini generateContent request with automatic retry and model fallback
 * to smoothly handle transient 503 high-demand spikes or rate limits.
 */
export async function generateContentWithFallback(
  ai: GoogleGenAI,
  options: {
    contents: any[];
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
  }
): Promise<string> {
  // Primary model and valid backup models for high-demand spiky periods
  const candidateModels = [
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ];
  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: options.contents,
          config: {
            responseMimeType: options.responseMimeType || 'application/json',
            temperature: options.temperature ?? 0.2,
            systemInstruction: options.systemInstruction ? { parts: [{ text: options.systemInstruction }] } : undefined,
          },
        });

        if (response.text) {
          // Strip markdown code fences if model enclosed JSON response in ```json ... ```
          let text = response.text.trim();
          if (text.startsWith('```')) {
            text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
          }
          return text;
        }
      } catch (err: any) {
        lastError = err;
        const errorMessage = err.message || String(err);
        
        // If it's a rate-limit (429), 503 high demand, or 404 NOT_FOUND/deprecated, switch model candidate immediately
        const isQuotaOrDemandSpike =
          errorMessage.includes('429') ||
          errorMessage.includes('503') ||
          errorMessage.includes('404') ||
          errorMessage.includes('UNAVAILABLE') ||
          errorMessage.includes('NOT_FOUND') ||
          errorMessage.includes('Quota exceeded') ||
          errorMessage.includes('RESOURCE_EXHAUSTED') ||
          errorMessage.includes('high demand') ||
          errorMessage.includes('no longer available');

        if (isQuotaOrDemandSpike) {
          console.warn(`[AI Helper] Model ${model} unavailable/quota limit reached. Trying next candidate model...`);
          break; // Jump to next model candidate immediately
        }

        console.warn(`[AI Helper] Model ${model} attempt ${attempt} error: ${errorMessage.slice(0, 100)}`);
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  }

  throw lastError || new Error('All candidate Gemini models exhausted or unavailable.');
}
