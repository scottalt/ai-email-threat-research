# Retro Phish — Research Methodology

**Working Title:** State of Phishing in the Rise of GenAI
**Author:** Scott Altiparmak
**Status:** Pre-collection — pipeline in development

---

## Core Research Question (LOCKED)

**Which phishing techniques are humans most likely to miss when linguistic quality is no longer a reliable detection signal?**

### Design decisions that flow from this question

- Dataset is entirely GenAI-generated phishing emails. Linguistic quality is held constant as the baseline assumption, not studied as a variable. This is the post-GenAI reality: grammar and fluency can no longer be relied upon as tells.
- Technique is the primary independent variable. The 14-category taxonomy (urgency, domain-spoofing, authority-impersonation, grammar-tells, hyper-personalization, fluent-prose, reward-prize, it-helpdesk, credential-harvest, invoice-fraud, pretexting, quishing, callback-phishing, multi-stage) provides the breakdown.
- Human detection rate (correct identification as phishing) is the primary outcome metric.
- Behavioral signals are secondary findings: response time, confidence level, confidence selection time, scroll depth, answer method, session position.
- Sample is self-selected game players. Not claimed as security-aware or general population. Limitation noted: the game's nature may attract security-interested individuals, meaning bypass rates may be conservative estimates for the general population.

### Why this is novel

Existing technique-level phishing detection literature was built on datasets where grammar and fluency varied. This study holds linguistic quality constant at AI-generation level and isolates technique as the sole variable. No published baseline exists for technique-level human detection rates in a world where AI-quality writing is assumed. This study establishes that baseline.
**Publication target:** Personal blog (scottaltiparmak.com) with potential journal submission
**Last updated:** 2026-03-01

---

## Research Question

Has the rise of generative AI meaningfully changed phishing email characteristics in ways that reduce human recognition rates — even among security-aware individuals?

Secondary questions:
- Do emails with high prose fluency, grammar quality, and personalization have higher bypass rates than low-quality traditional phishing?
- Which social engineering techniques have the highest bypass rate in text-based recognition tasks?
- Does player confidence level (GUESSING / LIKELY / CERTAIN) correlate with accuracy?
- Does time-to-decision correlate with accuracy? Do faster answers produce more errors?
- Does scroll depth affect accuracy? Do players who read the full email perform better?
- Are email-based phishing attempts harder to detect than SMS-based?
- Do within-session learning effects exist? Do players improve over a 10-card session?
- Does answer streak create overconfidence on subsequent cards?

---

## Hypothesis

Primary: Phishing emails exhibiting high prose fluency, grammatical correctness, and contextual personalization — characteristics associated with GenAI generation — will have a statistically higher bypass rate in human recognition tasks compared to low-quality traditional phishing, even among a self-selected security-aware population.

Secondary: Traditional phishing detection heuristics (grammar errors, urgency cues, domain spoofing) are becoming less reliable as GenAI raises the baseline quality of phishing prose.

---

## Dataset: Retro Phish Dataset v1

### Composition
- **Total cards:** 1,000
- **Phishing:** 600 (60%)
- **Legitimate:** 400 (40%)
- **Types:** Email and SMS (v1 is expected to be email-dominant due to corpus availability)
- **Era:** Post-2023 samples only (GenAI era)
- **Dataset version:** v1 — frozen once 1,000 cards are approved. No additions without a v2 release.

### Phishing Sources
All phishing samples are sourced post-2023 to capture the GenAI era:
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
Raw emails ingested from each source corpus via Node.js import scripts. Written to `cards_staging` with: raw content, source corpus, import batch ID, deduplication hash, full parsed email headers JSON, received date from headers, link list, attachment metadata, HTML vs plain text flag, detected language.

### Stage 2: AI Preprocessing
Each staging row is processed by a configurable AI model (default: OpenAI GPT-4o, swappable via `AI_PROVIDER` env var). Steps in order:

