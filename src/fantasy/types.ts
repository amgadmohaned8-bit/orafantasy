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

/* =========================================================
   SQUAD COMPOSITION
   A fixed 15-player pool, same shape as the real thing:
   2 GK, 5 DEF, 5 MID, 3 FWD. The formation you pick decides
   how many of each start; it never changes who's in the pool.
   ========================================================= */

export const BUDGET = 100;
export const MAX_PER_CLUB = 3;
export const FREE_TRANSFERS = 1;

export const SQUAD_COMPOSITION: Record<Position, number> = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 3,
};

export const SQUAD_SIZE = Object.values(SQUAD_COMPOSITION).reduce(
  (a, b) => a + b,
  0,
); // 15

export const SQUAD_SLOTS: { key: string; pos: Position }[] = (
  Object.entries(SQUAD_COMPOSITION) as [Position, number][]
).flatMap(([pos, count]) =>
  Array.from({ length: count }, (_, i) => ({
    key: `${pos.toLowerCase()}-${i}`,
    pos,
  })),
);

export function slotPosition(key: string): Position {
  return SQUAD_SLOTS.find((s) => s.key === key)?.pos ?? "MID";
}

/* =========================================================
   FORMATIONS
   Decides the starting XI split. Whatever's left over from
   the 15-player pool sits on the bench (always 4 players:
   1 reserve GK + 3 outfield reserves).
   ========================================================= */

export type Formation =
  | "3-4-3"
  | "3-5-2"
  | "4-3-3"
  | "4-4-2"
  | "4-5-1"
  | "5-3-2"
  | "5-4-1";

export const FORMATIONS: Record<Formation, { DEF: number; MID: number; FWD: number }> = {
  "3-4-3": { DEF: 3, MID: 4, FWD: 3 },
  "3-5-2": { DEF: 3, MID: 5, FWD: 2 },
  "4-3-3": { DEF: 4, MID: 3, FWD: 3 },
  "4-4-2": { DEF: 4, MID: 4, FWD: 2 },
  "4-5-1": { DEF: 4, MID: 5, FWD: 1 },
  "5-3-2": { DEF: 5, MID: 3, FWD: 2 },
  "5-4-1": { DEF: 5, MID: 4, FWD: 1 },
};

export const FORMATION_LIST = Object.keys(FORMATIONS) as Formation[];

export const DEFAULT_FORMATION: Formation = "4-3-3";

export function startingCountFor(formation: Formation): Record<Position, number> {
  const f = FORMATIONS[formation];
  return { GK: 1, DEF: f.DEF, MID: f.MID, FWD: f.FWD };
}

/* Greedy auto-pick: highest-price player at each position starts first.
   Used the first time a squad is completed, and whenever the current
   starters no longer fit (formation changed, or a starter was
   transferred out). */
export function autoFillStarters(
  squadPlayerIds: string[],
  formation: Formation,
  byId: Map<string, Player>,
): string[] {
  const need = startingCountFor(formation);
  const byPos: Record<Position, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };

  squadPlayerIds.forEach((id) => {
    const player = byId.get(id);
    if (player) byPos[player.position].push(player);
  });

  (Object.keys(byPos) as Position[]).forEach((pos) => {
    byPos[pos].sort((a, b) => b.price - a.price);
  });

  const starters: string[] = [];

  (["GK", "DEF", "MID", "FWD"] as Position[]).forEach((pos) => {
    byPos[pos].slice(0, need[pos]).forEach((p) => starters.push(p.id));
  });

  return starters;
}

export function startersAreOwned(
  starters: string[],
  slots: Record<string, string>,
): boolean {
  const owned = new Set(Object.values(slots));
  return starters.every((id) => owned.has(id));
}

/* Can this set of starters be saved for this formation? */
export function validateStarters(
  starters: string[],
  formation: Formation,
  byId: Map<string, Player>,
): string | null {
  if (starters.length !== 11) {
    return `Pick exactly 11 starters (you have ${starters.length}).`;
  }

  const need = startingCountFor(formation);
  const have: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };

  starters.forEach((id) => {
    const player = byId.get(id);
    if (player) have[player.position] += 1;
  });

  for (const pos of ["GK", "DEF", "MID", "FWD"] as Position[]) {
    if (have[pos] !== need[pos]) {
      return `Your ${formation} formation needs ${need[pos]} ${pos}${
        need[pos] === 1 ? "" : "s"
      }, you have ${have[pos]}.`;
    }
  }

  return null;
}

/* =========================================================
   CHIPS
   Each usable once per season. Only one chip can be active
   for a given gameweek.
   ========================================================= */

export type ChipKey = "wildcard" | "tripleCaptain" | "benchBoost";

export type ChipState = {
  used: boolean;
  usedGw?: number;
};

export const CHIP_LABELS: Record<ChipKey, string> = {
  wildcard: "Wildcard",
  tripleCaptain: "Triple Captain",
  benchBoost: "Bench Boost",
};

export const CHIP_DESCRIPTIONS: Record<ChipKey, string> = {
  wildcard:
    "Rebuild your whole squad this gameweek. No transfer limit and no points hit.",
  tripleCaptain:
    "Your captain's points count three times instead of two, just for this gameweek.",
  benchBoost:
    "Your bench players' points count toward your total this gameweek too.",
};

export const EMPTY_CHIPS: Record<ChipKey, ChipState> = {
  wildcard: { used: false },
  tripleCaptain: { used: false },
  benchBoost: { used: false },
};

/* =========================================================
   SQUAD DOC
   ========================================================= */

export type SquadDoc = {
  teamName: string;
  coachName: string;

  slots: Record<string, string>; // squad slot key -> player id (the 15-player pool)

  formation: Formation;
  starters: string[]; // player ids chosen to start, sized to match the formation
  captain: string | null; // player id, must be a starter
  viceCaptain: string | null; // player id, must be a starter, different from captain

  complete: boolean;
  transfersUsed: number;
  transfersGw: number;

  chips: Record<ChipKey, ChipState>;
  activeChip: ChipKey | null; // the chip in effect for the *current* gameweek, if any
  activeChipGw: number | null;
};

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