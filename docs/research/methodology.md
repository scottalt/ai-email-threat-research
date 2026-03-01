# Retro Phish — Research Methodology

**Working Title:** State of Phishing in the Rise of GenAI
**Author:** Scott Altiparmak
**Status:** Pre-collection — pipeline in development
**Publication target:** Personal blog (scottaltiparmak.com) with potential journal submission
**Last updated:** 2026-03-01

---

## Research Question

Has the rise of generative AI meaningfully changed phishing email characteristics in ways that reduce human recognition rates — even among security-aware individuals?

Secondary questions:
- Which social engineering techniques have the highest bypass rate in text-based recognition tasks?
- Does player confidence level (GUESSING / LIKELY / CERTAIN) correlate with accuracy?
- Do players who spend more time on a card perform better or worse?
- Are email-based phishing attempts harder to detect than SMS-based?
- Which technique categories are most affected by GenAI augmentation?

---

## Hypothesis

GenAI-crafted phishing emails — characterised by fluent prose, contextual awareness, and absence of traditional grammar tells — will have a statistically higher bypass rate in human recognition tasks compared to traditional phishing emails, even among a self-selected security-aware population.

---

## Dataset: Retro Phish Dataset v1

### Composition
- **Total cards:** 1,000
- **Phishing:** 600 (60%)
- **Legitimate:** 400 (40%)
- **Types:** Email and SMS (v1 is expected to be email-dominant due to corpus availability)
- **Dataset version:** v1 — frozen once 1,000 cards are approved. No additions without a v2 release.

### Phishing Sources
All phishing samples are sourced post-2023 to capture the GenAI era. Sources:
1. **Personal honeypot** — catch-all email address exposed to phishing campaigns. Primary original data source.
2. **Any.run public sandbox** — community-submitted malicious email samples, filtered for phishing.
3. **Malware-traffic-analysis.net** — real phishing samples published for educational use by Brad Duncan.
4. **Community sources** — r/phishing, r/Scams, curated manually for quality and relevance.
5. **Academic repositories** — Zenodo, IEEE DataPort, Mendeley Data (filtered for post-2023 samples).

### Legitimate Email Sources
1. **Real public communications** — modern shipping notifications, service emails, newsletters, company announcements. No PII. No personal correspondence.
2. **Synthetically generated** (labeled as synthetic in paper) — LLM-generated realistic work/personal emails where real sources are insufficient. Clearly disclosed in methodology.

### Why Not Enron or Pre-2023 Corpora
Pre-GenAI corpora (Enron, SpamAssassin, Nazario) are excluded by design. The research question is specifically about the GenAI era (2023+). Using older corpora would conflate traditional and GenAI phishing characteristics.

---

## Curation Pipeline

### Stage 1: Import
Raw emails ingested from each source corpus via Node.js import scripts. Written to `cards_staging` table in Supabase with: raw content, source corpus, import batch ID, deduplication hash (prevents duplicate entries across sources).

### Stage 2: AI Preprocessing
Each staging row is processed by a configurable AI model (default: OpenAI GPT-4o, swappable via `AI_PROVIDER` env var). The model:
1. **Strips PII first** — replaces real names, email addresses, phone numbers, account numbers, and identifying URLs with generic placeholders (`[RECIPIENT NAME]`, `[ACCOUNT NUMBER]`, etc.)
2. Extracts clean from/subject/body from raw email format
3. Identifies primary and secondary phishing technique
4. Assesses whether the email shows GenAI characteristics (`is_genai_suspected`, `genai_confidence: low | medium | high`)
5. Flags inappropriate content with reason
6. Drafts a sanitized body alternative for flagged content
7. Suggests difficulty rating, highlight phrases, analyst clues, and explanation text

The specific model used is stored per row (`ai_model` field) for reproducibility.

### Stage 3: Human Review
All cards reviewed by Scott Altiparmak via `/admin` review UI before approval. Reviewer:
- Sees raw content (left) and AI-processed fields (right)
- Can edit any field inline
- Marks each card as verbatim (original text preserved post-PII-strip) or adapted (sanitized/rewritten)
- Assigns final technique tags, difficulty, GenAI assessment
- Approves or rejects

No card enters the live dataset without human review.

### Stage 4: Dataset Freeze
Once `cards_real` reaches 1,000 approved cards, the dataset is frozen as v1. The pipeline is closed for v1. All future collection targets v2.

