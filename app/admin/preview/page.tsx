import { Game } from '@/components/Game';
import Link from 'next/link';

export default function AdminPreviewPage() {
  return (
    <main className="min-h-screen bg-[#010b01] flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-sm mb-4 flex items-center justify-between">
        <Link
          href="/admin"
          className="text-[#00aa28] font-mono text-xs hover:text-[#00ff41] transition-colors"
        >
          ← ADMIN
        </Link>
        <span className="text-[#ffaa00] font-mono text-[10px] tracking-widest">
          PREVIEW · NO DATA WRITTEN
        </span>
      </div>
      <Game previewMode />
    </main>
  );
}
