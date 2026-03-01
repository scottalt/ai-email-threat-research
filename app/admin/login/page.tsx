'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push('/admin');
    } else {
      setError('ACCESS DENIED.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060c06] flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="term-border bg-[#060c06]">
          <div className="border-b border-[rgba(0,255,65,0.35)] px-3 py-2">
            <span className="text-[#00aa28] text-xs tracking-widest">ADMIN_TERMINAL</span>
          </div>
          <form onSubmit={handleSubmit} className="px-3 py-4 space-y-3">
            <div className="text-[#00aa28] text-xs font-mono">ENTER ADMIN PASSWORD:</div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border border-[rgba(0,255,65,0.3)] text-[#00ff41] font-mono text-xs px-2 py-2 focus:outline-none focus:border-[rgba(0,255,65,0.7)]"
              autoFocus
            />
            {error && <div className="text-[#ff3333] text-xs font-mono">{error}</div>}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2 term-border text-[#00ff41] font-mono text-xs tracking-widest hover:bg-[rgba(0,255,65,0.08)] disabled:opacity-30 transition-all"
            >
              {loading ? 'AUTHENTICATING...' : '[ AUTHENTICATE ]'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
