import assert from "node:assert/strict";
import { normalizePosition, cleanName, extractCurrentSquad } from "../scripts/lib/parse-squad.mjs";

for (const [raw, want] of [["GK","GK"],["Goalkeeper","GK"],["DF","DEF"],["Defender","DEF"],
  ["MF","MID"],["Midfielder","MID"],["FW","FWD"],["Attacker","FWD"],["Forward","FWD"],["Striker","FWD"],["  fw ","FWD"]])
  assert.equal(normalizePosition(raw), want, raw);
assert.equal(normalizePosition("coach"), null);
assert.equal(normalizePosition(""), null);

assert.equal(cleanName("[[Ahmed Ali (footballer, born 1996)|Ahmed Ali]]"), "Ahmed Ali");
assert.equal(cleanName("[[Zizo]]"), "Zizo");
assert.equal(cleanName("[[Mohamed Hany (footballer)]]"), "Mohamed Hany");
assert.equal(cleanName("Mohamed El Shenawy (captain)"), "Mohamed El Shenawy");
assert.equal(cleanName("[[X]]<ref>note</ref>"), "X");

const wt = `
== History ==
{{Fs player|no=99|nat=EGY|pos=GK|name=Not In Squad}}
== Players ==
=== Current squad ===
{{Fs start}}
{{Fs player|no=1|nat=EGY|pos=GK|name=[[Mohamed El Shenawy]]|other=[[Captain (association football)|captain]]}}
{{Fs player|no=3|nat={{flag|MAR}}|pos=DF|name=[[Achraf Dari]]}}
{{Fs player |no= 10 |nat=ALG |pos=FW |name=[[Monsef Bakrar]]}}
{{Fs player|no=|nat=EGY|pos=MF|name=[[Ibrahim (footballer, born 2005)|Ibrahim Adel]]}}
{{Fs player|no=1|nat=EGY|pos=GK|name=[[Mohamed El Shenawy]]}}
{{Fs end}}
=== Out on loan ===
{{Fs player|no=—|nat=EGY|pos=FW|name=[[Loaned Guy]]}}
=== Reserve team ===
{{Fs player|no=50|nat=EGY|pos=DF|name=[[Reserve Guy]]}}
== Coaching staff ==
{{Fs player|no=77|nat=EGY|pos=DF|name=Staff Guy}}
`;
const squad = extractCurrentSquad(wt);
assert.deepEqual(squad.map(p => p.name), ["Mohamed El Shenawy","Achraf Dari","Monsef Bakrar","Ibrahim Adel"]);
assert.deepEqual(squad.map(p => p.position), ["GK","DEF","FWD","MID"]);
assert.deepEqual(squad.map(p => p.number), [1,3,10,undefined]);
console.log("parse-squad: all assertions passed (" + squad.length + " players parsed)");

// sibling section (Al Ahly-style): unregistered players listed next to "Current squad"
const wt2 = `== Players ==
=== First-team squad ===
{{Fs player|no=1|pos=GK|name=[[A]]}}
=== Other players under contract ===
{{Fs player|no=|pos=DF|name=[[B]]}}
=== Out on loan ===
{{Fs player|no=|pos=FW|name=[[C]]}}
== Staff ==
`;
assert.deepEqual(extractCurrentSquad(wt2).map(p => p.name), ["A", "B"]);
console.log("parse-squad: sibling-section case passed");
