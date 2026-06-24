// functions/_lib/funnel-engine.js
// ─────────────────────────────────────────────────────────────────────────────
// MarkCMO / WETYR Fractional Acquisition Funnel - deterministic decision engine.
//
// PURE FUNCTIONS ONLY. No I/O, no fetch, no env. Same answers in => same
// scores, segment, growth stage, engagement type, tier and line items out,
// every time. The API functions (functions/api/funnel/*) handle persistence
// and notifications; this file decides.
//
// Three things make this engine different from a generic lead scorer, and all
// three come straight from how Mark sells:
//
//   1. GROWTH STAGE (the WETYR M&A lens). A business is only ever in one of
//      three stages: GROWING, SUCCESSION (planning to exit / hand off), or
//      ACQUIRING (buying more businesses). Strategy is tailored to the stage,
//      and SUCCESSION / ACQUIRING route to the WETYR M&A service line.
//
//   2. MARKETING CAPACITY -> ENGAGEMENT TYPE. How robust the prospect's
//      marketing department is decides whether they need a STRATEGY partner
//      (they have the hands to execute, we are the brain/engine) or a
//      STRATEGY + EXECUTION partner - the full "VIP" package where we run it
//      internally end to end.
//
//   3. POSITIONING. We are not an agency and not a paint job on the car. We
//      are the engine that drives the transmission to move the vehicle where
//      the owner wants it to go. Everything ties to revenue. That voice lives
//      in the proposal model this engine produces.
//
// All money numbers are DEFAULTS and overridable by passing a `pricing` object
// (admin console config) into the package/proposal functions.
// ─────────────────────────────────────────────────────────────────────────────

// ───────────────────────── Pricing library (defaults) ───────────────────────
// Anchored to published markcmo.com pricing. Admin console may override.
export const DEFAULT_PRICING = {
  tiers: {
    FOUNDATION: { label: 'Foundation', monthly: 8000,  cadence: 'Monthly' },
    MOMENTUM:   { label: 'Momentum',   monthly: 12000, cadence: 'Biweekly' },
    EMPIRE:     { label: 'Empire',     monthly: 20000, cadence: 'Weekly' },
    CUSTOM:     { label: 'Custom',     monthly: null,  cadence: 'Custom' },
  },
  // Annual: pay for 11 months on a 12-month prepay (1 month free).
  annualMonthsCharged: 11,
  addons: {
    audit_90day:        { label: 'Full Marketing Audit + 90-Day Plan', price: 3500,  recurrence: 'one_time' },
    brand_audit:        { label: 'Brand & Competitive Edge Audit',     price: 1500,  recurrence: 'one_time' },
    funnel_audit:       { label: 'Funnel & Conversion Audit',          price: 2500,  recurrence: 'one_time' },
    growth_audit:       { label: 'Full Business Growth Audit',         price: 7500,  recurrence: 'one_time' },
    vip_day:            { label: 'CMO VIP Day (strategy intensive)',   price: 4500,  recurrence: 'one_time' },
    board_deck:         { label: 'Board / Investor Presentation',      price: 2000,  recurrence: 'one_time' },
    ai_automation:      { label: 'AI & Automation Build-Out',          price: 2500,  recurrence: 'one_time' },
    ma_readiness:       { label: 'M&A Readiness Advisory (WETYR)',     price: 5000,  recurrence: 'one_time' },
    acquisition_advisory:{ label: 'Acquisition & Integration Advisory (WETYR)', price: 5000, recurrence: 'one_time' },
    seo_aeo_geo:        { label: 'SEO / AEO / GEO Authority Build',    price: null,  recurrence: 'scoped' },
    founders_circle:    { label: 'Founders Circle (advisory, annual)', price: 25000, recurrence: 'annual' },
  },
};

// ───────────────────────── Enumerations ─────────────────────────────────────
export const SEGMENTS = ['HIGH_TICKET_SERVICE', 'DTC_CONSUMER', 'ENTERPRISE_B2B', 'GROWTH_SAAS', 'UNDETERMINED'];
export const GROWTH_STAGES = ['GROWING', 'SUCCESSION', 'ACQUIRING', 'UNDETERMINED'];
export const MARKETING_CAPACITY = ['NONE', 'SOLO', 'LEAN', 'ROBUST', 'AGENCY'];
export const ENGAGEMENT_TYPES = ['STRATEGY_ONLY', 'STRATEGY_PLUS_EXECUTION'];
export const BUDGET_BANDS = ['UNDER_5K', 'B5_8K', 'B8_12K', 'B12_20K', 'OVER_20K'];
export const TIERS = ['FOUNDATION', 'MOMENTUM', 'EMPIRE', 'CUSTOM'];

