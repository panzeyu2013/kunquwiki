export type AIParseRequest = {
  prompt: string;
  input: string;
  jsonSchema?: Record<string, unknown>;
};

export type AIParseResponse = {
  rawText: string;
};

export interface AIProvider {
  name: string;
  parse(request: AIParseRequest): Promise<AIParseResponse>;
}

export type AIProviderConfig = {
  provider: string;
  apiKey?: string;
  apiBase?: string;
  model?: string;
};
