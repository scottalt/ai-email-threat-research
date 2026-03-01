'use client';

import { motion } from 'framer-motion';
import type { RoundResult } from '@/lib/types';

interface Props {
  score: number;
  total: number;
  results: RoundResult[];
  onPlayAgain: () => void;
}

function getTier(score: number, total: number): { label: string; color: string; sub: string } {
  const pct = score / total;
  if (pct === 1) return { label: 'Perfect', color: 'text-indigo-400', sub: "You caught everything. Clean sweep." };
  if (pct >= 0.8) return { label: 'Sharp', color: 'text-green-400', sub: 'Strong instincts. A couple slipped through.' };
  if (pct >= 0.6) return { label: 'Cautious', color: 'text-yellow-400', sub: 'Decent, but a few got you. Review the red flags.' };
  if (pct >= 0.4) return { label: 'Hooked', color: 'text-orange-400', sub: "You took the bait more than once. Keep practicing." };
  return { label: 'Caught', color: 'text-red-400', sub: "The phishers won this round. Study up." };
}

export function RoundSummary({ score, total, results, onPlayAgain }: Props) {
  const tier = getTier(score, total);
  const phishingCaught = results.filter((r) => r.card.isPhishing && r.correct).length;
  const legitCorrect = results.filter((r) => !r.card.isPhishing && r.correct).length;
  const phishingTotal = results.filter((r) => r.card.isPhishing).length;
  const legitTotal = results.filter((r) => !r.card.isPhishing).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="w-full max-w-sm px-4 flex flex-col gap-5"
    >
      {/* Score hero */}
      <div className="text-center py-4">
        <div className="text-7xl font-black text-white mb-1">
          {score}
          <span className="text-3xl text-slate-500 font-light">/{total}</span>
        </div>
        <div className={`text-2xl font-black tracking-wide mb-1 ${tier.color}`}>
          {tier.label}
        </div>
        <div className="text-slate-400 text-sm">{tier.sub}</div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-4 text-center">
          <div className="text-red-400 text-2xl font-black">
            {phishingCaught}/{phishingTotal}
          </div>
          <div className="text-slate-400 text-xs mt-1 uppercase tracking-wider">
            Phishing caught
          </div>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-4 text-center">
          <div className="text-green-400 text-2xl font-black">
            {legitCorrect}/{legitTotal}
          </div>
          <div className="text-slate-400 text-xs mt-1 uppercase tracking-wider">
            Legit correct
          </div>
        </div>
      </div>

      {/* Results list */}
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
            Round breakdown
          </span>
        </div>
        <div className="divide-y divide-slate-700/30">
          {results.map((r, i) => (
            <div key={r.card.id} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={`text-sm font-bold w-5 text-center ${
                  r.correct ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {r.correct ? '✓' : '✗'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-slate-300 text-xs truncate">
                  {r.card.subject ?? r.card.from}
                </div>
                <div className="text-slate-500 text-xs">
                  {r.card.isPhishing ? 'Phishing' : 'Legit'} · {r.card.difficulty}
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  r.card.isPhishing
                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                    : 'text-green-400 bg-green-500/10 border-green-500/20'
                }`}
              >
                {r.card.isPhishing ? '⚠' : '✓'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Play again */}
      <button
        onClick={onPlayAgain}
        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black rounded-2xl transition-all tracking-wide text-lg"
      >
        Play Again
      </button>

      <p className="text-center text-slate-600 text-xs">
        Built by Scott Altiparmak · scottaltiparmak.com
      </p>
    </motion.div>
  );
}
