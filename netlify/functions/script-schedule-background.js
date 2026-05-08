// WETYR Studios - Shooting Schedule BACKGROUND function
// Generates stripboard + day-out-of-days from a breakdown. Async because
// 100+ scene scripts produce big output that blows the 26s sync timeout.
// Result persisted to Supabase wetyr_jobs table; client polls /script-result.

const { setJob } = require('./_wetyr_jobs');

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
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { jobId, breakdown, constraints = {} } = body;
  if (!jobId) return { statusCode: 400, body: 'jobId required' };

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { await setJob(jobId, { status: 'error', error: 'GEMINI_API_KEY missing' }); return { statusCode: 500, body: '' }; }
    if (!breakdown || !breakdown.scenes) { await setJob(jobId, { status: 'error', error: 'breakdown.scenes required' }); return { statusCode: 400, body: '' }; }

    await setJob(jobId, { progress: 'building stripboard' });

    const userMsg =
      'CONSTRAINTS:\n' + JSON.stringify(constraints, null, 2) +
      '\n\nBREAKDOWN:\n' + JSON.stringify(breakdown);

    const resp = await fetch(API_URL + '?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 16384,
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    });
    if (!resp.ok) {
      await setJob(jobId, { status: 'error', error: 'Gemini ' + resp.status + ': ' + (await resp.text()).slice(0, 600) });
      return { statusCode: 500, body: '' };
    }
    const data = await resp.json();
    const raw = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!raw) {
      await setJob(jobId, { status: 'error', error: 'Empty Gemini response' });
      return { statusCode: 500, body: '' };
    }
    let schedule;
    try { schedule = JSON.parse(extractJson(raw)); }
    catch (e) {
      await setJob(jobId, { status: 'error', error: 'Non-JSON response: ' + e.message });
      return { statusCode: 500, body: '' };
    }
    await setJob(jobId, { status: 'complete', progress: 'done', schedule });
    return { statusCode: 200, body: '' };
  } catch (e) {
    await setJob(jobId, { status: 'error', error: String(e.message || e) });
    return { statusCode: 500, body: '' };
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
