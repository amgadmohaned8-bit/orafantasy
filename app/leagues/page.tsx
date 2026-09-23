"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../../src/firebase";
import AppShell, { displayFont, focusRing, useProfile } from "../../src/components/AppShell";
import { StateMessage } from "../../src/components/MatchCard";
import type { Player, PlayerPoints, SquadDoc } from "../../src/fantasy/types";

type League = {
  id: string;
  name: string;
  code: string;
  ownerUid: string;
  memberUids: string[];
};

type MemberRow = {
  uid: string;
  teamName: string;
  coachName: string;
  points: number;
};

/* 6-character invite code — unambiguous alphabet, no 0/O/1/I. */
function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export default function LeaguesPage() {
  return (
    <AppShell title="Leagues" subtitle="Compete with friends">
      <LeaguesContent />
    </AppShell>
  );
}

function LeaguesContent() {
  const profile = useProfile();
  const uid = profile.uid;

  const [players, setPlayers] = useState<Player[]>([]);
  const [points, setPoints] = useState<Record<string, PlayerPoints>>({});

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [membersByLeague, setMembersByLeague] = useState<Record<string, MemberRow[]>>({});

  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [formNotice, setFormNotice] = useState("");

  const byId = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );

  /* players + points, once — needed to total up each member's score */
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch("/api/players", { signal: controller.signal });
        const json = await res.json();
        if (res.ok && !json.error) setPlayers(json.players as Player[]);
      } catch {
        /* standings just show 0 until players load */
      }
    })();

    (async () => {
      try {
        const res = await fetch("/api/football/points", { signal: controller.signal });
        const json = await res.json();
        if (res.ok && !json.error) setPoints(json.players || {});
      } catch {
        /* points stay at 0 until the next visit */
      }
    })();

    return () => controller.abort();
  }, []);

  const loadLeagues = async () => {
    try {
      setLoading(true);
      setError("");

      const q = query(collection(db, "leagues"), where("memberUids", "array-contains", uid));
      const snap = await getDocs(q);

      const rows: League[] = snap.docs.map((d) => {
        const data = d.data() as Omit<League, "id">;
        return { id: d.id, ...data };
      });

      setLeagues(rows);
    } catch (err) {
      console.error("Leagues load error:", err);
      setError("Your leagues couldn't be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeagues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  /* members' squads, fetched once per league once players/points are ready */
  useEffect(() => {
    if (leagues.length === 0 || players.length === 0) return;

    let cancelled = false;

    (async () => {
      const next: Record<string, MemberRow[]> = {};

      for (const league of leagues) {
        const memberDocs = await Promise.all(
          league.memberUids.map((memberUid) => getDoc(doc(db, "squads", memberUid))),
        );

        const rows: MemberRow[] = memberDocs.map((snap, i) => {
          const memberUid = league.memberUids[i];

          if (!snap.exists()) {
            return { uid: memberUid, teamName: "No team yet", coachName: "", points: 0 };
          }

          const data = snap.data() as Partial<SquadDoc>;
          const starters = Array.isArray(data.starters) ? data.starters : [];

          const total = starters.reduce((sum, playerId) => {
            const player = byId.get(playerId);
            if (!player) return sum;

            const isCaptain = playerId === data.captain;
            const multiplier =
              isCaptain && data.activeChip === "tripleCaptain" ? 3 : isCaptain ? 2 : 1;

            return sum + (points[playerId]?.total ?? 0) * multiplier;
          }, 0);

          return {
            uid: memberUid,
            teamName: data.teamName || "Unnamed team",
            coachName: data.coachName || "",
            points: total,
          };
        });

        rows.sort((a, b) => b.points - a.points);
        next[league.id] = rows;
      }

      if (!cancelled) setMembersByLeague(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [leagues, players, points, byId]);

  const createLeague = async () => {
    const name = createName.trim();

    if (name.length < 3 || name.length > 30) {
      setFormNotice("League name must be between 3 and 30 characters.");
      return;
    }

    try {
      setBusy(true);
      setFormNotice("");

      await addDoc(collection(db, "leagues"), {
        name,
        code: makeCode(),
        ownerUid: uid,
        memberUids: [uid],
        createdAt: serverTimestamp(),
      });

      setCreateName("");
      await loadLeagues();
    } catch (err) {
      console.error("Create league error:", err);
      setFormNotice("We couldn't create your league. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const joinLeague = async () => {
    const code = joinCode.trim().toUpperCase();

    if (code.length < 4) {
      setFormNotice("Enter the invite code your friend shared with you.");
      return;
    }

    try {
      setBusy(true);
      setFormNotice("");

      const q = query(collection(db, "leagues"), where("code", "==", code));
      const snap = await getDocs(q);

      if (snap.empty) {
        setFormNotice("No league matches that code. Double-check it and try again.");
        return;
      }

      const target = snap.docs[0];

      if ((target.data().memberUids as string[]).includes(uid)) {
        setFormNotice("You're already in this league.");
        return;
      }

      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(target.ref, { memberUids: arrayUnion(uid) });

      setJoinCode("");
      await loadLeagues();
    } catch (err) {
      console.error("Join league error:", err);
      setFormNotice("We couldn't join that league. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[760px]">
        <h1 className="text-[28px] font-black leading-none lg:hidden" style={displayFont}>
          Leagues
        </h1>

        {/* CREATE + JOIN */}
        <section className="ora-flash relative mt-4 overflow-hidden rounded-2xl border border-ora-gold/20 bg-ora-card lg:mt-0">
          <div className="ora-nile-band" aria-hidden="true" />

          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <div>
              <p className="ora-eyebrow">Start your own</p>
              <h2 className="mt-1 text-xl font-black" style={displayFont}>
                Create a league
              </h2>
              <p className="mt-1.5 text-sm text-ora-papyrus/55">
                You&apos;ll get an invite code to share with friends.
              </p>

              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                maxLength={30}
                placeholder="League name"
                className={`mt-3 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3.5 py-2.5 text-sm font-medium placeholder:text-ora-papyrus/30 ${focusRing}`}
              />

              <button
                type="button"
                onClick={createLeague}
                disabled={busy}
                className={`mt-3 w-full rounded-full bg-gradient-to-b from-ora-gold-light to-ora-gold px-4 py-2.5 text-sm font-bold text-ora-night disabled:opacity-50 ${focusRing}`}
              >
                {busy ? "Working" : "Create league"}
              </button>
            </div>

            <div className="border-t border-white/5 pt-5 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
              <p className="ora-eyebrow">Got a code?</p>
              <h2 className="mt-1 text-xl font-black" style={displayFont}>
                Join a league
              </h2>
              <p className="mt-1.5 text-sm text-ora-papyrus/55">
                Enter the code a friend sent you.
              </p>

              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                placeholder="Invite code"
                className={`mt-3 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3.5 py-2.5 text-sm font-bold uppercase tracking-widest placeholder:text-ora-papyrus/30 placeholder:normal-case placeholder:tracking-normal placeholder:font-medium ${focusRing}`}
              />

              <button
                type="button"
                onClick={joinLeague}
                disabled={busy}
                className={`mt-3 w-full rounded-full border border-ora-gold/40 px-4 py-2.5 text-sm font-bold text-ora-gold-light disabled:opacity-50 ${focusRing}`}
              >
                {busy ? "Working" : "Join league"}
              </button>
            </div>
          </div>

          {formNotice && (
            <p role="alert" className="border-t border-white/5 px-5 py-3 text-sm text-ora-carnelian sm:px-6">
              {formNotice}
            </p>
          )}
        </section>

        {/* MY LEAGUES */}
        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="h-40 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03] motion-reduce:animate-none" />
          ) : error ? (
            <p className="rounded-2xl border border-ora-carnelian/25 bg-ora-carnelian/[0.06] px-4 py-3 text-sm text-ora-carnelian">
              {error}
            </p>
          ) : leagues.length === 0 ? (
            <section className="overflow-hidden rounded-2xl border border-ora-gold/20 bg-ora-card">
              <div className="px-5 py-8">
                <StateMessage
                  title="You haven't joined a league yet"
                  text="Create one above, or ask a friend for their invite code."
                />
              </div>
            </section>
          ) : (
            leagues.map((league) => (
              <LeagueCard
                key={league.id}
                league={league}
                members={membersByLeague[league.id]}
                meUid={uid}
              />
            ))
          )}
        </div>
    </div>
  );
}

/* =========================================================
   ONE LEAGUE'S CARD
   ========================================================= */

function LeagueCard({
  league,
  members,
  meUid,
}: {
  league: League;
  members: MemberRow[] | undefined;
  meUid: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(league.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard not available, the code is still shown on screen */
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-ora-gold/20 bg-ora-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black" style={displayFont}>
            {league.name}
          </h3>
          <p className="mt-0.5 text-xs font-medium text-ora-papyrus/50">
            {league.memberUids.length}{" "}
            {league.memberUids.length === 1 ? "manager" : "managers"}
          </p>
        </div>

        <button
          type="button"
          onClick={copyCode}
          className={`flex shrink-0 items-center gap-2 rounded-full border border-ora-gold/30 px-3.5 py-1.5 text-xs font-bold text-ora-gold-light transition-colors hover:bg-ora-gold/10 ${focusRing}`}
        >
          {copied ? "Copied!" : league.code}
        </button>
      </div>

      <div className="border-t border-white/5">
        {!members ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-lg bg-white/[0.03] motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : (
          <ul>
            {members.map((member, index) => (
              <li
                key={member.uid}
                className={`flex items-center justify-between gap-3 px-5 py-3 ${
                  member.uid === meUid ? "bg-ora-gold/[0.06]" : ""
                } ${index !== members.length - 1 ? "border-b border-white/5" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`w-5 shrink-0 text-sm font-black tabular-nums ${
                      index === 0 ? "text-ora-gold-light" : "text-ora-papyrus/40"
                    }`}
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {member.teamName}
                      {member.uid === meUid ? " (You)" : ""}
                    </p>
                    {member.coachName && (
                      <p className="truncate text-xs font-medium text-ora-papyrus/45">
                        Coach {member.coachName}
                      </p>
                    )}
                  </div>
                </div>

                <span className="shrink-0 text-sm font-black tabular-nums text-ora-gold-light">
                  {member.points} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}