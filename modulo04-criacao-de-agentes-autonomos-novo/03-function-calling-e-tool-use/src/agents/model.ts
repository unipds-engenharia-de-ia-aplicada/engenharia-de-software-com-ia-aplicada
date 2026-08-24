import { ChatOpenAI } from "@langchain/openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function createModel(): ChatOpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is required");
  }

  return new ChatOpenAI({
    apiKey,
    model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    temperature: 0,
    configuration: {
      baseURL: OPENROUTER_BASE_URL,
    },
  });
}
