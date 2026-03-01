'use client';

import { motion } from 'framer-motion';
import type { RoundResult } from '@/lib/types';

interface Props {
  result: RoundResult;
  onNext: () => void;
  questionNumber: number;
  total: number;
}

export function FeedbackCard({ result, onNext, questionNumber, total }: Props) {
  const { card, correct, userAnswer } = result;
  const wasPhishing = card.isPhishing;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      className="w-full max-w-sm px-4 flex flex-col gap-5"
    >
      {/* Result header */}
      <div
        className={`rounded-2xl px-5 py-4 border ${
          correct
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">{correct ? '✓' : '✗'}</span>
          <div>
            <div
              className={`text-lg font-black tracking-wide ${
                correct ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {correct ? 'Correct' : 'Wrong'}
            </div>
            <div className="text-slate-400 text-xs">
              {questionNumber} of {total}
            </div>
          </div>
        </div>

        <div className="text-slate-300 text-sm leading-relaxed">
          {wasPhishing ? (
            <>
              This was a{' '}
              <span className="text-red-400 font-semibold">phishing</span> attempt.
              {!correct && ' You marked it as legit.'}
            </>
          ) : (
            <>
              This was a{' '}
              <span className="text-green-400 font-semibold">legitimate</span> message.
              {!correct && ' You marked it as phishing.'}
            </>
          )}
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-slate-800/60 rounded-2xl px-5 py-4 border border-slate-700/50">
        <div className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-semibold">
          Explanation
        </div>
        <p className="text-slate-200 text-sm leading-relaxed">{card.explanation}</p>
      </div>

      {/* Clues (only for phishing) */}
      {wasPhishing && card.clues.length > 0 && (
        <div className="bg-slate-800/60 rounded-2xl px-5 py-4 border border-slate-700/50">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-3 font-semibold">
            Red flags
          </div>
          <ul className="space-y-2">
            {card.clues.map((clue, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-300">
                <span className="text-red-400 shrink-0 mt-0.5">▸</span>
                <span>{clue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sender info for context */}
      <div className="bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-700/30">
        <div className="text-slate-500 text-xs mb-1">Sender</div>
        <div className="text-slate-300 text-sm font-mono break-all">{card.from}</div>
        {card.subject && (
          <>
            <div className="text-slate-500 text-xs mt-2 mb-1">Subject</div>
            <div className="text-slate-300 text-sm">{card.subject}</div>
          </>
        )}
      </div>

      {/* Difficulty badge + next */}
      <div className="flex items-center justify-between">
        <span
          className={`text-xs px-3 py-1 rounded-full font-medium uppercase tracking-wider border ${
            card.difficulty === 'easy'
              ? 'text-green-400 bg-green-500/10 border-green-500/20'
              : card.difficulty === 'medium'
              ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
              : 'text-red-400 bg-red-500/10 border-red-500/20'
          }`}
        >
          {card.difficulty}
        </span>

        <button
          onClick={onNext}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-xl transition-all tracking-wide"
        >
          {questionNumber === total ? 'See Results' : 'Next →'}
        </button>
      </div>
    </motion.div>
  );
}
