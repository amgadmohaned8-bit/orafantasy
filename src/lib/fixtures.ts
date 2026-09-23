/* =========================================================
   Shared fixtures logic (used by Home, Matches and Standings)
   ========================================================= */

export type Team = {
  id?: string | number;
  name: string;
  logo?: string;
  score: number;
};

export type Match = {
  id: string;
  date: string;
  kickoff: string;
  status?: string;
  displayStatus?: string;
  isLive?: boolean;
  home: Team;
  away: Team;
  league?: string;
  gameweek?: number;
};

export type MatchState = "upcoming" | "live" | "finished";

type APIWeek = {
  week?: number;
  matches?: unknown[];
};

type FixturesAPIResponse = {
  season?: string;
  league?: {
    id?: string | number;
    name?: string;
  };
  weeks?: APIWeek[];
  matches?: unknown[];
  error?: string;
};

export type FixturesData = {
  matches: Match[];
  season: string;
  leagueName: string;
};

/* =========================================================
   PARSING
   ========================================================= */

function toStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function toScore(value: unknown): number {
  const score = Number(value);

  return Number.isFinite(score) ? score : 0;
}

export function parseMatch(
  value: unknown,
  leagueName: string,
  gameweek?: number,
): Match | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;

  const homeValue = item.home;
  const awayValue = item.away;

  if (
    !homeValue ||
    typeof homeValue !== "object" ||
    !awayValue ||
    typeof awayValue !== "object"
  ) {
    return null;
  }

  const home = homeValue as Record<string, unknown>;
  const away = awayValue as Record<string, unknown>;

  const id = item.id;

  if (id === undefined || id === null) {
    return null;
  }

  return {
    id: String(id),
    date: toStringValue(item.date),
    kickoff: toStringValue(item.kickoff),
    status: toStringValue(item.status),
    displayStatus: toStringValue(item.displayStatus),
    isLive: Boolean(item.isLive),

    home: {
      id: home.id as string | number | undefined,
      name: toStringValue(home.name, "Home"),
      logo: toStringValue(home.logo) || undefined,
      score: toScore(home.score),
    },

    away: {
      id: away.id as string | number | undefined,
      name: toStringValue(away.name, "Away"),
      logo: toStringValue(away.logo) || undefined,
      score: toScore(away.score),
    },

    league: leagueName || "Egyptian Premier League",
    gameweek,
  };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "An unexpected fixtures error occurred.";
}

/* =========================================================
   FETCH
   ========================================================= */

export async function fetchFixtures(
  signal?: AbortSignal,
): Promise<FixturesData> {
  const response = await fetch("/api/football", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!response.ok) {
    const preview = text.replace(/\s+/g, " ").trim().slice(0, 180);

    throw new Error(
      `Fixtures request failed (${response.status}${
        response.statusText ? ` ${response.statusText}` : ""
      })${preview ? `: ${preview}` : "."}`,
    );
  }

  if (!contentType.toLowerCase().includes("application/json")) {
    const looksLikeHtml = /<!doctype html|<html[\s>]/i.test(text);

    throw new Error(
      looksLikeHtml
        ? "The fixtures route returned an HTML page instead of JSON. Check your /api/football route."
        : `The fixtures route returned an unexpected content type: ${
            contentType || "unknown"
          }.`,
    );
  }

  let data: FixturesAPIResponse;

  try {
    data = JSON.parse(text) as FixturesAPIResponse;
  } catch {
    throw new Error(
      `The fixtures route returned invalid JSON${
        text.trim() ? `: ${text.replace(/\s+/g, " ").slice(0, 180)}` : "."
      }`,
    );
  }

  if (data.error) {
    throw new Error(data.error);
  }

  const leagueName = data.league?.name || "Egyptian Premier League";

  /* One entry per match id. If a match appears twice, keep the copy
     that knows its gameweek. */
  const byId = new Map<string, Match>();

  const add = (raw: unknown, gameweek?: number) => {
    const match = parseMatch(raw, leagueName, gameweek);

    if (!match) {
      return;
    }

    const existing = byId.get(match.id);

    if (
      !existing ||
      (existing.gameweek === undefined && match.gameweek !== undefined)
    ) {
      byId.set(match.id, match);
    }
  };

  if (Array.isArray(data.weeks)) {
    data.weeks.forEach((week) => {
      if (Array.isArray(week.matches)) {
        week.matches.forEach((raw) => add(raw, week.week));
      }
    });
  }

  if (Array.isArray(data.matches)) {
    data.matches.forEach((raw) => add(raw));
  }

  return {
    matches: Array.from(byId.values()),
    season: data.season || "2026/2027",
    leagueName,
  };
}

/* =========================================================
   TIME + STATE
   ========================================================= */

