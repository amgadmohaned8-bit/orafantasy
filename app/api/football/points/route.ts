/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { calcPoints, type MatchStats } from "@/fantasy/scoring";
import type { Position, PlayerPoints } from "@/fantasy/types";
const BASE = "https://v3.football.api-sports.io";
const KEY = process.env.FOOTBALL_API_KEY ?? "";
const LEAGUE = process.env.FOOTBALL_LEAGUE_ID ?? "233";
const SEASON = process.env.FOOTBALL_SEASON ?? "2026";

const POS: Record<string, Position> = { G: "GK", D: "DEF", M: "MID", F: "FWD" };

async function api(path: string, ttl: number): Promise<any[]> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": KEY },
    next: { revalidate: ttl },
  });

  if (!res.ok) throw new Error(`Football API returned ${res.status} for ${path}`);

  const json = await res.json();

  /* API-Football reports problems inside a 200 response. */
  const errors = json.errors;
  const messages = Array.isArray(errors)
    ? errors
    : errors
      ? Object.values(errors)
      : [];

  if (messages.length > 0) {
    throw new Error(`Football API: ${messages.map(String).join(" ")}`);
  }

  return json.response ?? [];
}

type RoundResult = Record<string, { points: number; breakdown: PlayerPoints["breakdown"] }>;

async function roundPoints(round: number, isCurrent: boolean): Promise<RoundResult> {
  const fixtures = await api(
    `/fixtures?league=${LEAGUE}&season=${SEASON}&round=${encodeURIComponent(
      `Regular Season - ${round}`,
    )}`,
    isCurrent ? 60 : 3600,
  );

  const result: RoundResult = {};

  await Promise.all(
    fixtures.map(async (fx: any) => {
      const status = fx.fixture?.status?.short;
      const finished = ["FT", "AET", "PEN"].includes(status);
      const live = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"].includes(status);

      if (!finished && !live) return;

      const ttl = finished ? 86400 : 60;

      const [teams, events] = await Promise.all([
        api(`/fixtures/players?fixture=${fx.fixture.id}`, ttl),
        api(`/fixtures/events?fixture=${fx.fixture.id}`, ttl),
      ]);

      const ownGoals: Record<string, number> = {};

      events.forEach((e: any) => {
        if (e.type === "Goal" && e.detail === "Own Goal" && e.player?.id) {
          const id = String(e.player.id);
          ownGoals[id] = (ownGoals[id] ?? 0) + 1;
        }
      });

      const rows: { id: string; pos: Position; rating: number; stats: MatchStats }[] = [];

      teams.forEach((t: any) => {
        const isHome = t.team.id === fx.teams.home.id;
        const conceded = (isHome ? fx.goals.away : fx.goals.home) ?? 0;

        t.players.forEach((p: any) => {
          const s = p.statistics?.[0];
          const minutes = s?.games?.minutes ?? 0;
          const pos = POS[s?.games?.position];

          if (!s || !minutes || !pos) return;

          const id = String(p.player.id);

          rows.push({
            id,
            pos,
            rating: parseFloat(s.games.rating) || 0,
            stats: {
              minutes,
              goals: s.goals?.total ?? 0,
              assists: s.goals?.assists ?? 0,
              teamConceded: conceded,
              saves: s.goals?.saves ?? 0,
              penaltiesSaved: s.penalty?.saved ?? 0,
              penaltiesMissed: s.penalty?.missed ?? 0,
              yellowCards: s.cards?.yellow ?? 0,
              redCards: s.cards?.red ?? 0,
              ownGoals: ownGoals[id] ?? 0,
              bonus: 0,
            },
          });
        });
      });

      // The provider has no BPS, so bonus goes to the three best match ratings.
      [...rows]
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3)
        .forEach((row, index) => {
          if (row.rating > 0) row.stats.bonus = 3 - index;
        });

      rows.forEach((row) => {
        const { total, breakdown } = calcPoints(row.stats, row.pos);
        const entry = result[row.id] ?? { points: 0, breakdown: [] };

        entry.points += total;
        entry.breakdown.push(...breakdown);
        result[row.id] = entry;
      });
    }),
  );

  return result;
}

export async function GET() {
  try {
    if (!KEY) throw new Error("Missing FOOTBALL_API_KEY environment variable.");

    const current = await api(
      `/fixtures/rounds?league=${LEAGUE}&season=${SEASON}&current=true`,
      300,
    );

    const gw = Number(/(\d+)\s*$/.exec(String(current[0] ?? ""))?.[1]) || 1;

    const rounds = await Promise.all(
      Array.from({ length: gw }, (_, i) => roundPoints(i + 1, i + 1 === gw)),
    );

    const players: Record<string, PlayerPoints> = {};

    rounds.forEach((round, index) => {
      const isCurrent = index + 1 === gw;

      Object.entries(round).forEach(([id, value]) => {
        const entry = players[id] ?? { gw: 0, total: 0, breakdown: [] };

        entry.total += value.points;

        if (isCurrent) {
          entry.gw += value.points;
          entry.breakdown.push(...value.breakdown);
        }

        players[id] = entry;
      });
    });

    return NextResponse.json({ gw, players });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Points request failed." },
      { status: 502 },
    );
  }
}
