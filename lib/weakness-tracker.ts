const STORAGE_KEY = 'weakness_history';

export interface WeaknessHistory {
  [technique: string]: { attempts: number; missed: number };
}

export function getWeaknessHistory(): WeaknessHistory {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function updateWeaknessHistory(results: { technique: string | null; correct: boolean }[]): WeaknessHistory {
  const history = getWeaknessHistory();
  for (const { technique, correct } of results) {
    if (!technique) continue;
    if (!history[technique]) history[technique] = { attempts: 0, missed: 0 };
    history[technique].attempts++;
    if (!correct) history[technique].missed++;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  return history;
}

export function getWeakPoints(history: WeaknessHistory, minAttempts = 2): { technique: string; missRate: number; missed: number; attempts: number }[] {
  return Object.entries(history)
    .filter(([, v]) => v.attempts >= minAttempts)
    .map(([technique, v]) => ({
      technique,
      missRate: Math.round((v.missed / v.attempts) * 100),
      missed: v.missed,
      attempts: v.attempts,
    }))
    .filter((v) => v.missRate > 0)
    .sort((a, b) => b.missRate - a.missRate)
    .slice(0, 3);
}
