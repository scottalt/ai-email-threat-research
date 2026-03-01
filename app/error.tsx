'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{
      background: '#060c06',
      color: '#00ff41',
      fontFamily: 'monospace',
      padding: '1.5rem',
      minHeight: '100vh',
    }}>
      <div style={{ color: '#ff3333', fontSize: '14px', fontWeight: 'bold', marginBottom: '1rem' }}>
        !! CLIENT ERROR DETECTED
      </div>
      <pre style={{
        color: '#ff3333',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        fontSize: '11px',
        lineHeight: 1.6,
        background: '#0a0a0a',
        padding: '1rem',
        border: '1px solid rgba(255,51,51,0.4)',
      }}>
        {error?.message ?? 'Unknown error'}
        {'\n\n'}
        {error?.stack ?? ''}
      </pre>
      <button
        onClick={reset}
        style={{
          marginTop: '1.5rem',
          color: '#00ff41',
          border: '1px solid rgba(0,255,65,0.6)',
          padding: '0.75rem 1.5rem',
          background: 'transparent',
          fontFamily: 'monospace',
          fontSize: '13px',
          cursor: 'pointer',
        }}
      >
        [ RETRY ]
      </button>
    </div>
  );
}
