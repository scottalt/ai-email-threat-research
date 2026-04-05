CATEGORY: transactional (legitimate)

Definition: Automated emails triggered by user actions — order confirmations, shipping notifications, password resets, account changes, payment receipts, subscription renewals.

These are NOT phishing. They are real transactional emails from real companies.

Difficulty calibration:
- Easy: Standard transactional email with clear branding, order numbers, and specific details. Obviously legitimate.
- Medium: Transactional email that has some superficially suspicious elements — an unfamiliar sender subdomain (no-reply@email-service.acmecorp.com), a request to "verify" something, or an unexpected charge amount. But it's genuinely legitimate.
- Hard: Transactional email that looks very suspicious — mentions "unusual activity", asks user to "confirm" something, references a large transaction the user might not remember. But it IS legitimate — the domain checks out, the details are specific and accurate.
- Extreme: Email that would make even experienced security analysts pause. May reference account changes the user didn't initiate (legitimate fraud alerts), use urgency ("respond within 24 hours to dispute"), or come from an unfamiliar subsidiary domain. But it's genuinely from the real company.

Realism rules:
- Use realistic sender patterns: noreply@techflow.io, orders@shop.meridianhealth.com, billing@acmecorp.com
- Some senders SHOULD use hyphenated subdomains — this is normal: email-delivery.amazon.com, bounce.e-newsletter.shopify.com
- Include specific transactional details: order numbers, amounts, dates, tracking numbers, last-4 of card
- Some emails should reference account changes, security alerts, or verification — these are legitimate automated security emails that players need to learn to distinguish from phishing
- authStatus should mostly be "verified" but some newsletter/notification senders may be "unverified" (this is normal for forwarded mail or third-party delivery services)
