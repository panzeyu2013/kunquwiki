import { AIProvider, AIProviderConfig } from "./ai.types";
import { OpenAICompatibleProvider } from "./apifamily/openai-compatible";

export function createAIProvider(): AIProvider | null {
  const provider = process.env.AI_PROVIDER ?? "";
  if (!provider) {
    return null;
  }

  const config: AIProviderConfig = {
    provider,
    apiKey: process.env.AI_API_KEY,
    apiBase: process.env.AI_API_BASE,
    model: process.env.AI_MODEL
  };

  switch (provider) {
    case "openai-compatible":
      return new OpenAICompatibleProvider(config);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
