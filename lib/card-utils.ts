/** Fields to strip from cards before sending to clients */
const ANSWER_FIELDS = ['isPhishing', 'clues', 'explanation', 'highlights', 'technique'] as const;

/** Strip answer-revealing fields from a card for client delivery */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripCardAnswers<T>(card: T): T {
  const stripped = { ...card } as any;
  for (const field of ANSWER_FIELDS) {
    delete stripped[field];
  }
  return stripped;
}
