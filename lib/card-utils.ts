/**
 * Whitelist-based card sanitisation for client delivery.
 *
 * Only the fields needed to DISPLAY the card are sent.  Everything else
 * (answers, metadata, research signals, the real card ID) stays server-side.
 *
 * The client receives `_idx` (the card's position in the dealt array) as
 * its only identifier — used when calling /api/cards/check.
 */

/** The shape returned to the browser — nothing answer-revealing */
export interface SafeDealCard {
  _idx: number;         // opaque ordinal — NOT the real card ID
  type: string;         // 'email' | 'sms'
  from: string;
  subject?: string;
  body: string;
  authStatus: string;   // game mechanic — players inspect this
  replyTo?: string;
  attachmentName?: string;
  sentAt?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSafeCard(card: any, index: number): SafeDealCard {
  return {
    _idx: index,
    type: card.type,
    from: card.from,
    subject: card.subject ?? undefined,
    body: card.body,
    authStatus: card.authStatus ?? 'unverified',
    replyTo: card.replyTo ?? undefined,
    attachmentName: card.attachmentName ?? undefined,
    sentAt: card.sentAt ?? undefined,
  };
}
