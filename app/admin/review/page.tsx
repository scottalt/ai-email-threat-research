'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { parseFrom } from '@/lib/parseFrom';

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
  suggested_auth_status: string | null;
  suggested_reply_to: string | null;
  suggested_attachment_name: string | null;
  suggested_sent_at: string | null;
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
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [approvedCount, setApprovedCount] = useState<number | null>(null);
  const cardLoadTime = useRef<number>(Date.now());

  // Editable fields — pre-filled from AI suggestions
  const [processedFrom, setProcessedFrom] = useState('');
  const [processedSubject, setProcessedSubject] = useState('');
  const [processedBody, setProcessedBody] = useState('');
  const [technique, setTechnique] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [isPhishing, setIsPhishing] = useState(true);
  const [authStatus, setAuthStatus] = useState<'verified' | 'unverified' | 'fail'>('fail');
  const [replyTo, setReplyTo] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  function suggestAttachmentName(body: string): string {
    const b = body.toLowerCase();
    const hasRef = /\b(attach[a-z]*|enclosed|find the|see the file|\.pdf|\.xlsx|\.docx|\.csv|\.zip)\b/.test(b);
    if (!hasRef) return '';
    if (/invoice/.test(b)) return 'Invoice_March_2025.pdf';
    if (/statement/.test(b)) return 'Statement_March_2025.pdf';
    if (/contract/.test(b)) return 'Contract_Draft.pdf';
    if (/report/.test(b)) return 'Report_Q1_2025.pdf';
    if (/form/.test(b)) return 'Form.pdf';
    if (/receipt/.test(b)) return 'Receipt.pdf';
    if (/resume|curriculum vitae|\bcv\b/.test(b)) return 'Resume.pdf';
    if (/spreadsheet|\.xlsx/.test(b)) return 'Report.xlsx';
    return 'Document.pdf';
  }

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch('/api/admin/review');
      const { card: next, pendingCount: count, approvedCount: approved } = await res.json();
      setPendingCount(count ?? null);
      setApprovedCount(approved ?? null);
      if (!next) { setDone(true); setCard(null); } else {
        setCard(next);
        setProcessedFrom(next.processed_from ?? next.raw_from ?? '');
        setProcessedSubject(next.processed_subject ?? next.raw_subject ?? '');
        setProcessedBody(next.processed_body ?? next.raw_body ?? '');
        setTechnique(next.suggested_technique ?? '');
        const diff = next.suggested_difficulty ?? 'medium';
        const phishing = next.is_phishing ?? true;
        setDifficulty(diff);
        setIsPhishing(phishing);
        const derivedAuth = !phishing ? 'verified' : ['easy', 'medium'].includes(diff) ? 'fail' : 'unverified';
        setAuthStatus((next.suggested_auth_status as 'verified' | 'unverified' | 'fail' | null) ?? derivedAuth);
        setReplyTo(next.suggested_reply_to ?? '');
        setAttachmentName(next.suggested_attachment_name ?? suggestAttachmentName(next.processed_body ?? next.raw_body ?? ''));
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

    try {
      const res = await fetch('/api/admin/review', {
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
            suggested_difficulty: difficulty,
            suggested_highlights: card.suggested_highlights ?? [],
            suggested_clues: card.suggested_clues ?? [],
            suggested_explanation: card.suggested_explanation ?? '',
            source_corpus: card.source_corpus,
            review_notes: reviewNotes || null,
            review_time_ms: reviewTimeMs,
            ai_model: card.ai_model,
            ai_preprocessing_version: card.ai_preprocessing_version,
            auth_status: authStatus,
            reply_to: replyTo.trim() || null,
            attachment_name: attachmentName.trim() || null,
            suggested_sent_at: card.suggested_sent_at ?? null,
          } : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Action failed:', err);
        alert(`Action failed: ${err.error ?? res.status}`);
        return;
      }

      fetchNext();
    } catch (err) {
      console.error('handleAction threw:', err);
      alert(`Action failed: ${String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  const TECHNIQUES = [
    'urgency',
    'authority-impersonation',
    'credential-harvest',
    'hyper-personalization',
    'pretexting',
    'fluent-prose',
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
          <span className="text-[#00aa28] tracking-widest">
            <Link href="/admin" className="text-[#003a0e] hover:text-[#00aa28] transition-colors">← ADMIN</Link>
            <span className="text-[#001a06]"> · </span>REVIEW_QUEUE
            {pendingCount !== null && (
              <span className="text-[#003a0e]"> · {pendingCount} PENDING</span>
            )}
            {approvedCount !== null && (
              <span className="text-[#003a0e]"> · {approvedCount}<span className="text-[#002a0a]">/550</span> APPROVED</span>
            )}
          </span>
          <span className="text-[#003a0e]">A=approve · R=reject · N=needs_review</span>
        </div>

        {card.content_flagged && (
          <div className="term-border border-[rgba(255,51,51,0.5)] px-3 py-2 text-xs font-mono text-[#ff3333]">
            ⚠ CONTENT FLAGGED: {card.content_flag_reason}
          </div>
        )}

        {/* Editable card — full width */}
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[#00aa28] text-xs tracking-widest">CARD · EDITABLE</span>
              {card.ai_model && (
                <span className="text-[#003a0e] text-xs font-mono">{card.ai_model}</span>
              )}
            </div>
            <button
              onClick={() => setPreviewOpen((o) => !o)}
              className="text-[#003a0e] text-xs font-mono hover:text-[#00aa28] transition-colors"
            >
              {previewOpen ? '[HIDE PREVIEW]' : '[PREVIEW]'}
            </button>
          </div>
          {previewOpen && (
            <div className="border-b border-[rgba(0,255,65,0.2)] bg-[rgba(0,255,65,0.02)]">
              <div className="border-b border-[rgba(0,255,65,0.15)] px-3 py-1 flex items-center justify-between">
                <span className="text-[#003a0e] text-[10px] font-mono tracking-widest">AS SEEN BY PLAYER</span>
              </div>
              {/* Email header metadata */}
              <div className="px-3 py-2 border-b border-[rgba(0,255,65,0.15)] space-y-1">
                <div className="flex gap-2 text-xs">
                  <span className="text-[#00aa28] w-10 shrink-0">FROM:</span>
                  <span className="text-[#00ff41] font-mono text-xs">
                    {(() => { const { displayName, email } = parseFrom(processedFrom); return displayName ? <>{displayName} <span className="text-[#003a0e]">&lt;{email}&gt;</span></> : email; })()}
                  </span>
                </div>
                {processedSubject && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-[#00aa28] w-10 shrink-0">SUBJ:</span>
                    <span className="text-[#00ff41] font-mono text-xs">{processedSubject}</span>
                  </div>
                )}
                {card.suggested_sent_at && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-[#00aa28] w-10 shrink-0">SENT:</span>
                    <span className="text-[#00ff41] font-mono text-[10px]">{card.suggested_sent_at}</span>
                  </div>
                )}
                {attachmentName.trim() && (
                  <div className="flex gap-2 text-xs">
                    <span className="text-[#00aa28] w-10 shrink-0">ATCH:</span>
                    <span className="text-[#ffaa00] font-mono text-xs">📎 {attachmentName}</span>
                  </div>
                )}
              </div>
              {/* Auth status row */}
              <div className="px-3 py-1.5 border-b border-[rgba(0,255,65,0.1)] flex items-center gap-3 text-[10px] font-mono">
                <span className="text-[#003a0e]">AUTH:</span>
                <span style={{ color: authStatus === 'verified' ? '#00aa28' : authStatus === 'fail' ? '#ff3333' : '#ffaa00' }}>
                  {authStatus === 'verified' ? 'SPF PASS · DKIM PASS · DMARC PASS' : authStatus === 'fail' ? 'SPF FAIL · DKIM FAIL · DMARC FAIL' : 'SPF NONE · DKIM NONE · DMARC NONE'}
                </span>
                {replyTo.trim() && (
                  <span className="text-[#ffaa00] ml-2">Reply-To: {replyTo}</span>
                )}
              </div>
              {/* Body */}
              <div className="px-3 py-3 text-xs text-[#00aa28] leading-relaxed whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                {processedBody}
              </div>
            </div>
          )}
          <div className="px-3 py-2 space-y-2">
            <input value={processedFrom} onChange={(e) => setProcessedFrom(e.target.value)}
              className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)]"
              placeholder="FROM" />
            <input value={processedSubject} onChange={(e) => setProcessedSubject(e.target.value)}
              className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)]"
              placeholder="SUBJECT (optional)" />
            <textarea value={processedBody} onChange={(e) => setProcessedBody(e.target.value)}
              rows={10}
              className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)] resize-none"
            />
          </div>
        </div>

        {/* Classification + Feedback Preview */}
        <div className="grid grid-cols-2 gap-4">
          {/* Classification */}
          <div className="term-border bg-[#060c06] px-3 py-3 space-y-3">
            <div className="text-[#00aa28] text-xs font-mono tracking-widest">CLASSIFICATION</div>

            <div className="flex gap-2">
              {['phishing', 'legit'].map((v) => (
                <button key={v} onClick={() => {
                  const phishing = v === 'phishing';
                  setIsPhishing(phishing);
                  setAuthStatus(!phishing ? 'verified' : ['easy', 'medium'].includes(difficulty) ? 'fail' : 'unverified');
                }}
                  className={`flex-1 py-1.5 text-xs font-mono border transition-all ${
                    (v === 'phishing') === isPhishing
                      ? v === 'phishing' ? 'text-[#ff3333] border-[rgba(255,51,51,0.6)] bg-[rgba(255,51,51,0.08)]' : 'text-[#00ff41] border-[rgba(0,255,65,0.6)] bg-[rgba(0,255,65,0.08)]'
                      : 'text-[#003a0e] border-[rgba(0,255,65,0.15)]'
                  }`}>
                  {v.toUpperCase()}
                </button>
              ))}
            </div>

            {isPhishing ? (
              <>
                <select value={technique} onChange={(e) => setTechnique(e.target.value)}
                  className="w-full bg-[#060c06] border border-[rgba(0,255,65,0.3)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none">
                  <option value="">-- PRIMARY TECHNIQUE --</option>
                  {TECHNIQUES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>

                <select value={difficulty} onChange={(e) => {
                  const d = e.target.value;
                  setDifficulty(d);
                  setAuthStatus(['easy', 'medium'].includes(d) ? 'fail' : 'unverified');
                }}
                  className="w-full bg-[#060c06] border border-[rgba(0,255,65,0.3)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none">
                  <option value="easy">EASY</option>
                  <option value="medium">MEDIUM</option>
                  <option value="hard">HARD</option>
                  <option value="extreme">EXTREME</option>
                </select>
              </>
            ) : (
              <div className="text-[#003a0e] text-xs font-mono">LEGITIMATE — no technique or difficulty</div>
            )}

            <select value={authStatus} onChange={(e) => setAuthStatus(e.target.value as 'verified' | 'unverified' | 'fail')}
              className="w-full bg-[#060c06] border border-[rgba(0,255,65,0.3)] text-[#00aa28] font-mono text-xs px-2 py-1.5 focus:outline-none">
              <option value="verified">AUTH: VERIFIED</option>
              <option value="unverified">UNVERIFIED</option>
              <option value="fail">AUTH: FAIL</option>
            </select>

            {isPhishing && ['hard', 'extreme'].includes(difficulty) && (
              <input
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)]"
                placeholder="REPLY-TO (optional, hard/extreme only)"
              />
            )}

            <input
              value={attachmentName}
              onChange={(e) => setAttachmentName(e.target.value)}
              className="w-full bg-transparent border border-[rgba(0,255,65,0.2)] text-[#00ff41] font-mono text-xs px-2 py-1 focus:outline-none focus:border-[rgba(0,255,65,0.6)]"
              placeholder="ATTACHMENT (e.g. Invoice_March_2025.pdf — blank = none)"
            />

            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Review notes (optional)"
              rows={3}
              className="w-full bg-transparent border border-[rgba(0,255,65,0.15)] text-[#00aa28] font-mono text-xs px-2 py-1 focus:outline-none resize-none placeholder:text-[#003a0e]"
            />
          </div>

          {/* Feedback Preview */}
          <div className="term-border bg-[#060c06] px-3 py-3 space-y-3">
            <div className="text-[#00aa28] text-xs font-mono tracking-widest">FEEDBACK PREVIEW</div>

            <div>
              <div className="text-[#003a0e] text-xs font-mono mb-1">HIGHLIGHTS</div>
              {card.suggested_highlights && card.suggested_highlights.length > 0 ? (
                <ul className="space-y-0.5">
                  {card.suggested_highlights.map((h, i) => (
                    <li key={i} className="text-[#ffaa00] font-mono text-xs">&bull; &quot;{h}&quot;</li>
                  ))}
                </ul>
              ) : (
                <span className="text-[#003a0e] font-mono text-xs">—</span>
              )}
            </div>

            <div>
              <div className="text-[#003a0e] text-xs font-mono mb-1">CLUES</div>
              {card.suggested_clues && card.suggested_clues.length > 0 ? (
                <ul className="space-y-0.5">
                  {card.suggested_clues.map((c, i) => (
                    <li key={i} className="text-[#00aa28] font-mono text-xs">[{i + 1}] {c}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-[#003a0e] font-mono text-xs">—</span>
              )}
            </div>

            <div>
              <div className="text-[#003a0e] text-xs font-mono mb-1">EXPLANATION</div>
              {card.suggested_explanation ? (
                <p className="text-[#00aa28] font-mono text-xs leading-relaxed">{card.suggested_explanation}</p>
              ) : (
                <span className="text-[#003a0e] font-mono text-xs">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Validation warning */}
        {isPhishing && !technique && (
          <div className="term-border border-[rgba(255,51,51,0.4)] px-3 py-2 text-xs font-mono text-[#ff3333]">
            ⚠ Technique required before approving a phishing card.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button onClick={() => handleAction('approved')} disabled={submitting || (isPhishing && !technique)}
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