// ───────────────────────── Stage 1: pre-qualifier ───────────────────────────
//
// answers keys (all selectable controls):
//   pre_business_type    -> segment tag
//   pre_revenue          -> points + band flags
//   pre_growth_stage     -> GROWING | SUCCESSION | ACQUIRING   (NEW - M&A lens)
//   pre_marketing_dept   -> NONE | SOLO | LEAN | ROBUST | AGENCY (NEW)
//   pre_primary_need     -> points + need map
//   pre_budget_band      -> points + band
//   pre_urgency          -> points
//   pre_role             -> points + flag
//   pre_authority        -> points + flag
//
export function scorePreQualifier(answers = {}) {
  const flags = [];
  let score = 0;

  // Q1 - segment tag (0 pts; sets segment)
  const segmentTag = mapSegmentTag(answers.pre_business_type);

  // Q-stage - growth stage / M&A lens (0 pts; sets stage). Strategic value is
  // rewarded in the full score, not the pre-gate.
  const growth_stage = mapGrowthStage(answers.pre_growth_stage);

  // Q-marketing - department robustness (0 pts here; drives engagement type)
  const marketing_capacity = mapMarketingCapacity(answers.pre_marketing_dept);

  // Q2 - revenue
  const revPts = { under_1m: 0, '1_3m': 10, '3_10m': 20, '10_50m': 25, '50m_plus': 20 };
  score += revPts[answers.pre_revenue] ?? 0;
  if (answers.pre_revenue === 'under_1m') flags.push('below_floor');
  if (answers.pre_revenue === '50m_plus') flags.push('route_mark');

  // Q3 - primary need
  const needPts = { generate: 8, nurture: 8, architect: 6, map: 5, engineer: 6, track: 8 };
  score += needPts[answers.pre_primary_need] ?? 0;
  const need_map = answers.pre_primary_need || null;

  // Q4 - budget band
  const { pts: budgetPts, band: budget_band } = mapBudgetBand(answers.pre_budget_band);
  score += budgetPts;
  if (budget_band === 'UNDER_5K') flags.push('below_budget');

  // Q5 - urgency
  const urgPts = { urgent: 15, within_30: 10, '1_3mo': 5, exploring: 0 };
  score += urgPts[answers.pre_urgency] ?? 0;

  // Q6 - role
  const rolePts = { founder: 10, c_suite: 8, vp_director: 5, manager: 2 };
  score += rolePts[answers.pre_role] ?? 0;
  if (answers.pre_role === 'manager') flags.push('not_decision_maker');

  // Q7 - authority
  const authPts = { decides: 10, influences: 5, no: 0 };
  score += authPts[answers.pre_authority] ?? 0;
  if (answers.pre_authority === 'influences') flags.push('needs_buyin');
  if (answers.pre_authority === 'no') flags.push('no_authority');

  // Disposition
  let disposition;
  const hardDisqualify =
    (answers.pre_revenue === 'under_1m' && budget_band === 'UNDER_5K') ||
    (flags.includes('no_authority') && answers.pre_role === 'manager');

  if (hardDisqualify) {
    disposition = 'DISQUALIFIED';
  } else if (score >= 62) {
    disposition = 'HOT';
  } else if (score >= 40) {
    disposition = 'WARM';
  } else if (score >= 18) {
    disposition = 'COOL';
  } else {
    disposition = 'DISQUALIFIED';
  }

  // Routing of the prospect after Stage 1 (not consultant assignment - that
  // happens post-call in the intake step).
  const route =
    disposition === 'DISQUALIFIED'
      ? { action: 'free_resources', cta: '/leak-audit.html', reason: hardDisqualify ? 'below_floor' : 'low_fit' }
      : disposition === 'COOL'
      ? { action: 'soft_nurture', cta: '/leak-audit.html', reason: 'low_priority' }
      : { action: 'book_call', cta: '/book.html', priority: disposition === 'HOT' };

  return {
    pre_score: score,
    segment_tag: segmentTag,
    growth_stage,
    marketing_capacity,
    budget_band,
    need_map,
    flags,
    disposition,
    route,
  };
}

