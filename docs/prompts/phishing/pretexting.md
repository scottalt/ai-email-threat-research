TECHNIQUE: pretexting

Definition: Creates a detailed false scenario or narrative to make the eventual request seem natural and necessary. The pretext establishes context that logically justifies the ask.

Difficulty calibration:
- Easy: The scenario is thin (1–2 sentences of setup) and the ask is obvious and comes quickly. The story is implausible or too generic.
- Medium: Two-paragraph setup with a plausible business scenario. The ask follows logically from the scenario. Requires reading the whole email to understand the request.
- Hard: Full-narrative email that reads like routine business correspondence. The scenario is detailed, internally consistent, and highly plausible. The ask — credentials, payment action, sensitive information — feels like the obvious next step in the described process.
- Extreme: Business Email Compromise (BEC) style — NO malicious link, NO explicit credential request. Instead, the email is a low-commitment first touch or probe that any employee would respond to without suspicion. Examples: a request to "confirm you're the right person to handle vendor payments before we proceed", a message asking to "verify the banking details we have on file for your organisation", or a contextually rich email asking someone to "confirm receipt of the attached invoice" where the attack is the relationship being established, not a link or credential ask. The threat model is reconnaissance and trust-building, not a single click. The email reads as completely routine correspondence — possibly even boring. Nothing in the body would trigger a security-aware employee. The one forensic tell — mandatory — is the sender's email domain: a near-perfect lookalike with a single transposed character, wrong TLD, or convincing subdomain (e.g., s.chen@meridian-group.net instead of meridiangroup.com). A player who reads only the body will find nothing. A player who checks the sender domain character by character will find the discrepancy.

Generation notes:
- Common pretexting scenarios: vendor onboarding, contract renewal, compliance audit, IT system migration, benefits enrollment, quarterly reconciliation
- For hard cards: give the pretext enough specific detail that it feels like a real ongoing business relationship
- The ask should be proportionate to the pretext — a vendor relationship might request a wire transfer, an IT audit might request VPN credentials
- For extreme/BEC cards: the ask must NOT be a link click or an explicit credential request. It should be conversational and low-stakes on its face — a confirmation, a verification, a quick question. The phishing intent is in what comes next (the follow-up), but the email itself looks benign. The red flag is the nature and origin of the request, not anything in the language or format.
- For extreme/BEC cards: vary the attacker persona (fake vendor, fake executive, fake finance counterpart at a partner org, fake HR) and the target (finance team, executive assistant, IT admin, HR coordinator)
