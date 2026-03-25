'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  text: string;
  speed?: number;    // ms per character (default 30)
  delay?: number;    // ms before starting (default 0)
  onComplete?: () => void;
  className?: string;
  cursor?: boolean;  // show blinking cursor (default true)
}

/** Typewriter text effect — characters appear one by one with optional cursor */
export function Typewriter({ text, speed = 30, delay = 0, onComplete, className, cursor = true }: Props) {
  const [displayed, setDisplayed] = useState('');
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const callbackFired = useRef(false);

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
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);

    return () => clearTimeout(timer);
  }, [started, displayed, text, speed, onComplete]);

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
