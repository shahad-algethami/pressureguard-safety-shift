import 'server-only';
import OpenAI from 'openai';
export function aiClient() {
  if (!process.env.OPENAI_API_KEY) throw new Error('AI_NOT_CONFIGURED');
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: 20000,
    maxRetries: 0,
  });
}
