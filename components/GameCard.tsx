'use client';

import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import type { Card, Answer } from '@/lib/types';

const SWIPE_THRESHOLD = 80;

interface Props {
  card: Card;
  onAnswer: (answer: Answer) => void;
  questionNumber: number;
  total: number;
}

function EmailDisplay({ card }: { card: Card }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-2xl select-none">
      {/* Email chrome */}
      <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <span className="ml-2 text-xs text-slate-400 font-mono">INBOX</span>
        </div>
        <div className="space-y-1">
          <div className="flex gap-2 text-xs">
            <span className="text-slate-400 w-12 shrink-0">FROM</span>
            <span className="text-slate-700 font-mono break-all">{card.from}</span>
          </div>
          {card.subject && (
            <div className="flex gap-2 text-xs">
              <span className="text-slate-400 w-12 shrink-0">SUBJ</span>
              <span className="text-slate-800 font-semibold">{card.subject}</span>
            </div>
          )}
        </div>
      </div>
      {/* Email body */}
      <div className="px-4 py-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto font-mono">
        {card.body}
      </div>
    </div>
  );
}

function SMSDisplay({ card }: { card: Card }) {
  return (
    <div className="bg-slate-800 rounded-2xl overflow-hidden shadow-2xl select-none">
      {/* SMS chrome */}
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-700 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-slate-300 text-xs font-bold">
          ?
        </div>
        <div>
          <div className="text-white text-sm font-medium">{card.from}</div>
          <div className="text-slate-400 text-xs">Text Message</div>
        </div>
      </div>
      {/* SMS body */}
      <div className="px-4 py-5">
        <div className="bg-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-100 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
          {card.body}
        </div>
        <div className="text-right mt-2 text-xs text-slate-500">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

export function GameCard({ card, onAnswer, questionNumber, total }: Props) {
  const controls = useAnimation();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-12, 12]);
  const phishingOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0]);
  const legitOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1]);

  useEffect(() => {
    x.set(0);
    controls.set({ opacity: 0, scale: 0.88, y: 20 });
    controls.start({
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 280, damping: 22 },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  async function flyOff(direction: 'left' | 'right') {
    const targetX = direction === 'left' ? -600 : 600;
    await controls.start({
      x: targetX,
      opacity: 0,
      rotate: direction === 'left' ? -15 : 15,
      transition: { duration: 0.22, ease: [0.36, 0.66, 0.04, 1] },
    });
  }

  async function handleDragEnd(_: unknown, info: { offset: { x: number }; velocity: { x: number } }) {
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_THRESHOLD || velocity.x < -500) {
      await flyOff('left');
      onAnswer('phishing');
    } else if (offset.x > SWIPE_THRESHOLD || velocity.x > 500) {
      await flyOff('right');
      onAnswer('legit');
    } else {
      controls.start({
        x: 0,
        rotate: 0,
        transition: { type: 'spring', stiffness: 350, damping: 28 },
      });
    }
  }

  async function handleButton(answer: Answer) {
    await flyOff(answer === 'phishing' ? 'left' : 'right');
    onAnswer(answer);
  }

  const progress = ((questionNumber - 1) / total) * 100;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm px-4">
      {/* Progress */}
      <div className="w-full">
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>Question {questionNumber} of {total}</span>
          <span className="uppercase tracking-wider text-slate-500">
            {card.difficulty}
          </span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Swipe hints */}
      <div className="flex justify-between w-full text-xs text-slate-600 font-medium tracking-wider">
        <span>← PHISHING</span>
        <span>LEGIT →</span>
      </div>

      {/* Card */}
      <div className="relative w-full">
        {/* Phishing stamp overlay */}
        <motion.div
          style={{ opacity: phishingOpacity }}
          className="absolute inset-0 z-10 rounded-2xl pointer-events-none flex items-center justify-center"
        >
          <div className="border-4 border-red-500 rounded-lg px-3 py-1 rotate-[-14deg] bg-red-500/10">
            <span className="text-red-500 text-xl font-black tracking-widest">PHISHING</span>
          </div>
        </motion.div>

        {/* Legit stamp overlay */}
        <motion.div
          style={{ opacity: legitOpacity }}
          className="absolute inset-0 z-10 rounded-2xl pointer-events-none flex items-center justify-center"
        >
          <div className="border-4 border-green-500 rounded-lg px-3 py-1 rotate-[14deg] bg-green-500/10">
            <span className="text-green-500 text-xl font-black tracking-widest">LEGIT</span>
          </div>
        </motion.div>

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          style={{ x, rotate }}
          animate={controls}
          onDragEnd={handleDragEnd}
          className="cursor-grab active:cursor-grabbing"
        >
          {card.type === 'email' ? (
            <EmailDisplay card={card} />
          ) : (
            <SMSDisplay card={card} />
          )}
        </motion.div>
      </div>

      {/* Buttons */}
      <div className="flex gap-4 w-full">
        <button
          onClick={() => handleButton('phishing')}
          className="flex-1 py-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold tracking-wide hover:bg-red-500/20 hover:border-red-500/50 active:scale-95 transition-all"
        >
          PHISHING
        </button>
        <button
          onClick={() => handleButton('legit')}
          className="flex-1 py-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-400 font-bold tracking-wide hover:bg-green-500/20 hover:border-green-500/50 active:scale-95 transition-all"
        >
          LEGIT
        </button>
      </div>
    </div>
  );
}
