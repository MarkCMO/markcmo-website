// WETYR Studios - Shooting Schedule Generator
// Takes a breakdown JSON, returns a stripboard + shooting-day schedule.
// Uses Claude Opus for the sequencing logic (it's a constraint-satisfaction
// problem that benefits from LLM judgment on location/cast/time-of-day grouping).
//
// POST { breakdown: {...}, constraints?: { shootDays?: number, maxHoursPerDay?: number, unionRules?: string, daysOfWeek?: number } }
// -> { ok: true, schedule: { days: [...], dayOutOfDays: [...], summary: {...} } }

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a veteran Unit Production Manager building a shooting schedule in Movie Magic style.

INPUT: a full script breakdown JSON (scenes with eighths, locations, cast).
CONSTRAINTS (may be provided by user): target shoot days, max hours/day, union rules, days of week.

SCHEDULING RULES (in priority order)
1. Group scenes by LOCATION to minimize company moves.
2. Within a location, group by INT/EXT (EXT first to use daylight if applicable).
3. Within INT/EXT, group by TIME OF DAY (NIGHT scenes scheduled together, require night premiums).
4. Minimize cast work days - if Character A is in scenes 3, 17, 42, try to shoot all three in adjacent days (drop-and-pickup avoided if possible).
5. Target ~6 pages (48/8) per day for features, ~2-3 pages for TV, higher for indies.
6. Actors under 18 have limited hours - flag those days with minorHours: true.
7. Stunt/SFX/VFX-heavy scenes get reduced daily page targets.
8. Exteriors in bad-weather-likely seasons need cover sets (interiors ready if weather breaks).

OUTPUT STRICT JSON ONLY matching this schema:
{
  "summary": {
    "totalShootDays": number,
    "totalEighths": number,
    "avgEighthsPerDay": number,
    "totalLocations": number,
    "totalCompanyMoves": number,
    "nightShoots": number,
    "coverSetsNeeded": number
  },
  "days": [{
    "day": number,
    "date": string,
    "location": string,
    "intExt": "INT"|"EXT"|"INT/EXT",
    "timeOfDay": string,
    "scenes": [{ "number": string, "heading": string, "eighths": number, "pageCount": number }],
    "totalEighths": number,
    "totalPages": number,
    "castCalled": [string],
    "backgroundCount": number,
    "specialRequirements": [string],
    "estimatedCallTime": string,
    "estimatedWrapTime": string,
    "minorHours": bool,
    "notes": string
  }],
  "dayOutOfDays": [{
    "character": string,
    "workDays": [number],
    "holdDays": [number],
    "startDay": number,
    "endDay": number,
    "totalWorkDays": number
  }],
  "companyMoves": [{ "fromDay": number, "toDay": number, "fromLocation": string, "toLocation": string }]
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

  const { breakdown, constraints = {} } = body;
  if (!breakdown || !breakdown.scenes) return json(400, { ok: false, error: 'breakdown.scenes required' });

  const userMsg =
    'CONSTRAINTS:\n' + JSON.stringify(constraints, null, 2) +
    '\n\nBREAKDOWN:\n' + JSON.stringify(breakdown);

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
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });
    if (!resp.ok) return json(resp.status, { ok: false, error: 'Gemini ' + resp.status, detail: (await resp.text()).slice(0, 600) });
    const data = await resp.json();
    const raw = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!raw) return json(502, { ok: false, error: 'Empty Gemini response', detail: JSON.stringify(data).slice(0, 600) });
    let schedule;
    try { schedule = JSON.parse(extractJson(raw)); }
    catch { return json(502, { ok: false, error: 'Non-JSON response', preview: raw.slice(0, 600) }); }
    return json(200, { ok: true, schedule, usage: data.usageMetadata || null });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{'); const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}
function cors() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type' }; }
function json(statusCode, body) { return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(body) }; }
