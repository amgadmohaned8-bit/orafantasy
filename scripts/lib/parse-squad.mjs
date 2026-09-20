// Pure helpers for turning a Wikipedia club page (wikitext) into squad rows.
// No network access here so it can be unit-tested offline.

const POSITION_MAP = {
  GK: "GK", G: "GK", GOALKEEPER: "GK", KEEPER: "GK",
  DF: "DEF", DEF: "DEF", D: "DEF", DEFENDER: "DEF",
  CB: "DEF", LB: "DEF", RB: "DEF", LWB: "DEF", RWB: "DEF", SW: "DEF",
  MF: "MID", MID: "MID", M: "MID", MIDFIELDER: "MID",
  CM: "MID", DM: "MID", CDM: "MID", AM: "MID", CAM: "MID", LM: "MID", RM: "MID",
  FW: "FWD", FWD: "FWD", F: "FWD", ATTACKER: "FWD", FORWARD: "FWD", STRIKER: "FWD",
  CF: "FWD", ST: "FWD", LW: "FWD", RW: "FWD", WINGER: "FWD", SS: "FWD",
};

/** Maps any source position label to GK | DEF | MID | FWD (or null if unknown). */
export function normalizePosition(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toUpperCase().replace(/[^A-Z]/g, "");
  return POSITION_MAP[key] ?? null;
}

/** "[[Ahmed Ali (footballer, born 1996)|Ahmed Ali]]" -> "Ahmed Ali" */
export function cleanName(raw) {
  if (!raw) return "";
  let s = String(raw);
  s = s.replace(/<ref[\s\S]*?(<\/ref>|\/>)/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/\{\{[^{}]*\}\}/g, "");
  s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_, t) => t.replace(/\s*\([^)]*\)\s*$/, ""));
  s = s.replace(/'{2,}/g, "");
  s = s.replace(/\s*\((captain|vice-captain|c|vc|on loan|loan)\)\s*/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Find the index just after the "}}" that closes the "{{" at `start`. */
function findTemplateEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    const two = text.slice(i, i + 2);
    if (two === "{{") { depth++; i++; }
    else if (two === "}}") { depth--; i++; if (depth === 0) return i + 1; }
  }
  return -1;
}

/** Split template body on top-level "|" (ignoring pipes inside [[ ]] and {{ }}). */
function splitParams(body) {
  const out = [];
  let cur = "", link = 0, tpl = 0;
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "[[") { link++; cur += two; i++; continue; }
    if (two === "]]") { link = Math.max(0, link - 1); cur += two; i++; continue; }
    if (two === "{{") { tpl++; cur += two; i++; continue; }
    if (two === "}}") { tpl = Math.max(0, tpl - 1); cur += two; i++; continue; }
    if (body[i] === "|" && !link && !tpl) { out.push(cur); cur = ""; continue; }
    cur += body[i];
  }
  out.push(cur);
  return out;
}

const PLAYER_TEMPLATE =
  /\{\{\s*(?:fs player|fs2 player|football squad player|football squad2 player)\s*(?=\|)/gi;

/** Parse every {{Fs player|no=..|pos=..|name=..}} template in a chunk of wikitext. */
export function parsePlayerTemplates(text) {
  const players = [];
  PLAYER_TEMPLATE.lastIndex = 0;
  let m;
  while ((m = PLAYER_TEMPLATE.exec(text))) {
    const end = findTemplateEnd(text, m.index);
    if (end < 0) continue;
    const inner = text.slice(m.index + 2, end - 2);
    const params = {};
    for (const part of splitParams(inner).slice(1)) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      params[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
    }
    const name = cleanName(params.name);
    const position = normalizePosition(params.pos);
    const numRaw = parseInt(String(params.no ?? "").replace(/\D/g, ""), 10);
    if (!name || !position) continue;
    players.push({ name, position, number: Number.isFinite(numRaw) ? numRaw : undefined });
  }
  return players;
}

const HEADING = /^(={2,6})\s*(.+?)\s*\1\s*$/;
const SQUAD_TITLE = /^((current|first[- ]team|senior) )?(squad|players)$|^other players|under contract/i;
const EXCLUDED_TITLE = /reserve|youth|academy|women|u-?\d{2}|staff|coach|technical/i;

/**
 * Take only the "Current squad" section of a club page:
 * skips "Out on loan" sub-sections and reserve/youth sections.
 */
export function extractCurrentSquad(wikitext) {
  const lines = wikitext.split(/\r?\n/);
  let squadLevel = null;
  let skip = false;
  const chunks = [];
  for (const line of lines) {
    const h = line.match(HEADING);
    if (h) {
      const level = h[1].length;
      const title = h[2].replace(/<[^>]+>/g, "").replace(/\[\[|\]\]/g, "").trim();
      if (squadLevel !== null && level <= squadLevel) { squadLevel = null; skip = false; }
      if (squadLevel === null) {
        if (SQUAD_TITLE.test(title) && !EXCLUDED_TITLE.test(title)) squadLevel = level;
        continue;
      }
      skip = /loan/i.test(title) || EXCLUDED_TITLE.test(title);
      continue;
    }
    if (squadLevel !== null && !skip) chunks.push(line);
  }
  const seen = new Set();
  return parsePlayerTemplates(chunks.join("\n")).filter((p) => {
    const key = `${p.number ?? "-"}|${p.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Debug helper: which headings exist and how many player-like templates each holds. */
export function describePage(wikitext) {
  const rows = [];
  let cur = { level: 0, title: "(intro)", templates: {} };
  rows.push(cur);
  for (const line of wikitext.split(/\r?\n/)) {
    const h = line.match(HEADING);
    if (h) {
      cur = { level: h[1].length, title: h[2].replace(/<[^>]+>|\[\[|\]\]/g, "").trim(), templates: {} };
      rows.push(cur);
      continue;
    }
    for (const m of line.matchAll(/\{\{\s*([^|{}\n]*?player[^|{}\n]*?)\s*\|/gi)) {
      const k = m[1].toLowerCase();
      cur.templates[k] = (cur.templates[k] ?? 0) + 1;
    }
  }
  return rows.filter((r) => Object.keys(r.templates).length || /squad|player|loan|contract/i.test(r.title));
}
