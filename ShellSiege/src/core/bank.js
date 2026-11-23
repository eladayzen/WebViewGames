// THE BANK: what you keep, and when you keep it.
//
// Elad, 23 Nov: finishing a level should be a real event. Permanent abilities are WON during a run
// but only BANKED (saved) when the level is cleared:
//
//   clear a level  -> every permanent ability you hold is banked, and the next level unlocks;
//   die mid-level  -> you start the level again with the bank plus ONE pick (the permanent ability
//                     you leaned on most this run), so a run is never wasted but it is far better
//                     to finish the level.
//
// TEMPORARY abilities (the turtles, the stars, the shield, ...) are never banked. They carry from
// level to level while you live and are lost when you die (core/abilities.js clearTemp).
//
// "LOOSE" is the word for a permanent ability you hold that is not in the bank yet. The UI shows
// loose ones dashed and banked ones solid with a padlock, so the rule needs no text.
import { ABILITIES } from './abilities.js';

const permKeys = () => Object.keys(ABILITIES).filter((k) => ABILITIES[k].kind === 'perm' && !ABILITIES[k].locked);

/** The permanent abilities in a build, as counts. */
export function permOf(build) {
  const out = {};
  for (const k of permKeys()) if (build[k] > 0) out[k] = build[k];
  return out;
}

/** What you hold beyond the bank: { key: copies } for each permanent ability with more than banked. */
export function looseOf(build, bank) {
  const out = {};
  for (const k of permKeys()) {
    const n = (build[k] || 0) - (bank[k] || 0);
    if (n > 0) out[k] = n;
  }
  return out;
}

/** A level was cleared: bank everything. Never lowers a count. */
export function bankOnWin(bank, build) {
  const out = { ...bank };
  for (const [k, n] of Object.entries(permOf(build))) out[k] = Math.max(out[k] || 0, Math.min(ABILITIES[k].max, n));
  return out;
}

/** The one loose ability a death keeps: the one with the most loose copies (ties: listed order), or null. */
export function pickToKeep(build, bank) {
  let best = null, bestN = 0;
  for (const [k, n] of Object.entries(looseOf(build, bank))) if (n > bestN) { best = k; bestN = n; }
  return best;
}

/** You died: the bank plus one copy of the pick. */
export function bankOnDeath(bank, build) {
  const out = { ...bank };
  const k = pickToKeep(build, bank);
  if (k) out[k] = Math.min(ABILITIES[k].max, (out[k] || 0) + 1);
  return out;
}

/** A fresh build holding exactly the bank (no temporary abilities). */
export function buildFromBank(bank, createBuild) {
  const b = createBuild();
  for (const [k, n] of Object.entries(bank)) if (k in b) b[k] = n;
  return b;
}
