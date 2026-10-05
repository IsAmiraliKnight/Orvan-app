export interface LeagueMember {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  weeklyXp: number;
  /** The signed-in user, spliced in at render time. */
  isYou?: boolean;
}

export const LEAGUE_TIER = "Bronze";
export const ROOM_SIZE = 30;
export const PROMOTION_SLOTS = 5;
export const DEMOTION_SLOTS = 5;

/**
 * A frozen room of opponents. Real rooms come from the weekly league job in
 * P2 — until then this exists so the page has something to rank you against.
 */
const OPPONENTS: ReadonlyArray<readonly [string, string, number]> = [
  ["Sara Amini", "🦋", 412],
  ["Nima Rad", "🐺", 388],
  ["Kiana", "🌙", 365],
  ["Arash T.", "⚡", 341],
  ["Mahsa", "🍀", 318],
  ["Pouya", "🐙", 296],
  ["Elena", "🌸", 274],
  ["Reza K.", "🦅", 261],
  ["Tara", "🎧", 247],
  ["Milad", "🚀", 233],
  ["Yasmin", "🐝", 218],
  ["Omid", "🧭", 205],
  ["Nadia", "🪐", 191],
  ["Hooman", "🦊", 176],
  ["Setareh", "✨", 162],
  ["Bardia", "🏔", 149],
  ["Leyla", "🌺", 137],
  ["Kaveh", "🪵", 124],
  ["Roya", "🕊", 112],
  ["Sina", "🎯", 98],
  ["Darya", "🐚", 86],
  ["Farid", "🧩", 74],
  ["Golnar", "🌻", 61],
  ["Amir H.", "🛠", 52],
  ["Niloofar", "🦩", 43],
  ["Sepehr", "🌵", 34],
  ["Baran", "☔", 26],
  ["Kian", "🐢", 17],
  ["Anahita", "🔮", 9],
];

function handleFor(name: string): string {
  return `@${name.toLowerCase().replace(/[^a-z]+/g, "")}`;
}

export interface Standing extends LeagueMember {
  rank: number;
}

/** Ranks the room with the user spliced in at their real weekly XP. */
export function standings(you: {
  name: string;
  avatar: string;
  weeklyXp: number;
}): Standing[] {
  const room: LeagueMember[] = OPPONENTS.map(([name, avatar, weeklyXp], i) => ({
    id: `op-${i}`,
    name,
    handle: handleFor(name),
    avatar,
    weeklyXp,
  }));

  room.push({
    id: "you",
    name: you.name,
    handle: "@you",
    avatar: you.avatar,
    weeklyXp: you.weeklyXp,
    isYou: true,
  });

  return room
    .sort((a, b) => b.weeklyXp - a.weeklyXp || (a.isYou ? -1 : 1))
    .map((m, i) => ({ ...m, rank: i + 1 }));
}

/** Monday 00:00 reset — the countdown shown in the league header. */
export function timeToReset(now: Date = new Date()): { days: number; hours: number } {
  const end = new Date(now);
  const daysToMonday = (8 - now.getDay()) % 7 || 7;
  end.setDate(end.getDate() + daysToMonday);
  end.setHours(0, 0, 0, 0);
  const ms = end.getTime() - now.getTime();
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
  };
}
