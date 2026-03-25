'use client';

import { useMemo } from 'react';

/** Ambient scrolling hex text — decorative background texture for terminal immersion */
export function DataStream() {
  const lines = useMemo(() => {
    const hexChars = '0123456789ABCDEF';
    const result: string[] = [];
    for (let i = 0; i < 80; i++) {
      let line = '0x';
      for (let j = 0; j < 4; j++) {
        line += hexChars[Math.floor(Math.random() * 16)];
      }
      line += ' ';
      for (let j = 0; j < 4; j++) {
        line += hexChars[Math.floor(Math.random() * 16)];
      }
      result.push(line);
    }
    return result;
  }, []);

  // Double the lines for seamless scroll loop
  const text = [...lines, ...lines].join('\n');

  return (
    <div className="hidden md:block fixed inset-0 pointer-events-none z-[-1] overflow-hidden select-none" aria-hidden="true">
      <div className="absolute left-3 top-0 data-stream whitespace-pre">
        {text}
      </div>
      <div className="absolute right-3 top-0 data-stream whitespace-pre" style={{ animationDelay: '-15s' }}>
        {text}
      </div>
    </div>
  );
}