// ───────────────────────── Stage 2: deep intake ─────────────────────────────
//
// Receives the prospect's persisted Stage-1 result plus the full intake
// answers. Section B locks the segment; a dedicated stage question locks the
// growth stage; the marketing-department detail locks engagement type.
//
export function scoreIntake({ pre = {}, answers = {} } = {}) {
  const flags = [];
  const tags = new Set();

  // ---- Section weights (intake_score, 0..~120) ----
  let intake = 0;

  // Budget confirmed (D1/D2) up to 40
  const { pts: confBudgetPts, band: confBudgetBand } = mapBudgetBand(answers.d_monthly_budget);
  intake += confBudgetPts;
  if (confBudgetBand === 'UNDER_5K') flags.push('below_budget');
  const annualPts = { yes: 8, maybe: 5, no: 3 };
  intake += annualPts[answers.d_annual] ?? 0;
  if (answers.d_annual === 'yes') tags.add('annual_pref');

  // Decision authority clean (D5) up to 20
  const signoffPts = { just_me: 10, partner: 7, board: 4, unsure: 2 };
  intake += signoffPts[answers.d_signoff] ?? 0;
  if (answers.d_signoff === 'board') flags.push('committee_sale');
  if (answers.d_signoff === 'unsure') flags.push('unclear_authority');

  // Urgency / hard deadline (D6) up to 15
  const deadlinePts = { within_30: 15, this_quarter: 10, this_year: 6, none: 2 };
  intake += deadlinePts[answers.d_deadline] ?? 0;
  if (answers.d_deadline === 'within_30') flags.push('hard_deadline');

  // Execution capacity (D3) up to 10
  const teamPts = { none: 4, junior: 6, mid: 8, senior: 10, agency: 6 };
  intake += teamPts[answers.d_team] ?? 0;
  if (answers.d_team === 'none') tags.add('needs_execution');

  // Trajectory / strategic value via goals (Section C) up to 20
  const c6Pts = { stabilize: 4, lead_flow: 6, rev_25_50: 7, rev_50_100: 8, more_than_double: 8 };
  intake += c6Pts[answers.c_goal_6mo] ?? 0;
  if (answers.c_goal_6mo === 'more_than_double') flags.push('aggressive_goal');
  const exitTags = collectExitTags(answers);
  exitTags.forEach((t) => tags.add(t));
  if (exitTags.length) intake += 8; // strategic value (exit/raise/acquire)

  // ---- Segment lock (Section B wins over Stage 1) ----
  const segment = classifySegment({ pre, answers });

  // ---- Growth stage lock (M&A lens) ----
  const growth_stage = lockGrowthStage({ pre, answers });

  // ---- Marketing capacity + engagement type ----
  const marketing_capacity = lockMarketingCapacity({ pre, answers });
  const engagement_type = deriveEngagementType({ marketing_capacity, answers, budgetBand: confBudgetBand });

  // ---- Full score ----
  const full_score = clamp((pre.pre_score || 0) + intake, 0, 200);

  // ---- Expectation gap (big goals vs thin budget) ----
  const expectation_gap = detectExpectationGap({ answers, budgetBand: confBudgetBand });
  if (expectation_gap) flags.push('expectation_gap');

  // ---- Package recommendation ----
  const pkg = recommendPackage({
    segment,
    growth_stage,
    engagement_type,
    marketing_capacity,
    budgetBand: confBudgetBand,
    answers,
    expectation_gap,
  });

  return {
    full_score,
    segment,
    growth_stage,
    marketing_capacity,
    engagement_type,
    budget_band: confBudgetBand,
    recommended_tier: pkg.tier,
    recommended_package: pkg.name,
    emphasis_modules: pkg.emphasis,
    line_items: pkg.line_items,
    wetyr_track: pkg.wetyr_track,
    tags: [...tags],
    flags,
    expectation_gap,
  };
}

