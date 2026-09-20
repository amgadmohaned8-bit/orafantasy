import type { ReactNode } from "react";
import Link from "next/link";
import {
  formatKickoff,
  formatShortDate,
  getMatchState,
  type Match,
  type Team,
} from "../lib/fixtures";

const ring =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ora-gold";

/* =========================================================
   MATCH CARD
   Pass `href` to make the whole card a link (used for the
   match details page).
   ========================================================= */

export function MatchCard({
  match,
  showMeta = true,
  href,
}: {
  match: Match;
  showMeta?: boolean;
  href?: string;
}) {
  const state = getMatchState(match);
  const started = state !== "upcoming";
  const detail = match.displayStatus || match.status || "";

  const card = (
    <article
      className={`rounded-xl border px-3.5 py-3 ${
        state === "live"
          ? "border-ora-nile/30 bg-ora-nile/5"
          : "border-white/5 bg-white/[0.03]"
      }`}
    >
      {showMeta && (
        <div className="mb-2.5 flex items-center justify-between gap-3 text-xs text-ora-papyrus/50">
          <span>{formatShortDate(match.date)}</span>

          {match.gameweek ? <span>Gameweek {match.gameweek}</span> : null}
        </div>
      )}

      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <TeamRow
            team={match.home}
            score={started ? match.home.score : undefined}
          />

          <TeamRow
            team={match.away}
            score={started ? match.away.score : undefined}
          />
        </div>

        <div className="flex w-[72px] shrink-0 flex-col items-center justify-center border-l border-white/5 pl-3 text-center">
          {state === "live" ? (
            <>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ora-nile">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ora-nile motion-reduce:animate-none" />
                Live
              </span>

              {detail && detail.toLowerCase() !== "live" && (
                <span className="mt-0.5 text-xs text-ora-papyrus/50">
                  {detail}
                </span>
              )}
            </>
          ) : state === "finished" ? (
            <span className="text-xs font-medium text-ora-papyrus/50">
              Full time
            </span>
          ) : (
            <>
              <span className="text-sm font-semibold tabular-nums">
                {formatKickoff(match.kickoff)}
              </span>

              <span className="mt-0.5 text-xs text-ora-papyrus/40">
                Kickoff
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );

  if (!href) {
    return card;
  }

  return (
    <Link
      href={href}
      className={`block rounded-xl transition-transform hover:-translate-y-px ${ring}`}
    >
      {card}
    </Link>
  );
}

/* =========================================================
   TEAM ROW + BADGE
   ========================================================= */

export function TeamBadge({
  team,
  size = "md",
}: {
  team: { name: string; logo?: string };
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const img = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/5`}
    >
      {team.logo ? (
        <img
          src={team.logo}
          alt=""
          className={`${img} object-contain`}
          loading="lazy"
        />
      ) : (
        <span className="text-[10px] font-semibold text-ora-papyrus/50">
          {team.name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function TeamRow({ team, score }: { team: Team; score?: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <TeamBadge team={team} />

      <p className="min-w-0 flex-1 truncate text-sm font-medium">{team.name}</p>

      {score !== undefined && (
        <span className="shrink-0 text-base font-semibold tabular-nums">
          {score}
        </span>
      )}
    </div>
  );
}

/* =========================================================
   STATES
   ========================================================= */

export function StateMessage({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div className="max-w-[300px] text-center">
        <p className="text-base font-semibold">{title}</p>

        <p className="mt-2 text-sm leading-relaxed text-ora-papyrus/55">
          {text}
        </p>

        {action}
      </div>
    </div>
  );
}

export function MatchesLoading() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading fixtures">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="h-[88px] animate-pulse rounded-xl border border-white/5 bg-white/[0.03] motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

export function MatchesError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <StateMessage
      title="Fixtures couldn't load"
      text={message}
      action={
        <button
          type="button"
          onClick={onRetry}
          className={`mt-4 rounded-full border border-ora-gold/40 px-5 py-2 text-sm font-semibold text-ora-gold-light transition-colors hover:bg-ora-gold/10 ${ring}`}
        >
          Try again
        </button>
      }
    />
  );
}
