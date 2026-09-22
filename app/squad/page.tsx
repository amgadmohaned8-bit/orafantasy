"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Cinzel, Manrope } from "next/font/google";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../src/firebase";
import Shirt from "../../src/fantasy/Shirt";
import { getTeamStatus } from "../../src/fantasy/scoring";
import {
  ALL_SLOTS,
  BENCH_SLOTS,
  BUDGET,
  FORMATION,
  FREE_TRANSFERS,
  SQUAD_SIZE,
  STARTER_SLOTS,
  slotPosition,
  validatePick,
  type Player,
  type PlayerPoints,
  type Position,
  type SquadDoc,
} from "../../src/fantasy/types";

const display = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const displayFont = { fontFamily: "var(--font-display), Georgia, serif" } as const;

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a75a]";

const money = (value: number) => `${value.toFixed(1)}M`;

type SortKey = "price" | "points" | "name";

/* =========================================================
   PAGE
   ========================================================= */

export default function SquadPage() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [squad, setSquad] = useState<SquadDoc | null>(null);
  const [slots, setSlots] = useState<Record<string, string>>({});

  const [players, setPlayers] = useState<Player[]>([]);
  const [playersState, setPlayersState] = useState<"loading" | "ready" | "error">("loading");
  const [playersError, setPlayersError] = useState("");

  const [points, setPoints] = useState<Record<string, PlayerPoints>>({});
  const [gw, setGw] = useState(1);

  const [picker, setPicker] = useState<{ slot: string | null } | null>(null);
  const [detail, setDetail] = useState<{ player: Player; slot: string | null } | null>(null);

  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [coachName, setCoachName] = useState("");
  const [formError, setFormError] = useState("");

  /* ---------- auth + saved squad ---------- */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/");
        return;
      }

      setUid(user.uid);

      try {
        const snap = await getDoc(doc(db, "squads", user.uid));

        if (snap.exists()) {
          const data = snap.data() as SquadDoc;
          setSquad(data);
          setSlots(data.slots || {});
        }
      } catch (error) {
        console.error("Squad load error:", error);
        setLoadError("Your squad couldn't be loaded. Check your connection and refresh.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  /* ---------- players + points ---------- */

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/players", { signal: controller.signal });
        const json = await res.json();

        if (!res.ok || json.error) {
          throw new Error(json.error || `Players request failed (${res.status}).`);
        }

        setPlayers(json.players as Player[]);
        setPlayersState("ready");
      } catch (error) {
        if (controller.signal.aborted) return;

        setPlayersError(error instanceof Error ? error.message : "Players couldn't load.");
        setPlayersState("error");
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/football/points", { signal: controller.signal });
        const json = await res.json();

        if (res.ok && !json.error) {
          setPoints(json.players || {});
          setGw(json.gw || 1);
        }
      } catch {
        /* points stay at zero until the next visit */
      }
    })();

    return () => controller.abort();
  }, []);

  /* ---------- notices + Escape ---------- */

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(""), 4000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (detail) setDetail(null);
      else if (picker) setPicker(null);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [detail, picker]);

  /* ---------- derived data ---------- */

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const ready = playersState === "ready";

  const picked = useMemo(
    () =>
      Object.values(slots)
        .map((id) => byId.get(id))
        .filter((p): p is Player => Boolean(p)),
    [slots, byId],
  );

  const spent = picked.reduce((total, p) => total + p.price, 0);
  const budgetLeft = BUDGET - spent;
  const filled = Object.keys(slots).length;

  const starters = STARTER_SLOTS.map((s) => byId.get(slots[s.key])).filter(
    (p): p is Player => Boolean(p),
  );

  const gwPoints = starters.reduce((t, p) => t + (points[p.id]?.gw ?? 0), 0);
  const totalPoints = starters.reduce((t, p) => t + (points[p.id]?.total ?? 0), 0);

  const ranked = [...starters].sort(
    (a, b) => (points[b.id]?.gw ?? 0) - (points[a.id]?.gw ?? 0),
  );

  const highest = ranked[0];
  const lowest = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;

  const status = getTeamStatus(totalPoints, gw, filled === SQUAD_SIZE);

  const savedIds = new Set(Object.values(squad?.slots || {}));

  const pendingTransfers = squad?.complete
    ? Object.values(slots).filter((id) => !savedIds.has(id)).length
    : 0;

  const usedBefore = squad && squad.transfersGw === gw ? squad.transfersUsed : 0;
  const transfersUsed = usedBefore + pendingTransfers;

  const dirty =
    !!squad &&
    (Object.keys(slots).length !== Object.keys(squad.slots || {}).length ||
      Object.entries(slots).some(([k, id]) => squad.slots?.[k] !== id));

  /* ---------- actions ---------- */

  const createSquad = async () => {
    const team = teamName.trim();
    const coach = coachName.trim();

    if (team.length < 3 || team.length > 24) {
      setFormError("Team name must be between 3 and 24 characters.");
      return;
    }

    if (coach.length < 2 || coach.length > 24) {
      setFormError("Coach name must be between 2 and 24 characters.");
      return;
    }

    if (!uid) return;

    try {
      setSaving(true);
      setFormError("");

      const initial: SquadDoc = {
        teamName: team,
        coachName: coach,
        slots: {},
        complete: false,
        transfersUsed: 0,
        transfersGw: 0,
      };

      await setDoc(doc(db, "squads", uid), { ...initial, createdAt: serverTimestamp() });

      setSquad(initial);
      setSlots({});
    } catch (error) {
      console.error("Create squad error:", error);
      setFormError("We couldn't save your team. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveSquad = async () => {
    if (!uid || !squad || saving) return;

    try {
      setSaving(true);

      const next: SquadDoc = {
        ...squad,
        slots,
        complete: filled === SQUAD_SIZE,
        transfersUsed,
        transfersGw: gw,
      };

      await setDoc(doc(db, "squads", uid), { ...next, updatedAt: serverTimestamp() });

      setSquad(next);
      setNotice("Squad saved.");
    } catch (error) {
      console.error("Save squad error:", error);
      setNotice("Your squad couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const autoSlot = (player: Player) =>
    ALL_SLOTS.find((s) => s.pos === player.position && !slots[s.key])?.key ?? null;

  const addPlayer = (player: Player, slotKey: string | null) => {
    const key = slotKey ?? autoSlot(player);

    if (!key) {
      setNotice(`Your ${player.position} slots are full. Remove a player first.`);
      return false;
    }

    const error = validatePick(player, key, slots, byId);

    if (error) {
      setNotice(error);
      return false;
    }

    setSlots((current) => ({ ...current, [key]: player.id }));

    return true;
  };

  const removeFromSlot = (slotKey: string) => {
    setSlots((current) => {
      const next = { ...current };
      delete next[slotKey];
      return next;
    });
  };

  /* ---------- screens ---------- */

  const shell = `${display.variable} ${sans.variable} min-h-dvh bg-[#0d0c0a] text-[#f2ebdb]`;
  const shellStyle = { fontFamily: "var(--font-sans), system-ui, sans-serif" };

  if (loading) {
    return (
      <main className={`${shell} flex items-center justify-center`} style={shellStyle}>
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#c9a75a]/20 border-t-[#c9a75a] motion-reduce:animate-none" />
          <p className="mt-5 text-sm text-[#f2ebdb]/55">Loading your squad</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className={`${shell} flex items-center justify-center px-6`} style={shellStyle}>
        <p className="max-w-sm text-center text-sm text-[#f2ebdb]/70">{loadError}</p>
      </main>
    );
  }

  /* ----- step 1: name the team and the coach ----- */

  if (!squad) {
    return (
      <main
        className={`${shell} flex items-center justify-center px-4 py-10`}
        style={shellStyle}
      >
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#c9a75a]/[0.16] bg-gradient-to-b from-[#1c1911] to-[#131110] p-7 sm:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a75a]/70 to-transparent"
          />

          <Link
            href="/dashboard"
            className={`text-sm text-[#f2ebdb]/55 hover:text-[#f2ebdb] ${focusRing}`}
          >
            Back to dashboard
          </Link>

          <h1 className="mt-5 text-[40px] font-semibold leading-[1.05]" style={displayFont}>
            Create your team
          </h1>

          <p className="mt-3 text-[15px] leading-relaxed text-[#f2ebdb]/60">
            Pick a name for your team and your coach. You can build your squad next.
          </p>

          <div className="mt-7 space-y-5">
            <label className="block">
              <span className="text-sm font-medium">Choose your team name</span>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={24}
                placeholder="For example, Nile Kings"
                className={`mt-2 w-full rounded-xl border border-white/[0.1] bg-black/30 px-4 py-3 text-[15px] placeholder:text-[#f2ebdb]/30 ${focusRing}`}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Choose your coach name</span>
              <input
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                maxLength={24}
                placeholder="For example, Coach Hassan"
                className={`mt-2 w-full rounded-xl border border-white/[0.1] bg-black/30 px-4 py-3 text-[15px] placeholder:text-[#f2ebdb]/30 ${focusRing}`}
              />
            </label>
          </div>

          {formError && (
            <p role="alert" className="mt-4 text-sm text-red-300">
              {formError}
            </p>
          )}

          <button
            type="button"
            onClick={createSquad}
            disabled={saving}
            className={`mt-7 w-full rounded-full bg-gradient-to-b from-[#dcbf74] to-[#b8964a] px-6 py-3 text-sm font-semibold text-[#17130a] transition hover:from-[#e6cb85] hover:to-[#c4a155] disabled:opacity-50 ${focusRing}`}
          >
            {saving ? "Saving" : "Continue to squad"}
          </button>
        </div>
      </main>
    );
  }

  /* ----- step 2: the squad ----- */

  const renderSlot = (slotKey: string, position: Position, compact = false) => {
    const player = byId.get(slots[slotKey]);

    if (!player) {
      return (
        <button
          key={slotKey}
          type="button"
          onClick={() => setPicker({ slot: slotKey })}
          aria-label={`Add ${position}`}
          className={`group flex flex-col items-center gap-1.5 rounded-lg ${focusRing}`}
        >
          <span
            className={`flex items-center justify-center rounded-full border border-[#c9a75a]/45 bg-gradient-to-b from-[#c9a75a]/[0.16] to-[#c9a75a]/[0.03] text-xl text-[#e2c778] transition-colors group-hover:border-[#c9a75a] ${
              compact ? "h-11 w-11" : "h-14 w-14"
            }`}
          >
            +
          </span>
          <span className="text-[11px] font-semibold text-[#f2ebdb]/60">{position}</span>
        </button>
      );
    }

    return (
      <button
        key={slotKey}
        type="button"
        onClick={() => setDetail({ player, slot: slotKey })}
        aria-label={`${player.name}, ${player.teamName}`}
        className={`flex w-[76px] flex-col items-center rounded-lg ${focusRing}`}
      >
        <Shirt team={player.teamName} number={player.number} className={compact ? "h-11 w-11" : "h-14 w-14"} />

        <span className="mt-1 w-full truncate rounded bg-black/60 px-1.5 py-0.5 text-center text-[11px] font-semibold">
          {player.name.split(" ").slice(-1)[0]}
        </span>

        <span className="mt-0.5 w-full rounded-b bg-[#c9a75a] px-1.5 text-center text-[11px] font-semibold tabular-nums text-[#17130a]">
          {points[player.id]?.gw ?? 0} pts
        </span>
      </button>
    );
  };

  return (
    <main className={shell} style={shellStyle}>
      {/* TOP BAR */}

      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0a0908]/95 backdrop-blur">
        <div className="mx-auto max-w-[980px] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/dashboard"
              className={`shrink-0 text-sm text-[#f2ebdb]/55 hover:text-[#f2ebdb] ${focusRing}`}
            >
              Dashboard
            </Link>

            <div className="min-w-0 text-center">
              <p className="truncate text-2xl font-semibold leading-none" style={displayFont}>
                {squad.teamName}
              </p>
              <p className="mt-1 truncate text-xs text-[#f2ebdb]/50">Coach {squad.coachName}</p>
            </div>

            <button
              type="button"
              onClick={() => setPicker({ slot: null })}
              className={`shrink-0 rounded-full border border-[#c9a75a]/40 px-4 py-1.5 text-sm font-semibold text-[#e2c778] hover:bg-[#c9a75a]/10 ${focusRing}`}
            >
              Players
            </button>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <TopStat label="Budget" value={money(budgetLeft)} warn={budgetLeft < 0} />
            <TopStat label="Points" value={String(totalPoints)} />
            <TopStat label="Transfers" value={`${transfersUsed} used`} hint={`${FREE_TRANSFERS} free per gameweek`} />
            <TopStat label="Team status" value={status} />
          </dl>
        </div>
      </header>

      <div className="mx-auto max-w-[980px] px-4 pb-24 pt-6">
        {/* GAMEWEEK POINTS: lowest, total, highest */}

        <section aria-label={`Gameweek ${gw} points`} className="grid grid-cols-3 gap-2 sm:gap-3">
          <ExtremeCard title="Lowest" player={lowest} pts={lowest ? points[lowest.id]?.gw ?? 0 : 0} onOpen={(p) => setDetail({ player: p, slot: null })} />

          <div className="flex flex-col items-center justify-center rounded-xl border border-[#c9a75a]/30 bg-[#c9a75a]/[0.07] px-2 py-4 text-center">
            <p className="text-xs text-[#f2ebdb]/60">Gameweek {gw} points</p>
            <p className="mt-1 text-[52px] font-semibold leading-none tabular-nums text-[#e2c778]" style={displayFont}>
              {gwPoints}
            </p>
          </div>

          <ExtremeCard title="Highest" player={highest} pts={highest ? points[highest.id]?.gw ?? 0 : 0} onOpen={(p) => setDetail({ player: p, slot: null })} />
        </section>

        {/* PITCH */}

        {playersState === "error" && (
          <p role="alert" className="mt-5 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
            Players couldn&apos;t load: {playersError}
          </p>
        )}

        <div
          className="relative mt-5 overflow-hidden rounded-xl border border-white/[0.07] bg-[#0f150e] shadow-[inset_0_0_80px_rgba(0,0,0,0.55)]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.024) 0 48px, transparent 48px 96px)",
          }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-md border border-[#f2ebdb]/[0.14]">
            <div className="absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f2ebdb]/[0.14]" />
            <div className="absolute bottom-0 left-1/2 h-[17%] w-[56%] -translate-x-1/2 border border-b-0 border-[#f2ebdb]/[0.14]" />
          </div>

          <div className="relative flex min-h-[520px] flex-col justify-between px-3 py-8">
            {FORMATION.map((row) => (
              <div key={row.key} className="mx-auto flex w-full max-w-[520px] items-start justify-evenly">
                {Array.from({ length: row.count }, (_, i) => renderSlot(`${row.key}-${i}`, row.label))}
              </div>
            ))}
          </div>
        </div>

        {/* BENCH */}

        <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/30 px-3 pb-4 pt-3.5">
          <p className="text-sm font-semibold">Bench</p>
          <div className="mx-auto mt-3 flex max-w-[520px] items-start justify-between gap-1">
            {BENCH_SLOTS.map((s) => renderSlot(s.key, s.pos, true))}
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-[#f2ebdb]/45">
          {filled} of {SQUAD_SIZE} players picked. Max 3 from one club. Only starters score points.
        </p>
      </div>

      {/* SAVE BAR */}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-[#0a0908]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[980px] items-center justify-between gap-3">
          <p className="text-sm text-[#f2ebdb]/60">
            {dirty ? "You have unsaved changes." : "All changes saved."}
          </p>
          <button
            type="button"
            onClick={saveSquad}
            disabled={!dirty || saving || !ready}
            className={`rounded-full bg-gradient-to-b from-[#dcbf74] to-[#b8964a] px-6 py-2.5 text-sm font-semibold text-[#17130a] disabled:opacity-40 ${focusRing}`}
          >
            {saving ? "Saving" : "Save squad"}
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md rounded-xl border border-[#c9a75a]/30 bg-[#1c1911] px-4 py-3 text-center text-sm shadow-2xl">
          {notice}
        </div>
      )}

      {/* PLAYER PICKER */}

      {picker && (
        <PlayerPicker
          slot={picker.slot}
          players={players}
          state={playersState}
          error={playersError}
          points={points}
          slots={slots}
          byId={byId}
          onClose={() => setPicker(null)}
          onOpen={(player) => setDetail({ player, slot: picker.slot })}
          onAdd={(player) => {
            if (addPlayer(player, picker.slot) && picker.slot) setPicker(null);
          }}
        />
      )}

      {/* PLAYER DETAIL */}

      {detail && (
        <PlayerDetail
          player={detail.player}
          pts={points[detail.player.id]}
          gw={gw}
          inSquad={Object.values(slots).includes(detail.player.id)}
          onClose={() => setDetail(null)}
          onAdd={() => {
            if (addPlayer(detail.player, detail.slot)) {
              setDetail(null);
              setPicker(null);
            }
          }}
          onRemove={() => {
            const key = Object.entries(slots).find(([, id]) => id === detail.player.id)?.[0];
            if (key) removeFromSlot(key);
            setDetail(null);
          }}
          onReplace={
            detail.slot
              ? () => {
                  setPicker({ slot: detail.slot });
                  setDetail(null);
                }
              : undefined
          }
        />
      )}
    </main>
  );
}

/* =========================================================
   SMALL PIECES
   ========================================================= */

function TopStat({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2" title={hint}>
      <dt className="text-xs text-[#f2ebdb]/50">{label}</dt>
      <dd className={`mt-0.5 text-xl font-semibold leading-tight tabular-nums ${warn ? "text-red-300" : ""}`} style={displayFont}>
        {value}
      </dd>
    </div>
  );
}

function ExtremeCard({
  title,
  player,
  pts,
  onOpen,
}: {
  title: string;
  player?: Player;
  pts: number;
  onOpen: (player: Player) => void;
}) {
  if (!player) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02] px-2 py-4 text-center">
        <p className="text-xs text-[#f2ebdb]/50">{title}</p>
        <p className="mt-2 text-sm text-[#f2ebdb]/40">Pick your starters</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(player)}
      className={`flex flex-col items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.02] px-2 py-4 text-center hover:bg-white/[0.04] ${focusRing}`}
    >
      <p className="text-xs text-[#f2ebdb]/50">{title}</p>
      <PlayerPhoto player={player} size={44} />
      <p className="mt-1.5 w-full truncate text-sm font-semibold">{player.name}</p>
      <p className="text-lg font-semibold tabular-nums text-[#e2c778]" style={displayFont}>
        {pts} pts
      </p>
    </button>
  );
}

function PlayerPhoto({ player, size = 44 }: { player: Player; size?: number }) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06]"
    >
      {player.photo && !failed ? (
        <img
          src={player.photo}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Shirt team={player.teamName} className="h-[70%] w-[70%]" />
      )}
    </div>
  );
}