export function getMatchTimestamp(match: Match): number {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(match.date?.trim() || "");
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(match.kickoff?.trim() || "");

  if (!dateMatch) {
    return Number.MAX_SAFE_INTEGER;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);

  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;

  const timestamp = Date.UTC(year, month, day, hour, minute);

  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

export function getMatchState(match: Match): MatchState {
  const normalize = (value?: string) =>
    String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");

  const status = normalize(match.status);
  const displayStatus = normalize(match.displayStatus);

  const finishedStatuses = new Set([
    "finished",
    "ft",
    "full_time",
    "full time",
    "completed",
    "complete",
    "ended",
    "end",
  ]);

  const liveStatuses = new Set([
    "live",
    "inplay",
    "in_play",
    "in-play",
    "playing",
    "started",
    "1h",
    "2h",
    "ht",
    "extra_time",
    "extra time",
    "et",
  ]);

  if (finishedStatuses.has(status) || finishedStatuses.has(displayStatus)) {
    return "finished";
  }

  if (
    match.isLive ||
    liveStatuses.has(status) ||
    liveStatuses.has(displayStatus)
  ) {
    return "live";
  }

  return "upcoming";
}

/* =========================================================
   CURRENT GAMEWEEK
   Live match first, then the next match to be played,
   then the latest finished one.
   ========================================================= */

export function getCurrentGameweek(matches: Match[]): number | undefined {
  const withWeek = matches.filter(
    (match) =>
      match.gameweek !== undefined &&
      Number.isFinite(match.gameweek) &&
      match.gameweek >= 1,
  );

  if (withWeek.length === 0) {
    return undefined;
  }

  const live = withWeek.find((match) => getMatchState(match) === "live");

  if (live) {
    return live.gameweek;
  }

  /* Ignore old unfinished matches (postponed games) so they don't
     freeze the current gameweek in the past. */
  const grace = 12 * 60 * 60 * 1000;
  const now = Date.now();

  const nextUp = withWeek
    .filter(
      (match) =>
        getMatchState(match) === "upcoming" &&
        getMatchTimestamp(match) >= now - grace,
    )
    .sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b))[0];

  if (nextUp) {
    return nextUp.gameweek;
  }

  const lastFinished = withWeek
    .filter((match) => getMatchState(match) === "finished")
    .sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a))[0];

  return (lastFinished ?? withWeek[withWeek.length - 1]).gameweek;
}

export function groupByGameweek(matches: Match[]): Map<number, Match[]> {
  const groups = new Map<number, Match[]>();

  matches.forEach((match) => {
    const gameweek = Number(match.gameweek);

    if (!Number.isFinite(gameweek) || gameweek < 1) {
      return;
    }

    const list = groups.get(gameweek);

    if (list) {
      list.push(match);
    } else {
      groups.set(gameweek, [match]);
    }
  });

  return groups;
}

/* =========================================================
   STANDINGS (calculated from finished matches)
   ========================================================= */

export type StandingRow = {
  key: string;
  name: string;
  logo?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export function computeStandings(matches: Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();

  const rowFor = (team: Team): StandingRow => {
    const hasId = team.id !== undefined && team.id !== null && team.id !== "";
    const key = hasId ? `id:${team.id}` : `name:${team.name}`;

    let row = rows.get(key);

    if (!row) {
      row = {
        key,
        name: team.name,
        logo: team.logo,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
      };

      rows.set(key, row);
    }

    return row;
  };

  matches.forEach((match) => {
    const home = rowFor(match.home);
    const away = rowFor(match.away);

    if (getMatchState(match) !== "finished") {
      return;
    }

    const homeGoals = match.home.score;
    const awayGoals = match.away.score;

    home.played += 1;
    away.played += 1;

    home.gf += homeGoals;
    home.ga += awayGoals;
    away.gf += awayGoals;
    away.ga += homeGoals;

    if (homeGoals > awayGoals) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (homeGoals < awayGoals) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  return Array.from(rows.values())
    .map((row) => ({ ...row, gd: row.gf - row.ga }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        a.name.localeCompare(b.name),
    );
}

/* =========================================================
   DATE FORMATTING
   ========================================================= */

function parseISODate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, monthIndex, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthIndex ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

/* "Sat 14 Nov" */
export function formatShortDate(date: string): string {
  const parsed = parseISODate(date);

  if (!parsed) {
    return date || "Date to be confirmed";
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(parsed)
    .replace(",", "");
}

/* "Saturday 14 November" */
export function formatLongDate(date: string): string {
  const parsed = parseISODate(date);

  if (!parsed) {
    return date || "Date to be confirmed";
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
    .format(parsed)
    .replace(",", "");
}

export function formatKickoff(kickoff: string): string {
  const value = kickoff.trim();

  const clockMatch = /^(\d{1,2}):(\d{2})/.exec(value);

  if (clockMatch) {
    const hour = Number(clockMatch[1]);
    const minute = Number(clockMatch[2]);

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(
        2,
        "0",
      )}`;
    }
  }

  return value || "TBA";
}