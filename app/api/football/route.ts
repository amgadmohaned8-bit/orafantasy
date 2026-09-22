// app/api/football/match-details/route.ts
//
// Fix applied: live-football-api.com returns "lineups": {} (an empty
// object, not null) when the lineup hasn't been published yet. We now
// only treat lineups as available when it actually has a home+away
// starting XI, otherwise we return null (so the frontend shows the
// "not out yet" message instead of crashing).

import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://live-football-api.com/api/v1";

export async function GET(req: NextRequest) {
  const matchId = req.nextUrl.searchParams.get("match_id");
  const lang = req.nextUrl.searchParams.get("lang") ?? "en";

  if (!matchId) {
    return NextResponse.json(
      { success: false, message: "match_id is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.LIVE_FOOTBALL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, message: "LIVE_FOOTBALL_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const detailsUrl = `${BASE_URL}/live_match_details?api_key=${apiKey}&match_id=${matchId}&lang=${lang}`;
  const lineupsUrl = `${BASE_URL}/lineups?api_key=${apiKey}&match_id=${matchId}&lang=${lang}`;

  try {
    const [detailsRes, lineupsRes] = await Promise.all([
      fetch(detailsUrl, { next: { revalidate: 15 } }),
      fetch(lineupsUrl, { next: { revalidate: 60 } }),
    ]);

    const detailsJson = await detailsRes.json();
    const lineupsJson = lineupsRes.ok ? await lineupsRes.json() : null;

    if (!detailsJson.success) {
      return NextResponse.json(
        { success: false, message: detailsJson.message ?? "Failed to fetch match details" },
        { status: detailsRes.status }
      );
    }

    const details = detailsJson.data;
    const lineupsData = lineupsJson?.success ? lineupsJson.data : null;

    // The provider returns {} (truthy, but empty) before the lineup is
    // announced. Only treat it as real when both sides actually have a
    // starting XI.
    const hasLineups = Boolean(
      lineupsData &&
        Array.isArray(lineupsData.home?.starting) &&
        lineupsData.home.starting.length > 0 &&
        Array.isArray(lineupsData.away?.starting) &&
        lineupsData.away.starting.length > 0
    );

    const response = {
      success: true,
      match_id: matchId,
      header: details.header,
      minute: details.header?.status?.minute ?? null,
      is_live: details.header?.status?.is_live ?? false,

      events: (details.events ?? []).map((e: any) => ({
        minute: e.time,
        type: e.type,
        side: e.side,
        player: e.detail?.player ?? null,
        assist: e.detail?.assist ?? null,
        score_after: e.detail?.score ?? null,
      })),

      stats: details.stats ?? [],
      venue: details.venue ?? null,
      referee: details.referee ?? null,
      tv_channels: details.tv_channels ?? [],
      player_of_the_match: details.player_of_the_match ?? null,
      csb_url: details.csb_url ?? null,

      lineups: hasLineups
        ? {
            home: lineupsData.home,
            away: lineupsData.away,
            formation: lineupsData.formation ?? { home: null, away: null },
            is_projected: Boolean(lineupsData.is_projected),
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("match-details route error:", err);
    return NextResponse.json(
      { success: false, message: "Unexpected error fetching match details" },
      { status: 500 }
    );
  }
}