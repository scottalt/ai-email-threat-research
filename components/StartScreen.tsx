'use client';

import { motion } from 'framer-motion';

interface Props {
  onStart: () => void;
}

export function StartScreen({ onStart }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="w-full max-w-sm px-4 flex flex-col items-center gap-8"
    >
      {/* Logo */}
      <div className="text-center">
        <div className="text-6xl mb-4">🎣</div>
        <h1 className="text-4xl font-black text-white tracking-tight">
          Phish or Not
        </h1>
        <p className="text-slate-400 mt-2 text-base">
          Can you spot a phishing attempt?
        </p>
      </div>

      {/* How it works */}
      <div className="w-full bg-slate-800/60 rounded-2xl border border-slate-700/50 px-5 py-5 space-y-4">
        <div className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
          How it works
        </div>
        <div className="space-y-3">
          {[
            ['👁', 'Read the message carefully — email or SMS'],
            ['↔', 'Swipe left for phishing, right for legit'],
            ['💡', 'Get instant feedback on what you missed'],
            ['📊', 'See your score after 10 rounds'],
          ].map(([icon, text]) => (
            <div key={text} className="flex gap-3 items-start">
              <span className="text-lg leading-none mt-0.5">{icon}</span>
              <span className="text-slate-300 text-sm">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Difficulty note */}
      <div className="w-full flex gap-2 text-center">
        {(['easy', 'medium', 'hard'] as const).map((d) => (
          <div
            key={d}
            className={`flex-1 rounded-xl py-2 border text-xs font-semibold uppercase tracking-wider ${
              d === 'easy'
                ? 'text-green-400 bg-green-500/10 border-green-500/20'
                : d === 'medium'
                ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Start button */}
      <button
        onClick={onStart}
        className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black rounded-2xl transition-all tracking-wide text-xl shadow-lg shadow-indigo-900/50"
      >
        Start Game
      </button>

      <p className="text-slate-600 text-xs text-center">
        10 questions per round · Mix of email and SMS
      </p>
    </motion.div>
  );
}
