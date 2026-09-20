export type Position = "GK" | "DEF" | "MID" | "FWD";

export type Player = {
  id: string;
  name: string;
  position: Position;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  photo?: string;
  number?: number;
  price: number; // in millions
  rating?: number; // last-season average rating, used for pricing
};

export type PlayerPoints = {
  gw: number; // points in the current gameweek
  total: number; // points across the season
  breakdown: { label: string; points: number }[]; // current gameweek only
};

export type SquadDoc = {
  teamName: string;
  coachName: string;
  slots: Record<string, string>; // slot key -> player id
  complete: boolean;
  transfersUsed: number;
  transfersGw: number; // gameweek the transfersUsed counter belongs to
};

export const BUDGET = 100;
export const SQUAD_SIZE = 15;
export const MAX_PER_CLUB = 3;
export const FREE_TRANSFERS = 1;

/* Starting eleven, 4-3-3. Top of the pitch to the bottom. */
export const FORMATION: { key: string; label: Position; count: number }[] = [
  { key: "fwd", label: "FWD", count: 3 },
  { key: "mid", label: "MID", count: 3 },
  { key: "def", label: "DEF", count: 4 },
  { key: "gk", label: "GK", count: 1 },
];

export const BENCH: { key: string; label: Position }[] = [
  { key: "bench-gk", label: "GK" },
  { key: "bench-def-1", label: "DEF" },
  { key: "bench-def-2", label: "DEF" },
  { key: "bench-mid", label: "MID" },
  { key: "bench-fwd", label: "FWD" },
];

export const STARTER_SLOTS: { key: string; pos: Position }[] =
  FORMATION.flatMap((row) =>
    Array.from({ length: row.count }, (_, i) => ({
      key: `${row.key}-${i}`,
      pos: row.label,
    })),
  );

export const BENCH_SLOTS: { key: string; pos: Position }[] = BENCH.map((b) => ({
  key: b.key,
  pos: b.label,
}));

export const ALL_SLOTS = [...STARTER_SLOTS, ...BENCH_SLOTS];

export function slotPosition(key: string): Position {
  return ALL_SLOTS.find((s) => s.key === key)?.pos ?? "MID";
}

/* Returns an error message, or null when the pick is allowed. */
export function validatePick(
  player: Player,
  slotKey: string,
  slots: Record<string, string>,
  byId: Map<string, Player>,
): string | null {
  if (slotPosition(slotKey) !== player.position) {
    return `This slot is for a ${slotPosition(slotKey)}.`;
  }

  if (Object.entries(slots).some(([k, id]) => id === player.id && k !== slotKey)) {
    return `${player.name} is already in your squad.`;
  }

  const others = Object.entries(slots)
    .filter(([k]) => k !== slotKey)
    .map(([, id]) => byId.get(id))
    .filter((p): p is Player => Boolean(p));

  if (others.filter((p) => p.teamId === player.teamId).length >= MAX_PER_CLUB) {
    return `You can pick at most ${MAX_PER_CLUB} players from ${player.teamName}.`;
  }

  const spent = others.reduce((t, p) => t + p.price, 0) + player.price;

  if (spent > BUDGET + 1e-9) {
    const left = BUDGET - others.reduce((t, p) => t + p.price, 0);
    return `Not enough budget. You have ${left.toFixed(1)}M for this slot.`;
  }

  return null;
}
