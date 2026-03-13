// ── XP システム定数 & ユーティリティ ──

export const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 100 },
  { level: 3, xp: 250 },
  { level: 4, xp: 500 },
  { level: 5, xp: 1000 },
  { level: 6, xp: 1750 },
  { level: 7, xp: 2750 },
  { level: 8, xp: 4000 },
  { level: 9, xp: 5500 },
  { level: 10, xp: 7500 },
];

export const XP_ACTIONS = {
  workout_submit: 30,
  streak_7: 50,
  streak_14: 100,
  streak_30: 200,
  challenge_complete: 500,
  poke: 5,
} as const;

export function calcLevel(xp: number): number {
  let level = 1;
  for (const t of LEVEL_THRESHOLDS) {
    if (xp >= t.xp) level = t.level;
    else break;
  }
  return level;
}

export function xpForNextLevel(xp: number): {
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
  level: number;
} {
  const level = calcLevel(xp);
  const current = LEVEL_THRESHOLDS.find((t) => t.level === level)!;
  const next = LEVEL_THRESHOLDS.find((t) => t.level === level + 1);

  if (!next) {
    return { currentLevelXp: current.xp, nextLevelXp: current.xp, progress: 100, level };
  }

  const range = next.xp - current.xp;
  const progress = Math.min(100, Math.round(((xp - current.xp) / range) * 100));
  return { currentLevelXp: current.xp, nextLevelXp: next.xp, progress, level };
}

export function getLevelTitle(level: number): string {
  const titles: Record<number, string> = {
    1: "ルーキー",
    2: "ビギナー",
    3: "レギュラー",
    4: "ファイター",
    5: "ウォリアー",
    6: "ベテラン",
    7: "エリート",
    8: "マスター",
    9: "チャンピオン",
    10: "レジェンド",
  };
  return titles[level] ?? "レジェンド";
}
