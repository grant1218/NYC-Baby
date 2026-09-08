/*
 * IN / Mikey FUCK IT brain v0.1
 *
 * Founder-labeled decision layer. This converts the first Mikey training
 * sessions into explicit weights, state transitions and learning signals.
 * It does NOT invent live access, crowd, promoter, ride, dating or venue data.
 * Feed only verified/authorized signals into `context`.
 */

const MIKEY_BASE_WEIGHTS = Object.freeze({
  socialUpside: 9,
  momentum: 10,
  accessCertainty: 10,
  trustedPeople: 8,
  mutualRomanticUpside: 10,
  energy: 8,
  spontaneity: 8,
  proximity: 6,
  novelty: 4,
  trustedRelationship: 8,
  lateNightContinuity: 6,
  decisionBurden: -8,
  doorRisk: -12,
  deadTime: -9,
  travelFriction: -6,
  coordinationFriction: -8
});

function clamp(n, min = 0, max = 1) {
  n = Number(n);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : 0;
}

function safe(v) { return clamp(v); }

function weightsForContext(context = {}) {
  const w = { ...MIKEY_BASE_WEIGHTS };

  // Founder rule: a failed door changes the objective immediately.
  if (context.doorRejected) {
    w.accessCertainty = 16;
    w.momentum = 15;
    w.proximity = 10;
    w.novelty = 1;
    w.decisionBurden = -14;
    w.doorRisk = -20;
    w.deadTime = -15;
  }

  // A dead room should favor a quick credible pivot over theoretical quality.
  if (context.roomDead) {
    w.momentum = 15;
    w.energy = 12;
    w.deadTime = -14;
    w.proximity = 9;
  }

  // If Mikey is impaired, simplify. Do not encourage more drinking.
  if (context.impaired) {
    w.decisionBurden = -18;
    w.travelFriction = -10;
    w.accessCertainty = Math.max(w.accessCertainty, 14);
    w.momentum = Math.max(w.momentum, 13);
  }

  return w;
}

function feature(opportunity, key) {
  return safe(opportunity?.features?.[key]);
}

function scoreOpportunity(opportunity, context = {}) {
  const w = weightsForContext(context);
  const f = opportunity?.features || {};
  let score = 0;
  const reasons = [];

  for (const [key, weight] of Object.entries(w)) {
    const value = safe(f[key]);
    if (!value) continue;
    const contribution = value * weight;
    score += contribution;
    if (Math.abs(contribution) >= 5) reasons.push({ key, contribution });
  }

  // Relationships are hidden utility: bartender, host, promoter, trusted regular.
  if (opportunity?.trustedRelationship === true) {
    score += w.trustedRelationship;
    reasons.push({ key: 'trustedRelationship', contribution: w.trustedRelationship });
  }

  // Never count romantic upside unless the signal represents mutual/consented interest.
  if (f.romanticUpside && !opportunity?.mutualRomanticSignal) {
    score -= safe(f.romanticUpside) * Math.abs(w.mutualRomanticUpside);
    reasons.push({ key: 'unverifiedRomanticSignal', contribution: -safe(f.romanticUpside) * Math.abs(w.mutualRomanticUpside) });
  }

  return { opportunity, score: Math.round(score * 10) / 10, reasons };
}

function rankOpportunities(opportunities = [], context = {}) {
  return opportunities
    .filter(o => o && o.name)
    .map(o => scoreOpportunity(o, context))
    .sort((a, b) => b.score - a.score);
}

function modeForContext(context = {}) {
  if (context.doorRejected) return 'RECOVERY_DOOR';
  if (context.roomDead) return 'RECOVERY_ROOM';
  if (context.sessionActive) return 'LIVE';
  if (context.pregame) return 'PREGAME';
  return 'OPENING';
}

function buildDirective(ranked = [], context = {}) {
  const best = ranked[0] || null;
  const backup = ranked.find((x, i) => i > 0 && x.opportunity?.id !== best?.opportunity?.id) || null;
  const mode = modeForContext(context);

  if (!best) {
    return {
      mode,
      headline: 'I’m still working it.',
      instruction: 'Stay put for a minute. I do not have a credible move worth sending you to yet.',
      unresolved: ['credible next move'],
      best: null,
      backup: null
    };
  }

  const name = best.opportunity.name;
  const unresolved = [];
  if (!best.opportunity.accessVerified) unresolved.push('access');
  if (!best.opportunity.liveEnergyVerified) unresolved.push('live room energy');
  if (!best.opportunity.rideVerified) unresolved.push('ride timing');

  let headline = 'Start here. I’m working what happens after.';
  let instruction = `Go to ${name}. I’ll keep ranking the next move while the night is moving.`;

  if (mode === 'PREGAME') {
    headline = 'Don’t leave yet.';
    instruction = `Keep the pregame moving. ${name} is the best credible opening move right now; I’m still working access, people and the second move.`;
  }
  if (mode === 'RECOVERY_DOOR') {
    headline = 'Forget that door. I’ve got the next move.';
    instruction = `${name} is the recovery move. Access certainty and speed are outranking novelty right now.`;
  }
  if (mode === 'RECOVERY_ROOM') {
    headline = 'This room is dead. Move.';
    instruction = `${name} is the pivot. I’m optimizing for energy, proximity and momentum.`;
  }

  return { mode, headline, instruction, unresolved, best, backup };
}

function learnFromOutcome(currentWeights = {}, outcome = {}) {
  const next = { ...MIKEY_BASE_WEIGHTS, ...currentWeights };
  const bump = (key, amount) => { next[key] = (Number(next[key]) || 0) + amount; };

  if (outcome.accepted) bump('momentum', 0.2);
  if (outcome.extendedNight) bump('momentum', 0.5);
  if (outcome.doorRejected) { bump('accessCertainty', 0.8); bump('doorRisk', -0.8); }
  if (outcome.roomDead) { bump('energy', 0.5); bump('deadTime', -0.5); }
  if (outcome.trustedVenueWorked) bump('trustedRelationship', 0.6);
  if (outcome.mutualRomanticConnection) bump('mutualRomanticUpside', 0.6);
  if (outcome.rejectedByPerson) bump('momentum', 0.1); // graceful continuation, never pressure.
  if (outcome.longIdlePeriod) bump('deadTime', -0.5);
  if (outcome.tooManyChoices) bump('decisionBurden', -0.6);

  return next;
}

function decisionRecord({ context = {}, ranked = [], directive = null, outcome = null } = {}) {
  return {
    version: 'mikey-fuckit-v0.1',
    createdAt: new Date().toISOString(),
    context,
    candidates: ranked.slice(0, 5).map(x => ({
      id: x.opportunity?.id,
      name: x.opportunity?.name,
      score: x.score,
      reasons: x.reasons
    })),
    directive,
    outcome
  };
}

module.exports = {
  MIKEY_BASE_WEIGHTS,
  weightsForContext,
  scoreOpportunity,
  rankOpportunities,
  modeForContext,
  buildDirective,
  learnFromOutcome,
  decisionRecord
};