1. **Strip PII first** — replaces real names, email addresses, phone numbers, account numbers, and identifying URLs with generic placeholders (`[RECIPIENT NAME]`, `[ACCOUNT NUMBER]`, etc.) before any other processing.
2. Extract clean from/subject/body from raw email format.
3. Identify primary and secondary phishing technique from taxonomy.
4. **Linguistic quality scores** — assess grammar_quality, prose_fluency, personalization_level, contextual_coherence (each 0–5).
5. **GenAI assessment** — classify is_genai_suspected and genai_confidence (low/medium/high) based on linguistic characteristics. Record full reasoning in genai_ai_reasoning.
6. Flag inappropriate content with reason; draft sanitized body alternative.
7. Suggest difficulty rating, highlight phrases, analyst clues, explanation text.

The specific model and preprocessing prompt version are stored per row for reproducibility.

### Stage 2b: AI Detector Score
Each email body is independently scored by an AI text detection API (GPTZero or equivalent). Raw score (0–1) stored as `genai_detector_score`. This is a separate signal from the preprocessing model's assessment, providing an independent quantitative measure.

### Stage 2c: Computed Linguistic Metrics
Programmatically computed from the processed body (no subjectivity):
- Flesch-Kincaid readability score
- Average sentence length
- Sentence length variance (burstiness — lower variance is a GenAI signal)
- Word count, character count
- Link count in display body
- Exclamation mark count, capitalisation ratio (traditional phishing signals)

### Stage 3: Human Review
All cards reviewed by Scott Altiparmak via `/admin` review UI before approval. Reviewer sees:
- Raw content (left panel)
- AI-processed fields (right panel, all editable inline)
- Linguistic metrics computed automatically
- AI detector score
- AI's GenAI reasoning

Reviewer actions:
- Edits any field
- Confirms or overrides GenAI assessment, records own reasoning in `genai_reviewer_reasoning`
- Marks verbatim (original text post-PII-strip) or adapted (sanitized/rewritten)
- Assigns final technique tags, difficulty
- Approves or rejects
- Review time is recorded in `review_time_ms`

No card enters the live dataset without human review.

### Stage 4: Dataset Freeze
Once `cards_real` reaches 1,000 approved cards, the dataset is frozen as v1. The pipeline closes for v1. All future collection targets v2. Freeze event recorded in `dataset_versions` table.

---

## GenAI Classification Methodology

### The Core Problem
There is no definitive way to prove a phishing email was generated by an AI. No watermark, no metadata field confirms AI origin. All classification is probabilistic.

### Three-Layer Classification

**Layer 1 — AI Detector Score (quantitative, external)**
Each email body is scored by an independent AI text detection API. Returns a probability (0–1). Imperfect — known false positive and negative rates — but provides a quantitative external signal not produced by the same model doing preprocessing. Stored as `genai_detector_score`.

**Layer 2 — Computed Linguistic Metrics (quantitative, objective)**
Observable characteristics of the text computed programmatically:
- Flesch-Kincaid readability (GenAI scores higher)
- Average sentence length and variance (GenAI has lower variance)
- Grammar error count (GenAI has fewer)
- Sentence complexity indicators

These are facts about the text, not assertions about its origin. They are independently verifiable and reproducible.

**Layer 3 — AI Model Assessment + Human Reviewer (qualitative)**
The preprocessing model evaluates holistic characteristics and records reasoning. The human reviewer sees all three signals and makes the final classification call, recording their own reasoning.

