"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../src/firebase";
import AppShell, {
  Cartouche,
  displayFont,
  focusRing,
  useProfile,
} from "../../src/components/AppShell";
import {
  MatchCard,
  MatchesError,
  MatchesLoading,
  StateMessage,
} from "../../src/components/MatchCard";
import {
  SquadBench,
  SquadPitch,
} from "../../src/components/SquadPitch";
import {
  BUDGET,
  DEFAULT_FORMATION,
  SQUAD_SIZE,
  type Formation,
  type Player,
  type PlayerPoints,
  type SquadDoc,
} from "../../src/fantasy/types";
import {
  getCurrentGameweek,
  getMatchState,
  getMatchTimestamp,
} from "../../src/lib/fixtures";
import { useFixtures } from "../../src/lib/useFixtures";

type Fixtures = ReturnType<typeof useFixtures>;

const money = (value: number) => `${value.toFixed(1)}M`;

/* A player "played" this gameweek if their breakdown has anything in
   it — calcPoints only ever returns an empty breakdown when minutes
   were zero. Used to decide whether the captain armband should fall
   back to the vice-captain. */
const didPlay = (pts?: PlayerPoints) => !!pts && pts.breakdown.length > 0;

/* Points refresh cadence while a match is live. Matches the API route's
   own 60s cache for the current gameweek, so polling faster is wasted. */
const LIVE_POLL_MS = 60_000;

export default function DashboardPage() {
  const fixtures = useFixtures();

  const hasLive = useMemo(
    () => fixtures.matches.some((match) => getMatchState(match) === "live"),
    [fixtures.matches],
  );

  return (
    <AppShell
      title="Home"
      subtitle={`${fixtures.leagueName}, season ${fixtures.season}`}
      liveNow={hasLive}
    >
      <DashboardContent fixtures={fixtures} hasLive={hasLive} />
    </AppShell>
  );
}

