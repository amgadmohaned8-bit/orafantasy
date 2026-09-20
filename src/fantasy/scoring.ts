import type { Position } from "./types";

/* Scoring follows the Fantasy Premier League rules. */

export type MatchStats = {
  minutes: number;
  goals: number;
  assists: number;
  teamConceded: number; // goals the player's team conceded in the match
  saves: number;
  penaltiesSaved: number;
  penaltiesMissed: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  bonus: number; // 0 to 3
};

export function calcPoints(s: MatchStats, pos: Position) {
  const breakdown: { label: string; points: number }[] = [];
  let total = 0;

  const add = (label: string, points: number) => {
    if (points !== 0) {
      breakdown.push({ label, points });
      total += points;
    }
  };

  if (s.minutes <= 0) {
    return { total, breakdown };
  }

  const played60 = s.minutes >= 60;

  add(played60 ? "60+ minutes played" : "Under 60 minutes played", played60 ? 2 : 1);

  const goalPoints: Record<Position, number> = { GK: 6, DEF: 6, MID: 5, FWD: 4 };

  if (s.goals > 0) {
    add(`${s.goals} goal${s.goals > 1 ? "s" : ""}`, s.goals * goalPoints[pos]);
  }

  if (s.assists > 0) {
    add(`${s.assists} assist${s.assists > 1 ? "s" : ""}`, s.assists * 3);
  }

  if (played60 && s.teamConceded === 0 && pos !== "FWD") {
    add("Clean sheet", pos === "MID" ? 1 : 4);
  }

  if (played60 && (pos === "GK" || pos === "DEF")) {
    const lost = Math.floor(s.teamConceded / 2);
    if (lost > 0) add(`${s.teamConceded} goals conceded`, -lost);
  }

  if (pos === "GK") {
    const saveBlocks = Math.floor(s.saves / 3);
    if (saveBlocks > 0) add(`${s.saves} saves`, saveBlocks);
  }

  if (s.penaltiesSaved > 0) add("Penalty saved", s.penaltiesSaved * 5);
  if (s.penaltiesMissed > 0) add("Penalty missed", s.penaltiesMissed * -2);
  if (s.yellowCards > 0) add("Yellow card", s.yellowCards * -1);
  if (s.redCards > 0) add("Red card", s.redCards * -3);
  if (s.ownGoals > 0) add("Own goal", s.ownGoals * -2);
  if (s.bonus > 0) add("Bonus", s.bonus);

  return { total, breakdown };
}

/* Team status, from the worst level to the best. */
export const STATUS_LEVELS = [
  "Poor",
  "Weak",
  "Average",
  "Good",
  "Great",
  "Professional",
] as const;

const STATUS_THRESHOLDS = [30, 40, 50, 60, 70]; // average points per gameweek

export function getTeamStatus(
  totalPoints: number,
  gameweeks: number,
  complete: boolean,
): (typeof STATUS_LEVELS)[number] {
  if (!complete) return STATUS_LEVELS[0];

  const average = totalPoints / Math.max(gameweeks, 1);
  const index = STATUS_THRESHOLDS.filter((t) => average >= t).length;

  return STATUS_LEVELS[index];
}