/* =========================================================
   PLAYER PICKER (drawer)
   ========================================================= */

function PlayerPicker({
  slot,
  players,
  state,
  error,
  points,
  slots,
  byId,
  onClose,
  onOpen,
  onAdd,
}: {
  slot: string | null;
  players: Player[];
  state: "loading" | "ready" | "error";
  error: string;
  points: Record<string, PlayerPoints>;
  slots: Record<string, string>;
  byId: Map<string, Player>;
  onClose: () => void;
  onOpen: (player: Player) => void;
  onAdd: (player: Player) => void;
}) {
  const locked = slot ? slotPosition(slot) : null;

  const [position, setPosition] = useState<Position | "ALL">(locked ?? "ALL");
  const [team, setTeam] = useState("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("price");

  const teams = useMemo(
    () =>
      Array.from(new Map(players.map((p) => [p.teamId, p.teamName])).entries()).sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    [players],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();

    return players
      .filter((p) => (locked ? p.position === locked : position === "ALL" || p.position === position))
      .filter((p) => team === "ALL" || p.teamId === team)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "points") return (points[b.id]?.total ?? 0) - (points[a.id]?.total ?? 0);
        return b.price - a.price;
      })
      .slice(0, 80);
  }, [players, locked, position, team, query, sort, points]);

  const positions: (Position | "ALL")[] = ["ALL", "GK", "DEF", "MID", "FWD"];

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Choose a player">
      <button type="button" aria-label="Close players" onClick={onClose} className="absolute inset-0 bg-black/70" />

      <div className="relative flex h-full w-full max-w-md flex-col border-l border-white/[0.08] bg-[#131110]">
        <div className="shrink-0 border-b border-white/[0.07] px-4 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[28px] font-semibold leading-none" style={displayFont}>
              {locked ? `Choose a ${locked}` : "Players"}
            </h2>
            <button type="button" onClick={onClose} className={`rounded-full px-3 py-1 text-sm text-[#f2ebdb]/60 hover:text-[#f2ebdb] ${focusRing}`}>
              Close
            </button>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            aria-label="Search players"
            className={`mt-3 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-sm placeholder:text-[#f2ebdb]/30 ${focusRing}`}
          />

          {!locked && (
            <div className="mt-3 flex gap-1.5">
              {positions.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPosition(p)}
                  aria-pressed={position === p}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${focusRing} ${
                    position === p
                      ? "border-[#c9a75a] bg-[#c9a75a]/[0.14] text-[#e2c778]"
                      : "border-white/[0.08] text-[#f2ebdb]/55"
                  }`}
                >
                  {p === "ALL" ? "All" : p}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              aria-label="Filter by club"
              className={`rounded-lg border border-white/[0.1] bg-[#0d0c0a] px-2 py-2 text-sm ${focusRing}`}
            >
              <option value="ALL">All clubs</option>
              {teams.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort players"
              className={`rounded-lg border border-white/[0.1] bg-[#0d0c0a] px-2 py-2 text-sm ${focusRing}`}
            >
              <option value="price">Highest price</option>
              <option value="points">Most points</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {state === "loading" && <p className="py-10 text-center text-sm text-[#f2ebdb]/50">Loading players</p>}
          {state === "error" && <p className="py-10 text-center text-sm text-red-200">{error}</p>}
          {state === "ready" && list.length === 0 && (
            <p className="py-10 text-center text-sm text-[#f2ebdb]/50">No players match these filters.</p>
          )}

          <ul className="space-y-2">
            {list.map((player) => {
              const targetSlot = slot ?? ALL_SLOTS.find((s) => s.pos === player.position && !slots[s.key])?.key;
              const blocked = targetSlot ? validatePick(player, targetSlot, slots, byId) : "No free slot.";
              const owned = Object.values(slots).includes(player.id);

              return (
                <li key={player.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <button type="button" onClick={() => onOpen(player)} className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left ${focusRing}`}>
                    <PlayerPhoto player={player} size={44} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{player.name}</span>
                      <span className="block truncate text-xs text-[#f2ebdb]/50">
                        {player.teamName}, {player.position}
                      </span>
                    </span>
                  </button>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">{money(player.price)}</p>
                    <p className="text-xs tabular-nums text-[#f2ebdb]/45">{points[player.id]?.total ?? 0} pts</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onAdd(player)}
                    disabled={owned || !!blocked}
                    title={owned ? "Already in your squad" : blocked || undefined}
                    className={`shrink-0 rounded-full border border-[#c9a75a]/50 px-3 py-1.5 text-xs font-semibold text-[#e2c778] hover:bg-[#c9a75a]/10 disabled:opacity-30 ${focusRing}`}
                  >
                    {owned ? "Added" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PLAYER DETAIL (modal)
   ========================================================= */

function PlayerDetail({
  player,
  pts,
  gw,
  inSquad,
  onClose,
  onAdd,
  onRemove,
  onReplace,
}: {
  player: Player;
  pts?: PlayerPoints;
  gw: number;
  inSquad: boolean;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onReplace?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label={player.name}>
      <button type="button" aria-label="Close player details" onClick={onClose} className="absolute inset-0 bg-black/75" />

      <div className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-[#c9a75a]/[0.2] bg-gradient-to-b from-[#1c1911] to-[#131110] p-6">
        <div className="flex items-center gap-4">
          <PlayerPhoto player={player} size={96} />
          <Shirt team={player.teamName} number={player.number} className="h-20 w-20" />
        </div>

        <h3 className="mt-4 text-[32px] font-semibold leading-tight" style={displayFont}>
          {player.name}
        </h3>

        <p className="mt-1 flex items-center gap-2 text-sm text-[#f2ebdb]/60">
          {player.teamLogo && <img src={player.teamLogo} alt="" className="h-5 w-5 object-contain" />}
          {player.teamName}, {player.position}
        </p>

        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-white/[0.04] py-2">
            <dt className="text-xs text-[#f2ebdb]/50">Price</dt>
            <dd className="text-lg font-semibold tabular-nums">{money(player.price)}</dd>
          </div>
          <div className="rounded-lg bg-white/[0.04] py-2">
            <dt className="text-xs text-[#f2ebdb]/50">GW {gw}</dt>
            <dd className="text-lg font-semibold tabular-nums">{pts?.gw ?? 0}</dd>
          </div>
          <div className="rounded-lg bg-white/[0.04] py-2">
            <dt className="text-xs text-[#f2ebdb]/50">Season</dt>
            <dd className="text-lg font-semibold tabular-nums">{pts?.total ?? 0}</dd>
          </div>
        </dl>

        {pts && pts.breakdown.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {pts.breakdown.map((row, i) => (
              <li key={`${row.label}-${i}`} className="flex justify-between text-[#f2ebdb]/70">
                <span>{row.label}</span>
                <span className={`tabular-nums ${row.points < 0 ? "text-red-300" : "text-[#e2c778]"}`}>
                  {row.points > 0 ? `+${row.points}` : row.points}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {inSquad ? (
            <>
              {onReplace && (
                <button type="button" onClick={onReplace} className={`flex-1 rounded-full border border-[#c9a75a]/50 px-4 py-2.5 text-sm font-semibold text-[#e2c778] ${focusRing}`}>
                  Replace
                </button>
              )}
              <button type="button" onClick={onRemove} className={`flex-1 rounded-full border border-red-400/40 px-4 py-2.5 text-sm font-semibold text-red-200 ${focusRing}`}>
                Remove
              </button>
            </>
          ) : (
            <button type="button" onClick={onAdd} className={`flex-1 rounded-full bg-gradient-to-b from-[#dcbf74] to-[#b8964a] px-4 py-2.5 text-sm font-semibold text-[#17130a] ${focusRing}`}>
              Add to squad
            </button>
          )}

          <button type="button" onClick={onClose} className={`rounded-full border border-white/[0.12] px-4 py-2.5 text-sm text-[#f2ebdb]/70 ${focusRing}`}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
