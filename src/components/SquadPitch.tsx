"use client";

import Shirt from "../fantasy/Shirt";
import {
  FORMATIONS,
  type Formation,
  type Player,
  type PlayerPoints,
  type Position,
} from "../fantasy/types";
import { Icon } from "./AppShell";

const ring =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ora-gold";

const BENCH_SIZE = 4;

/* =========================================================
   ONE SLOT
   Read-only preview tile: filled or empty, both just open
   the squad editor when tapped.
   ========================================================= */

function SlotButton({
  player,
  pts,
  emptyLabel,
  compact,
  onOpen,
}: {
  player: Player | undefined;
  pts: number;
  emptyLabel: string;
  compact?: boolean;
  onOpen: () => void;
}) {
  if (!player) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Add ${emptyLabel}`}
        className={`group flex w-[72px] flex-col items-center gap-1.5 rounded-lg ${ring}`}
      >
        <span
          className={`flex items-center justify-center rounded-full border border-ora-gold/45 bg-ora-gold/10 text-ora-gold-light transition-colors group-hover:border-ora-gold group-hover:bg-ora-gold/20 ${
            compact ? "h-10 w-10" : "h-12 w-12"
          }`}
        >
          <Icon name="plus" className="h-5 w-5" />
        </span>

        <span className="text-[11px] font-semibold text-ora-papyrus/60">
          {emptyLabel}
        </span>
      </button>
    );
  }

  const lastName = player.name.split(" ").slice(-1)[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${player.name}, ${player.teamName}`}
      className={`flex w-[72px] flex-col items-center rounded-lg ${ring}`}
    >
      <Shirt
        team={player.teamName}
        number={player.number}
        className={compact ? "h-10 w-10" : "h-12 w-12"}
      />

      <span className="mt-1 w-full truncate rounded-t bg-black/60 px-1.5 py-0.5 text-center text-[11px] font-semibold">
        {lastName}
      </span>

      <span className="w-full rounded-b bg-ora-gold px-1.5 text-center text-[11px] font-semibold tabular-nums text-ora-night">
        {pts} pts
      </span>
    </button>
  );
}

/* =========================================================
   PITCH (starting eleven)
   Shape follows the chosen formation. `starters` only needs
   to contain the players that are actually starting — any
   position short of the formation's count is drawn as an
   empty slot.
   ========================================================= */

export function SquadPitch({
  formation,
  starters,
  points,
  onOpen,
}: {
  formation: Formation;
  starters: Player[];
  points: Record<string, PlayerPoints>;
  onOpen: () => void;
}) {
  const need = { GK: 1, ...FORMATIONS[formation] };

  const rows: { pos: Position; count: number }[] = [
    { pos: "FWD", count: need.FWD },
    { pos: "MID", count: need.MID },
    { pos: "DEF", count: need.DEF },
    { pos: "GK", count: need.GK },
  ];

  const byPos: Record<Position, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  starters.forEach((p) => byPos[p.position].push(p));

  return (
    <div
      className="relative min-h-[400px] overflow-hidden rounded-xl border border-ora-gold/15 bg-ora-pitch shadow-[inset_0_0_70px_rgba(0,0,0,0.5)]"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, rgba(255,255,255,0.025) 0 44px, transparent 44px 88px)",
      }}
    >
      {/* pitch markings */}
      <div
        className="pointer-events-none absolute inset-3 overflow-hidden rounded-md border border-ora-papyrus/15"
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-0 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ora-papyrus/15" />

        <div className="absolute bottom-0 left-1/2 h-[17%] w-[56%] -translate-x-1/2 border border-b-0 border-ora-papyrus/15" />

        <div className="absolute bottom-0 left-1/2 h-[7%] w-[26%] -translate-x-1/2 border border-b-0 border-ora-papyrus/15" />
      </div>

      <div className="relative flex min-h-[400px] flex-col justify-between px-3 py-6">
        {rows.map((row) => {
          const rowPlayers = byPos[row.pos].slice(0, row.count);
          const missing = Math.max(row.count - rowPlayers.length, 0);

          return (
            <div
              key={row.pos}
              className="mx-auto flex w-full max-w-[460px] items-start justify-evenly"
            >
              {rowPlayers.map((player) => (
                <SlotButton
                  key={player.id}
                  player={player}
                  pts={points[player.id]?.gw ?? 0}
                  emptyLabel={row.pos}
                  onOpen={onOpen}
                />
              ))}

              {Array.from({ length: missing }, (_, index) => (
                <SlotButton
                  key={`empty-${row.pos}-${index}`}
                  player={undefined}
                  pts={0}
                  emptyLabel={row.pos}
                  onOpen={onOpen}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   BENCH
   Always 4 reserves: whatever's left over from the 15-player
   pool once the starting XI is set.
   ========================================================= */

export function SquadBench({
  bench,
  points,
  onOpen,
}: {
  bench: Player[];
  points: Record<string, PlayerPoints>;
  onOpen: () => void;
}) {
  const shown = bench.slice(0, BENCH_SIZE);
  const missing = Math.max(BENCH_SIZE - shown.length, 0);

  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 pb-4 pt-3.5">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm font-semibold">Bench</p>

        <p className="text-xs text-ora-papyrus/50">
          {BENCH_SIZE} substitutes. Bench players don&apos;t score.
        </p>
      </div>

      <div className="mx-auto mt-3 flex max-w-[460px] items-start justify-between gap-1">
        {shown.map((player) => (
          <SlotButton
            key={player.id}
            player={player}
            pts={points[player.id]?.gw ?? 0}
            emptyLabel="Sub"
            compact
            onOpen={onOpen}
          />
        ))}

        {Array.from({ length: missing }, (_, index) => (
          <SlotButton
            key={`empty-bench-${index}`}
            player={undefined}
            pts={0}
            emptyLabel="Sub"
            compact
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}