// ───────────────────────── Segment classification ───────────────────────────
function classifySegment({ pre = {}, answers = {} }) {
  // Section B signals (deterministic). If present, they win.
  const acv = answers.b_acv;          // low_ticket..enterprise_deal
  const motion = answers.b_motion;    // self_serve | sales_assisted | sales_led
  const cycle = answers.b_cycle;      // impulse | days_weeks | 1_3mo | quarters
  const offering = answers.a_offering_type; // service | product | software | platform | mixed

  if (offering === 'product' || acv === 'low_ticket' || motion === 'self_serve' || cycle === 'impulse') {
    return 'DTC_CONSUMER';
  }
  if (offering === 'software') {
    return 'GROWTH_SAAS';
  }
  if (acv === 'enterprise_deal' || motion === 'sales_led' || cycle === 'quarters') {
    return 'ENTERPRISE_B2B';
  }
  if (offering === 'service' || acv === 'high_ticket' || answers.b_revenue_source === 'organic_inbound' || answers.b_revenue_source === 'referral') {
    return 'HIGH_TICKET_SERVICE';
  }
  // Fall back to the Stage 1 tag if Section B was thin.
  if (pre.segment_tag && pre.segment_tag !== 'UNDETERMINED') return pre.segment_tag;
  return 'UNDETERMINED';
}

// ───────────────────────── Growth stage (M&A) ───────────────────────────────
function lockGrowthStage({ pre = {}, answers = {} }) {
  // Stage-2 explicit question wins, then exit-intent inference, then Stage 1.
  const direct = mapGrowthStage(answers.b_growth_stage || answers.stage_growth);
  if (direct !== 'UNDETERMINED') return direct;

  // Infer from goals/endgame if the explicit question was skipped.
  if (answers.c_endgame_5yr === 'sell' || answers.c_goal_1yr === 'exit_or_raise' || hasTag(answers, 'exit')) {
    return 'SUCCESSION';
  }
  if (answers.c_endgame_5yr === 'acquire' || hasTag(answers, 'acquirer')) {
    return 'ACQUIRING';
  }
  if (pre.growth_stage && pre.growth_stage !== 'UNDETERMINED') return pre.growth_stage;
  return 'GROWING';
}

// ───────────────────────── Marketing capacity + engagement type ─────────────
function lockMarketingCapacity({ pre = {}, answers = {} }) {
  // Stage-2 seat-count question wins over the Stage-1 quick read.
  const direct = mapMarketingCapacity(answers.d_marketing_dept || answers.marketing_seats);
  if (direct) return direct;
  // Infer from D3 (team available).
  const fromTeam = { none: 'NONE', junior: 'SOLO', mid: 'LEAN', senior: 'ROBUST', agency: 'AGENCY' };
  if (answers.d_team && fromTeam[answers.d_team]) return fromTeam[answers.d_team];
  return pre.marketing_capacity || 'NONE';
}

// The core "strategy vs strategy+execution (VIP)" decision.
//   Robust dept or agency in place  -> they have hands. We are the engine/brain:
//                                       STRATEGY_ONLY (fractional CMO leadership).
//   None / solo / lean              -> they need the engine AND the hands:
//                                       STRATEGY_PLUS_EXECUTION (full VIP).
// A lean team with an aggressive goal still needs execution help, so lean
// defaults to VIP unless the budget cannot support it.
function deriveEngagementType({ marketing_capacity, answers = {}, budgetBand }) {
  if (marketing_capacity === 'ROBUST' || marketing_capacity === 'AGENCY') {
    return 'STRATEGY_ONLY';
  }
  if (marketing_capacity === 'NONE' || marketing_capacity === 'SOLO') {
    return 'STRATEGY_PLUS_EXECUTION';
  }
  // LEAN: execution-heavy unless the budget is at the entry floor.
  if (budgetBand === 'UNDER_5K' || budgetBand === 'B5_8K') return 'STRATEGY_ONLY';
  return 'STRATEGY_PLUS_EXECUTION';
}

