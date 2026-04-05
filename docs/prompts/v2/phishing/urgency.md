TECHNIQUE: urgency

Definition: Creates false time pressure or threatens immediate negative consequences to prevent careful analysis. The goal is to make the recipient act before thinking.

Difficulty calibration:
- Easy: Urgency language is explicit and prominent ("Act within 24 hours or your account will be permanently deleted", "IMMEDIATE ACTION REQUIRED"). Sender domain is clearly wrong. The urgency is disproportionate to the stated cause.
- Medium: Urgency is present but professional in tone ("We've placed a temporary hold on your account pending verification"). Context is plausible. Sender domain looks legitimate at first glance but has a subtle tell.
- Hard: Urgency is subtle and embedded in routine-sounding correspondence. Time pressure feels natural ("Our systems will undergo scheduled maintenance on Friday — please update your payment method before then"). Sender domain is convincing. Requires careful analysis.
- Extreme: Urgency is indistinguishable from legitimate operational deadlines. The email reads like a real business communication with a real deadline. Only forensic analysis of the sender domain or link destination reveals it. Some cards should have authStatus "verified".

Anti-pattern rules:
- Do NOT always use exclamation marks or caps for urgency — real urgency can be expressed calmly ("Please complete this by end of day")
- Do NOT always use a suspicious-looking domain — use typosquatting, subdomain tricks, or even clean unrelated domains
- Medium/hard cards should NOT read like phishing templates — they should read like real emails with real problems
- Vary the context: banking, subscriptions, cloud storage, HR systems, vendor invoices, IT tickets
