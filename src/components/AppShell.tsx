"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Cinzel, Manrope } from "next/font/google";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const display = Cinzel({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const displayFont = {
  fontFamily: "var(--font-display), Georgia, serif",
  fontWeight: 800,
} as const;

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ora-gold";

type UserDoc = {
  managerName?: string;
};

type SquadInfoDoc = {
  teamName?: string;
  coachName?: string;
};

export type Profile = {
  uid: string;
  managerName: string;
  coachName: string;
  teamName: string;
};

type ProfileContextValue = Profile & {
  updateProfile: (
    patch: Partial<Pick<Profile, "teamName" | "coachName">>,
  ) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

let cachedProfile: Profile | null = null;

export function useProfile(): ProfileContextValue {
  const profile = useContext(ProfileContext);

  if (!profile) {
    throw new Error("useProfile must be used inside <AppShell>.");
  }

  return profile;
}

type IconName =
  | "home"
  | "team"
  | "matches"
  | "standings"
  | "leagues"
  | "players"
  | "logout"
  | "plus"
  | "info";

const NAV: { label: string; href: string; icon: IconName }[] = [
  { label: "Home", href: "/dashboard", icon: "home" },
  { label: "My Team", href: "/squad", icon: "team" },
  { label: "Matches", href: "/matches", icon: "matches" },
  { label: "Standings", href: "/standings", icon: "standings" },
  { label: "Leagues", href: "/leagues", icon: "leagues" },
  { label: "Players", href: "/players", icon: "players" },
];

export default function AppShell({
  children,
  title,
  subtitle,
  liveNow = false,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  liveNow?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<Profile | null>(
    () => cachedProfile,
  );

  const [authChecking, setAuthChecking] = useState(
    () => cachedProfile === null,
  );

  const [profileError, setProfileError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    console.log("AppShell: Firebase Auth listener started");

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log(
        "AppShell: Firebase Auth user:",
        user
          ? {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
            }
          : null,
      );

      if (!user) {
        cachedProfile = null;
        setProfile(null);
        setAuthChecking(false);

        console.log("AppShell: No authenticated user. Redirecting to /");

        router.replace("/");
        return;
      }

      setAuthChecking(false);
      setProfileError(null);

      try {
        const [userResult, squadResult] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "squads", user.uid)),
        ]);

        let managerName = user.displayName?.trim() || "";
        let coachName = "";
        let teamName = "";

        if (userResult.exists()) {
          const data = userResult.data() as UserDoc;

          managerName =
            data.managerName?.trim() || managerName;
        }

        if (squadResult.exists()) {
          const data = squadResult.data() as SquadInfoDoc;

          coachName = data.coachName?.trim() || "";
          teamName = data.teamName?.trim() || "";
        }

        const next: Profile = {
          uid: user.uid,
          managerName:
            managerName || teamName || "Manager",
          coachName,
          teamName,
        };

        console.log("AppShell: Profile loaded:", next);

        cachedProfile = next;
        setProfile(next);
      } catch (error) {
        console.error(
          "AppShell: Firestore profile error:",
          error,
        );

        /*
         * حتى لو Firestore فشل، لا نخلي الصفحة
         * تعلق على Loading للأبد.
         */
        const fallbackProfile: Profile = {
          uid: user.uid,
          managerName:
            user.displayName?.trim() || "Manager",
          coachName: "",
          teamName: "",
        };

        cachedProfile = fallbackProfile;
        setProfile(fallbackProfile);

        setProfileError(
          "Could not load your full profile. Some profile details may be unavailable.",
        );
      }
    });

    return () => {
      console.log("AppShell: Firebase Auth listener stopped");
      unsubscribe();
    };
  }, [router]);

  const updateProfile = useCallback(
    (
      patch: Partial<
        Pick<Profile, "teamName" | "coachName">
      >,
    ) => {
      setProfile((current) => {
        if (!current) {
          return current;
        }

        const next = {
          ...current,
          ...patch,
        };

        cachedProfile = next;

        return next;
      });
    },
    [],
  );

  const contextValue = useMemo<ProfileContextValue | null>(
    () =>
      profile
        ? {
            ...profile,
            updateProfile,
          }
        : null,
    [profile, updateProfile],
  );

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    try {
      setLoggingOut(true);

      await signOut(auth);

      cachedProfile = null;

      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
      setLoggingOut(false);
    }
  };

  /*
   * فقط نستعمل Loading أثناء التأكد من حالة تسجيل الدخول.
   * لا ننتظر Firestore إلى ما لا نهاية.
   */
  if (authChecking && !profile) {
    return (
      <main
        className={`${display.variable} ${sans.variable} flex min-h-dvh w-full items-center justify-center bg-ora-night text-ora-papyrus`}
        style={{
          fontFamily:
            "var(--font-sans), system-ui, sans-serif",
        }}
      >
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-ora-gold/20 border-t-ora-gold motion-reduce:animate-none" />

          <p className="mt-5 text-sm font-semibold text-ora-papyrus/60">
            Loading Ora
          </p>
        </div>
      </main>
    );
  }

  /*
   * لو مفيش profile بعد انتهاء Auth check،
   * نعرض رسالة بدل Loading لا نهائي.
   */
  if (!profile || !contextValue) {
    return (
      <main
        className={`${display.variable} ${sans.variable} flex min-h-dvh w-full items-center justify-center bg-ora-night text-ora-papyrus`}
        style={{
          fontFamily:
            "var(--font-sans), system-ui, sans-serif",
        }}
      >
        <div className="max-w-sm px-6 text-center">
          <p
            className="text-xl font-black"
            style={displayFont}
          >
            Session required
          </p>

          <p className="mt-3 text-sm text-ora-papyrus/60">
            Please sign in to continue.
          </p>

          <button
            type="button"
            onClick={() => router.replace("/")}
            className={`mt-5 rounded-full bg-ora-gold px-5 py-2.5 text-sm font-bold text-ora-night ${focusRing}`}
          >
            Go to Login
          </button>
        </div>
      </main>
    );
  }

  const isActive = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`);

  const secondLine = profile.coachName
    ? `Coach ${profile.coachName}`
    : "Fantasy manager";

  return (
    <ProfileContext.Provider value={contextValue}>
      <div
        className={`${display.variable} ${sans.variable} relative isolate min-h-dvh bg-ora-night text-ora-papyrus lg:flex`}
        style={{
          fontFamily:
            "var(--font-sans), system-ui, sans-serif",
        }}
      >
        <div
          aria-hidden="true"
          className="ora-glow pointer-events-none fixed inset-0 -z-10"
        />

        <aside className="sticky top-0 hidden h-dvh w-[224px] shrink-0 flex-col border-r border-ora-gold/10 bg-ora-side px-4 py-5 lg:flex">
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 rounded-lg px-1 py-1 ${focusRing}`}
          >
            <img
              src="/ora.png"
              alt=""
              className="h-10 w-10 object-contain"
            />

            <span>
              <span
                className="block text-[27px] font-black leading-none tracking-wide"
                style={displayFont}
              >
                Ora
              </span>

              <span className="ora-eyebrow mt-1 block">
                Fantasy
              </span>
            </span>
          </Link>

          <div
            className="ora-nile-band mt-5 opacity-90"
            aria-hidden="true"
          />

          <nav
            className="mt-5 flex flex-col gap-1"
            aria-label="Main"
          >
            {NAV.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    active ? "page" : undefined
                  }
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${focusRing} ${
                    active
                      ? "bg-gradient-to-r from-ora-gold/20 to-transparent text-ora-gold-light"
                      : "text-ora-papyrus/60 hover:bg-white/5 hover:text-ora-papyrus"
                  }`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-xl border border-ora-nile/20 bg-ora-nile/[0.06] px-3 py-3">
            <p className="ora-eyebrow text-ora-nile">
              Season status
            </p>

            <p className="mt-1 text-xs font-semibold text-ora-papyrus/70">
              Egyptian Premier League, live scoring
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-5">
          <div className="mx-auto max-w-[1280px]">
            <header className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 lg:hidden">
                <img
                  src="/ora.png"
                  alt=""
                  className="h-8 w-8 object-contain"
                />

                <span
                  className="text-xl font-black leading-none tracking-wide"
                  style={displayFont}
                >
                  Ora Fantasy
                </span>
              </div>

              <div className="hidden min-w-0 lg:block">
                <p className="ora-eyebrow">
                  Ora Fantasy
                </p>

                <h2
                  className="truncate text-[26px] font-black leading-tight"
                  style={displayFont}
                >
                  {title}
                </h2>

                {subtitle && (
                  <p className="mt-1 text-xs font-semibold text-ora-papyrus/50">
                    {subtitle}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {liveNow && (
                  <span className="flex items-center gap-2 rounded-full border border-ora-nile/40 bg-ora-nile/10 px-3 py-1.5 text-xs font-bold text-ora-nile">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ora-nile motion-reduce:animate-none" />
                    Live now
                  </span>
                )}

                <div className="flex items-center gap-2.5 rounded-full border border-ora-gold/15 bg-ora-card py-1.5 pl-1.5 pr-2">
                  <Avatar
                    name={profile.managerName}
                  />

                  <div className="hidden min-w-0 max-w-[170px] sm:block">
                    <p className="truncate text-sm font-bold leading-tight">
                      {profile.managerName}
                    </p>

                    <p className="truncate text-xs font-medium leading-tight text-ora-papyrus/50">
                      {secondLine}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    aria-label="Log out"
                    title="Log out"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ora-papyrus/60 transition-colors hover:bg-white/10 hover:text-ora-papyrus disabled:opacity-40 ${focusRing}`}
                  >
                    {loggingOut ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border border-ora-papyrus/30 border-t-ora-papyrus motion-reduce:animate-none" />
                    ) : (
                      <Icon
                        name="logout"
                        className="h-4 w-4"
                      />
                    )}
                  </button>
                </div>
              </div>
            </header>

            {profileError && (
              <div className="mt-3 rounded-lg border border-ora-gold/20 bg-ora-gold/5 px-3 py-2 text-xs font-medium text-ora-papyrus/60">
                {profileError}
              </div>
            )}

            <div className="mt-5">
              {children}
            </div>
          </div>
        </div>

        <nav
          aria-label="Main"
          className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-ora-gold/15 bg-ora-card/95 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden"
        >
          <div className="grid grid-cols-6">
            {NAV.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={
                    active ? "page" : undefined
                  }
                  className={`flex min-w-0 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold transition-colors ${focusRing} ${
                    active
                      ? "bg-ora-gold/10 text-ora-gold-light"
                      : "text-ora-papyrus/60 hover:text-ora-papyrus"
                  }`}
                >
                  <Icon
                    name={item.icon}
                    className="h-5 w-5"
                  />

                  <span className="max-w-full truncate">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </ProfileContext.Provider>
  );
}

export function Cartouche({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex items-center rounded-full border border-ora-gold/60 bg-ora-gold/10 py-1 pl-4 pr-6 text-sm font-bold text-ora-gold-light">
      {children}

      <span
        aria-hidden="true"
        className="absolute right-2.5 top-1/2 h-4 w-px -translate-y-1/2 bg-ora-gold/60"
      />
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-ora-gold-light to-ora-gold text-xs font-black text-ora-night">
      {initials}
    </div>
  );
}

const ICONS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </>
  ),

  team: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),

  matches: (
    <>
      <rect
        x="3"
        y="4"
        width="18"
        height="18"
        rx="2"
      />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),

  standings: (
    <path d="M18 20V10M12 20V4M6 20v-6" />
  ),

  leagues: (
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>
  ),

  players: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),

  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),

  plus: (
    <path d="M12 5v14M5 12h14" />
  ),

  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5" />
      <path d="M12 8h.01" />
    </>
  ),
};

export function Icon({
  name,
  className = "h-[18px] w-[18px]",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
