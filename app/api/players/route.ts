import { readFile } from "node:fs/promises";
import path from "node:path";
import { mapPlayers, type RawPlayersFile } from "./mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEASON = "2026/27";
const DATA_FILE = path.join(process.cwd(), "data", "players-2026-27.json");

function fail(status: number, code: string, message: string, hint?: string) {
  return Response.json({ error: code, message, ...(hint ? { hint } : {}), season: SEASON }, { status });
}

export async function GET() {
  let text: string;
  try {
    text = await readFile(DATA_FILE, "utf8");
  } catch (e) {
    return fail(
      500,
      "PLAYERS_FILE_MISSING",
      "Could not read data/players-2026-27.json.",
      `Run "npm run build:players" from the project root. (${e instanceof Error ? e.message : String(e)})`,
    );
  }

  let file: RawPlayersFile;
  try {
    file = JSON.parse(text) as RawPlayersFile;
  } catch {
    return fail(
      500,
      "PLAYERS_FILE_INVALID",
      "data/players-2026-27.json is not valid JSON.",
      'Re-generate it with "npm run build:players".',
    );
  }

  const { players, skipped } = mapPlayers(file);
  if (skipped.length) console.warn(`[api/players] skipped ${skipped.length} invalid rows:`, skipped.slice(0, 10));

  if (players.length === 0) {
    return fail(
      500,
      "NO_VALID_PLAYERS",
      "The data file was read, but it contains no valid players.",
      `${skipped.length} rows were rejected (missing name, position or team). Run "npm run build:players".`,
    );
  }

  return Response.json({ players, count: players.length, season: SEASON });
}
