#!/usr/bin/env node
/**
 * Builds data/players-2026-27.json from Wikipedia's free public API.
 * No API key, no paid source. Run it on a machine with internet access:
 *
 *   npm run build:players              # all 20 clubs
 *   npm run build:players -- --only=zamalek,pyramids
 *
 * Clubs that fail (page not found, no squad section, fewer than 11 players)
 * keep whatever is already in the JSON file, and are listed in the summary.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractCurrentSquad, describePage } from "./lib/parse-squad.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "players-2026-27.json");
const API = "https://en.wikipedia.org/w/api.php";
const UA = "fantasy-ora-data-builder/1.0 (personal fantasy football project; https://en.wikipedia.org/wiki/Wikipedia:Bot_policy)";
const GAP_MS = 1500; // pause between requests so Wikipedia does not rate-limit us
const MIN_PLAYERS = 11;

// `name` is what ends up in Player.teamName -> it is passed to computePrice().
// Keep these identical to the team names used in src/fantasy/pricing.ts.
const CLUBS = [
  { id: "al-ahly", name: "Al Ahly", titles: ["Al Ahly SC"] },
  { id: "zamalek", name: "Zamalek", titles: ["Zamalek SC"] },
  { id: "pyramids", name: "Pyramids", titles: ["Pyramids FC"] },
  { id: "al-masry", name: "Al Masry", titles: ["Al Masry SC"] },
  { id: "al-ittihad", name: "Al Ittihad", titles: ["Al Ittihad Alexandria Club"] },
  { id: "enppi", name: "ENPPI", titles: ["ENPPI SC"] },
  { id: "smouha", name: "Smouha", titles: ["Smouha SC"] },
  { id: "petrojet", name: "Petrojet", titles: ["Petrojet SC"] },
  { id: "tala-el-gaish", name: "Tala'ea El Gaish", titles: ["Tala'ea El Gaish SC"] },
  { id: "mokawloon", name: "Al Mokawloon Al Arab", titles: ["Al Mokawloon Al Arab SC"] },
  { id: "ghazl-el-mahalla", name: "Ghazl El Mahalla", titles: ["Ghazl El Mahalla SC"] },
  { id: "el-qanah", name: "El Qanah", titles: ["El Qanah FC"] },
  { id: "el-gouna", name: "El Gouna", titles: ["El Gouna FC"] },
  { id: "ceramica-cleopatra", name: "Ceramica Cleopatra", titles: ["Ceramica Cleopatra FC"] },
  { id: "modern-sport", name: "Modern Sport", titles: ["Modern Sport FC", "Future FC (Egypt)"] },
  { id: "national-bank", name: "National Bank of Egypt", titles: ["National Bank of Egypt SC"] },
  { id: "wadi-degla", name: "Wadi Degla", titles: ["Wadi Degla SC"] },
  { id: "zed", name: "ZED", titles: ["ZED FC"] },
  { id: "abou-qir", name: "Abou Qir Fertilizers", titles: ["Abou Qir Fertilizers SC"], search: "Abou Qir Fertilizers football club Egypt" },
  { id: "asyut-petroleum", name: "Asyut Petroleum", titles: ["Asyut Petroleum SC"], search: "Asyut Petroleum football club Egypt" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: "json", formatversion: "2", ...params })}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (res.ok) return res.json();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 6) throw new Error(`HTTP ${res.status} for ${params.action}`);
    const header = Number(res.headers?.get?.("retry-after"));
    const wait = Math.max(Number.isFinite(header) && header > 0 ? header * 1000 : 0, 3000 * 2 ** attempt);
    process.stdout.write(`\n    (HTTP ${res.status}, waiting ${Math.round(wait / 1000)}s then retrying)\n    `);
    await sleep(wait);
  }
}

async function getWikitext(title) {
  const json = await api({ action: "parse", page: title, prop: "wikitext", redirects: "1" });
  if (json.error) return null;
  return { title: json.parse.title, wikitext: json.parse.wikitext };
}

async function searchTitle(query) {
  const json = await api({ action: "query", list: "search", srsearch: query, srlimit: "1" });
  return json.query?.search?.[0]?.title ?? null;
}

async function loadClub(club) {
  const candidates = [...club.titles];
  for (let i = 0; i <= candidates.length; i++) {
    let title = candidates[i];
    if (i === candidates.length) {
      title = await searchTitle(club.search ?? `${club.name} football club Egypt`);
      if (!title) break;
    }
    const page = await getWikitext(title);
    await sleep(GAP_MS);
    if (!page) continue;
    const players = extractCurrentSquad(page.wikitext);
    if (players.length >= MIN_PLAYERS) return { title: page.title, players };
  }
  return null;
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(OUT, "utf8"));
  } catch {
    return { season: "2026/27", teams: [], players: [] };
  }
}

async function debugClub(id) {
  const club = CLUBS.find((c) => c.id === id);
  if (!club) return console.log(`Unknown club id "${id}". Valid: ${CLUBS.map((c) => c.id).join(", ")}`);
  for (const title of [...club.titles, null]) {
    const t = title ?? (await searchTitle(club.search ?? `${club.name} football club Egypt`));
    if (!t) break;
    const page = await getWikitext(t);
    await sleep(GAP_MS);
    if (!page) { console.log(`- "${t}": page not found`); continue; }
    console.log(`\n=== ${page.title} (parsed ${extractCurrentSquad(page.wikitext).length} players) ===`);
    for (const r of describePage(page.wikitext))
      console.log(`${"  ".repeat(Math.max(0, r.level - 2))}[h${r.level}] ${r.title}  ${JSON.stringify(r.templates)}`);
  }
}

async function main() {
  const dbg = process.argv.find((a) => a.startsWith("--debug="));
  if (dbg) return debugClub(dbg.slice(8));
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? new Set(onlyArg.slice(7).split(",").map((s) => s.trim())) : null;
  const data = await readExisting();
  const summary = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const club of CLUBS) {
    if (only && !only.has(club.id)) continue;
    process.stdout.write(`• ${club.name.padEnd(24)} `);
    try {
      const result = await loadClub(club);
      if (!result) {
        console.log("no usable squad found (kept existing data)");
        summary.push({ club: club.name, status: "FAILED", count: data.players.filter((p) => p.teamId === club.id).length });
        continue;
      }
      data.players = data.players.filter((p) => p.teamId !== club.id);
      data.teams = data.teams.filter((t) => t.id !== club.id);
      data.teams.push({
        id: club.id,
        name: club.name,
        source: `Wikipedia: ${result.title}`,
        fetchedAt: today,
      });
      for (const p of result.players) data.players.push({ ...p, teamId: club.id });
      console.log(`${result.players.length} players  <- ${result.title}`);
      summary.push({ club: club.name, status: "OK", count: result.players.length });
    } catch (err) {
      console.log(`error: ${err.message} (kept existing data)`);
      summary.push({ club: club.name, status: "ERROR", count: 0 });
    }
  }

  const order = new Map(CLUBS.map((c, i) => [c.id, i]));
  data.teams.sort((a, b) => order.get(a.id) - order.get(b.id));
  data.players.sort(
    (a, b) => order.get(a.teamId) - order.get(b.teamId) || (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name),
  );
  data.season = "2026/27";
  data.updatedAt = new Date().toISOString();

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");

  const ok = summary.filter((s) => s.status === "OK").length;
  console.log(`\nWrote ${data.players.length} players / ${data.teams.length} clubs -> ${path.relative(ROOT, OUT)}`);
  const missing = CLUBS.filter((c) => !data.teams.some((t) => t.id === c.id)).map((c) => c.name);
  if (missing.length) console.log(`Clubs still without players: ${missing.join(", ")}`);
  if (only === null && ok < CLUBS.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
