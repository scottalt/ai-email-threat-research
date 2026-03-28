'use client';

import { useState, useEffect, useRef } from 'react';
import { usePlayer } from '@/lib/usePlayer';
import { Handler } from './Handler';

interface AdminMessage {
  id: string;
  lines: string[];
  buttonText: string;
  isGlobal: boolean;
  createdAt: string;
}

export function AnnouncementBanner() {
  const { signedIn } = usePlayer();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [globalBanner, setGlobalBanner] = useState<AdminMessage | null>(null);
  const [sigintMessage, setSigintMessage] = useState<AdminMessage | null>(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!signedIn || fetchedRef.current) return;
    fetchedRef.current = true;

    fetch('/api/player/messages')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data?.messages?.length) return;
        const msgs = data.messages as AdminMessage[];
        setMessages(msgs);

        // Targeted messages show as SIGINT overlay (first one)
        const targeted = msgs.find((m) => !m.isGlobal);
        if (targeted) setSigintMessage(targeted);

        // Global messages show as top banner
        const global = msgs.find((m) => m.isGlobal);
        if (global) {
          setGlobalBanner(global);
          // Slide in after a short delay
          setTimeout(() => setBannerVisible(true), 1000);
        }
      })
      .catch(() => {});
  }, [signedIn]);

  async function dismissMessage(msg: AdminMessage) {
    await fetch('/api/player/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: msg.id }),
    }).catch(() => {});
  }

  function handleSigintDismiss() {
    if (sigintMessage) {
      dismissMessage(sigintMessage);
      setSigintMessage(null);
      // Check if there are more targeted messages
      const remaining = messages.filter((m) => !m.isGlobal && m.id !== sigintMessage.id);
      if (remaining.length > 0) {
        setTimeout(() => setSigintMessage(remaining[0]), 500);
      }
    }
  }

  function handleBannerDismiss() {
    if (globalBanner) dismissMessage(globalBanner);
    setBannerDismissed(true);
    setTimeout(() => setBannerVisible(false), 300);
  }

  return (
    <>
      {/* Global announcement banner — slides down from top */}
      {globalBanner && !bannerDismissed && (
        <div
          className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-500 ${
            bannerVisible ? 'translate-y-0' : '-translate-y-full'
          }`}
        >
          <div className="bg-[var(--c-bg)] border-b-2 border-[var(--c-accent)] px-4 py-3 shadow-[0_4px_20px_rgba(255,170,0,0.15)]">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[var(--c-accent)] text-sm font-mono font-bold shrink-0">⚡ SIGINT</span>
                <span className="text-[var(--c-primary)] text-sm font-mono truncate">
                  {globalBanner.lines[0]}
                </span>
              </div>
              <button
                onClick={handleBannerDismiss}
                className="text-[var(--c-muted)] text-xs font-mono hover:text-[var(--c-secondary)] shrink-0 transition-colors"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Targeted SIGINT message — full Handler overlay */}
      {sigintMessage && (
        <Handler
          lines={sigintMessage.lines}
          buttonText={sigintMessage.buttonText}
          onDismiss={handleSigintDismiss}
        />
      )}
    </>
  );
}
