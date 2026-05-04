import { logger } from "../../lib/logger";
import { ClassificationResult } from "./types";
import { retry } from "../../lib/retry";

export class Classifier {
  private GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-lite";
  private GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${this.GEMINI_MODEL}:generateContent`;

  getCaptionScore(caption?: string): number {
    if (!caption) return 0;
    const text = caption.toLowerCase();
    let score = 0;

    const dj = ["dj", "b2b", "set", "live", "band", "acoustic", "vinyl"];
    const event = ["lineup", "tonight", "party", "doors", "schedule", "gig", "presents"];
    const days = ["friday", "saturday", "thursday", "wednesday"];
    const time = ["pm", "am", ":00"];

    if (dj.some(w => text.includes(w))) score += 3;
    if (event.some(w => text.includes(w))) score += 2;
    if (days.some(w => text.includes(w))) score += 2;
    if (time.some(w => text.includes(w))) score += 2;
    if (text.match(/@\w+/g)) score += 1;

    return score;
  }

  isNightlifeKeyword(text: string): boolean {
    const keywords = ["dj", "lineup", "doors", "b2b", "resident", "guest", "live", "acoustic", "band", "music", "schedule", "gig", "session", "presents"];
    return keywords.some(k => text.toLowerCase().includes(k));
  }

  async classifyImage(buffer: Buffer, todayString: string): Promise<ClassificationResult | null> {
    const prompt = `
    You are an expert nightlife event scout analyzing a flyer image.

    Today's date is ${todayString}. All dates must be formatted as YYYY-MM-DD. Never use past years.
    Never return dates before today or more than 30 days in the future.

    STEP 1 — Classify the image as exactly ONE of these types:
    - "dedicated_poster": A flyer for ONE specific event on ONE specific night at a specific venue. Priority: 10
    - "weekly_overview": A schedule card listing multiple events across multiple different dates. Priority: 2
    - "artist_promo": A personal promotional post for an individual DJ or artist. Priority: 1
    - "not_event": Food promo, lifestyle post, general announcement. Priority: 0

    STEP 2 — Extract event data based on type:
    - For "dedicated_poster": return a single event object.
    - For "weekly_overview": return one object per distinct date in the "events" array.
    - For "artist_promo" or "not_event": return is_event: false, no need to fill other fields.

    Return ONLY a raw JSON object with no markdown, no backticks, no explanation:
    {
      "image_type": "dedicated_poster | weekly_overview | artist_promo | not_event",
      "is_event": true,
      "event_name": "string",
      "djs": ["string"],
      "event_date": "YYYY-MM-DD",
      "events": [
        { "event_name": "string", "djs": ["string"], "event_date": "YYYY-MM-DD" }
      ]
    }
    `;

    return retry(async () => {
      const response = await fetch(`${this.GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: "image/jpeg", data: buffer.toString("base64") } }
            ]
          }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (response.status === 429) {
        throw new Error("Gemini Rate Limit (429)");
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        logger.debug("Gemini returned no text", data);
        return null;
      }

      try {
        return JSON.parse(text.trim().replace(/```json|```/g, ""));
      } catch (e) {
        logger.error("Failed to parse Gemini JSON response", text);
        return null;
      }
    }, 3, 5000);
  }
}

export const classifier = new Classifier();
