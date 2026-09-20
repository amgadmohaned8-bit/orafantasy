"use client";

import Shirt from "../fantasy/Shirt";
import {
  BENCH_SLOTS,
  FORMATION,
  type Player,
  type PlayerPoints,
  type Position,
} from "../fantasy/types";
import { Icon } from "./AppShell";

const ring =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ora-gold";

type SlotHandler = (
  slotKey: string,
  position: Position,
  player: Player | undefined,
) => void;

type SquadViewProps = {
  slots: Record<string, string>;
  byId: Map<string, Player>;
  points: Record<string, PlayerPoints>;
  onSlot: SlotHandler;
};

/* =========================================================
   ONE SLOT
   ========================================================= */

function SlotButton({
  slotKey,
  position,
  player,
  pts,
  compact,
  onSlot,
}: {
  slotKey: string;
  position: Position;
  player: Player | undefined;
  pts: number;
  compact?: boolean;
  onSlot: SlotHandler;
}) {
  if (!player) {
    return (
      <button
        type="button"
        onClick={() => onSlot(slotKey, position, undefined)}
        aria-label={`Add ${position}`}
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
          {position}
        </span>
      </button>
    );
  }

  const lastName = player.name.split(" ").slice(-1)[0];

  return (
    <button
      type="button"
      onClick={() => onSlot(slotKey, position, player)}
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
   ========================================================= */

export function SquadPitch({ slots, byId, points, onSlot }: SquadViewProps) {
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
        {FORMATION.map((row) => (
          <div
            key={row.key}
            className="mx-auto flex w-full max-w-[460px] items-start justify-evenly"
          >
            {Array.from({ length: row.count }, (_, index) => {
              const slotKey = `${row.key}-${index}`;
              const player = byId.get(slots[slotKey]);

              return (
                <SlotButton
                  key={slotKey}
                  slotKey={slotKey}
                  position={row.label}
                  player={player}
                  pts={player ? (points[player.id]?.gw ?? 0) : 0}
                  onSlot={onSlot}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   BENCH
   ========================================================= */

export function SquadBench({ slots, byId, points, onSlot }: SquadViewProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 pb-4 pt-3.5">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm font-semibold">Bench</p>

        <p className="text-xs text-ora-papyrus/50">
          {BENCH_SLOTS.length} substitutes. Bench players don&apos;t score.
        </p>
      </div>

      <div className="mx-auto mt-3 flex max-w-[460px] items-start justify-between gap-1">
        {BENCH_SLOTS.map((slot) => {
          const player = byId.get(slots[slot.key]);

          return (
            <SlotButton
              key={slot.key}
              slotKey={slot.key}
              position={slot.pos}
              player={player}
              pts={player ? (points[player.id]?.gw ?? 0) : 0}
              compact
              onSlot={onSlot}
            />
          );
        })}
      </div>
    </div>
  );
}
