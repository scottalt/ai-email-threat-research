TECHNIQUE: authority-impersonation

Definition: Impersonates a trusted authority — IT department, senior management, government agency, or well-known brand — to bypass skepticism through perceived legitimacy.

Difficulty calibration:
- Easy: Authority figure is plausible but sender domain is obviously wrong. Uses generic addressing ("Dear Customer"). Brand or role is surface-level.
- Medium: Sender name and branding match the authority convincingly. Domain looks legitimate at casual glance. References specific products or services.
- Hard: Highly specific internal-sounding language. References real-sounding system names, ticket numbers, policies. Domain uses subdomain spoofing or typosquatting that requires character-by-character inspection.
- Extreme: Perfect impersonation. Internal jargon, realistic thread context, plausible sender. The ONLY tell is a subtle domain anomaly or an unusual request buried in otherwise normal communication. authStatus may be "verified".

Anti-pattern rules:
- Do NOT always put "support-" or "-secure" in phishing domains — use typosquatting, homoglyphs, or subdomain nesting instead
- For hard/extreme: the impersonation should be SO good that the email could genuinely be from the claimed sender
- Vary authority types: IT helpdesk, C-suite, bank, government, cloud service, vendor, legal department
- Some cards should impersonate INTERNAL roles (your own company's IT, your own manager) not just external brands
