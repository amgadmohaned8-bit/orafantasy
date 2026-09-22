import { NextResponse } from "next/server";

const LEAGUE_ID = "8k1xcsyvxapl4jlsluh3eomre";

export async function GET() {
  try {
    const apiKey = process.env.LIVE_FOOTBALL_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "LIVE_FOOTBALL_API_KEY is missing",
        },
        { status: 500 }
      );
    }

    const apiUrl =
      `https://live-football-api.com/api/v1/league_fixtures` +
      `?api_key=${encodeURIComponent(apiKey)}` +
      `&league_id=${encodeURIComponent(LEAGUE_ID)}`;

    const response = await fetch(apiUrl, {
      cache: "no-store",
    });

    const text = await response.text();

    console.log("FOOTBALL API STATUS:", response.status);
    console.log("FOOTBALL API RESPONSE:", text.slice(0, 1000));

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Football API request failed",
          status: response.status,
          details: text.slice(0, 500),
        },
        { status: response.status }
      );
    }

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: "Football API returned invalid JSON",
          details: text.slice(0, 500),
        },
        { status: 502 }
      );
    }

    const weeks = Array.isArray(data?.data?.weeks)
      ? data.data.weeks
      : [];

    const normalizedWeeks = weeks.map((week: any) => ({
      week: Number(week?.week ?? 0),

      matches: Array.isArray(week?.matches)
        ? week.matches.map((match: any) => ({
            id: String(match?.id ?? ""),

            date: match?.date ?? "",
            kickoff: match?.kickoff ?? "",

            status: match?.status?.status ?? "",
            displayStatus: match?.status?.display ?? "",
            isLive: Boolean(match?.status?.is_live),

            home: {
              id: match?.home?.id
                ? String(match.home.id)
                : undefined,

              name: match?.home?.name ?? "Home",

              logo: match?.home?.logo ?? "",

              score: Number(match?.home?.score ?? 0),
            },

            away: {
              id: match?.away?.id
                ? String(match.away.id)
                : undefined,

              name: match?.away?.name ?? "Away",

              logo: match?.away?.logo ?? "",

              score: Number(match?.away?.score ?? 0),
            },
          }))
        : [],
    }));

    return NextResponse.json({
      success: true,

      season: data?.data?.season ?? "",

      league: {
        id: data?.data?.league_id ?? LEAGUE_ID,
        name: data?.data?.league_name ?? "Egyptian Premier League",
      },

      weeks: normalizedWeeks,
    });
  } catch (error) {
    console.error("Football route error:", error);

    return NextResponse.json(
      {
        error: "Something went wrong",
      },
      { status: 500 }
    );
  }
}