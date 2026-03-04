'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // With implicit flow, getSession() parses access_token from the URL hash
    supabase.auth.getSession().then(async ({ data: { session }, error: sessionErr }) => {
      if (sessionErr || !session) {
        setError('Sign-in link invalid or expired. Please request a new one.');
        return;
      }

      try {
        const res = await fetch('/api/auth/create-handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });
        const data = await res.json();
        if (res.ok && data.code) {
          setCode(data.code);
        } else {
          // Desktop: session already established in the browser, just go home
          router.replace('/');
        }
      } catch {
        router.replace('/');
      }
    });
  }, [router]);

  if (error) {
    return (
      <main className="min-h-screen bg-[#060c06] flex items-center justify-center px-4">
        <div className="w-full max-w-xs font-mono border border-[rgba(0,255,65,0.35)] bg-[#060c06] px-4 py-6 text-center space-y-3">
          <div className="text-[#ff3333] text-xs">{error}</div>
          <button onClick={() => router.replace('/')} className="text-[#00aa28] text-xs underline">
            Back to app
          </button>
        </div>
      </main>
    );
  }

  if (!code) {
    return (
      <main className="min-h-screen bg-[#060c06] flex items-center justify-center px-4">
        <div className="w-full max-w-xs font-mono text-center">
          <span className="text-[#00aa28] text-xs tracking-widest">VERIFYING...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#060c06] flex items-center justify-center px-4">
      <div className="w-full max-w-xs font-mono space-y-6">
        <div className="border border-[rgba(0,255,65,0.35)] bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2">
            <span className="text-[#00aa28] text-xs tracking-widest">AUTH_HANDOFF</span>
          </div>
          <div className="px-3 py-6 space-y-4 text-center">
            <div className="text-[#00aa28] text-xs">You&apos;re signed in.</div>
            <div className="text-[#003a0e] text-[10px] leading-relaxed">
              Open the Retro Phish app and enter this code:
            </div>
            <div className="text-[#00ff41] text-3xl tracking-[0.4em] font-bold py-2" style={{ textShadow: '0 0 10px #00ff41' }}>
              {code}
            </div>
            <div className="text-[#003a0e] text-[10px]">Valid for 5 minutes · single use</div>
          </div>
        </div>
        <button
          onClick={() => router.replace('/')}
          className="w-full text-[#003a0e] text-[10px] font-mono hover:text-[#00aa28] transition-colors"
        >
          skip — already on desktop
        </button>
      </div>
    </main>
  );
}