function DashboardContent({
  fixtures,
  hasLive,
}: {
  fixtures: Fixtures;
  hasLive: boolean;
}) {
  const router = useRouter();
  const profile = useProfile();
  const uid = profile.uid;

  /* ---------- saved squad + players + points ---------- */

  const [slots, setSlots] = useState<Record<string, string>>({});
  const [formation, setFormation] = useState<Formation>(DEFAULT_FORMATION);
  const [starterIds, setStarterIds] = useState<string[]>([]);
  const [captain, setCaptain] = useState<string | null>(null);
  const [viceCaptain, setViceCaptain] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [activeChipGw, setActiveChipGw] = useState<number | null>(null);
  const [hasTeam, setHasTeam] = useState(false);
  const [squadLoading, setSquadLoading] = useState(true);

  const [players, setPlayers] = useState<Player[]>([]);
  const [playersReady, setPlayersReady] = useState(false);

  const [points, setPoints] = useState<Record<string, PlayerPoints>>({});
  const [pointsGw, setPointsGw] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "squads", uid));

        if (cancelled) return;

        if (snap.exists()) {
          const data = snap.data() as Partial<SquadDoc>;

          setSlots(data.slots || {});
          setFormation(data.formation ?? DEFAULT_FORMATION);
          setStarterIds(Array.isArray(data.starters) ? data.starters : []);
          setCaptain(data.captain ?? null);
          setViceCaptain(data.viceCaptain ?? null);
          setActiveChip(data.activeChip ?? null);
          setActiveChipGw(data.activeChipGw ?? null);
          setHasTeam(true);
        }
      } catch (error) {
        console.error("Home squad load error:", error);
      } finally {
        if (!cancelled) setSquadLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  /* Players load once — the roster doesn't change mid-session. */
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/players", { signal: controller.signal });
        const json = await res.json();

        if (res.ok && !json.error) {
          setPlayers(json.players as Player[]);
          setPlayersReady(true);
        }
      } catch {
        /* the pitch stays without names until the next visit */
      }
    })();

    return () => controller.abort();
  }, []);

  /* Points load once on mount, then poll every LIVE_POLL_MS while a
     match in the current gameweek is live, so scores update without a
     manual refresh. Polling stops as soon as nothing is live. */
  useEffect(() => {
    const controller = new AbortController();

    const loadPoints = async () => {
      try {
        const res = await fetch("/api/football/points", {
          signal: controller.signal,
        });
        const json = await res.json();

        if (res.ok && !json.error) {
          setPoints(json.players || {});
          setPointsGw(json.gw || undefined);
        }
      } catch {
        /* points stay at their last known value until the next tick */
      }
    };

    loadPoints();

    if (!hasLive) {
      return () => controller.abort();
    }

    const interval = setInterval(loadPoints, LIVE_POLL_MS);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [hasLive]);

  const byId = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  const filled = Object.keys(slots).length;

  const spent = Object.values(slots).reduce(
    (total, id) => total + (byId.get(id)?.price ?? 0),
    0,
  );

  const starters = starterIds
    .map((id) => byId.get(id))
    .filter((player): player is Player => Boolean(player));

  const bench = Object.values(slots)
    .filter((id) => !starterIds.includes(id))
    .map((id) => byId.get(id))
    .filter((player): player is Player => Boolean(player));

  const gw = pointsGw ?? 1;

  const isTripleCaptainActive = activeChip === "tripleCaptain" && activeChipGw === gw;
  const isBenchBoostActive = activeChip === "benchBoost" && activeChipGw === gw;
  const captainMultiplier = isTripleCaptainActive ? 3 : 2;

  const captainPlayed = didPlay(captain ? points[captain] : undefined);
  const vicePlayed = didPlay(viceCaptain ? points[viceCaptain] : undefined);
  const effectiveCaptainId = captainPlayed ? captain : vicePlayed ? viceCaptain : null;

  const gwPointsBase = starters.reduce(
    (total, player) => total + (points[player.id]?.gw ?? 0),
    0,
  );

  const captainBonus = effectiveCaptainId
    ? (points[effectiveCaptainId]?.gw ?? 0) * (captainMultiplier - 1)
    : 0;

  const benchBonus = isBenchBoostActive
    ? bench.reduce((total, player) => total + (points[player.id]?.gw ?? 0), 0)
    : 0;

  const gwPoints = gwPointsBase + captainBonus + benchBonus;

  const totalPoints = starters.reduce(
    (total, player) => total + (points[player.id]?.total ?? 0),
    0,
  );

  const budgetText =
    playersReady || filled === 0 ? money(BUDGET - spent) : "-";

  /* ---------- fixtures ---------- */

  const currentGameweek = useMemo(
    () => getCurrentGameweek(fixtures.matches),
    [fixtures.matches],
  );

  const gameweekMatches = useMemo(() => {
    if (currentGameweek === undefined) {
      return [];
    }

    return fixtures.matches
      .filter((match) => match.gameweek === currentGameweek)
      .sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b));
  }, [fixtures.matches, currentGameweek]);

  const pointsLabel = pointsGw ?? currentGameweek;

  const openSquad = () => router.push("/squad");

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* MY TEAM */}
      <section className="overflow-hidden rounded-2xl border border-ora-gold/20 bg-gradient-to-b from-ora-raised to-ora-card shadow-[0_30px_70px_-40px_rgba(0,0,0,0.9)]">
        <div className="ora-nile-band" aria-hidden="true" />

        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1
                className="break-words text-[30px] font-black leading-tight tracking-wide"
                style={displayFont}
              >
                {profile.teamName || "Build your team"}
              </h1>

              <p className="mt-1 text-sm text-ora-papyrus/60">
                {profile.coachName
                  ? `Coach ${profile.coachName}`
                  : "Name your team, then pick your 15-player squad."}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {currentGameweek !== undefined && (
                <Cartouche>Gameweek {currentGameweek}</Cartouche>
              )}

              <Link
                href="/squad"
                className={`inline-flex items-center justify-center rounded-full bg-gradient-to-b from-ora-gold-light to-ora-gold px-5 py-2 text-sm font-semibold text-ora-night transition hover:brightness-105 ${focusRing}`}
              >
                {hasTeam ? "Edit my team" : "Create your team"}
              </Link>
            </div>
          </div>

          <div className="mt-6">
            {squadLoading ? (
              <div
                className="min-h-[400px] animate-pulse rounded-xl border border-white/5 bg-white/[0.03] motion-reduce:animate-none"
                aria-busy="true"
                aria-label="Loading your squad"
              />
            ) : (
              <SquadPitch
                formation={formation}
                starters={starters}
                points={points}
                onOpen={openSquad}
              />
            )}
          </div>

          {!squadLoading && (
            <div className="mt-3">
              <SquadBench bench={bench} points={points} onOpen={openSquad} />
            </div>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-y-5 border-t border-white/5 pt-5 sm:grid-cols-4 sm:gap-y-0">
            <Stat label="Squad" value={`${filled} / ${SQUAD_SIZE}`} />
            <Stat
              label={
                pointsLabel !== undefined
                  ? `Gameweek ${pointsLabel} points`
                  : "Gameweek points"
              }
              value={String(gwPoints)}
            />
            <Stat label="Season points" value={String(totalPoints)} />
            <Stat label="Budget left" value={budgetText} />
          </dl>
        </div>
      </section>

      {/* CURRENT GAMEWEEK */}
      <section className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-2xl border border-ora-gold/15 bg-ora-card">
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2
              className="text-[26px] font-black leading-none tracking-wide"
              style={displayFont}
            >
              {currentGameweek !== undefined
                ? `Gameweek ${currentGameweek}`
                : "Fixtures"}
            </h2>

            <p className="mt-1.5 truncate text-sm text-ora-papyrus/50">
              {fixtures.leagueName}
            </p>
          </div>

          <Link
            href="/matches"
            className={`shrink-0 rounded-full border border-ora-gold/30 px-3.5 py-1.5 text-xs font-semibold text-ora-gold-light transition-colors hover:bg-ora-gold/10 ${focusRing}`}
          >
            All matches
          </Link>
        </div>

        <div className="relative min-h-[300px] flex-1">
          <div className="max-h-[520px] overflow-y-auto px-5 pb-5 [scrollbar-color:#ffffff1f_transparent] [scrollbar-width:thin] xl:absolute xl:inset-0 xl:max-h-none">
            {fixtures.loading ? (
              <MatchesLoading />
            ) : fixtures.error ? (
              <MatchesError
                message={fixtures.error}
                onRetry={fixtures.reload}
              />
            ) : gameweekMatches.length === 0 ? (
              <StateMessage
                title="No matches yet"
                text="Fixtures will show up here as soon as the league publishes them."
              />
            ) : (
              <div className="space-y-2.5">
                {gameweekMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* =========================================================
   STAT
   ========================================================= */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-white/5 pl-4 first:pl-0 sm:pl-6 sm:first:pl-0 sm:[&:not(:first-child)]:border-l">
      <dt className="text-xs text-ora-papyrus/50">{label}</dt>

      <dd
        className="mt-1 text-[28px] font-semibold leading-none tabular-nums"
        style={displayFont}
      >
        {value}
      </dd>
    </div>
  );
}