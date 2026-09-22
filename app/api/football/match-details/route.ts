// app/api/football/match-details/route.ts
//
// Combines two live-football-api.com endpoints into one response for a
// single match page:
//   - /live_match_details -> score, minute, events (goals + who scored +
//     minute + assist), stats
//   - /lineups             -> starting XI, subs, coach, formation,
//                             is_projected (true = predicted lineup,
//                             false = official confirmed lineup)
//
// Usage from the frontend:
//   fetch(`/api/football/match-details?match_id=${matchId}`)

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
    // Fetch both in parallel to save time.
    const [detailsRes, lineupsRes] = await Promise.all([
      fetch(detailsUrl, { next: { revalidate: 15 } }), // refresh every 15s for live matches
      fetch(lineupsUrl, { next: { revalidate: 60 } }), // lineups change less often
    ]);

    const detailsJson = await detailsRes.json();
    // Lineups may not exist yet (>1h before kickoff) -> API can 4xx/empty, don't fail the whole request for that.
    const lineupsJson = lineupsRes.ok ? await lineupsRes.json() : null;

    if (!detailsJson.success) {
      return NextResponse.json(
        { success: false, message: detailsJson.message ?? "Failed to fetch match details" },
        { status: detailsRes.status }
      );
    }

    const details = detailsJson.data;
    const lineups = lineupsJson?.success ? lineupsJson.data : null;

    // Shape a clean, ready-to-render payload for the match page.
    const response = {
      success: true,
      match_id: matchId,
      header: details.header,
      minute: details.header?.status?.minute ?? null,
      is_live: details.header?.status?.is_live ?? false,

      // Goals with scorer, minute and assist (assist is included by the
      // provider only when one was recorded on that goal).
      events: (details.events ?? []).map((e: any) => ({
        minute: e.time,
        type: e.type, // 'goal' | 'own_goal' | 'yellow_card' | 'red_card' | 'substitution'
        side: e.side, // 'home' | 'away'
        player: e.detail?.player ?? null,
        assist: e.detail?.assist ?? null, // present only on goal events with an assist
        score_after: e.detail?.score ?? null,
      })),

      stats: details.stats ?? [],
      venue: details.venue ?? null,
      referee: details.referee ?? null,
      tv_channels: details.tv_channels ?? [],
      player_of_the_match: details.player_of_the_match ?? null,
      csb_url: details.csb_url ?? null, // ready-made live match visualization iframe

      // Lineup: null until ~1h before kickoff. is_projected=true means it's
      // a predicted lineup, false means it's the official confirmed one.
      lineups: lineups
        ? {
            home: lineups.home,
            away: lineups.away,
            formation: lineups.formation,
            is_projected: lineups.is_projected,
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