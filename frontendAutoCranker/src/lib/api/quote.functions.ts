import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  inspectionReport: z.string().min(1).max(5000),
  vehicle: z.string().max(200).optional(),
  service: z.string().max(200).optional(),
});

const lineItemSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "Short descriptive name of the part or labor task" },
    type: { type: "string", enum: ["part", "labor"] },
    qty: { type: "number", description: "Quantity (for parts) or hours (for labor)" },
    unitCost: { type: "number", description: "Cost per unit/hour in USD" },
  },
  required: ["name", "type", "qty", "unitCost"],
  additionalProperties: false,
};

export const generateQuotation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are an experienced auto-repair service writer. Given an inspection report from a mechanic, produce a realistic itemized repair quotation. Include both required parts and labor lines. Use realistic US shop prices (parts at retail, labor at $120/hr). Quantities: integers for parts, decimal hours for labor (e.g. 1.5).`;

    const userPrompt = `Vehicle: ${data.vehicle ?? "unknown"}
Service request: ${data.service ?? "unspecified"}

Inspection report:
${data.inspectionReport}

Generate the quotation line items.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "build_quotation",
              description: "Return the itemized repair quotation",
              parameters: {
                type: "object",
                properties: {
                  lineItems: { type: "array", items: lineItemSchema, minItems: 1 },
                },
                required: ["lineItems"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "build_quotation" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 429) throw new Error("Rate limit exceeded. Please try again in a moment.");
      if (response.status === 402) throw new Error("AI credits exhausted. Add credits in Workspace settings.");
      throw new Error(`AI gateway error ${response.status}: ${text.slice(0, 200)}`);
    }

    const json = await response.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return a quotation");

    const parsed = JSON.parse(toolCall.function.arguments);
    return { lineItems: parsed.lineItems as Array<{ name: string; type: "part" | "labor"; qty: number; unitCost: number }> };
  });