---

## PII Handling

PII stripping is mandatory and happens as the **first step** of AI preprocessing — before any other analysis. The raw body is never stored in `cards_real`. All PII is replaced with clearly bracketed generic placeholders. Cards marked verbatim have had PII stripped but otherwise retain original wording. Cards marked adapted have been rewritten for content reasons.

---

## Data Collection (Gameplay)

Player answers are collected anonymously via the Retro Phish game in **Research Mode**. Each answer event records:
- Card ID, technique, is_genai_suspected, difficulty, type (email/SMS)
- Player's answer (phishing/legit), whether correct
- Confidence level (GUESSING / LIKELY / CERTAIN)
- Time spent on card (ms) — from card render to answer submission
- Session ID (UUID generated per game session, not persisted)
- Game mode (research/training)

No personally identifiable information is collected. No accounts, no IP storage, no cookies beyond session state.

### Consent
Players are informed via the game UI that answers in Research Mode contribute to anonymised security awareness research. Participation is voluntary and implicit in selecting Research Mode.

---

## Sample Characteristics and Limitations

### Self-Selected Sample
Players who seek out a retro phishing awareness game are likely more security-aware than the general population. Results should be interpreted in the context of a **security-aware population**, not general users. This is noted as a limitation but also a feature: if even security-aware individuals show elevated bypass rates for GenAI phishing, the finding is conservative and stronger.

### Text-Based Presentation
The terminal interface strips all visual design cues (logos, branding, CSS styling). Real-world phishing detection in Gmail or Outlook also involves visual anomalies. Results reflect **text-based, linguistic phishing recognition** — not full email client simulation. This is a documented limitation.

This limitation is partially offset by the research focus: GenAI's primary advantage over traditional phishing is *text quality*, not visual design. Testing linguistic cues in isolation is appropriate for the GenAI research question.

### SMS Coverage
v1 is expected to be email-dominant. Public post-2023 smishing corpora are limited. SMS card count will be reported transparently.

### Synthetic Legitimate Emails
Where synthetic legitimate emails are used, they are clearly labeled as synthetic in the dataset and disclosed in methodology. The research question concerns phishing detection; legitimate emails serve as foils.

---

## Analysis Plan

### Primary Analysis
- GenAI phishing bypass rate vs. traditional phishing bypass rate (the headline finding)
- Breakdown by technique category
- Breakdown by difficulty
- Breakdown by type (email vs SMS)

### Secondary Analysis
- Confidence calibration: are CERTAIN answers more accurate? Does this hold for GenAI phishing?
- Time-to-decision analysis: does longer deliberation improve accuracy?
- Streak effects: does answer streak correlate with accuracy on subsequent cards?
- Within-session learning: do players improve over a 10-card session?

### Dataset Descriptive Statistics
- Technique distribution across phishing cards
- GenAI classification distribution and confidence breakdown
- Source corpus breakdown
- Verbatim vs adapted breakdown

---

## Technique Taxonomy

Phishing technique labels used in the dataset:

| Label | Description |
|-------|-------------|
| `urgency` | Creates false time pressure or threat of account loss |
| `domain-spoofing` | Uses lookalike domains (paypa1.com, secure-chase.net) |
| `authority-impersonation` | Impersonates IT, management, government, or known brand |
| `grammar-tells` | Traditional phishing: poor grammar, awkward phrasing |
| `hyper-personalization` | Uses recipient's name, role, or context convincingly (GenAI indicator) |
| `fluent-prose` | Polished, natural language with no traditional tells (GenAI indicator) |
| `reward-prize` | Fake prize, refund, or benefit as lure |
| `it-helpdesk` | Impersonates internal IT support |
| `credential-harvest` | Explicit credential request or login page redirect |
| `invoice-fraud` | Fake invoice or payment request |

Cards may have a primary and secondary technique.

---

## Publication Plan

1. **Public analytics page** (`/intel`) — live aggregate findings, always current, citable URL
2. **Blog post** (scottaltiparmak.com) — "State of Phishing in the GenAI Era" — detailed write-up with methodology, findings, and implications. Published once sufficient answer data collected.
3. **Potential journal submission** — mid-tier security awareness or human factors venue. Methodology section references this document.

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-03-01 | Initial methodology draft — pre-collection |