// ───────────────────────── Package recommendation ───────────────────────────
export function recommendPackage({
  segment,
  growth_stage,
  engagement_type,
  marketing_capacity,
  budgetBand,
  answers = {},
  expectation_gap = false,
}) {
  // 1. Base tier by budget band per segment.
  let tier = baseTierForBudget(budgetBand);

  // 2. Segment overrides.
  if (segment === 'ENTERPRISE_B2B') {
    tier = budgetBand === 'OVER_20K' ? 'CUSTOM' : 'EMPIRE';
  }
  if (segment === 'GROWTH_SAAS' && hasFlag(answers, 'aggressive_goal') && tier !== 'CUSTOM') {
    tier = bumpTier(tier);
  }

  // 3. Engagement type override: full VIP (strategy + execution) needs the
  //    weight to actually run channels, so it floors at MOMENTUM and bumps a
  //    notch when the team is empty.
  if (engagement_type === 'STRATEGY_PLUS_EXECUTION') {
    if (tierRank(tier) < tierRank('MOMENTUM')) tier = 'MOMENTUM';
    if (marketing_capacity === 'NONE' && tier !== 'CUSTOM') tier = bumpTier(tier);
  }

  // 4. M&A growth-stage override: succession/acquiring is strategy-weighted,
  //    board-room work - floor at EMPIRE.
  if ((growth_stage === 'SUCCESSION' || growth_stage === 'ACQUIRING') && tier !== 'CUSTOM') {
    if (tierRank(tier) < tierRank('EMPIRE')) tier = 'EMPIRE';
  }

  // 5. Feasibility: aggressive goal on a thin budget -> recommend audit-first
  //    entry instead of a full retainer they cannot sustain.
  if (expectation_gap && tierRank(tier) > tierRank('FOUNDATION')) {
    tier = 'FOUNDATION';
  }

  // 6. Emphasis modules (segment) + WETYR track (growth stage).
  const emphasis = emphasisForSegment(segment, engagement_type);
  const wetyr_track = wetyrTrackForStage(growth_stage);

  // 7. Line items: retainer + emphasis + triggered add-ons.
  const line_items = buildLineItems({ tier, segment, growth_stage, engagement_type, answers, expectation_gap });

  const name = `${DEFAULT_PRICING.tiers[tier].label} - ${engagementLabel(engagement_type)}`;

  return { tier, name, emphasis, wetyr_track, line_items };
}

function buildLineItems({ tier, segment, growth_stage, engagement_type, answers = {}, expectation_gap }) {
  const items = [];
  const T = DEFAULT_PRICING.tiers[tier];
  // Primary retainer
  items.push({
    key: 'retainer',
    label: `${T.label} Fractional CMO Retainer (${engagementLabel(engagement_type)})`,
    recurrence: tier === 'CUSTOM' ? 'quote' : 'monthly',
    amount: T.monthly,
    cadence: T.cadence,
  });

  // Feasibility path: lead with the audit, not the retainer.
  if (expectation_gap) {
    items.unshift(addonItem('audit_90day'));
  }

  // Segment-triggered add-ons.
  if (segment === 'HIGH_TICKET_SERVICE') items.push(addonItem('seo_aeo_geo'));
  if (segment === 'ENTERPRISE_B2B' || segment === 'GROWTH_SAAS') {
    if (hasFlag(answers, 'weak_positioning') || answers.a_positioning_clarity === 'cannot' || answers.a_positioning_clarity === 'vaguely') {
      items.push(addonItem('brand_audit'));
    }
  }
  if (answers.b_constraint === 'nurture' || answers.pre_primary_need === 'nurture') items.push(addonItem('funnel_audit'));
  if (answers.b_constraint === 'engineer' || answers.pre_primary_need === 'engineer') items.push(addonItem('ai_automation'));

  // Growth-stage (M&A) add-ons - the WETYR service line.
  if (growth_stage === 'SUCCESSION') {
    items.push(addonItem('ma_readiness'));
    items.push(addonItem('board_deck'));
  }
  if (growth_stage === 'ACQUIRING') {
    items.push(addonItem('acquisition_advisory'));
  }

  return items;
}

// ───────────────────────── Proposal model (8 sections) ──────────────────────
// Produces the structured data a proposal renderer (hosted page + PDF) merges.
// No placeholder text: empty blocks are omitted by the renderer. Voice is
// outcome-first and revenue-tied - the "engine, not a paint job" positioning.
export function buildProposalModel({ prospect = {}, intake = {}, answers = {}, pricing = DEFAULT_PRICING }) {
  const tier = intake.recommended_tier || 'MOMENTUM';
  const engagement_type = intake.engagement_type || 'STRATEGY_PLUS_EXECUTION';
  const growth_stage = intake.growth_stage || 'GROWING';
  const segment = intake.segment || 'UNDETERMINED';

  return {
    meta: {
      prospect_name: prospect.full_name || '',
      company: prospect.company || '',
      segment,
      growth_stage,
      engagement_type,
      tier,
      expires_days: 14,
    },
    positioning: POSITIONING, // shared brand voice block
    p1_situation: situationMirror({ answers, segment, growth_stage }),
    p2_stakes: stakesBlock(answers),
    p3_outcome: outcomeBlock(answers),
    p4_approach: {
      headline: stageLead(growth_stage, engagement_type),
      modules: intake.emphasis_modules || emphasisForSegment(segment, engagement_type),
      wetyr_track: intake.wetyr_track || wetyrTrackForStage(growth_stage),
      engagement_note: engagementNarrative(engagement_type, intake.marketing_capacity),
    },
    p5_package: buildTierLadder({ recommended: tier, line_items: intake.line_items, pricing }),
    p6_proof: proofForSegment(segment),
    p7_objection: objectionBlock(answers),
    p8_path: {
      steps: ['Accept', 'Sign (NDA + Engagement + MSA)', 'First payment', 'Kickoff call scheduled'],
      cta: 'Accept and start',
    },
  };
}

