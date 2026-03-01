import type { AIPreprocessor, RawEmailInput, PreprocessResult } from '../ai-preprocessor';
import { SYSTEM_PROMPT, getUserPrompt, PREPROCESSING_VERSION } from '../ai-preprocessor';
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicPreprocessor implements AIPreprocessor {
  private client: Anthropic;
  readonly modelId = 'claude-opus-4-6';
  readonly version = PREPROCESSING_VERSION;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async process(input: RawEmailInput): Promise<PreprocessResult> {
    const message = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: getUserPrompt(input) }],
    });

    const block = message.content[0];
    if (block.type !== 'text') throw new Error('Anthropic returned non-text response');

    // Strip any markdown code fences if present
    const json = block.text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(json) as PreprocessResult;
  }
}