### Final Fields
- `genai_detector_score` — raw API score (0–1)
- `grammar_quality` — reviewer/AI assessed (0–5)
- `prose_fluency` — reviewer/AI assessed (0–5)
- `personalization_level` — reviewer/AI assessed (0–5)
- `contextual_coherence` — reviewer/AI assessed (0–5)
- `is_genai_suspected` — final boolean (human reviewer decision)
- `genai_confidence` — low / medium / high (reviewer's confidence)
- `genai_ai_reasoning` — preprocessing model's free-text explanation
- `genai_reviewer_reasoning` — reviewer's free-text explanation

### Primary Research Framing

The primary analysis uses **observable linguistic characteristics** rather than binary GenAI classification. Research question: do emails with high fluency/personalization/grammar scores have higher bypass rates?

This is more defensible because:
1. It does not require proving AI origin — only measuring observable text quality
2. Findings are directly actionable (defenders know what characteristics to watch for)
3. Results are reproducible against the stored metric scores

The `is_genai_suspected` flag is used as a secondary variable and narrative framing, with confidence levels applied as filters (primary analysis uses medium/high confidence only). Sensitivity analysis runs with and without low-confidence classifications.

---

## PII Handling

PII stripping is mandatory and happens as the **first step** of AI preprocessing — before any other analysis. The raw body is never stored in `cards_real`. All PII is replaced with clearly bracketed generic placeholders. Cards marked verbatim have had PII stripped but otherwise retain original wording. Cards marked adapted have been rewritten for content reasons.

The AI preprocessing prompt explicitly instructs the model to strip PII before performing any other task. The reviewer audits for missed PII before approving any card.

---

## Database Schema Overview

### `cards_staging`
Raw imports plus all preprocessing outputs. Full field list:

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| raw_email_hash | TEXT | SHA-256 of raw content for deduplication |
| import_batch_id | UUID | FK to import_batches |
| source_corpus | TEXT | Origin source |
| raw_from | TEXT | |
| raw_subject | TEXT | |
| raw_body | TEXT | |
| email_headers_json | JSONB | Full parsed headers |
| received_date | TIMESTAMPTZ | From email headers |
| has_html | BOOLEAN | HTML vs plain text |
| has_attachments | BOOLEAN | |
| attachment_count | INT | |
| attachment_types | TEXT[] | MIME types |
| link_count | INT | URLs in raw email |
| links_json | JSONB | Array of URLs found |
| language_detected | TEXT | ISO language code |
| inferred_type | TEXT | email / sms |
| is_phishing | BOOLEAN | Nullable — may be unknown at import |
| processed_from | TEXT | AI-cleaned sender |
| processed_subject | TEXT | |
| processed_body | TEXT | PII-stripped, cleaned |
| sanitized_body | TEXT | Rewritten version if content flagged |
| suggested_technique | TEXT | |
| suggested_secondary_technique | TEXT | |
| suggested_difficulty | TEXT | |
| suggested_highlights | TEXT[] | |
| suggested_clues | TEXT[] | |
| suggested_explanation | TEXT | |
| grammar_quality | SMALLINT | 0–5 |
| prose_fluency | SMALLINT | 0–5 |
| personalization_level | SMALLINT | 0–5 |
| contextual_coherence | SMALLINT | 0–5 |
| genai_detector_score | FLOAT | 0–1 from external API |
| is_genai_suspected | BOOLEAN | |
| genai_confidence | TEXT | low / medium / high |
| genai_ai_assessment | TEXT | low / medium / high |
| genai_ai_reasoning | TEXT | Model's free-text reasoning |
| content_flagged | BOOLEAN | |
| content_flag_reason | TEXT | |
| ai_provider | TEXT | openai / anthropic |
| ai_model | TEXT | e.g. gpt-4o |
| ai_preprocessing_version | TEXT | Prompt version |
| ai_processed_at | TIMESTAMPTZ | |
| status | TEXT | pending / approved / rejected / needs_review |
| reviewed_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### `cards_real`
Approved, curated live dataset. Full field list:

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| staging_id | UUID | FK to cards_staging (audit trail) |
| card_id | TEXT | Unique game ID e.g. real-p-001 |
| type | TEXT | email / sms |
| is_phishing | BOOLEAN | |
| difficulty | TEXT | easy / medium / hard |
| from_address | TEXT | |
| subject | TEXT | Nullable |
| body | TEXT | |
| body_truncated | BOOLEAN | True if original was cut for UI |
| word_count | INT | Of displayed body |
| char_count | INT | Of displayed body |
| link_count_in_display | INT | |
| technique | TEXT | Primary technique |
| secondary_technique | TEXT | Nullable |
| grammar_quality | SMALLINT | 0–5 |
| prose_fluency | SMALLINT | 0–5 |
| personalization_level | SMALLINT | 0–5 |
| contextual_coherence | SMALLINT | 0–5 |
| flesch_kincaid_score | FLOAT | Computed readability |
| avg_sentence_length | FLOAT | |
| sentence_length_variance | FLOAT | Burstiness measure |
| genai_detector_score | FLOAT | Carried from staging |
| is_genai_suspected | BOOLEAN | Final reviewer decision |
| genai_confidence | TEXT | low / medium / high |
| genai_ai_reasoning | TEXT | |
| genai_reviewer_reasoning | TEXT | Reviewer's explanation |
| is_verbatim | BOOLEAN | True = original post-PII-strip |
| source_corpus | TEXT | |
| highlights | TEXT[] | |
| clues | TEXT[] | |
| explanation | TEXT | |
| review_notes | TEXT | Reviewer free text |
| review_time_ms | INT | Time reviewer spent |
| ai_model | TEXT | Which model preprocessed |
| ai_preprocessing_version | TEXT | |
| dataset_version | TEXT | v1 |
| approved_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### `answers`
Every answer event from research mode:

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| session_id | UUID | Groups answers from same game |
| card_id | TEXT | |
| card_source | TEXT | generated / real |
| is_phishing | BOOLEAN | Ground truth |
| technique | TEXT | |
| secondary_technique | TEXT | |
| is_genai_suspected | BOOLEAN | |
| genai_confidence | TEXT | |
| grammar_quality | SMALLINT | Denormalised from card |
| prose_fluency | SMALLINT | Denormalised from card |
| personalization_level | SMALLINT | Denormalised from card |
| contextual_coherence | SMALLINT | Denormalised from card |
| difficulty | TEXT | |
| type | TEXT | email / sms |
| user_answer | TEXT | phishing / legit |
| correct | BOOLEAN | |
| confidence | TEXT | guessing / likely / certain |
| time_from_render_ms | INT | Card shown → answer submitted |
| time_from_confidence_ms | INT | Confidence selected → answer submitted |
| confidence_selection_time_ms | INT | Card shown → confidence selected |
| scroll_depth_pct | SMALLINT | 0–100 |
| answer_method | TEXT | swipe / button |
| answer_ordinal | SMALLINT | Position in session (1–10) |
| streak_at_answer_time | SMALLINT | Player's streak at time of answer |
| correct_count_at_time | SMALLINT | Correct answers so far in session |
| game_mode | TEXT | research / training |
| is_daily_challenge | BOOLEAN | |
| dataset_version | TEXT | v1 |
| created_at | TIMESTAMPTZ | |

### `sessions`
Session-level data (one row per game played):

| Field | Type | Notes |
|-------|------|-------|
| session_id | UUID | Primary key |
| game_mode | TEXT | research / training |
| is_daily_challenge | BOOLEAN | |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | Null if abandoned |
| cards_answered | SMALLINT | May be < 10 if abandoned |
| final_score | INT | |
| final_rank | TEXT | |
| device_type | TEXT | mobile / tablet / desktop |
| viewport_width | SMALLINT | |
| viewport_height | SMALLINT | |
| referrer | TEXT | Where traffic came from |

### `import_batches`
Tracks each corpus import run:

| Field | Type | Notes |
|-------|------|-------|
| batch_id | UUID | Primary key |
| source_corpus | TEXT | |
| import_date | TIMESTAMPTZ | |
| raw_count | INT | Emails imported |
| processed_count | INT | AI preprocessed |
| approved_count | INT | Approved by reviewer |
| rejected_count | INT | |
| notes | TEXT | |

### `dataset_versions`
Version registry:

| Field | Type | Notes |
|-------|------|-------|
| version | TEXT | v1, v2 etc. |
| locked_at | TIMESTAMPTZ | Null until frozen |
| total_cards | INT | |
| phishing_count | INT | |
| legit_count | INT | |
| description | TEXT | |

---

## Data Collection (Gameplay)

Player answers collected anonymously in Research Mode. The session UUID is generated at game start, held in memory only, never persisted to localStorage or cookies.

Timing measurements:
- `time_from_render_ms` — from card first render to answer submission
- `time_from_confidence_ms` — from confidence selection to answer submission (pure decision deliberation)
- `confidence_selection_time_ms` — from card render to confidence selection (how long before committing to a confidence level)

Scroll depth tracked via IntersectionObserver on the card body — records the maximum scroll percentage reached before answering.

No personally identifiable information is collected. No accounts, no IP storage, no cookies beyond session state.

### Consent
Players are informed via the game UI that answers in Research Mode contribute to anonymised security awareness research. Participation is voluntary and implicit in selecting Research Mode.

---

## Sample Characteristics and Limitations

### Self-Selected Sample
Players who seek out a retro phishing awareness game are likely more security-aware than the general population. Results should be interpreted in the context of a **security-aware population**, not general users. This is a limitation but also a conservative bias — if even security-aware individuals show elevated bypass rates for high-quality phishing, the finding is stronger than a general population result.

### Text-Based Presentation
The terminal interface strips all visual design cues (logos, branding, CSS styling). Results reflect **text-based, linguistic phishing recognition** — not full email client simulation.

This limitation is partially offset by the research focus: GenAI's primary advantage over traditional phishing is text quality, not visual design. Testing linguistic cues in isolation is appropriate for the GenAI research question.

### GenAI Classification Uncertainty
GenAI classification is probabilistic, not definitive. Primary analysis uses observable linguistic characteristics (fluency, grammar, personalization scores) rather than binary AI/non-AI classification. Where `is_genai_suspected` is used, only medium/high confidence classifications are included in primary analysis. Sensitivity analysis disclosed in paper.

### SMS Coverage
v1 is expected to be email-dominant. Public post-2023 smishing corpora are limited. SMS card count reported transparently.

### Synthetic Legitimate Emails
Where synthetic legitimate emails are used, they are clearly labeled as synthetic in the dataset and disclosed in methodology.

---

## Analysis Plan

### Primary Analysis — Linguistic Characteristics vs. Bypass Rate
- Bypass rate segmented by prose_fluency score (0–5)
- Bypass rate segmented by grammar_quality score (0–5)
- Bypass rate segmented by personalization_level score (0–5)
- Composite high-quality phishing (all three scores ≥ 4) vs. low-quality (all three ≤ 2)
- Flesch-Kincaid readability correlation with bypass rate

### Secondary Analysis — GenAI Classification
- Bypass rate: is_genai_suspected = true (medium/high confidence only) vs. false
- Sensitivity analysis including low-confidence classifications
- GenAI detector score (continuous) correlation with bypass rate

### Technique Analysis
- Bypass rate by primary technique category
- GenAI-associated techniques (hyper-personalization, fluent-prose) vs. traditional (grammar-tells, urgency)

### Player Behaviour Analysis
- Confidence calibration: CERTAIN vs. LIKELY vs. GUESSING accuracy
- Time-to-decision: does longer deliberation improve accuracy?
- Scroll depth: does reading the full card improve accuracy?
- Answer ordinal: within-session learning curve (position 1–10)
- Streak effect: does streak correlate with accuracy on subsequent cards?
- Answer method: swipe vs. button — any accuracy difference?

### Descriptive Statistics
- Technique distribution across phishing cards
- GenAI score distributions (detector score, linguistic scores)
- Source corpus breakdown
- Verbatim vs. adapted breakdown
- Import batch yield rates (imported → approved)

---

## Technique Taxonomy

| Label | Description |
|-------|-------------|
| `urgency` | False time pressure or threat of account loss |
| `domain-spoofing` | Lookalike domains (paypa1.com, secure-chase.net) |
| `authority-impersonation` | Impersonates IT, management, government, or known brand |
| `grammar-tells` | Traditional phishing: poor grammar, awkward phrasing |
| `hyper-personalization` | Uses recipient name, role, or context convincingly (GenAI indicator) |
| `fluent-prose` | Polished natural language with no traditional tells (GenAI indicator) |
| `reward-prize` | Fake prize, refund, or benefit as lure |
| `it-helpdesk` | Impersonates internal IT support |
| `credential-harvest` | Explicit credential request or login page redirect |
| `invoice-fraud` | Fake invoice or payment request |
| `pretexting` | Builds a false scenario or relationship before the ask |
| `quishing` | QR code phishing — lure to scan a code |
| `callback-phishing` | Asks recipient to call a number (vishing hybrid) |
| `multi-stage` | Establishes rapport across multiple messages before the phish |

Cards may have a primary and secondary technique.

---

## Publication Plan

1. **Public analytics page** (`/intel`) — live aggregate findings, always current, citable URL. Methodology note links to this document.
2. **Blog post** (scottaltiparmak.com) — "State of Phishing in the GenAI Era" — detailed write-up with methodology, findings, and implications. Published once sufficient answer data collected (target: 10,000+ answer events).
3. **Potential journal submission** — mid-tier security awareness or human factors venue. Methodology section references this document.

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-03-01 | Initial methodology draft |
| 0.2 | 2026-03-01 | Full schema, GenAI classification methodology, three-layer approach, characteristics-based primary analysis, expanded technique taxonomy, complete answer/session fields |
