"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell, { Cartouche, focusRing } from "@/src/components/AppShell";
import {
  MatchCard,
  MatchesLoading,
  MatchesError,
  StateMessage,
} from "@/src/components/MatchCard";
import { useFixtures } from "@/src/lib/useFixtures";
import {
  groupByGameweek,
  getCurrentGameweek,
  getMatchTimestamp,
  getMatchState,
} from "@/src/lib/fixtures";

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

  // Which gameweek tab is selected. Defaults to the current one once
  // the data has loaded; falls back to the last available week.
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  useEffect(() => {
    if (selectedWeek !== null) return;
    if (gameweeks.length === 0) return;

    setSelectedWeek(currentGameweek ?? gameweeks[gameweeks.length - 1]);
  }, [selectedWeek, currentGameweek, gameweeks]);

  const activeWeek = selectedWeek ?? currentGameweek ?? gameweeks[gameweeks.length - 1];

  const weekMatches = useMemo(() => {
    if (activeWeek === undefined || activeWeek === null) return [];

    return (groups.get(activeWeek) ?? [])
      .slice()
      .sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b));
  }, [groups, activeWeek]);

  const sortedAll = useMemo(
    () =>
      matches
        .slice()
        .sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b)),
    [matches],
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

            <div className="mt-4 space-y-2.5">
              {weekMatches.length === 0 ? (
                <StateMessage
                  title="No matches this gameweek"
                  text="Try a different gameweek from the list above."
                />
              ) : (
                weekMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    href={`/matches/${match.id}`}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="space-y-2.5">
            {sortedAll.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                href={`/matches/${match.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/* =========================================================
   GAMEWEEK TABS
   Horizontal scrollable row of gameweek numbers, 1 through N.
   ========================================================= */

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