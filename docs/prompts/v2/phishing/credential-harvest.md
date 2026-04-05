TECHNIQUE: credential-harvest

Definition: Requests the recipient's login credentials, password, or access token — either directly or via a link to a fake login page.

Difficulty calibration:
- Easy: Direct and explicit request ("Please click here to reset your password" or "Verify your account by entering your credentials below"). Link text is generic.
- Medium: Framed as a security measure ("To protect your account, we've temporarily restricted access. Click below to verify your identity"). The credential request is justified by a plausible context. Link looks realistic.
- Hard: Credential request is embedded in a multi-step workflow. The ask feels like an expected step in a normal process (e.g., MFA re-enrollment, SSO migration, compliance recertification).
- Extreme: The credential flow is indistinguishable from real IT processes. References specific-sounding systems (Okta, Azure AD, Duo). The link URL uses subdomain spoofing that looks correct at a glance. authStatus may be "verified".

Anti-pattern rules:
- Do NOT always use "Click here" — use realistic button text like "Complete Verification", "Sign In to Continue", "Review Access"
- Do NOT always ask for passwords directly — some harvest credentials via fake SSO pages, "document access" requiring login, or "shared drive" links
- The harder the card, the more the credential request should feel like a normal business process
- Vary the service: corporate email, banking, HR portal, cloud storage, VPN, document sharing
