import { AIParseRequest, AIParseResponse, AIProvider, AIProviderConfig } from "../ai.types";

export class OpenAICompatibleProvider implements AIProvider {
  name = "openai-compatible" as const;
  private readonly apiKey: string;
  private readonly apiBase: string;
  private readonly model: string;

  constructor(config: AIProviderConfig) {
    if (!config.apiKey) {
      throw new Error("AI_API_KEY is required");
    }
    this.apiKey = config.apiKey;
    this.apiBase = config.apiBase ?? "https://api.openai.com/v1";
    this.model = config.model ?? "gpt-4o-mini";
  }

  async parse(request: AIParseRequest): Promise<AIParseResponse> {
    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0,
        messages: [
          { role: "system", content: request.prompt },
          { role: "user", content: request.input }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI provider error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI provider returned empty response");
    }

    return { rawText: content };
  }
}
