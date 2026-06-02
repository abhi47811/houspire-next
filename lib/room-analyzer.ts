import { getAnthropicClient } from "./anthropic";
import type { RoomAnalysis } from "./types";

const VISION_PROMPT = `Analyse this interior design render carefully. Return a JSON object with:
- room_type: one of [Living Room, Master Bedroom, Bedroom, Kitchen, Bathroom, Study / Home Office, Dining Room, Foyer / Entrance, Balcony, Unknown]
- estimated_sqft: integer estimate of floor area in sqft
- confidence: "high" | "medium" | "low"
- design_elements: one detailed sentence listing EVERY visible element — floor, ceiling, carpentry, lights, AC, fans, furniture, decor with material specs and brands where visible.
Return ONLY valid JSON, no other text.`;

export async function analyzeRender(
  imageBase64: string,
  mediaType: string,
  filename: string,
): Promise<RoomAnalysis> {
  const client = getAnthropicClient();
  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png", data: imageBase64 },
            },
            { type: "text", text: VISION_PROMPT },
          ],
        },
      ],
    });
    let text = (resp.content[0] as { text: string }).text.trim();
    if (text.startsWith("```")) text = text.split("```")[1].replace(/^json/, "").trim();
    const data = JSON.parse(text);
    return {
      room_type: data.room_type ?? "Unknown",
      estimated_sqft: parseInt(data.estimated_sqft) || 120,
      confidence: data.confidence ?? "medium",
      design_elements: data.design_elements ?? "",
      image_filename: filename,
    };
  } catch {
    return { room_type: "Unknown", estimated_sqft: 120, confidence: "low", design_elements: "Could not analyse — describe manually.", image_filename: filename };
  }
}
