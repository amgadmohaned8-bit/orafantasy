"use client";

import { useEffect, useMemo, useState } from "react";
import { IBM_Plex_Sans_Arabic, Reem_Kufi } from "next/font/google";
import "./players.css";

const display = Reem_Kufi({
  subsets: ["arabic", "latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});
const body = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

type Pos = "GK" | "DEF" | "MID" | "FWD";

interface ApiPlayer {
  id: string;
  name: string;
  position: Pos;
  teamId: string;
  teamName: string;
  photo?: string;
  number?: number;
  price: number;
}

interface ApiOk {
  players: ApiPlayer[];
  count: number;
  season: string;
}

interface ApiErr {
  error: string;
  message: string;
  hint?: string;
}

// Zones run from our own goal to the attack. In an RTL page GK lands on the right.
const ZONES: { pos: Pos; label: string }[] = [
  { pos: "GK", label: "حراس المرمى" },
  { pos: "DEF", label: "المدافعون" },
  { pos: "MID", label: "لاعبو الوسط" },
  { pos: "FWD", label: "المهاجمون" },
];

const TAG: Record<Pos, string> = { GK: "حارس", DEF: "مدافع", MID: "وسط", FWD: "مهاجم" };

type Sort = "number" | "price" | "name";
const PAGE = 48;

// Adjust to match how /squad shows prices.
const formatPrice = (price: number) => `${price.toFixed(1)}M`;

export default function PlayersPage() {
  const [data, setData] = useState<ApiOk | null>(null);
  const [error, setError] = useState<ApiErr | null>(null);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<Pos | "ALL">("ALL");
  const [team, setTeam] = useState("ALL");
  const [sort, setSort] = useState<Sort>("number");
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/players", { signal: ctrl.signal })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw json as ApiErr;
        setData(json as ApiOk);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        const known = e as Partial<ApiErr>;
        setError(
          known?.message
            ? (known as ApiErr)
            : { error: "NETWORK", message: "تعذّر الاتصال بالخادم.", hint: "تأكد أن المشروع يعمل ثم أعد تحميل الصفحة." },
        );
      });
    return () => ctrl.abort();
  }, []);

  const teams = useMemo(() => {
    const map = new Map<string, string>();
    data?.players.forEach((p) => map.set(p.teamId, p.teamName));
    return [...map].map(([id, name]) => ({ id, name }));
  }, [data]);

  // filters other than position, so the pitch counts react to search and club
  const scoped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.players ?? []).filter(
      (p) => (team === "ALL" || p.teamId === team) && (!needle || p.name.toLowerCase().includes(needle)),
    );
  }, [data, q, team]);

  const counts = useMemo(() => {
    const c: Record<Pos, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    scoped.forEach((p) => c[p.position]++);
    return c;
  }, [scoped]);

  const list = useMemo(() => {
    const rows = pos === "ALL" ? [...scoped] : scoped.filter((p) => p.position === pos);
    rows.sort((a, b) => {
      if (sort === "price") return b.price - a.price || a.name.localeCompare(b.name);
      if (sort === "name") return a.name.localeCompare(b.name);
      return (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name);
    });
    return rows;
  }, [scoped, pos, sort]);

  const filtersOn = pos !== "ALL" || team !== "ALL" || q.trim() !== "";
  const reset = () => {
    setQ("");
    setPos("ALL");
    setTeam("ALL");
    setVisible(PAGE);
  };

  return (
    <div className={`pl-root ${display.variable} ${body.variable}`} dir="rtl" lang="ar">
      <header className="pl-wrap pl-hero">
        <h1 className="pl-title">لاعبو دوري أورا {data?.season ?? "2026/27"}</h1>
        <p className="pl-sub">
          {data
            ? `${data.count} لاعبًا من ${teams.length} ${teams.length === 1 ? "نادٍ" : "أندية"}. اختر مركزًا على الملعب لتصفية القائمة.`
            : "جارٍ تحميل قوائم الأندية…"}
        </p>

        <div className="pl-lanes" role="group" aria-label="تصفية حسب المركز">
          {ZONES.map((z) => (
            <button
              key={z.pos}
              type="button"
              className="pl-lane"
              aria-pressed={pos === z.pos}
              onClick={() => {
                setPos(pos === z.pos ? "ALL" : z.pos);
                setVisible(PAGE);
              }}
            >
              <span className="pl-lane-count">{data ? counts[z.pos] : "–"}</span>
              <span className="pl-lane-name">{z.label}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="pl-bar">
        <div className="pl-wrap pl-bar-inner">
          <div className="pl-search">
            <label className="pl-sr" htmlFor="pl-q">
              ابحث باسم اللاعب
            </label>
            <input
              id="pl-q"
              className="pl-field"
              style={{ width: "100%" }}
              type="search"
              placeholder="ابحث باسم اللاعب"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setVisible(PAGE);
              }}
            />
          </div>
          <div>
            <label className="pl-sr" htmlFor="pl-team">
              النادي
            </label>
            <select
              id="pl-team"
              className="pl-field"
              style={{ width: "100%" }}
              value={team}
              onChange={(e) => {
                setTeam(e.target.value);
                setVisible(PAGE);
              }}
            >
              <option value="ALL">كل الأندية</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="pl-sr" htmlFor="pl-sort">
              الترتيب
            </label>
            <select
              id="pl-sort"
              className="pl-field"
              style={{ width: "100%" }}
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="number">رقم القميص</option>
              <option value="price">الأعلى سعرًا</option>
              <option value="name">الاسم</option>
            </select>
          </div>
        </div>
      </div>

      <main className="pl-wrap">
        {error && (
          <section className="pl-state" role="alert">
            <h2>تعذّر تحميل اللاعبين</h2>
            <p>{error.message}</p>
            {error.hint && <p>{error.hint}</p>}
            <p>
              <code>{error.error}</code>
            </p>
          </section>
        )}

        {!error && !data && (
          <div className="pl-grid" style={{ marginTop: 20 }} aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="pl-skel" />
            ))}
          </div>
        )}

        {data && (
          <>
            <div className="pl-meta" aria-live="polite">
              <span>
                يعرض {Math.min(visible, list.length)} من {list.length} لاعب
              </span>
              {filtersOn && (
                <button type="button" className="pl-link" onClick={reset}>
                  مسح التصفية
                </button>
              )}
            </div>

            {list.length === 0 ? (
              <section className="pl-state">
                <h2>لا يوجد لاعبون بهذه المعايير</h2>
                <p>غيّر كلمة البحث أو اختر مركزًا أو ناديًا آخر.</p>
                <button type="button" className="pl-link" onClick={reset}>
                  مسح التصفية
                </button>
              </section>
            ) : (
              <>
                <div className="pl-grid">
                  {list.slice(0, visible).map((p) => (
                    <article key={p.id} className="pl-card" data-pos={p.position}>
                      <span className="pl-num" aria-hidden="true">
                        {p.number ?? ""}
                      </span>
                      {p.photo && (
                        <div className="pl-face">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.photo} alt="" loading="lazy" />
                        </div>
                      )}
                      <h2 className="pl-name">{p.name}</h2>
                      <p className="pl-team">{p.teamName}</p>
                      <div className="pl-foot">
                        <span className="pl-tag">{TAG[p.position]}</span>
                        <span className="pl-price">{formatPrice(p.price)}</span>
                      </div>
                    </article>
                  ))}
                </div>
                {visible < list.length && (
                  <button type="button" className="pl-more" onClick={() => setVisible((v) => v + PAGE)}>
                    عرض المزيد
                  </button>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
