'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface StagingCard {
  id: string;
  raw_from: string;
  raw_subject: string | null;
  raw_body: string;
  source_corpus: string;
  inferred_type: string;
  is_phishing: boolean | null;
  processed_from: string | null;
  processed_subject: string | null;
  processed_body: string | null;
  suggested_technique: string | null;
  suggested_secondary_technique: string | null;
  suggested_difficulty: string | null;
  suggested_highlights: string[] | null;
  suggested_clues: string[] | null;
  suggested_explanation: string | null;
  grammar_quality: number | null;
  prose_fluency: number | null;
  personalization_level: number | null;
  contextual_coherence: number | null;
  genai_detector_score: number | null;
  is_genai_suspected: boolean | null;
  genai_confidence: string | null;
  genai_ai_reasoning: string | null;
  ai_model: string | null;
  ai_preprocessing_version: string | null;
  content_flagged: boolean;
  content_flag_reason: string | null;
}

export default function ReviewPage() {
  const [card, setCard] = useState<StagingCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const cardLoadTime = useRef<number>(Date.now());

  // Editable fields — pre-filled from AI suggestions
  const [processedFrom, setProcessedFrom] = useState('');
  const [processedSubject, setProcessedSubject] = useState('');
  const [processedBody, setProcessedBody] = useState('');
  const [technique, setTechnique] = useState('');
  const [secondaryTechnique, setSecondaryTechnique] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [isPhishing, setIsPhishing] = useState(true);
  const [isVerbatim, setIsVerbatim] = useState(false);
  const [isGenai, setIsGenai] = useState(false);
  const [genaiConfidence, setGenaiConfidence] = useState('low');
  const [genaiReviewerReasoning, setGenaiReviewerReasoning] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch('/api/admin/review');
      const { card: next } = await res.json();
      if (!next) { setDone(true); setCard(null); } else {
        setCard(next);
        setProcessedFrom(next.processed_from ?? next.raw_from ?? '');
        setProcessedSubject(next.processed_subject ?? next.raw_subject ?? '');
        setProcessedBody(next.processed_body ?? next.raw_body ?? '');
        setTechnique(next.suggested_technique ?? '');
        setSecondaryTechnique(next.suggested_secondary_technique ?? '');
        setDifficulty(next.suggested_difficulty ?? 'medium');
        setIsPhishing(next.is_phishing ?? true);
        setIsVerbatim(false);
        setIsGenai(next.is_genai_suspected ?? false);
        setGenaiConfidence(next.genai_confidence ?? 'low');
        setGenaiReviewerReasoning('');
        setReviewNotes('');
        cardLoadTime.current = Date.now();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  // Keyboard shortcuts
  const handleActionRef = useRef(handleAction);
  handleActionRef.current = handleAction;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'a') handleActionRef.current('approved');
      if (e.key === 'r') handleActionRef.current('rejected');
      if (e.key === 'n') handleActionRef.current('needs_review');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleAction(action: 'approved' | 'rejected' | 'needs_review') {
    if (!card || submitting) return;
    setSubmitting(true);
    const reviewTimeMs = Date.now() - cardLoadTime.current;

    await fetch('/api/admin/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        stagingId: card.id,
        reviewedFields: action === 'approved' ? {
          inferred_type: card.inferred_type,
          is_phishing: isPhishing,
          processed_from: processedFrom,
          processed_subject: processedSubject || null,
          processed_body: processedBody,
          suggested_technique: technique,
          suggested_secondary_technique: secondaryTechnique || null,
          suggested_difficulty: difficulty,
          suggested_highlights: card.suggested_highlights ?? [],
          suggested_clues: card.suggested_clues ?? [],
          suggested_explanation: card.suggested_explanation ?? '',
          grammar_quality: card.grammar_quality,
          prose_fluency: card.prose_fluency,
          personalization_level: card.personalization_level,
          contextual_coherence: card.contextual_coherence,
          genai_detector_score: card.genai_detector_score,
          is_genai_suspected: isGenai,
          genai_confidence: genaiConfidence,
          genai_ai_reasoning: card.genai_ai_reasoning,
          genai_reviewer_reasoning: genaiReviewerReasoning || null,
          is_verbatim: isVerbatim,
          source_corpus: card.source_corpus,
          review_notes: reviewNotes || null,
          review_time_ms: reviewTimeMs,
          ai_model: card.ai_model,
          ai_preprocessing_version: card.ai_preprocessing_version,
        } : null,
      }),
    });

    setSubmitting(false);
    fetchNext();
  }

  const TECHNIQUES = [
    'urgency', 'domain-spoofing', 'authority-impersonation', 'grammar-tells',
    'hyper-personalization', 'fluent-prose', 'reward-prize', 'it-helpdesk',
    'credential-harvest', 'invoice-fraud', 'pretexting', 'quishing',
    'callback-phishing', 'multi-stage',
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#060c06] flex items-center justify-center">
      <span className="text-[#00aa28] font-mono text-xs">LOADING...</span>
    </div>
  );

  if (done) return (
    <div className="min-h-screen bg-[#060c06] flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="text-[#00ff41] font-mono text-sm glow">QUEUE EMPTY</div>
        <div className="text-[#00aa28] font-mono text-xs">No pending cards to review.</div>
      </div>
    </div>
  );

  if (!card) return null;

  return (
    <div className="min-h-screen bg-[#060c06] p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#00aa28] tracking-widest">REVIEW_QUEUE</span>
          <span className="text-[#003a0e]">A=approve · R=reject · N=needs_review</span>
        </div>

        {card.content_flagged && (
          <div className="term-border border-[rgba(255,51,51,0.5)] px-3 py-2 text-xs font-mono text-[#ff3333]">
            ⚠ CONTENT FLAGGED: {card.content_flag_reason}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Left: Raw */}
          <div className="term-border bg-[#060c06] space-y-0">
            <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
              <span className="text-[#003a0e] text-xs tracking-widest">RAW_INPUT · {card.source_corpus}</span>
            </div>
            <div className="px-3 py-2 text-xs font-mono space-y-1">
              <div><span className="text-[#003a0e]">FROM:</span> <span className="text-[#00aa28]">{card.raw_from}</span></div>
              {card.raw_subject && <div><span className="text-[#003a0e]">SUBJ:</span> <span className="text-[#00aa28]">{card.raw_subject}</span></div>}
            </div>
            <div className="px-3 pb-3 text-xs text-[#003a0e] font-mono whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
              {card.raw_body}
            </div>
          </div>

          {/* Right: Processed (editable) */}
          <div className="term-border bg-[#060c06]">
            <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5">
              <span className="text-[#00aa28] text-xs tracking-widest">AI_PROCESSED · EDITABLE</span>
            </div>
            <div className="px-3 py-2 space-y-2">
              <input value={processedFrom} onChange={(e) => setProcessedFrom(e.target.value)}
                className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)]"
                placeholder="FROM" />
              <input value={processedSubject} onChange={(e) => setProcessedSubject(e.target.value)}
                className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)]"
                placeholder="SUBJECT (optional)" />
              <textarea value={processedBody} onChange={(e) => setProcessedBody(e.target.value)}
                rows={6}
                className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Classification fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="term-border bg-[#060c06] px-3 py-3 space-y-3">
            <div className="text-[#00aa28] text-xs font-mono tracking-widest">CLASSIFICATION</div>

            <div className="flex gap-2">
              {['phishing', 'legit'].map((v) => (
                <button key={v} onClick={() => setIsPhishing(v === 'phishing')}
                  className={`flex-1 py-1.5 text-xs font-mono border transition-all ${
                    (v === 'phishing') === isPhishing
                      ? v === 'phishing' ? 'text-[#ff3333] border-[rgba(255,51,51,0.6)] bg-[rgba(255,51,51,0.08)]' : 'text-[#00ff41] border-[rgba(0,255,65,0.6)] bg-[rgba(0,255,65,0.08)]'
                      : 'text-[#003a0e] border-[rgba(0,255,65,0.15)]'
                  }`}>
                  {v.toUpperCase()}
                </button>
              ))}
            </div>

            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-[#060c06] border border-[rgba(0,255,65,0.3)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none">
              <option value="easy">EASY</option>
              <option value="medium">MEDIUM</option>
              <option value="hard">HARD</option>
            </select>

            <select value={technique} onChange={(e) => setTechnique(e.target.value)}
              className="w-full bg-[#060c06] border border-[rgba(0,255,65,0.3)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none">
              <option value="">-- PRIMARY TECHNIQUE --</option>
              {TECHNIQUES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <select value={secondaryTechnique} onChange={(e) => setSecondaryTechnique(e.target.value)}
              className="w-full bg-[#060c06] border border-[rgba(0,255,65,0.3)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none">
              <option value="">-- SECONDARY TECHNIQUE (optional) --</option>
              {TECHNIQUES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <div className="flex gap-4 text-xs font-mono">
              <label className="flex items-center gap-2 text-[#00aa28] cursor-pointer">
                <input type="checkbox" checked={isVerbatim} onChange={(e) => setIsVerbatim(e.target.checked)} className="accent-[#00ff41]" />
                VERBATIM
              </label>
            </div>
          </div>

          <div className="term-border bg-[#060c06] px-3 py-3 space-y-3">
            <div className="text-[#00aa28] text-xs font-mono tracking-widest">GENAI ASSESSMENT</div>

            {card.genai_detector_score !== null && (
              <div className="text-xs font-mono">
                <span className="text-[#003a0e]">DETECTOR SCORE: </span>
                <span className="text-[#ffaa00]">{(card.genai_detector_score * 100).toFixed(1)}%</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {[
                { label: 'GRAMMAR', value: card.grammar_quality },
                { label: 'FLUENCY', value: card.prose_fluency },
                { label: 'PERSONAL', value: card.personalization_level },
                { label: 'COHERENCE', value: card.contextual_coherence },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[#003a0e]">{label}:</span>
                  <span className="text-[#00aa28]">{value ?? '—'}/5</span>
                </div>
              ))}
            </div>

            {card.genai_ai_reasoning && (
              <div className="text-[10px] font-mono text-[#003a0e] leading-relaxed">
                {card.genai_ai_reasoning}
              </div>
            )}

            <div className="flex gap-2 items-center">
              <label className="flex items-center gap-2 text-xs font-mono text-[#00aa28] cursor-pointer">
                <input type="checkbox" checked={isGenai} onChange={(e) => setIsGenai(e.target.checked)} className="accent-[#00ff41]" />
                GENAI SUSPECTED
              </label>
              <select value={genaiConfidence} onChange={(e) => setGenaiConfidence(e.target.value)}
                className="flex-1 bg-[#060c06] border border-[rgba(0,255,65,0.3)] text-[#00aa28] font-mono text-xs px-1 py-1 focus:outline-none">
                <option value="low">LOW</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH</option>
              </select>
            </div>

            <textarea value={genaiReviewerReasoning} onChange={(e) => setGenaiReviewerReasoning(e.target.value)}
              placeholder="Reviewer GenAI reasoning (optional)"
              rows={2}
              className="w-full bg-transparent border border-[rgba(0,255,65,0.15)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none resize-none placeholder:text-[#003a0e]"
            />

            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Review notes (optional)"
              rows={2}
              className="w-full bg-transparent border border-[rgba(0,255,65,0.15)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none resize-none placeholder:text-[#003a0e]"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={() => handleAction('approved')} disabled={submitting}
            className="flex-1 py-3 border border-[rgba(0,255,65,0.5)] text-[#00ff41] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(0,255,65,0.08)] disabled:opacity-30 transition-all">
            [A] APPROVE
          </button>
          <button onClick={() => handleAction('needs_review')} disabled={submitting}
            className="flex-1 py-3 border border-[rgba(255,170,0,0.5)] text-[#ffaa00] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,170,0,0.08)] disabled:opacity-30 transition-all">
            [N] NEEDS REVIEW
          </button>
          <button onClick={() => handleAction('rejected')} disabled={submitting}
            className="flex-1 py-3 border border-[rgba(255,51,51,0.5)] text-[#ff3333] font-mono font-bold tracking-widest text-sm hover:bg-[rgba(255,51,51,0.08)] disabled:opacity-30 transition-all">
            [R] REJECT
          </button>
        </div>
      </div>
    </div>
  );
}
