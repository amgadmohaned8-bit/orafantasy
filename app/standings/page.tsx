"use client";

import { useMemo, useState } from "react";
import AppShell, { displayFont, focusRing, Icon } from "../../src/components/AppShell";
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
  const [showInfo, setShowInfo] = useState(false);

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
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <h1 className="text-[28px] font-black leading-none" style={displayFont}>
            Standings
          </h1>
        </div>

        <section className="ora-flash relative mt-4 overflow-hidden rounded-2xl border border-ora-gold/20 bg-ora-card lg:mt-0">
          <div className="ora-nile-band" aria-hidden="true" />

          {/* EGYPT SCOPE BANNER */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-lg leading-none">🇪🇬</span>
              <div>
                <p className="text-sm font-bold leading-tight">
                  Egypt, official league table
                </p>
                <p className="text-xs font-medium leading-tight text-ora-papyrus/50">
                  {fixtures.leagueName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInfo(true)}
              className={`flex items-center gap-1.5 rounded-full border border-ora-gold/30 px-3 py-1.5 text-xs font-bold text-ora-gold-light transition-colors hover:bg-ora-gold/10 ${focusRing}`}
            >
              <Icon name="info" className="h-3.5 w-3.5" />
              What is this?
            </button>
          </div>

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
                  <tr className="border-b border-white/5 text-xs font-bold text-ora-papyrus/50">
                    <th className="w-10 py-3 pl-5 text-left">#</th>
                    <th className="py-3 text-left">Team</th>
                    <th className="w-10 py-3 text-center">P</th>
                    <th className="w-10 py-3 text-center">W</th>
                    <th className="w-10 py-3 text-center">D</th>
                    <th className="w-10 py-3 text-center">L</th>
                    <th className="w-12 py-3 text-center">GD</th>
                    <th className="w-14 py-3 pr-5 text-right text-ora-gold-light">
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
                            ? "font-black text-ora-gold-light"
                            : "font-semibold text-ora-papyrus/50"
                        }`}
                      >
                        {index + 1}
                      </td>

                      <td className="py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <TeamBadge team={row} size="sm" />

                          <span className="truncate font-semibold">
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
                      <td className="py-2.5 pr-5 text-right font-black tabular-nums">
                        {row.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-3 text-xs font-medium text-ora-papyrus/45">
          Calculated from finished matches. Live games are not counted until
          full time. Want to compete just with friends instead?{" "}
          <a href="/leagues" className={`font-bold text-ora-gold-light ${focusRing}`}>
            Start a private league.
          </a>
        </p>
      </div>

      {showInfo && <StandingsInfoDialog onClose={() => setShowInfo(false)} />}
    </AppShell>
  );
}

/* =========================================================
   INFO DIALOG — explains the table's scope
   ========================================================= */

function StandingsInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="About this table"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/75"
      />

      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-ora-gold/20 bg-gradient-to-b from-ora-raised to-ora-card p-6">
        <div className="ora-nile-band absolute inset-x-0 top-0" aria-hidden="true" />

        <div className="mt-2 flex items-center gap-2.5">
          <span className="text-2xl leading-none">🇪🇬</span>
          <h3 className="text-2xl font-black leading-tight" style={displayFont}>
            Egypt&apos;s official table
          </h3>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ora-papyrus/70">
          This standings table tracks real results from the Egyptian Premier
          League, club by club. It has nothing to do with your fantasy
          points, it&apos;s the actual football table.
        </p>

        <p className="mt-3 text-sm leading-relaxed text-ora-papyrus/70">
          Want a ranking based on fantasy points instead, just between you
          and your friends? Create a private league and compete there.
        </p>

        <div className="mt-6 flex gap-2">
          <a
            href="/leagues"
            className={`flex-1 rounded-full bg-gradient-to-b from-ora-gold-light to-ora-gold px-4 py-2.5 text-center text-sm font-bold text-ora-night ${focusRing}`}
          >
            Go to Leagues
          </a>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full border border-white/[0.12] px-4 py-2.5 text-sm font-bold text-ora-papyrus/70 ${focusRing}`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}