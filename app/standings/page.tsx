"use client";

import { useMemo } from "react";
import AppShell, { displayFont } from "../../src/components/AppShell";
import {
  MatchesError,
  MatchesLoading,
  StateMessage,
  TeamBadge,
} from "../../src/components/MatchCard";
import { computeStandings, getMatchState } from "../../src/lib/fixtures";
import { useFixtures } from "../../src/lib/useFixtures";

export default function StandingsPage() {
  const fixtures = useFixtures();

  const hasLive = useMemo(
    () => fixtures.matches.some((match) => getMatchState(match) === "live"),
    [fixtures.matches],
  );

  const rows = useMemo(
    () => computeStandings(fixtures.matches),
    [fixtures.matches],
  );

  const hasResults = rows.some((row) => row.played > 0);

  return (
    <AppShell
      title="Standings"
      subtitle={`${fixtures.leagueName}, season ${fixtures.season}`}
      liveNow={hasLive}
    >
      <div className="mx-auto max-w-[860px]">
        <h1
          className="text-[28px] font-semibold leading-none lg:hidden"
          style={displayFont}
        >
          Standings
        </h1>

        <section className="mt-4 overflow-hidden rounded-2xl border border-ora-gold/20 bg-ora-card lg:mt-0">
          <div className="ora-nile-band" aria-hidden="true" />

          {fixtures.loading ? (
            <div className="p-5">
              <MatchesLoading />
            </div>
          ) : fixtures.error ? (
            <div className="p-5">
              <MatchesError
                message={fixtures.error}
                onRetry={fixtures.reload}
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-5">
              <StateMessage
                title="No table yet"
                text="The table will appear once fixtures are published."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-ora-papyrus/50">
                    <th className="w-10 py-3 pl-5 text-left font-medium">#</th>
                    <th className="py-3 text-left font-medium">Team</th>
                    <th className="w-10 py-3 text-center font-medium">P</th>
                    <th className="w-10 py-3 text-center font-medium">W</th>
                    <th className="w-10 py-3 text-center font-medium">D</th>
                    <th className="w-10 py-3 text-center font-medium">L</th>
                    <th className="w-12 py-3 text-center font-medium">GD</th>
                    <th className="w-14 py-3 pr-5 text-right font-semibold text-ora-gold-light">
                      Pts
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={row.key}
                      className="border-b border-white/5 last:border-b-0"
                    >
                      <td
                        className={`py-2.5 pl-5 tabular-nums ${
                          index < 3 && hasResults
                            ? "font-semibold text-ora-gold-light"
                            : "text-ora-papyrus/50"
                        }`}
                      >
                        {index + 1}
                      </td>

                      <td className="py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <TeamBadge team={row} size="sm" />

                          <span className="truncate font-medium">
                            {row.name}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 text-center tabular-nums text-ora-papyrus/70">
                        {row.played}
                      </td>
                      <td className="py-2.5 text-center tabular-nums text-ora-papyrus/70">
                        {row.won}
                      </td>
                      <td className="py-2.5 text-center tabular-nums text-ora-papyrus/70">
                        {row.drawn}
                      </td>
                      <td className="py-2.5 text-center tabular-nums text-ora-papyrus/70">
                        {row.lost}
                      </td>
                      <td className="py-2.5 text-center tabular-nums text-ora-papyrus/70">
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </td>
                      <td className="py-2.5 pr-5 text-right font-semibold tabular-nums">
                        {row.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-3 text-xs text-ora-papyrus/45">
          Calculated from finished matches. Live games are not counted until
          full time.
        </p>
      </div>
    </AppShell>
  );
}
