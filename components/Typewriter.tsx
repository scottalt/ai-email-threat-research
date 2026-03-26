'use client';

import { useState, useEffect, useRef } from 'react';
import { getCtx } from '@/lib/sounds';

interface Props {
  text: string;
  speed?: number;    // ms per character (default 30)
  delay?: number;    // ms before starting (default 0)
  onComplete?: () => void;
  className?: string;
  cursor?: boolean;  // show blinking cursor (default true)
  sound?: boolean;   // play typing sound (default false)
}

/** Typewriter text effect — characters appear one by one with optional cursor and sound */
export function Typewriter({ text, speed = 30, delay = 0, onComplete, className, cursor = true, sound = false }: Props) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const callbackFired = useRef(false);
  const charCount = useRef(0);

  useEffect(() => {
    const delayTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(delayTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) {
      if (!callbackFired.current && onComplete) {
        callbackFired.current = true;
        onComplete();
      }
      setDone(true);
      return;
    }

    const timer = setTimeout(() => {
      const nextChar = text[displayed.length];
      setDisplayed(text.slice(0, displayed.length + 1));
      charCount.current++;

      // Play typing sound every 3rd character (not every char — too rapid)
      if (sound && nextChar !== ' ' && charCount.current % 3 === 0) {
        try {
          const ctx = getCtx(); // Shared context — works on Safari
          const t = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = 600 + Math.random() * 200;
          gain.gain.setValueAtTime(0.04, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.02);
        } catch { /* silently ignore */ }
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [started, displayed, text, speed, onComplete, sound]);

  // Respect reduced motion — show full text immediately
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayed(text);
      setDone(true);
    }
  }, [text]);

  return (
    <span className={className}>
      {displayed}
      {cursor && !done && <span className="cursor" />}
    </span>
  );
}
