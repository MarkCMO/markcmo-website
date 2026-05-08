// WETYR Studios - Call Sheet BACKGROUND function
// Generates a per-day call sheet packet from breakdown + schedule.
// One Gemini call per shoot day, run in parallel batches (concurrency cap 4).
// Result persisted to wetyr_jobs.payload.callsheet for /script-result + admin vault.

const { setJob } = require('./_wetyr_jobs');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_CONCURRENCY = 4;

const SYSTEM_PROMPT = `You are a 2nd Assistant Director writing a professional call sheet for a single shoot day.

INPUT: a single day's slot from a shooting schedule + the master breakdown for cross-referencing scene elements.

OUTPUT a JSON call sheet matching this schema. Be specific and crew-ready.

{
  "day": number,
  "date": string,
  "title": string,
  "location": {
    "name": string,
    "address": string,
    "parking": string,
    "nearestHospital": string,
    "directions": string
  },
  "weather": { "high": string, "low": string, "sunrise": string, "sunset": string, "conditions": string, "notes": string },
  "callTimes": {
    "generalCrew": string,
    "departmentBreakdown": [{ "department": string, "callTime": string, "personnel": [string] }]
  },
  "scenes": [{
    "number": string,
    "heading": string,
    "intExt": string,
    "timeOfDay": string,
    "pageCount": number,
    "synopsis": string,
    "cast": [string],
    "props": [string],
    "wardrobe": [string],
    "vehicles": [string],
    "weapons": [string],
    "sfx": [string],
    "stunts": [string],
    "specialEquipment": [string]
  }],
  "cast": [{ "character": string, "actor": string, "callTime": string, "makeupCall": string, "wardrobeCall": string, "onSet": string, "status": "WORKING"|"START"|"WORK"|"FINISH"|"HOLD"|"TRAVEL" }],
  "background": { "count": number, "callTime": string, "wardrobe": string },
  "transportation": [{ "type": string, "pickupLocation": string, "pickupTime": string, "destination": string }],
  "catering": { "breakfast": string, "lunch": string, "secondMeal": string, "headCount": number, "dietary": [string] },
  "specialNotes": [string],
  "safetyNotes": [string],
  "nextDayPreview": string
}

RULES
1. Use realistic call-time offsets: dept heads 30-60 min before general crew; cast 60-90 min for makeup/wardrobe; principals on-set 15-30 min before shoot start.
2. Cross-reference the breakdown for every scene scheduled - pull props/wardrobe/vehicles/weapons/stunts/sfx into the scene block.
3. Mark cast START on their first day, WORK on intermediate days, FINISH on their last day. Mark HOLD if they're paid but not working that day. (Use schedule.dayOutOfDays if available.)
4. Safety notes MUST list any stunts/firearms/animals/water/fire/vehicles/minors on set that day.
5. For "actor" fields, leave as the character name (production fills in the real actor later).
6. If the day has minors on set, add a note about minor work hour limits in safetyNotes.
7. Weather/sunrise/sunset can be placeholder ("TBD - check 48hr before") if no real data.
8. Return ONLY valid JSON. No prose, no fences.`;

exports.handler = async (event) => {
  const t0 = Date.now();
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { jobId, breakdown, schedule } = body;
  if (!jobId) return { statusCode: 400, body: 'jobId required' };

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { await setJob(jobId, { status: 'error', error: 'GEMINI_API_KEY missing' }); return { statusCode: 500, body: '' }; }
    if (!schedule || !schedule.days?.length) { await setJob(jobId, { status: 'error', error: 'schedule.days required' }); return { statusCode: 400, body: '' }; }
    if (!breakdown) { await setJob(jobId, { status: 'error', error: 'breakdown required' }); return { statusCode: 400, body: '' }; }

    const days = schedule.days;
    await setJob(jobId, { progress: `building ${days.length} call sheets` });

    // Compact breakdown lookup so each per-day call has just enough context.
    const sceneById = new Map((breakdown.scenes || []).map(s => [String(s.number), s]));
    const dood = schedule.dayOutOfDays || [];
    const charStatus = (charName, dayNum) => {
      const ch = dood.find(d => d.character === charName);
      if (!ch) return 'WORKING';
      if (ch.startDay === dayNum) return 'START';
      if (ch.endDay === dayNum) return 'FINISH';
      if ((ch.holdDays || []).includes(dayNum)) return 'HOLD';
      return 'WORK';
    };

    const tasks = days.map((day, i) => () => {
      const expandedScenes = (day.scenes || []).map(sc => {
        const full = sceneById.get(String(sc.number)) || {};
        return { ...sc, ...full };
      });
      const userMsg =
        `DAY ${day.day} of ${days.length}.\n` +
        `Production title: "${breakdown.title || 'Untitled'}".\n\n` +
        `SCHEDULE SLOT:\n${JSON.stringify({ ...day, scenes: undefined }, null, 2)}\n\n` +
        `SCENES (with breakdown elements):\n${JSON.stringify(expandedScenes, null, 2)}\n\n` +
        `CAST DAY-OUT-OF-DAYS for this day:\n` +
        JSON.stringify((day.castCalled || []).map(c => ({ character: c, status: charStatus(c, day.day) })), null, 2);
      return callGemini(key, SYSTEM_PROMPT, userMsg);
    });

    const results = await runConcurrent(tasks, MAX_CONCURRENCY);
    const callSheets = results.map((r, i) => {
      const parsed = safeParse(r.text);
      return parsed || { day: days[i].day, error: 'parse failed', raw: (r.text || '').slice(0, 500) };
    });

    await setJob(jobId, {
      status: 'complete',
      progress: 'done',
      callsheet: { days: callSheets, generatedAt: new Date().toISOString(), total: callSheets.length },
      ms: Date.now() - t0
    });
    return { statusCode: 200, body: '' };
  } catch (e) {
    await setJob(jobId, { status: 'error', error: String(e.message || e) });
    return { statusCode: 500, body: '' };
  }
};

async function callGemini(key, systemPrompt, userText) {
  const resp = await fetch(API_URL + '?key=' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });
  if (!resp.ok) throw new Error('Gemini ' + resp.status + ': ' + (await resp.text()).slice(0, 600));
  const data = await resp.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  return { text, usage: data.usageMetadata };
}

async function runConcurrent(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]();
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
    return JSON.parse(fenced ? fenced[1].trim() : raw.trim());
  } catch {
    const f = raw.indexOf('{'), l = raw.lastIndexOf('}');
    if (f >= 0 && l > f) { try { return JSON.parse(raw.slice(f, l + 1)); } catch { return null; } }
    return null;
  }
}
