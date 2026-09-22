"use client";

import { useMemo } from "react";
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
          <div className="space-y-6">
            {gameweeks.map((week) => {
              const weekMatches = (groups.get(week) ?? [])
                .slice()
                .sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b));

              return (
                <section key={week}>
                  <div className="mb-2.5 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-ora-papyrus/70">
                      Gameweek {week}
                    </h2>

                    {week === currentGameweek && <Cartouche>Current</Cartouche>}
                  </div>

                  <div className="space-y-2.5">
                    {weekMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        href={`/matches/${match.id}`}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
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