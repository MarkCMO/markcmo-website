// WETYR Studios - Budget Generator
// Takes breakdown + schedule, returns an ATL/BTL budget with line items.
// Uses industry-standard budget top sheet categories (AICP/IATSE reference).
//
// POST { breakdown, schedule?, context?: { budgetTier, union, region, shootState } }
// -> { ok: true, budget: { topSheet, categories, contingency, grandTotal } }

const MODEL = 'gemini-2.5-pro';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a Line Producer building a top-sheet budget in AICP/MPAA style.

INPUT: script breakdown, optional shooting schedule, and production context (budget tier, union/non-union, region, shoot state).

BUDGET TIERS
- "ultralow": $50k-$250k (SAG ULB possible, skeleton crew, run-and-gun)
- "micro": $250k-$1M (SAG LBA, lean crew, limited shoot days)
- "indie": $1M-$5M (SAG low-budget, full crew, name talent possible)
- "midrange": $5M-$20M (full union, recognizable cast, solid dept heads)
- "studio": $20M-$80M (full scale, A-list supporting + name leads, 2nd unit)
- "tentpole": $80M-$200M (major VFX, global stars, multi-unit, international locations)
- "blockbuster": $200M+ (franchise/IP scale, full VFX house engagement, massive marketing)
- "custom": user-supplied target budget. When provided, size every line item to hit that total. Scale crew count, shoot days, equipment quality, above-the-line fees, and post spend proportionally to the target. Do NOT ignore the custom number - it IS the ceiling before contingency.

BUDGET STRUCTURE (AICP-style top sheet)
ABOVE THE LINE (ATL)
- Story & Rights
- Producer
- Director
- Cast (principals, day players, stunts, looping)

BELOW THE LINE - PRODUCTION (BTL-P)
- Production Staff (UPM, 1st AD, 2nd AD, Script Sup, PAs)
- Extras & Stand-ins
- Set Design
- Set Construction
- Set Dressing
- Property
- Wardrobe
- Makeup & Hair
- Electric (gaffer, best boy, electricians, equipment rental)
- Grip (key grip, best boy, grips, equipment rental)
- Camera (DP, operators, ACs, equipment rental)
- Sound (mixer, boom, equipment rental)
- Transportation
- Locations (fees, permits, site rep)
- Picture Vehicles & Animals
- Special Effects
- Film/Media & Lab
- Production Office (supplies, copies, rentals)

BELOW THE LINE - POST (BTL-POST)
- Editorial (editor, assistant, rooms)
- Music (composer, licensing)
- Post Sound (mix, design, ADR, Foley)
- Color / DI
- VFX
- Deliverables

OTHER
- Insurance (production package, E&O, workers comp)
- Legal & Accounting
- Publicity
- Contingency (10% standard, 15% for high-risk productions)

RULES
1. Use realistic line-item costs for the specified tier + region + union status.
2. Crew rates: pull from 2024-2025 IATSE Local 600/80/728/44 and DGA scales for union. Non-union use ~60-70% of scale.
3. Equipment: reference pricing from Keslow/Panavision (camera), MBS/ARRI (grip/electric), Sound Lounge (sound).
4. Location fees: typical daily fees for house/business/public. Add permit + site rep costs.
5. Include EACH line item with quantity, unit (day/week/allow), rate, and total.
6. Multiply shoot days by schedule if provided; otherwise estimate from page count and breakdown.
7. Flag production risks that inflate insurance (stunts, minors, firearms, water, vehicles, pyro).
8. Add 10% contingency by default (15% if hasStunts || hasVfx || hasWaterWork).
9. Report grand total and compare to tier ceiling.

OUTPUT STRICT JSON ONLY:
{
  "topSheet": {
    "atlTotal": number, "btlProductionTotal": number, "btlPostTotal": number,
    "otherTotal": number, "subtotal": number, "contingencyPct": number,
    "contingencyAmount": number, "grandTotal": number, "tier": string, "tierCeiling": number
  },
  "categories": [{
    "code": string, "name": string, "section": "ATL"|"BTL-P"|"BTL-POST"|"OTHER",
    "lineItems": [{
      "description": string, "quantity": number, "unit": string, "rate": number, "total": number, "notes": string
    }],
    "subtotal": number
  }],
  "risks": [{ "risk": string, "insuranceImpact": string, "mitigation": string }],
  "assumptions": [string],
  "warnings": [string]
}

No prose. JSON only.`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'POST only' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(500, { ok: false, error: 'GEMINI_API_KEY missing' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { ok: false, error: 'Invalid JSON' }); }

  const { breakdown, schedule = null, context = {} } = body;
  if (!breakdown) return json(400, { ok: false, error: 'breakdown required' });

  const ctx = {
    budgetTier: context.budgetTier || 'indie',
    customBudget: (context.budgetTier === 'custom' && Number(context.customBudget) > 0) ? Number(context.customBudget) : null,
    union: context.union || 'non-union',
    region: context.region || 'US',
    shootState: context.shootState || 'unspecified'
  };

  const userMsg =
    'CONTEXT:\n' + JSON.stringify(ctx, null, 2) +
    '\n\nBREAKDOWN (compact):\n' + JSON.stringify(compactBreakdown(breakdown)) +
    (schedule ? '\n\nSCHEDULE SUMMARY:\n' + JSON.stringify(schedule.summary || {}) + '\nDAY COUNT: ' + (schedule.days?.length || 0) : '');

  try {
    const resp = await fetch(API_URL + '?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 32000
        }
      })
    });
    if (!resp.ok) return json(resp.status, { ok: false, error: 'Gemini ' + resp.status, detail: (await resp.text()).slice(0, 600) });
    const data = await resp.json();
    const raw = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!raw) return json(502, { ok: false, error: 'Empty Gemini response', detail: JSON.stringify(data).slice(0, 600) });
    let budget;
    try { budget = JSON.parse(extractJson(raw)); }
    catch { return json(502, { ok: false, error: 'Non-JSON response', preview: raw.slice(0, 600) }); }
    return json(200, { ok: true, budget, context: ctx, usage: data.usageMetadata || null });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};

// Keep the breakdown payload small for the budget pass - we only need
// counts and flags, not every prop/wardrobe detail.
function compactBreakdown(b) {
  return {
    title: b.title,
    format: b.format,
    pageCount: b.pageCount,
    sceneCount: b.scenes?.length || 0,
    characterCount: b.characters?.length || 0,
    leadCount: (b.characters || []).filter(c => c.type === 'lead').length,
    supportingCount: (b.characters || []).filter(c => c.type === 'supporting').length,
    dayPlayerCount: (b.characters || []).filter(c => c.type === 'day_player').length,
    locationCount: b.locations?.length || 0,
    locations: (b.locations || []).map(l => ({ name: l.name, type: l.type, intExt: l.intExt, eighths: l.totalEighths })),
    totalEighths: (b.scenes || []).reduce((s, sc) => s + (sc.eighths || 0), 0),
    nightScenes: (b.scenes || []).filter(s => s.timeOfDay === 'NIGHT').length,
    flags: b.productionFlags || {}
  };
}

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{'); const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}
function cors() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' }; }
function json(statusCode, body) { return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(body) }; }
