'use client';

import dynamic from 'next/dynamic';

const Game = dynamic(() => import('./Game').then((m) => m.Game), {
  ssr: false,
  loading: () => null,
});

export function ClientGame() {
  return <Game />;
}
