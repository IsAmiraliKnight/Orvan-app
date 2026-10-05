export const MAX_LEVEL = 50;

/** XP required to move from `level` to `level + 1`. */
export function xpToNextLevel(level: number): number {
  return 50 + 25 * (level - 1);
}

/** Cumulative XP needed to have reached `level`. Level 1 costs nothing. */
export function totalXpForLevel(level: number): number {
  const n = level - 1;
  if (n <= 0) return 0;
  return 50 * n + (25 * n * (n - 1)) / 2;
}

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  isMaxLevel: boolean;
}

export function levelFromTotalXp(totalXp: number): LevelProgress {
  let level = 1;
  while (level < MAX_LEVEL && totalXp >= totalXpForLevel(level + 1)) {
    level += 1;
  }
  const isMaxLevel = level >= MAX_LEVEL;
  return {
    level,
    xpIntoLevel: totalXp - totalXpForLevel(level),
    xpForNext: isMaxLevel ? 0 : xpToNextLevel(level),
    isMaxLevel,
  };
}

const TITLES: ReadonlyArray<readonly [number, string]> = [
  [1, "Seedling"],
  [5, "Sprout"],
  [10, "Sapling"],
  [18, "Grove"],
  [28, "Timber"],
  [40, "Old growth"],
];

export function levelTitle(level: number): string {
  let title = TITLES[0][1];
  for (const [threshold, name] of TITLES) {
    if (level >= threshold) title = name;
  }
  return title;
}
