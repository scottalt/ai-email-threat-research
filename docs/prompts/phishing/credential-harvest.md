TECHNIQUE: credential-harvest

Definition: Requests the recipient's login credentials, password, or access token — either directly or via a link to a fake login page.

Difficulty calibration:
- Easy: Direct and explicit request ("Please click here to reset your password" or "Verify your account by entering your credentials below"). Obvious that the email is asking for credentials.
- Medium: Framed as a security measure or account protection ("To protect your account, we've temporarily restricted access. Click below to verify your identity"). The credential request is justified by a plausible context.
- Hard: Credential request is embedded in a multi-step workflow. The ask feels like an expected step in a normal process (e.g., multi-factor re-authentication for a system upgrade, reactivating SSO access). Very low alarm level.

Generation notes:
- Vary the service being impersonated: corporate email, banking, HR system, cloud storage, corporate VPN
- The link text should look legitimate (not "click here" — use realistic anchor text like "Verify Account" or "Complete Setup")
- For hard cards: the credential ask should be one natural step in a longer, plausible process