// Shared brand voice. Kept verbatim so every proposal speaks the same way.
export const POSITIONING = {
  not_an_agency:
    'We are not an agency and this is not a paint job on the car. We are the engine that drives the transmission to move the vehicle in the direction you want it to go. Every decision ties back to revenue.',
  one_liner: 'A growth partner that ties everything to revenue.',
};

function stageLead(stage, engagement_type) {
  const exec = engagement_type === 'STRATEGY_PLUS_EXECUTION';
  const base = {
    GROWING:
      'Build the growth engine: the right offers, channels and funnel, sequenced so revenue compounds.',
    SUCCESSION:
      'Build a business that sells: de-risk the revenue, make growth transferable, and tell a story buyers and boards underwrite.',
    ACQUIRING:
      'Build the platform: a brand and growth system you can bolt acquisitions onto and integrate without losing momentum.',
    UNDETERMINED:
      'Build the growth engine around what actually moves revenue.',
  }[stage] || '';
  return exec ? base + ' We run it, not just plan it.' : base;
}

function engagementNarrative(engagement_type, capacity) {
  if (engagement_type === 'STRATEGY_PLUS_EXECUTION') {
    return 'You do not have the bench to run this internally yet, so this is the full VIP partnership: we own strategy and execution end to end - the engine and the hands - until the system is built and producing.';
  }
  return 'You already have a capable marketing team, so we lead as the strategic engine - direction, priorities and accountability - while your team executes against the plan. We drive; you do not have to rebuild the department.';
}

function wetyrTrackForStage(stage) {
  return {
    GROWING: { brand: 'MarkCMO', label: 'Growth engine', focus: 'Revenue growth, demand, conversion.' },
    SUCCESSION: { brand: 'WETYR', label: 'Succession / exit readiness', focus: 'Value building, transferable growth, board and buyer narrative, M&A readiness.' },
    ACQUIRING: { brand: 'WETYR', label: 'Acquisition & roll-up', focus: 'Buy-side positioning, integration marketing, platform brand architecture, deal sourcing.' },
    UNDETERMINED: { brand: 'MarkCMO', label: 'Growth engine', focus: 'Revenue growth.' },
  }[stage];
}

// ───────────────────────── Routing (consultant assignment) ──────────────────
// Pure given the consultant roster. Mirrors Section 6 routing rules.
export function routeAssignment({ intake = {}, consultants = [], budgetMonthly = 0, complianceTags = [] }) {
  const principal = consultants.find((c) => c.is_principal) || null;
  const reasons = [];

  // R1 - enterprise + big budget -> Mark
  if (intake.segment === 'ENTERPRISE_B2B' && budgetMonthly >= 15000) {
    return { assigned: principal, queue: 'mark_direct', reason: 'enterprise_high_budget', approval: false };
  }
  // R2 - Empire/Custom -> Mark approves
  if (intake.recommended_tier === 'EMPIRE' || intake.recommended_tier === 'CUSTOM') {
    reasons.push('empire_or_custom');
    return { assigned: principal, queue: 'mark_approval', reason: 'empire_or_custom', approval: true };
  }
  // R2b - M&A stage -> Mark / WETYR approval (succession & acquisition are
  // strategy-weighted, principal-led)
  if (intake.growth_stage === 'SUCCESSION' || intake.growth_stage === 'ACQUIRING') {
    return { assigned: principal, queue: 'mark_approval', reason: 'ma_growth_stage', approval: true };
  }
  // R3 - compliance -> matching specialist, else Mark
  if (complianceTags.length) {
    const spec = consultants.find(
      (c) => c.active && Array.isArray(c.industries) && c.industries.some((i) => complianceTags.includes(i))
    );
    if (spec) return { assigned: spec, queue: 'specialist', reason: 'compliance_match', approval: false };
    return { assigned: principal, queue: 'mark_approval', reason: 'compliance_no_match', approval: true };
  }
  // R4 - lowest-load eligible fractional CMO
  const eligible = consultants
    .filter((c) => c.active && !c.is_principal)
    .filter((c) => (c.capacity_used || 0) < (c.capacity_max || 0))
    .filter((c) => budgetMonthly >= (c.min_deal_size || 0))
    .filter((c) => !Array.isArray(c.industries) || !c.industries.length || c.industries.includes(intake.segment))
    .sort((a, b) => (a.capacity_used || 0) - (b.capacity_used || 0));
  if (eligible.length) {
    return { assigned: eligible[0], queue: 'fractional', reason: 'lowest_load', approval: false };
  }
  // R5 - no capacity -> queue + notify Mark
  return { assigned: null, queue: 'waitlist', reason: 'no_capacity', approval: true };
}

