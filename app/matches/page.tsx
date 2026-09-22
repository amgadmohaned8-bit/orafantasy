"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell, {
  Cartouche,
  displayFont,
  focusRing,
  Icon,
} from "@/src/components/AppShell";
import { TeamBadge, StateMessage } from "@/src/components/MatchCard";

/* =========================================================
   TYPES
   Mirrors /api/football/match-details.
   ========================================================= */

type TeamInfo = { id: string; name: string; logo?: string; score: string };

type Player = {
  id: string;
  name: string;
  image?: string;
  number?: string;
  position?: string;
};

type MatchEvent = {
  minute: string;
  type: "goal" | "own_goal" | "yellow_card" | "red_card" | "substitution";
  side: "home" | "away";
  player: Player | null;
  assist: Player | null;
};

type LineupSide = {
  starting: Player[];
  subs: Player[];
  coach: { name: string } | null;
};

type MatchDetails = {
  success: boolean;
  message?: string;
  minute: string | null;
  is_live: boolean;
  header: {
    home: TeamInfo;
    away: TeamInfo;
    status: { display: string; state: string };
  };
  events: MatchEvent[];
  stats: { label: string; home: string; away: string }[];
  venue: { name: string } | null;
  referee: string | null;
  lineups: {
    home: LineupSide;
    away: LineupSide;
    formation: { home: string; away: string };
    is_projected: boolean;
  } | null;
};

/* =========================================================
   PAGE
   ========================================================= */

