import { computePrice } from "@/src/fantasy/pricing";
import type { Player, Position } from "@/src/fantasy/types";

export interface RawTeam {
  id: string;
  name: string;
  logo?: string;
}

export interface RawPlayer {
  name?: string;
  position?: string;
  teamId?: string;
  number?: number;
  rating?: number;
  photo?: string;
}

export interface RawPlayersFile {
  season?: string;
  teams?: RawTeam[];
  players?: RawPlayer[];
}

/** Every position label we might meet in a source, mapped to our four positions. */
const POSITION_ALIASES: Record<string, Position> = {
  GK: "GK", GOALKEEPER: "GK", KEEPER: "GK",
  DEF: "DEF", DF: "DEF", DEFENDER: "DEF",
  MID: "MID", MF: "MID", MIDFIELDER: "MID",
  FWD: "FWD", FW: "FWD", FORWARD: "FWD", ATTACKER: "FWD", STRIKER: "FWD",
};

export function toPosition(raw: unknown): Position | null {
  if (typeof raw !== "string") return null;
  return POSITION_ALIASES[raw.trim().toUpperCase().replace(/[^A-Z]/g, "")] ?? null;
}

function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function mapPlayers(file: RawPlayersFile): { players: Player[]; skipped: string[] } {
  const teams = new Map((file.teams ?? []).map((t) => [t.id, t]));
  const usedIds = new Set<string>();
  const players: Player[] = [];
  const skipped: string[] = [];

  for (const raw of file.players ?? []) {
    const name = raw.name?.trim();
    const position = toPosition(raw.position);
    const team = raw.teamId ? teams.get(raw.teamId) : undefined;

    if (!name || !position || !team) {
      skipped.push(`${name ?? "(no name)"} [position=${raw.position ?? "?"}, team=${raw.teamId ?? "?"}]`);
      continue;
    }

    const rating = typeof raw.rating === "number" && Number.isFinite(raw.rating) ? raw.rating : undefined;
    const number = Number.isInteger(raw.number) && (raw.number as number) > 0 ? raw.number : undefined;

    let id = `${team.id}-${slugify(name)}`;
    if (usedIds.has(id)) id = `${id}-${number ?? usedIds.size}`;
    usedIds.add(id);

    players.push({
      id,
      name,
      position,
      teamId: team.id,
      teamName: team.name,
      ...(team.logo ? { teamLogo: team.logo } : {}),
      // Empty string on purpose: /squad falls back to the team shirt when photo is "".
      photo: raw.photo ?? "",
      ...(number !== undefined ? { number } : {}),
      ...(rating !== undefined ? { rating } : {}),
      price: computePrice(position, team.name, rating),
    });
  }

  return { players, skipped };
}
