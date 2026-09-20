import type { Position } from "./types";

/* Club tiers are my own judgement of the current Egyptian Premier League.
   Edit these lists whenever you want to re-rank the clubs. */
const TIER_3 = ["ahly", "zamalek", "pyramids"]; // +2.5M
const TIER_2 = [
  "ceramica",
  "masry",
  "future",
  "modern",
  "zed",
  "ittihad",
  "enppi",
  "smouha",
  "ismaily",
]; // +1.5M

function clubBonus(teamName: string): number {
  const name = teamName.toLowerCase();

  // "Bank Ahly" is not Al Ahly.
  if (!name.includes("bank") && TIER_3.some((t) => name.includes(t))) return 2.5;
  if (TIER_2.some((t) => name.includes(t))) return 1.5;

  return 0.5;
}

const BASE: Record<Position, number> = { GK: 4.0, DEF: 4.0, MID: 4.5, FWD: 5.0 };
const CAP: Record<Position, number> = { GK: 6.0, DEF: 7.5, MID: 13.0, FWD: 13.0 };
const RATING_WEIGHT: Record<Position, number> = { GK: 1.0, DEF: 1.5, MID: 3.0, FWD: 3.5 };

export function computePrice(
  position: Position,
  teamName: string,
  rating?: number,
): number {
  let price = BASE[position] + clubBonus(teamName);

  if (rating && Number.isFinite(rating)) {
    // A 6.5 rating is neutral. Every 0.1 above or below moves the price.
    const bonus = (rating - 6.5) * RATING_WEIGHT[position];
    price += Math.max(-0.5, Math.min(bonus, 4));
  }

  price = Math.min(Math.max(price, 4.0), CAP[position]);

  return Math.round(price * 2) / 2;
}
