// WETYR Studios - Location Scouting BACKGROUND function
// For each unique location in the breakdown, generates scout requirements:
// permit type, permit fees, parking, power needs, sound concerns, neighbor
// notification reqs, base camp size, and recommended scout questions.

const { setJob } = require('./_wetyr_jobs');
const { callGeminiJSON } = require('./_gemini');

const SYSTEM_PROMPT = `You are a Location Manager building a SCOUT REPORT and permit roadmap for each location in a breakdown.

For every location, return:
- Location name + INT/EXT
- Total scenes/eighths shot there
- Recommended location type (private property / public / municipal / studio / soundstage)
- Permit type required (e.g. "FilmLA Type B for street closures", "NYPD Movie/TV detail", "National Park Service Special Use Permit")
- Permit fees (rough range)
- Permit lead time (business days)
- Insurance requirements (liability minimums)
- Parking strategy (number of spots needed for crew + base camp)
- Power needs (generator size kVA or shore power)
- Restroom requirements (honeywagon vs existing facilities)
- Sound concerns (airport flight paths, traffic, schools, construction)
- Neighbor notification radius + form
- Scout questions checklist (10-15 items the location scout MUST verify in person)

Use real jurisdictional knowledge: California (FilmLA, CalOSHA), New York (MOFTB), Georgia (state film office), New Mexico, etc.

OUTPUT JSON ONLY:
{
  "locations": [{
    "name": string,
    "intExt": string,
    "totalScenes": number,
    "totalEighths": number,
    "locationType": string,
    "jurisdiction": string,
    "permitType": string,
    "permitFeeRange": string,
    "permitLeadTimeDays": number,
    "insuranceRequired": string,
    "parking": { "crewSpots": number, "baseCampSpots": number, "publicLot": bool, "notes": string },
    "power": { "generatorKVA": number, "shorePowerAvailable": bool, "notes": string },
    "restrooms": string,
    "soundConcerns": [string],
    "neighborNotification": { "radius": string, "form": string, "leadTimeDays": number },
    "scoutChecklist": [string],
    "estimatedDailyFee": number,
    "redFlags": [string]
  }],
  "summary": {
    "totalLocations": number,
    "totalEstimatedPermitFees": number,
    "longestLeadTime": number,
    "complexLocations": number
  }
}
No prose. JSON only.`;

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { jobId, breakdown, context = {} } = body;
  if (!jobId) return { statusCode: 400, body: 'jobId required' };

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { await setJob(jobId, { status: 'error', error: 'GEMINI_API_KEY missing' }); return { statusCode: 500, body: '' }; }
    if (!breakdown || !(breakdown.locations || breakdown.scenes)) { await setJob(jobId, { status: 'error', error: 'breakdown.locations or scenes required' }); return { statusCode: 400, body: '' }; }

    await setJob(jobId, { progress: 'analyzing locations' });

    const locations = breakdown.locations?.length
      ? breakdown.locations
      : aggregateLocationsFromScenes(breakdown.scenes);

    const compact = {
      title: breakdown.title,
      shootState: context.shootState || 'CA',
      tier: context.budgetTier || 'indie',
      locations
    };

    const result = await callGeminiJSON({
      key, system: SYSTEM_PROMPT,
      user: 'Generate scout report and permit roadmap.\n\nCONTEXT:\n' + JSON.stringify(compact, null, 2),
      maxOutputTokens: 16384
    });

    await setJob(jobId, { status: 'complete', progress: 'done', locations: { ...result, generatedAt: new Date().toISOString() } });
    return { statusCode: 200, body: '' };
  } catch (e) {
    await setJob(jobId, { status: 'error', error: String(e.message || e) });
    return { statusCode: 500, body: '' };
  }
};

function aggregateLocationsFromScenes(scenes) {
  const map = new Map();
  for (const s of scenes || []) {
    const key = (s.location || '').toUpperCase();
    if (!key) continue;
    const cur = map.get(key) || { name: s.location, intExt: s.intExt, scenes: [], totalEighths: 0 };
    cur.scenes.push(s.number);
    cur.totalEighths += (s.eighths || 0);
    map.set(key, cur);
  }
  return [...map.values()];
}
