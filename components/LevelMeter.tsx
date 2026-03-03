import { xpToNextLevel, MAX_LEVEL } from '@/lib/xp';

interface LevelMeterProps {
  xp: number;
  level: number;
  compact?: boolean; // true = 1 line for HUD use
}

export function LevelMeter({ xp, level, compact }: LevelMeterProps) {
  const { current, needed } = xpToNextLevel(xp);
  const pct = needed === 0 ? 100 : Math.round((current / needed) * 100);
  const isMax = level >= MAX_LEVEL;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-[#00aa28]">LVL {level}</span>
        <div className="w-16 h-0.5 bg-[#003a0e]">
          <div className="h-full bg-[#00aa28]" style={{ width: `${pct}%` }} />
        </div>
        {!isMax && <span className="text-[#003a0e]">{current}/{needed} XP</span>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-[#00aa28]">LEVEL {level}</span>
        <span className="text-[#003a0e]">{isMax ? 'MAX' : `${current} / ${needed} XP`}</span>
      </div>
      <div className="h-1 bg-[#003a0e] w-full">
        <div className="h-full bg-[#00ff41] transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-right text-[10px] font-mono text-[#003a0e]">{xp.toLocaleString()} XP total</div>
    </div>
  );
}
