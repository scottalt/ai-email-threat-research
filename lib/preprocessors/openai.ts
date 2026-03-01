import type { AIPreprocessor, RawEmailInput, PreprocessResult } from '../ai-preprocessor';
import { SYSTEM_PROMPT, getUserPrompt, PREPROCESSING_VERSION } from '../ai-preprocessor';
import OpenAI from 'openai';

export class OpenAIPreprocessor implements AIPreprocessor {
  private client: OpenAI;
  readonly modelId = 'gpt-4o';
  readonly version = PREPROCESSING_VERSION;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async process(input: RawEmailInput): Promise<PreprocessResult> {
    const response = await this.client.chat.completions.create({
      model: this.modelId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: getUserPrompt(input) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty response');

    return JSON.parse(content) as PreprocessResult;
  }
}
