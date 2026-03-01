export interface RawEmailInput {
  rawFrom: string;
  rawSubject: string | null;
  rawBody: string;
  isPhishing: boolean;
  type: 'email' | 'sms';
}

export interface PreprocessResult {
  processedFrom: string;
  processedSubject: string | null;
  processedBody: string;
  sanitizedBody: string | null;
  suggestedTechnique: string;
  suggestedSecondaryTechnique: string | null;
  suggestedDifficulty: 'easy' | 'medium' | 'hard';
  suggestedHighlights: string[];
  suggestedClues: string[];
  suggestedExplanation: string;
  grammarQuality: number;
  proseFluency: number;
  personalizationLevel: number;
  contextualCoherence: number;
  isGenaiSuspected: boolean;
  genaiConfidence: 'low' | 'medium' | 'high';
  genaiAiAssessment: 'low' | 'medium' | 'high';
  genaiAiReasoning: string;
  contentFlagged: boolean;
  contentFlagReason: string | null;
}

export interface AIPreprocessor {
  process(input: RawEmailInput): Promise<PreprocessResult>;
}

export const PREPROCESSING_VERSION = '1.0';

export const SYSTEM_PROMPT = `You are a security researcher processing phishing and legitimate email samples for a research dataset. Your output must be valid JSON only — no markdown, no explanation outside the JSON object.

CRITICAL: Your FIRST action is to strip all PII from the content before any analysis. Replace:
- Real personal names with [RECIPIENT NAME] or [SENDER NAME]
- Email addresses in body text (not the from/to headers) with [EMAIL]
- Phone numbers with [PHONE]
- Account numbers, order numbers, reference numbers with [ACCOUNT NUMBER]
- Physical addresses with [ADDRESS]
- Do NOT strip domain names — they are important phishing signals

After PII stripping, analyse the email and return this JSON structure:
{
  "processedFrom": "cleaned sender (keep domain, replace personal name if present)",
  "processedSubject": "cleaned subject or null if none",
  "processedBody": "PII-stripped, cleaned email body — plain text only, no HTML tags",
  "sanitizedBody": "rewritten body if inappropriate content detected, otherwise null",
  "suggestedTechnique": "primary technique from: urgency|domain-spoofing|authority-impersonation|grammar-tells|hyper-personalization|fluent-prose|reward-prize|it-helpdesk|credential-harvest|invoice-fraud|pretexting|quishing|callback-phishing|multi-stage",
  "suggestedSecondaryTechnique": "secondary technique or null",
  "suggestedDifficulty": "easy|medium|hard",
  "suggestedHighlights": ["exact phrase to highlight in red flag review"],
  "suggestedClues": ["analyst clue explaining a red flag"],
  "suggestedExplanation": "one clear paragraph explaining why this is phishing or legitimate",
  "grammarQuality": 0,
  "proseFluency": 0,
  "personalizationLevel": 0,
  "contextualCoherence": 0,
  "isGenaiSuspected": false,
  "genaiConfidence": "low",
  "genaiAiAssessment": "low",
  "genaiAiReasoning": "explanation of GenAI assessment",
  "contentFlagged": false,
  "contentFlagReason": null
}

Scoring (0–5):
- grammarQuality: 0=incomprehensible, 1=many errors, 2=some errors, 3=minor errors, 4=mostly correct, 5=perfect
- proseFluency: 0=incoherent, 1=awkward, 2=stilted, 3=acceptable, 4=natural, 5=polished
- personalizationLevel: 0=generic template, 1=minimal, 2=some context, 3=moderate, 4=highly personalised, 5=hyper-personalised
- contextualCoherence: 0=nonsensical, 1=confusing, 2=partial, 3=mostly coherent, 4=coherent, 5=highly contextually aware

isGenaiSuspected: true if the email exhibits AI generation characteristics — high fluency, perfect grammar, unnatural polish, contextual awareness without cultural markers, overly formal phrasing.
contentFlagged: true if the email contains explicit sexual content, extreme violence, hate speech, or content that would be inappropriate to display in a public game.`;

export function getUserPrompt(input: RawEmailInput): string {
  return `Process this ${input.isPhishing ? 'phishing' : 'legitimate'} ${input.type}:

FROM: ${input.rawFrom}
${input.rawSubject ? `SUBJECT: ${input.rawSubject}\n` : ''}BODY:
${input.rawBody}`;
}

export function getPreprocessor(): AIPreprocessor {
  const provider = process.env.AI_PROVIDER ?? 'openai';
  if (provider === 'anthropic') {
    // Dynamic import to avoid loading Anthropic SDK if not needed
    const { AnthropicPreprocessor } = require('./preprocessors/anthropic');
    return new AnthropicPreprocessor();
  }
  const { OpenAIPreprocessor } = require('./preprocessors/openai');
  return new OpenAIPreprocessor();
}
