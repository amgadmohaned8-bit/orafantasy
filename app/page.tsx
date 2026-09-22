"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../src/firebase";
import { loginWithRememberMe } from "@/src/lib/authPersistence";

type Mode = "register" | "login";

const players = [
  {
    image: "/players/imam.png",
    name: "Imam Ashour",
    position: "MID",
    club: "AL AHLY",
    number: "8",
  },
  {
    image: "/players/abdallah.png",
    name: "Abdallah El Said",
    position: "MID",
    club: "ZAMALEK",
    number: "19",
  },
  {
    image: "/players/elkarti.png",
    name: "Walid El Karti",
    position: "MID",
    club: "PYRAMIDS FC",
    number: "10",
  },
];

export default function Home() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("register");
  const [showPassword, setShowPassword] = useState(false);

  const [managerName, setManagerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);
    console.log("SUBMIT STARTED");

    try {
      if (mode === "register") {
        if (!managerName.trim()) {
          setError("Please enter your manager name.");
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );
        console.log("AUTH SUCCESS");
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
          managerName: managerName.trim(),
          email: user.email,
          createdAt: serverTimestamp(),
        });
        console.log("FIRESTORE SUCCESS");
        router.push("/dashboard");
      } else {
       await loginWithRememberMe(email, password);

        router.push("/dashboard");
      }
    } catch (err: unknown) {
      const code = err instanceof FirebaseError ? err.code : undefined;
      const message = err instanceof Error ? err.message : undefined;
      console.error("FIREBASE ERROR:", code, message);

      switch (code) {
        case "auth/email-already-in-use":
          setError("This email is already registered.");
          break;

        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;

        case "auth/weak-password":
          setError("Password must be at least 6 characters.");
          break;

        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          setError("Email or password is incorrect.");
          break;

        case "auth/too-many-requests":
          setError("Too many attempts. Please try again later.");
          break;

        default:
          setError(message || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "register" ? "login" : "register");
    setError("");
    setSuccess("");
  };

  return (
    // FIX: scrollable on mobile, locked to viewport only on desktop (lg)
    <main className="relative min-h-dvh w-full overflow-x-hidden bg-[#070609] text-white lg:h-dvh lg:overflow-hidden">
      {/* BACKGROUND */}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[15%] -top-[35%] h-[850px] w-[850px] rounded-full bg-[#641f7c]/35 blur-[180px]" />

        <div className="absolute -right-[15%] top-[-10%] h-[700px] w-[700px] rounded-full bg-[#3b1248]/55 blur-[170px]" />

        <div className="absolute bottom-[-45%] left-[20%] h-[850px] w-[1000px] rounded-full bg-[#28102f] blur-[150px]" />

        <div className="absolute left-[40%] top-[20%] h-[500px] w-[500px] rounded-full bg-[#d6b35a]/[0.035] blur-[130px]" />

        <div
          className="
            absolute inset-0 opacity-[0.018]
            [background-image:linear-gradient(rgba(214,179,90,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(214,179,90,.8)_1px,transparent_1px)]
            [background-size:75px_75px]
          "
        />

        <div className="absolute -left-[320px] top-[2%] h-[680px] w-[680px] rotate-45 border border-[#d6b35a]/[0.035]" />

        <div className="absolute -left-[250px] top-[10%] h-[530px] w-[530px] rotate-45 border border-[#d6b35a]/[0.02]" />

        <div className="absolute -right-[300px] bottom-[-300px] h-[750px] w-[750px] rotate-45 border border-[#d6b35a]/[0.03]" />

        <div className="absolute bottom-[-7%] left-[-5%] opacity-[0.055]">
          <Pyramid large />
        </div>

        <div className="absolute bottom-[-5%] right-[0%] opacity-[0.035]">
          <Pyramid />
        </div>

        <div className="absolute right-[7%] top-[10%] opacity-[0.025]">
          <HorusEye />
        </div>

        <div
          className="
            absolute inset-0
            bg-[radial-gradient(circle_at_50%_38%,transparent_12%,rgba(7,6,9,.35)_55%,#070609_100%)]
          "
        />
      </div>

      {/* NAVBAR */}

      <header
        className="
          relative z-50 mx-auto flex h-[72px] max-w-[1500px]
          items-center justify-between px-6 sm:px-10 lg:px-14
        "
      >
        <nav className="hidden items-center gap-8 lg:flex">
          <NavItem active>Home</NavItem>
          <NavItem>How it works</NavItem>
          <NavItem>Rules</NavItem>
          <NavItem>Leagues</NavItem>
        </nav>

        <div
          className="
            absolute bottom-0 left-[80%]
            flex -translate-x-1/2
            items-end
          "
        >
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-[#d6b35a]/50" />

          <span className="text-[6px] font-black uppercase tracking-[0.4em] text-[#d6b35a]/60">
            Egyptian Fantasy Football
          </span>

          <span className="h-px w-8 bg-gradient-to-l from-transparent to-[#d6b35a]/50" />
        </div>

        <div className="ml-auto flex items-center">
          <div className="relative flex h-[64px] w-[160px] items-center justify-end">
            <div
              className="
                pointer-events-none absolute right-0 top-1/2
                h-44 w-44 -translate-y-1/2 rounded-full
                bg-[#d6b35a]/10 blur-3xl
              "
            />

            <img
              src="/ora.png"
              alt="Fantasy ORA"
              className="
                relative z-10 h-[100px] w-auto max-w-[120px]
                object-contain object-right
                drop-shadow-[0_10px_20px_rgba(0,0,0,.55)]
              "
            />
          </div>
        </div>
      </header>

      {/* MAIN */}

      {/* FIX: removed h-auto, desktop height only on lg */}
      <section
        className="
          relative z-10 mx-auto min-h-[calc(100dvh-72px)]
          max-w-[1500px] lg:h-[calc(100dvh-72px)]
        "
      >
        {/* FIX: h-full only on desktop */}
        <div
          className="
            grid min-h-0
            grid-cols-1 items-center gap-8
            lg:h-full lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-10
          "
        >
          {/* HERO / PLAYERS */}

          {/* FIX: side padding on mobile, h-full only on desktop */}
          <div className="relative flex min-h-0 flex-col justify-center px-4 lg:h-full lg:px-0">
            <div className="relative z-40 mb-2 flex items-center gap-3">
              <span className="h-px w-9 bg-[#d6b35a]" />

              <span className="text-[6px] font-black uppercase tracking-[0.42em] text-[#d6b35a]">
                Egyptian Fantasy League
              </span>
            </div>

            <h1
              className="
                relative z-40
                text-[46px] font-black uppercase
                leading-[0.8] tracking-[-0.075em]
                sm:text-[54px] lg:text-[60px]
              "
            >
              Build

              <br />

              <span
                className="
                  bg-gradient-to-b from-[#f5da83]
                  via-[#d6b35a] to-[#957129]
                  bg-clip-text text-transparent
                "
              >
                your
              </span>

              <br />

              legacy.
            </h1>

            <p
              className="
                relative z-40 mt-3 max-w-[330px]
                text-[10px] leading-4 text-white/40
              "
            >
              Pick your stars. Build your squad.
              Compete every gameweek and write your own
              Egyptian fantasy legacy.
            </p>

            {/* PLAYER CARDS */}

            {/* FIX: shorter container on mobile */}
            <div
              className="
                relative z-30 mt-1
                h-[300px] w-full max-w-[720px]
                sm:h-[380px]
              "
            >
              <div
                className="
                  pointer-events-none absolute
                  bottom-[4%] left-1/2
                  h-[210px] w-[620px]
                  -translate-x-1/2
                  rounded-full
                  bg-[#70247f]/30
                  blur-[110px]
                  lg:left-[35%]
                "
              />

              {/* FIX: centered + scaled down on mobile so it never overflows */}
              <div
                className="
                  absolute bottom-0 left-1/2
                  flex origin-bottom -translate-x-1/2
                  scale-[0.65] items-end
                  sm:scale-100
                  lg:left-[38%]
                "
              >
                {players.map((player, index) => (
                  <PlayerCard
                    key={player.name}
                    player={player}
                    index={index}
                  />
                ))}
              </div>
            </div>

            <div className="mt-0 flex items-center gap-3">
              <span className="text-[5px] font-black uppercase tracking-[0.4em] text-[#d6b35a]/45">
                Pharaohs of Fantasy
              </span>

              <span className="h-px w-8 bg-[#d6b35a]/20" />

              <span className="text-[5px] uppercase tracking-[0.25em] text-white/15">
                Choose your eleven
              </span>
            </div>
          </div>

          {/* AUTH CARD */}

          {/* FIX: padding + bottom space on mobile */}
          <div className="relative z-50 flex items-center justify-center px-4 pb-10 lg:px-0 lg:pb-0">
            {/* FIX: 90% width up to 450px on mobile, 330px on desktop */}
            <div className="relative box-border w-[90%] max-w-[450px] lg:w-full lg:max-w-[330px]">
              <div className="absolute -inset-2 border border-[#d6b35a]/[0.04]" />

              <div
                className="
                  relative overflow-hidden
                  border border-[#d6b35a]/25
                  bg-gradient-to-b
                  from-[#17101b]
                  via-[#100b13]
                  to-[#0b080e]
                  px-6 py-6
                  shadow-[0_35px_100px_rgba(0,0,0,.75)]
                  backdrop-blur-2xl
                "
              >
                <div
                  className="
                    pointer-events-none absolute
                    -right-20 -top-20 h-40 w-40
                    rounded-full bg-[#d6b35a]/[0.06] blur-3xl
                  "
                />

                <div
                  className="
                    pointer-events-none absolute
                    -bottom-20 -left-20 h-40 w-40
                    rounded-full bg-[#70247f]/[0.10] blur-3xl
                  "
                />

                <Corner position="left-top" />
                <Corner position="right-top" />
                <Corner position="left-bottom" />
                <Corner position="right-bottom" />

                <div className="mb-3 flex justify-center">
                  <div className="flex h-14 w-[90px] items-center justify-center">
                    <img
                      src="/ora.png"
                      alt="Fantasy ORA"
                      className="
                        h-[140px]
                        w-auto
                        max-w-[240px]
                        object-contain
                      "
                    />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-[7px] font-bold uppercase tracking-[0.38em] text-[#d6b35a]">
                    Enter the league
                  </p>

                  <h2
                    className="
                      mt-2 text-[23px] font-black
                      leading-tight tracking-[-0.04em]
                      text-white
                    "
                  >
                    {mode === "register"
                      ? "Become a manager."
                      : "Welcome back."}
                  </h2>

                  <p
                    className="
                      mx-auto mt-2 max-w-[250px]
                      text-[9px] font-medium
                      leading-4 text-white/35
                    "
                  >
                    {mode === "register"
                      ? "Create your account and start building your fantasy legacy."
                      : "Return to your squad and continue your fantasy journey."}
                  </p>
                </div>

                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#d6b35a]/20" />

                  <div className="h-1.5 w-1.5 rotate-45 bg-[#d6b35a] shadow-[0_0_12px_rgba(214,179,90,.4)]" />

                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#d6b35a]/20" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  {mode === "register" && (
                    <Field
                      label="Manager name"
                      placeholder="Enter your name"
                      type="text"
                      value={managerName}
                      onChange={setManagerName}
                    />
                  )}

                  <Field
                    label="Email address"
                    placeholder="you@example.com"
                    type="email"
                    value={email}
                    onChange={setEmail}
                  />

                  <div>
                    <label
                      className="
                        mb-1.5 block text-[7px]
                        font-bold uppercase
                        tracking-[0.22em]
                        text-[#d6b35a]/60
                      "
                    >
                      Password
                    </label>

                    <div className="relative">
                      <input
                        required
                        minLength={6}
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="
                          h-[46px] w-full rounded-sm
                          border border-white/[0.10]
                          bg-white/[0.035]
                          px-3 pr-14
                          text-[11px] font-medium
                          text-white outline-none
                          transition
                          placeholder:text-white/20
                          focus:border-[#d6b35a]/60
                          focus:bg-white/[0.05]
                        "
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="
                          absolute right-3 top-1/2
                          -translate-y-1/2
                          text-[7px] font-bold
                          uppercase tracking-[0.15em]
                          text-white/30 transition
                          hover:text-[#d6b35a]
                        "
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div
                      className="
                        rounded-sm border
                        border-red-400/20
                        bg-red-500/[0.06]
                        px-3 py-2
                        text-center text-[8px]
                        font-medium leading-4
                        text-red-300
                      "
                    >
                      {error}
                    </div>
                  )}

                  {success && (
                    <div
                      className="
                        rounded-sm border
                        border-[#d6b35a]/20
                        bg-[#d6b35a]/[0.05]
                        px-3 py-2
                        text-center text-[8px]
                        font-medium leading-4
                        text-[#e4c46c]
                      "
                    >
                      {success}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="
                      group relative mt-1
                      h-[48px] w-full overflow-hidden
                      rounded-sm
                      bg-gradient-to-r
                      from-[#a97d2c]
                      via-[#f0d477]
                      to-[#a97d2c]
                      text-[8px]
                      font-black uppercase
                      tracking-[0.2em]
                      text-[#100a04]
                      shadow-[0_15px_40px_rgba(214,179,90,.15)]
                      transition
                      hover:brightness-110
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  >
                    <span
                      className="
                        absolute inset-y-0
                        -left-[30%] w-[20%]
                        -skew-x-12 bg-white/50
                        blur-md transition-all
                        duration-700
                        group-hover:left-[120%]
                      "
                    />

                    <span className="relative">
                      {loading
                        ? "Please wait..."
                        : mode === "register"
                          ? "Create your account"
                          : "Enter your squad"}

                      {!loading && (
                        <span className="ml-2 text-[12px]">→</span>
                      )}
                    </span>
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <span className="text-[8px] font-medium text-white/25">
                    {mode === "register"
                      ? "Already have an account?"
                      : "New to Fantasy ORA?"}
                  </span>

                  <button
                    type="button"
                    onClick={switchMode}
                    className="
                      ml-2 text-[8px]
                      font-black text-[#d6b35a]
                      transition hover:text-[#f5da83]
                    "
                  >
                    {mode === "register" ? "Sign in" : "Create account"}
                  </button>
                </div>

                <p
                  className="
                    mt-4 text-center text-[6px]
                    font-medium uppercase
                    tracking-[0.2em] text-white/10
                  "
                >
                  Fantasy ORA · Egyptian Fantasy Football
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ===============================================================
   PLAYER CARD
   =============================================================== */

function PlayerCard({
  player,
  index,
}: {
  player: {
    image: string;
    name: string;
    position: string;
    club: string;
    number: string;
  };
  index: number;
}) {
  const isCenter = index === 1;

  return (
    <div
      className={`
        group relative shrink-0 overflow-hidden
        border border-[#d6b35a]/35
        bg-gradient-to-b
        from-[#24122e]
        via-[#120d17]
        to-[#09070b]
        shadow-[0_25px_55px_rgba(0,0,0,.7)]
        transition-all duration-300
        hover:z-[60]
        hover:-translate-y-2
        hover:border-[#d6b35a]/70

        ${
          isCenter
            ? `
              z-30
              -mx-[4px]
              h-[320px]
              w-[150px]
              sm:h-[340px]
              sm:w-[170px]
              lg:h-[350px]
              lg:w-[200px]
            `
            : `
              z-20
              h-[300px]
              w-[150px]
              sm:h-[340px]
              sm:w-[170px]
              lg:h-[320px]
              lg:w-[200px]
            `
        }
      `}
    >
      <div
        className="
          absolute left-3 right-3 top-0 z-[70]
          h-[2px]
          bg-gradient-to-r
          from-transparent
          via-[#e3c66d]
          to-transparent
        "
      />

      <div
        className="
          absolute bottom-3 left-3 right-3 z-[70]
          h-[2px]
          bg-gradient-to-r
          from-transparent
          via-[#d6b35a]/40
          to-transparent
        "
      />

      <div
        className="
          pointer-events-none absolute inset-0 z-10
          opacity-[0.035]
          [background-image:linear-gradient(45deg,#d6b35a_1px,transparent_1px),linear-gradient(-45deg,#d6b35a_1px,transparent_1px)]
          [background-size:30px_30px]
        "
      />

      <div className="absolute left-2.5 top-2.5 z-[60]">
        <p className="text-[5px] font-black uppercase tracking-[0.2em] text-[#d6b35a]/70">
          Position
        </p>

        <p className="mt-0.5 text-[10px] font-black text-[#f0d27e]">
          {player.position}
        </p>
      </div>

      <div
        className="
          absolute right-1 top-1 z-10
          text-[44px] font-black
          leading-none text-white/[0.045]
        "
      >
        {player.number}
      </div>

      <div
        className="
          absolute inset-[-8%]
          z-30 flex items-end justify-center
        "
      >
        <img
          src={player.image}
          alt={player.name}
          draggable={false}
          className="
            h-[225%]
            w-[250%]
            max-w-none
            object-contain
            object-bottom
            drop-shadow-[0_22px_25px_rgba(0,0,0,.95)]
            transition-transform
            duration-500
            group-hover:scale-[1.045]
          "
        />
      </div>

      <div
        className="
          pointer-events-none absolute
          bottom-0 left-0 right-0 z-40
          h-[100px]
          bg-gradient-to-t
          from-[#070609]
          via-[#070609]/75
          to-transparent
        "
      />

      <div
        className="
          absolute bottom-0 left-0 right-0
          z-50 px-2.5 pb-3
        "
      >
        <div className="mb-1 flex items-center gap-1">
          <span
            className="
              h-1 w-1 rounded-full
              bg-[#d6b35a]
              shadow-[0_0_8px_#d6b35a]
            "
          />

          <span
            className="
              truncate
              text-[5px] font-black
              uppercase tracking-[0.16em]
              text-[#d6b35a]/75
            "
          >
            {player.club}
          </span>
        </div>

        <p
          className={`
            font-black uppercase
            leading-[0.9] tracking-[-0.04em]
            text-white
            drop-shadow-[0_2px_5px_rgba(0,0,0,.9)]
            ${
              isCenter
                ? "text-[11px] sm:text-[12px]"
                : "text-[9px] sm:text-[10px]"
            }
          `}
        >
          {player.name}
        </p>
      </div>

      <div
        className="
          absolute left-0 top-0 z-[80]
          h-5 w-5
          border-l border-t
          border-[#d6b35a]/80
        "
      />

      <div
        className="
          absolute right-0 top-0 z-[80]
          h-5 w-5
          border-r border-t
          border-[#d6b35a]/80
        "
      />

      <div
        className="
          absolute bottom-0 left-0 z-[80]
          h-5 w-5
          border-b border-l
          border-[#d6b35a]/50
        "
      />

      <div
        className="
          absolute bottom-0 right-0 z-[80]
          h-5 w-5
          border-b border-r
          border-[#d6b35a]/50
        "
      />
    </div>
  );
}

/* ===============================================================
   FIELD
   =============================================================== */

function Field({
  label,
  placeholder,
  type,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        className="
          mb-1.5 block text-[7px]
          font-bold uppercase
          tracking-[0.22em]
          text-[#d6b35a]/60
        "
      >
        {label}
      </label>

      <input
        required
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          h-[46px] w-full rounded-sm
          border border-white/[0.10]
          bg-white/[0.035]
          px-3
          text-[11px] font-medium
          text-white outline-none
          transition
          placeholder:text-white/20
          focus:border-[#d6b35a]/60
          focus:bg-white/[0.05]
          focus:shadow-[0_0_25px_rgba(214,179,90,.05)]
        "
      />
    </div>
  );
}

/* ===============================================================
   NAV ITEM
   =============================================================== */

function NavItem({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={`
        cursor-pointer
        text-[7px]
        font-black
        uppercase
        tracking-[0.22em]
        transition
        ${
          active
            ? "text-[#d6b35a]"
            : "text-white/25 hover:text-white/70"
        }
      `}
    >
      {children}
    </span>
  );
}

/* ===============================================================
   CORNERS
   =============================================================== */

function Corner({
  position,
}: {
  position: "left-top" | "right-top" | "left-bottom" | "right-bottom";
}) {
  const classes = {
    "left-top": "left-0 top-0 border-l border-t",
    "right-top": "right-0 top-0 border-r border-t",
    "left-bottom": "bottom-0 left-0 border-b border-l",
    "right-bottom": "bottom-0 right-0 border-b border-r",
  };

  return (
    <div
      className={`
        absolute h-7 w-7
        border-[#d6b35a]/60
        ${classes[position]}
      `}
    />
  );
}

/* ===============================================================
   PYRAMID
   =============================================================== */

function Pyramid({
  large = false,
}: {
  large?: boolean;
}) {
  return (
    <div
      className={`
        relative
        ${large ? "h-[280px] w-[470px]" : "h-[190px] w-[320px]"}
      `}
    >
      <div
        className={`
          absolute bottom-0 left-1/2
          h-0 w-0
          -translate-x-1/2
          border-l-transparent
          border-r-transparent
          border-b-[#d6b35a]
          ${
            large
              ? "border-l-[235px] border-r-[235px] border-b-[280px]"
              : "border-l-[160px] border-r-[160px] border-b-[190px]"
          }
        `}
      />
    </div>
  );
}

/* ===============================================================
   HORUS EYE
   =============================================================== */

function HorusEye({
  small = false,
}: {
  small?: boolean;
}) {
  return (
    <svg
      width={small ? 36 : 230}
      height={small ? 24 : 150}
      viewBox="0 0 230 150"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10 68C42 28 82 12 116 15C151 18 190 42 220 69C188 101 153 126 115 132C76 137 39 111 10 68Z"
        stroke="#d6b35a"
        strokeWidth="4"
      />

      <path
        d="M11 68C37 72 54 94 63 120"
        stroke="#d6b35a"
        strokeWidth="4"
      />

      <path
        d="M42 43C68 57 91 62 118 62C147 62 175 52 198 35"
        stroke="#d6b35a"
        strokeWidth="4"
      />

      <circle cx="116" cy="70" r="21" stroke="#d6b35a" strokeWidth="4" />

      <circle cx="116" cy="70" r="7" fill="#d6b35a" />

      <path d="M116 91L108 132" stroke="#d6b35a" strokeWidth="4" />

      <path d="M147 45L168 15" stroke="#d6b35a" strokeWidth="4" />
    </svg>
  );
}