// ═════════════════════════ Small mappers / helpers ══════════════════════════
function mapSegmentTag(v) {
  return (
    { high_ticket_service: 'HIGH_TICKET_SERVICE', dtc_consumer: 'DTC_CONSUMER', growth_saas: 'GROWTH_SAAS', enterprise_b2b: 'ENTERPRISE_B2B', other: 'UNDETERMINED' }[v] ||
    'UNDETERMINED'
  );
}
function mapGrowthStage(v) {
  return { growing: 'GROWING', succession: 'SUCCESSION', acquiring: 'ACQUIRING' }[v] || 'UNDETERMINED';
}
function mapMarketingCapacity(v) {
  return { none: 'NONE', solo: 'SOLO', lean: 'LEAN', robust: 'ROBUST', agency: 'AGENCY' }[v] || null;
}
function mapBudgetBand(v) {
  const table = {
    under_5k: { pts: 0, band: 'UNDER_5K' },
    b5_8k: { pts: 15, band: 'B5_8K' },
    b8_12k: { pts: 25, band: 'B8_12K' },
    b12_20k: { pts: 35, band: 'B12_20K' },
    over_20k: { pts: 40, band: 'OVER_20K' },
  };
  // Stage 1 uses a lighter scale; normalize to the same bands.
  const s1 = {
    under_5k: { pts: 0, band: 'UNDER_5K' },
    b5_8k: { pts: 10, band: 'B5_8K' },
    b8_12k: { pts: 20, band: 'B8_12K' },
    b12_20k: { pts: 25, band: 'B12_20K' },
    over_20k: { pts: 25, band: 'OVER_20K' },
  };
  return table[v] || s1[v] || { pts: 0, band: 'UNDER_5K' };
}
function baseTierForBudget(band) {
  return { UNDER_5K: 'FOUNDATION', B5_8K: 'FOUNDATION', B8_12K: 'MOMENTUM', B12_20K: 'EMPIRE', OVER_20K: 'EMPIRE' }[band] || 'FOUNDATION';
}
function tierRank(t) {
  return { FOUNDATION: 0, MOMENTUM: 1, EMPIRE: 2, CUSTOM: 3 }[t] ?? 0;
}
function bumpTier(t) {
  return ['FOUNDATION', 'MOMENTUM', 'EMPIRE', 'CUSTOM'][Math.min(tierRank(t) + 1, 3)];
}
function engagementLabel(t) {
  return t === 'STRATEGY_PLUS_EXECUTION' ? 'Strategy + Execution (VIP)' : 'Strategy Partner';
}
function emphasisForSegment(segment, engagement_type) {
  const exec = engagement_type === 'STRATEGY_PLUS_EXECUTION';
  const base = {
    HIGH_TICKET_SERVICE: ['SEO / AEO / GEO authority', 'Off-site authority (backlinks, GBP, citations)', 'Inbound funnel', 'Nurture sequences'],
    DTC_CONSUMER: ['Paid media (Meta/Google/TikTok)', 'CRO + creative testing', 'Retention (email/SMS)', 'Social growth'],
    ENTERPRISE_B2B: ['Positioning architecture', 'Internal alignment / org', 'ABM', 'Sales enablement', 'Board / investor narrative'],
    GROWTH_SAAS: ['Full-funnel demand gen', 'ABM', 'Attribution + RevOps', 'SDR playbook', 'KPI dashboards'],
    UNDETERMINED: ['Positioning', 'Primary channel', 'Funnel', 'KPI reporting'],
  }[segment] || [];
  return exec ? base : base.concat(['Strategy, priorities and accountability for your team to execute']);
}
function proofForSegment(segment) {
  return {
    HIGH_TICKET_SERVICE: { stat: 'Inbound that compounds', detail: 'Authority-led pipeline for a professional-services firm.' },
    DTC_CONSUMER: { stat: '4x ROAS', detail: 'Scaled paid acquisition while protecting margin for a consumer brand.' },
    ENTERPRISE_B2B: { stat: '$3.4M pipeline', detail: 'Repositioned a complex B2B org and aligned the room behind one story.' },
    GROWTH_SAAS: { stat: '340% pipeline growth', detail: 'Built predictable SaaS pipeline with attribution from day one.' },
    UNDETERMINED: { stat: 'Revenue-tied growth', detail: 'Every engagement is measured against revenue, not activity.' },
  }[segment];
}
function buildTierLadder({ recommended, line_items, pricing }) {
  const order = ['FOUNDATION', 'MOMENTUM', 'EMPIRE'];
  const tiers = order.map((t) => ({
    key: t,
    label: pricing.tiers[t].label,
    monthly: pricing.tiers[t].monthly,
    annual: pricing.tiers[t].monthly ? pricing.tiers[t].monthly * pricing.annualMonthsCharged : null,
    recommended: t === recommended,
  }));
  if (recommended === 'CUSTOM') tiers.push({ key: 'CUSTOM', label: 'Custom', monthly: null, annual: null, recommended: true });
  return { anchor: 'EMPIRE', target: recommended, tiers, line_items };
}
function situationMirror({ answers, segment, growth_stage }) {
  const constraint = { demand: 'not enough qualified demand', nurture: 'demand that does not convert', engineer: 'operations that cannot keep up with growth', map: 'no clarity on what is actually broken' }[answers.b_constraint] || null;
  return { segment, growth_stage, constraint, trajectory: answers.a_trajectory || null };
}
function stakesBlock(answers) {
  return {
    primary: { revenue_stakes: 'Lost revenue and missed targets', competitive_stakes: 'Falling behind competitors', founder_relief: 'You keep carrying it alone', exit_stakes: 'A failed raise or a discounted exit', credibility_stakes: 'Lost team and investor confidence' }[answers.e_stakes] || null,
  };
}
function outcomeBlock(answers) {
  return { goal_6mo: answers.c_goal_6mo || null, goal_1yr: answers.c_goal_1yr || null, endgame: answers.c_endgame_5yr || null };
}
function objectionBlock(answers) {
  return { objection: answers.e_objection || null, resistance: answers.e_internal_resistance || null };
}
function collectExitTags(answers) {
  const tags = [];
  const c5 = arr(answers.c_exit_intent);
  if (c5.includes('selling')) tags.push('exit');
  if (c5.includes('raising')) tags.push('raise');
  if (c5.includes('acquiring')) tags.push('acquirer');
  if (answers.c_endgame_5yr === 'sell') tags.push('exit');
  if (answers.c_endgame_5yr === 'acquire') tags.push('acquirer');
  if (answers.c_endgame_5yr === 'raise') tags.push('raise');
  return tags;
}
function detectExpectationGap({ answers, budgetBand }) {
  const aggressive = answers.c_goal_6mo === 'more_than_double' || answers.c_goal_1yr === 'aggressive';
  const thin = budgetBand === 'UNDER_5K' || budgetBand === 'B5_8K';
  return Boolean(aggressive && thin);
}
function addonItem(key) {
  const a = DEFAULT_PRICING.addons[key];
  return { key, label: a.label, recurrence: a.recurrence, amount: a.price };
}
function hasFlag(answers, flag) {
  return Array.isArray(answers.__flags) && answers.__flags.includes(flag);
}
function hasTag(answers, tag) {
  const t = collectExitTags(answers);
  return t.includes(tag);
}
function arr(v) {
  if (Array.isArray(v)) return v;
  if (v == null || v === '') return [];
  return [v];
}
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