export default function MatchPage() {
  const params = useParams();
  const matchId = params?.id as string;

  const [data, setData] = useState<MatchDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"events" | "lineups" | "stats">("events");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/football/match-details?match_id=${matchId}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as MatchDetails;

      if (!json.success) {
        setError(json.message || "This match couldn't be loaded.");
        return;
      }

      setData(json);
      setError(null);
    } catch {
      setError("This match couldn't be loaded.");
    }
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!data?.is_live) return;
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [data?.is_live, load]);

  const title = data
    ? `${data.header.home.name} vs ${data.header.away.name}`
    : "Match";

  return (
    <AppShell title={title} liveNow={Boolean(data?.is_live)}>
      <div className="mx-auto max-w-[760px]">
        <Link
          href="/matches"
          className={`inline-flex items-center gap-1.5 rounded-lg text-sm text-ora-papyrus/50 transition-colors hover:text-ora-papyrus ${focusRing}`}
        >
          ← Back to matches
        </Link>

        <div className="mt-4">
          {error ? (
            <StateMessage title="Match couldn't load" text={error} />
          ) : !data ? (
            <MatchHeaderSkeleton />
          ) : (
            <>
              <MatchHeader data={data} />

              <Tabs tab={tab} onChange={setTab} />

              <div className="mt-5">
                {tab === "events" && <Events events={data.events} />}
                {tab === "lineups" && <Lineups lineups={data.lineups} />}
                {tab === "stats" && <Stats stats={data.stats} />}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* =========================================================
   HEADER
   ========================================================= */

function MatchHeader({ data }: { data: MatchDetails }) {
  const { header } = data;
  const started = header.status.state !== "upcoming";

  return (
    <div
      className={`rounded-xl border px-5 py-6 ${
        data.is_live
          ? "border-ora-nile/30 bg-ora-nile/5"
          : "border-white/5 bg-white/[0.03]"
      }`}
    >
      {data.is_live && (
        <div className="mb-4 flex justify-center">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ora-nile">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ora-nile motion-reduce:animate-none" />
            Live · {data.minute}&apos;
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 items-center gap-2">
        <TeamColumn team={header.home} align="right" />

        <div className="text-center">
          <p
            className="text-[32px] font-semibold leading-none tabular-nums"
            style={displayFont}
          >
            {started ? `${header.home.score} – ${header.away.score}` : "vs"}
          </p>

          {!data.is_live && (
            <p className="mt-2 text-xs text-ora-papyrus/50">
              {header.status.display || header.status.state}
            </p>
          )}
        </div>

        <TeamColumn team={header.away} align="left" />
      </div>

      {(data.venue || data.referee) && (
        <div className="mt-5 flex justify-center gap-4 border-t border-white/5 pt-4 text-xs text-ora-papyrus/40">
          {data.venue && <span>{data.venue.name}</span>}
          {data.referee && <span>Referee: {data.referee}</span>}
        </div>
      )}
    </div>
  );
}

function TeamColumn({ team, align }: { team: TeamInfo; align: "left" | "right" }) {
  return (
    <div
      className={`flex flex-col items-center gap-2 ${
        align === "right" ? "items-end sm:items-center" : "items-start sm:items-center"
      }`}
    >
      <TeamBadge team={team} size="md" />
      <p className="max-w-[100px] truncate text-center text-sm font-medium">
        {team.name}
      </p>
    </div>
  );
}

function MatchHeaderSkeleton() {
  return (
    <div className="h-[160px] animate-pulse rounded-xl border border-white/5 bg-white/[0.03] motion-reduce:animate-none" />
  );
}

/* =========================================================
   TABS
   ========================================================= */

function Tabs({
  tab,
  onChange,
}: {
  tab: "events" | "lineups" | "stats";
  onChange: (tab: "events" | "lineups" | "stats") => void;
}) {
  const options: { key: "events" | "lineups" | "stats"; label: string }[] = [
    { key: "events", label: "Events" },
    { key: "lineups", label: "Lineups" },
    { key: "stats", label: "Stats" },
  ];

  return (
    <div className="mt-5 flex gap-1.5" role="tablist" aria-label="Match view">
      {options.map((opt) => {
        const active = tab === opt.key;

        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${focusRing} ${
              active
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

/* =========================================================
   EVENTS
   ========================================================= */

function Events({ events }: { events: MatchEvent[] }) {
  if (events.length === 0) {
    return (
      <StateMessage
        title="No events yet"
        text="Goals and cards will show up here once the match kicks off."
      />
    );
  }

  return (
    <ol className="space-y-2.5">
      {events.map((event, index) => (
        <li
          key={index}
          className={`flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3 ${
            event.side === "away" ? "flex-row-reverse text-right" : ""
          }`}
        >
          <span className="w-9 shrink-0 text-xs font-medium text-ora-papyrus/40 tabular-nums">
            {event.minute}&apos;
          </span>

          <span className="text-lg leading-none">{eventIcon(event.type)}</span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {event.player?.name ?? "—"}
            </p>

            {event.assist && (
              <p className="truncate text-xs text-ora-papyrus/50">
                Assist: {event.assist.name}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function eventIcon(type: MatchEvent["type"]) {
  switch (type) {
    case "goal":
      return "⚽";
    case "own_goal":
      return "⚽️➖";
    case "yellow_card":
      return "🟨";
    case "red_card":
      return "🟥";
    case "substitution":
      return "⇄";
    default:
      return "•";
  }
}

/* =========================================================
   LINEUPS
   ========================================================= */

function Lineups({ lineups }: { lineups: MatchDetails["lineups"] }) {
  // The provider can send an empty {} before the lineup is published, so
  // don't trust truthiness alone — check the actual starting XIs exist.
  const ready =
    lineups &&
    Array.isArray(lineups.home?.starting) &&
    lineups.home.starting.length > 0 &&
    Array.isArray(lineups.away?.starting) &&
    lineups.away.starting.length > 0;

  if (!ready) {
    return (
      <StateMessage
        title="Lineups aren't out yet"
        text="They usually land about an hour before kickoff."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-center">
        <Cartouche>
          {lineups!.is_projected ? "Predicted lineup" : "Confirmed lineup"}
        </Cartouche>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <LineupColumn side={lineups!.home} formation={lineups!.formation?.home ?? "—"} />
        <LineupColumn side={lineups!.away} formation={lineups!.formation?.away ?? "—"} />
      </div>
    </div>
  );
}

function LineupColumn({
  side,
  formation,
}: {
  side: LineupSide;
  formation: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-ora-gold-light">
          {formation}
        </span>
        {side.coach && (
          <span className="truncate text-xs text-ora-papyrus/40">
            {side.coach.name}
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {side.starting.map((player) => (
          <li key={player.id} className="flex items-center gap-2 text-sm">
            <span className="w-5 shrink-0 text-ora-papyrus/40 tabular-nums">
              {player.number}
            </span>
            <span className="truncate">{player.name}</span>
          </li>
        ))}
      </ul>

      {side.subs.length > 0 && (
        <>
          <div className="my-3 h-px bg-white/5" />

          <ul className="space-y-1.5">
            {side.subs.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-2 text-xs text-ora-papyrus/50"
              >
                <span className="w-5 shrink-0 tabular-nums">
                  {player.number}
                </span>
                <span className="truncate">{player.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* =========================================================
   STATS
   ========================================================= */

function Stats({ stats }: { stats: { label: string; home: string; away: string }[] }) {
  if (stats.length === 0) {
    return (
      <StateMessage title="No stats yet" text="Match stats will appear here once available." />
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.03] p-4">
      {stats.map((stat) => (
        <div key={stat.label}>
          <div className="mb-1.5 flex items-center justify-between text-xs text-ora-papyrus/50">
            <span className="font-medium text-ora-papyrus">{stat.home}</span>
            <span>{stat.label}</span>
            <span className="font-medium text-ora-papyrus">{stat.away}</span>
          </div>

          <StatBar home={stat.home} away={stat.away} />
        </div>
      ))}
    </div>
  );
}

function StatBar({ home, away }: { home: string; away: string }) {
  const h = parseFloat(home) || 0;
  const a = parseFloat(away) || 0;
  const total = h + a || 1;
  const homePct = useMemo(() => (h / total) * 100, [h, total]);

  return (
    <div className="flex h-1 overflow-hidden rounded-full bg-white/5">
      <div className="bg-ora-gold" style={{ width: `${homePct}%` }} />
      <div className="flex-1 bg-white/10" />
    </div>
  );
}
