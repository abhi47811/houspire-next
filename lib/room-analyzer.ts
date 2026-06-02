import { getAnthropicClient } from "./anthropic";
import type { RoomAnalysis } from "./types";

const VISION_PROMPT_MULTI = `You are analysing a set of interior design renders for a single residential project.

For EACH image provided, return a JSON object in an array. Cross-reference rooms where possible (e.g. note consistent ceiling styles, flooring continuity).

For each room return:
- room_type: one of [Living Room, Master Bedroom, Bedroom, Kitchen, Bathroom, Study / Home Office, Dining Room, Foyer / Entrance, Balcony, Unknown]
- estimated_sqft: integer estimate of floor area in sqft (bedroom 120-200, living 200-400, kitchen 80-150, bathroom 40-80)
- confidence: "high" | "medium" | "low"
- design_elements: one detailed sentence listing EVERY visible element — floor material, ceiling treatment, every carpentry item (wardrobe/TV unit/headboard/desk/shelves), wall treatment, every light fixture, AC, fans, furniture, soft furnishings, decor. Include material specs and brands where visible.

Return ONLY a JSON array — one object per image in the same order. No markdown, no explanation.
Example: [{"room_type":"Living Room","estimated_sqft":280,"confidence":"high","design_elements":"..."},...]`;

const VISION_PROMPT_SINGLE = `Analyse this interior design render carefully. Return a JSON object with:
- room_type: one of [Living Room, Master Bedroom, Bedroom, Kitchen, Bathroom, Study / Home Office, Dining Room, Foyer / Entrance, Balcony, Unknown]
- estimated_sqft: integer estimate of floor area in sqft
- confidence: "high" | "medium" | "low"
- design_elements: one detailed sentence listing EVERY visible element — floor, ceiling, carpentry, lights, AC, fans, furniture, decor with material specs and brands where visible.
Return ONLY valid JSON, no other text.`;

export async function analyzeAllRenders(
  images: Array<{ base64: string; mediaType: string; filename: string }>,
): Promise<RoomAnalysis[]> {
  if (images.length === 0) return [];
  const client = getAnthropicClient();

  if (images.length === 1) {
    // Single image — simple call
    return [await analyzeSingle(client, images[0])];
  }

  // Multiple images — one call with all images for cross-room context
  try {
    const content: Array<{ type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png"; data: string } } | { type: "text"; text: string }> = [
      ...images.map((img) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: img.mediaType as "image/jpeg" | "image/png", data: img.base64 },
      })),
      { type: "text" as const, text: `${VISION_PROMPT_MULTI}\n\nAnalyse these ${images.length} renders in order.` },
    ];

    const resp = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024 * images.length,
      messages: [{ role: "user", content }],
    });

    let text = (resp.content[0] as { text: string }).text.trim();
    if (text.startsWith("```")) text = text.split("```")[1].replace(/^json/, "").trim();

    const parsed = JSON.parse(text) as Array<{
      room_type: string; estimated_sqft: number; confidence: string; design_elements: string;
    }>;

    return parsed.map((d, i) => ({
      room_type: d.room_type ?? "Unknown",
      estimated_sqft: parseInt(String(d.estimated_sqft)) || 120,
      confidence: (d.confidence as "high" | "medium" | "low") ?? "medium",
      design_elements: d.design_elements ?? "",
      image_filename: images[i]?.filename ?? `image_${i + 1}`,
    }));
  } catch {
    // Fallback: analyse each individually
    return Promise.all(images.map((img) => analyzeSingle(client, img)));
  }
}

async function analyzeSingle(
  client: ReturnType<typeof getAnthropicClient>,
  img: { base64: string; mediaType: string; filename: string },
): Promise<RoomAnalysis> {
  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: img.mediaType as "image/jpeg" | "image/png", data: img.base64 } },
            { type: "text", text: VISION_PROMPT_SINGLE },
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
      image_filename: img.filename,
    };
  } catch {
    return { room_type: "Unknown", estimated_sqft: 120, confidence: "low", design_elements: "Could not analyse — describe manually.", image_filename: img.filename };
  }
}
