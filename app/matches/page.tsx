"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell, {
  Cartouche,
  displayFont,
  focusRing,
} from "@/components/AppShell";
import {
  MatchesLoading,
  MatchesError,
  StateMessage,
  TeamBadge,
} from "@/components/MatchCard";
import { useFixtures } from "@/lib/useFixtures";
import {
  groupByGameweek,
  getCurrentGameweek,
  getMatchTimestamp,
  getMatchState,
  formatKickoff,
  formatLongDate,
  type Match,
  type MatchState,
} from "@/lib/fixtures";

type Filter = "all" | "live" | "upcoming" | "finished";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Fixtures" },
  { key: "finished", label: "Results" },
];

export default function MatchesPage() {
  const { matches, leagueName, loading, error, reload } = useFixtures();

  const isLiveNow = useMemo(
    () => matches.some((match) => getMatchState(match) === "live"),
    [matches],
  );

  const groups = useMemo(() => groupByGameweek(matches), [matches]);

  const gameweeks = useMemo(
    () => Array.from(groups.keys()).sort((a, b) => a - b),
    [groups],
  );

  const currentGameweek = useMemo(
    () => getCurrentGameweek(matches),
    [matches],
  );

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  useEffect(() => {
    if (selectedWeek !== null) return;
    if (gameweeks.length === 0) return;

    setSelectedWeek(
      currentGameweek ?? gameweeks[gameweeks.length - 1],
    );
  }, [selectedWeek, currentGameweek, gameweeks]);

  const activeWeek =
    selectedWeek ??
    currentGameweek ??
    gameweeks[gameweeks.length - 1];

  const [filter, setFilter] = useState<Filter>("all");

  const weekMatches = useMemo(() => {
    if (activeWeek === undefined || activeWeek === null) return [];

    return (groups.get(activeWeek) ?? [])
      .slice()
      .sort(
        (a, b) =>
          getMatchTimestamp(a) - getMatchTimestamp(b),
      );
  }, [groups, activeWeek]);

  const filteredMatches = useMemo(() => {
    if (filter === "all") return weekMatches;

    const wanted: MatchState =
      filter === "finished"
        ? "finished"
        : filter === "live"
          ? "live"
          : "upcoming";

    return weekMatches.filter(
      (match) => getMatchState(match) === wanted,
    );
  }, [weekMatches, filter]);

  const sortedAll = useMemo(
    () =>
      matches
        .slice()
        .sort(
          (a, b) =>
            getMatchTimestamp(a) - getMatchTimestamp(b),
        ),
    [matches],
  );

  const dateGroups = useMemo(
    () => groupByDate(filteredMatches),
    [filteredMatches],
  );

  return (
    <AppShell title="Matches" liveNow={isLiveNow}>
      <div className="mx-auto max-w-[760px]">
        {leagueName && (
          <div className="mb-4 flex justify-center">
            <Cartouche>{leagueName}</Cartouche>
          </div>
        )}

        {loading && matches.length === 0 ? (
          <MatchesLoading />
        ) : error ? (
          <MatchesError message={error} onRetry={reload} />
        ) : matches.length === 0 ? (
          <StateMessage
            title="No matches yet"
            text="Fixtures will show up here once they're published."
          />
        ) : gameweeks.length > 0 ? (
          <>
            <GameweekTabs
              gameweeks={gameweeks}
              active={activeWeek}
              current={currentGameweek}
              onSelect={setSelectedWeek}
            />

            <FilterTabs
              active={filter}
              onSelect={setFilter}
            />

            <div className="mt-5 space-y-6">
              {dateGroups.length === 0 ? (
                <StateMessage
                  title="No matches here"
                  text="Try a different filter or gameweek."
                />
              ) : (
                dateGroups.map(
                  ({ date, label, matches: dayMatches }) => (
                    <section key={date}>
                      <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ora-papyrus/45">
                        {label}
                      </h2>

                      <div className="space-y-2.5">
                        {dayMatches.map((match) => (
                          <MatchRow
                            key={match.id}
                            match={match}
                          />
                        ))}
                      </div>
                    </section>
                  ),
                )
              )}
            </div>
          </>
        ) : (
          <div className="space-y-2.5">
            {sortedAll.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FilterTabs({
  active,
  onSelect,
}: {
  active: Filter;
  onSelect: (filter: Filter) => void;
}) {
  return (
    <div
      className="mt-3 flex gap-1.5"
      role="tablist"
      aria-label="Match status"
    >
      {FILTERS.map((opt) => {
        const isActive = opt.key === active;

        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(opt.key)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${focusRing} ${
              isActive
                ? "border-ora-gold bg-ora-gold text-ora-night"
                : "border-white/10 text-ora-papyrus/60 hover:bg-ora-gold/10 hover:text-ora-papyrus"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function GameweekTabs({
  gameweeks,
  active,
  current,
  onSelect,
}: {
  gameweeks: number[];
  active: number | null | undefined;
  current: number | undefined;
  onSelect: (week: number) => void;
}) {
  return (
    <div
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1"
      role="tablist"
      aria-label="Gameweek"
    >
      {gameweeks.map((week) => {
        const isActive = week === active;
        const isCurrent = week === current;

        return (
          <button
            key={week}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(week)}
            className={`relative shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${focusRing} ${
              isActive
                ? "border-ora-gold bg-ora-gold text-ora-night"
                : "border-white/10 text-ora-papyrus/60 hover:bg-ora-gold/10 hover:text-ora-papyrus"
            }`}
          >
            {week}

            {isCurrent && !isActive && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-ora-nile" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function MatchRow({ match }: { match: Match }) {
  const state = getMatchState(match);
  const started = state !== "upcoming";
  const detail = match.displayStatus || match.status || "";

  return (
    <Link
      href={`/matches/${match.id}`}
      className={`block rounded-xl border transition-transform hover:-translate-y-px ${focusRing} ${
        state === "live"
          ? "border-ora-nile/30 bg-ora-nile/5"
          : "border-white/5 bg-white/[0.03]"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <TeamSide team={match.home} align="right" />

        <div className="flex w-[84px] shrink-0 flex-col items-center">
          {state === "live" ? (
            <>
              <p
                className="text-xl font-semibold leading-none tabular-nums"
                style={displayFont}
              >
                {match.home.score} – {match.away.score}
              </p>

              <span className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-ora-nile">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ora-nile motion-reduce:animate-none" />
                {detail &&
                detail.toLowerCase() !== "live"
                  ? detail
                  : "Live"}
              </span>
            </>
          ) : started ? (
            <>
              <p
                className="text-xl font-semibold leading-none tabular-nums"
                style={displayFont}
              >
                {match.home.score} – {match.away.score}
              </p>

              <span className="mt-1.5 text-[11px] font-medium text-ora-papyrus/45">
                Full time
              </span>
            </>
          ) : (
            <>
              <p className="text-base font-semibold tabular-nums">
                {formatKickoff(match.kickoff)}
              </p>

              <span className="mt-1.5 text-[11px] text-ora-papyrus/40">
                Kickoff
              </span>
            </>
          )}
        </div>

        <TeamSide team={match.away} align="left" />
      </div>
    </Link>
  );
}

function TeamSide({
  team,
  align,
}: {
  team: { name: string; logo?: string };
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2.5 ${
        align === "right"
          ? "flex-row-reverse text-right"
          : "text-left"
      }`}
    >
      <TeamBadge team={team} size="md" />

      <p className="min-w-0 truncate text-sm font-medium">
        {team.name}
      </p>
    </div>
  );
}

function groupByDate(
  matches: Match[],
): {
  date: string;
  label: string;
  matches: Match[];
}[] {
  const byDate = new Map<string, Match[]>();

  matches.forEach((match) => {
    const key = match.date || "unknown";
    const list = byDate.get(key);

    if (list) {
      list.push(match);
    } else {
      byDate.set(key, [match]);
    }
  });

  const todayKey = new Date()
    .toISOString()
    .slice(0, 10);

  const tomorrowKey = new Date(
    Date.now() + 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  return Array.from(byDate.entries())
    .sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )
    .map(([date, dayMatches]) => ({
      date,
      label:
        date === todayKey
          ? "Today"
          : date === tomorrowKey
            ? "Tomorrow"
            : formatLongDate(date),
      matches: dayMatches.sort(
        (a, b) =>
          getMatchTimestamp(a) -
          getMatchTimestamp(b),
      ),
    }));
}
