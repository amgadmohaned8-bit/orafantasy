"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell, {
  Cartouche,
  displayFont,
  focusRing,
} from "../../src/components/AppShell";
import {
  MatchCard,
  MatchesError,
  MatchesLoading,
  StateMessage,
} from "../../src/components/MatchCard";
import {
  formatLongDate,
  getCurrentGameweek,
  getMatchState,
  getMatchTimestamp,
  groupByGameweek,
  type Match,
} from "../../src/lib/fixtures";
import { useFixtures } from "../../src/lib/useFixtures";

type Fixtures = ReturnType<typeof useFixtures>;

export default function MatchesPage() {
  const fixtures = useFixtures();

  const hasLive = useMemo(
    () => fixtures.matches.some((match) => getMatchState(match) === "live"),
    [fixtures.matches],
  );

  return (
    <AppShell
      title="Matches"
      subtitle={`${fixtures.leagueName}, season ${fixtures.season}`}
      liveNow={hasLive}
    >
      <MatchesContent fixtures={fixtures} />
    </AppShell>
  );
}

function MatchesContent({ fixtures }: { fixtures: Fixtures }) {
  const [picked, setPicked] = useState<number | null>(null);

  const currentGameweek = useMemo(
    () => getCurrentGameweek(fixtures.matches),
    [fixtures.matches],
  );

  const groups = useMemo(
    () => groupByGameweek(fixtures.matches),
    [fixtures.matches],
  );

  const gameweeks = useMemo(
    () => Array.from(groups.keys()).sort((a, b) => a - b),
    [groups],
  );

  /* Opens on the current gameweek until the user picks another one. */
  const selected = picked ?? currentGameweek ?? gameweeks[0];

  const list = useMemo(() => {
    if (selected === undefined) {
      return [];
    }

    return [...(groups.get(selected) ?? [])].sort(
      (a, b) => getMatchTimestamp(a) - getMatchTimestamp(b),
    );
  }, [groups, selected]);

  /* Keep the selected chip visible in the scrolling row. */
  useEffect(() => {
    if (selected === undefined) {
      return;
    }

    document
      .getElementById(`gw-chip-${selected}`)
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [selected, gameweeks.length]);

  const days: { date: string; items: Match[] }[] = [];

  list.forEach((match) => {
    const last = days[days.length - 1];

    if (last && last.date === match.date) {
      last.items.push(match);
    } else {
      days.push({ date: match.date, items: [match] });
    }
  });

  return (
    <div className="mx-auto max-w-[760px]">
      {gameweeks.length > 0 && (
        <div
          className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Gameweek"
        >
          {gameweeks.map((gameweek) => {
            const active = gameweek === selected;
            const isCurrent = gameweek === currentGameweek;

            return (
              <button
                key={gameweek}
                id={`gw-chip-${gameweek}`}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPicked(gameweek)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${focusRing} ${
                  active
                    ? "border-ora-gold bg-ora-gold text-ora-night"
                    : isCurrent
                      ? "border-ora-gold/50 text-ora-gold-light hover:bg-ora-gold/10"
                      : "border-white/10 text-ora-papyrus/60 hover:text-ora-papyrus"
                }`}
              >
                GW {gameweek}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1
          className="text-[28px] font-semibold leading-none"
          style={displayFont}
        >
          {selected !== undefined ? `Gameweek ${selected}` : "Matches"}
        </h1>

        {selected !== undefined && selected === currentGameweek && (
          <Cartouche>Current</Cartouche>
        )}
      </div>

      <div className="mt-5">
        {fixtures.loading ? (
          <MatchesLoading />
        ) : fixtures.error ? (
          <MatchesError message={fixtures.error} onRetry={fixtures.reload} />
        ) : days.length === 0 ? (
          <StateMessage
            title="No matches yet"
            text="Fixtures will show up here as soon as the league publishes them."
          />
        ) : (
          <div className="space-y-6">
            {days.map((day, index) => (
              <div key={`${day.date}-${index}`}>
                <h2 className="mb-2.5 text-sm font-semibold text-ora-papyrus/70">
                  {formatLongDate(day.date)}
                </h2>

                <div className="space-y-2.5">
                  {day.items.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      showMeta={false}
                      href={`/matches/${match.id}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
