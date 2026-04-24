// WETYR Studios - Script Dissector
// Takes normalized script text, returns a full production breakdown (scenes,
// characters, elements, locations, production flags) via Gemini 2.5 Pro.
//
// POST { scriptText: string, title?: string, format?: string }
// -> { ok: true, breakdown: {...}, usage: {...}, ms: number }
//
// Env: GEMINI_API_KEY

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_OUTPUT_TOKENS = 32000;

const SYSTEM_PROMPT = `You are the WETYR Studios Script Breakdown Engine - a veteran 1st Assistant Director with 25 years of feature experience. You break down screenplays into production-ready data like Movie Magic / StudioBinder, with the judgment of an experienced AD.

TASK
Given a screenplay in any text format (standard US, Fountain, FDX-exported), return a COMPLETE structured JSON breakdown matching the schema below.

RULES
1. Tag every element that appears on screen. A gun held by a character goes in BOTH weapons AND props.
2. Page count in eighths. 1 page = 8/8. pageCount is decimal; eighths is integer count of 1/8 units.
3. Scene numbers: use the script's numbers if present; otherwise sequential starting at 1.
4. INT/EXT and time-of-day come from the slugline. Infer if ambiguous.
5. Characters: every speaking role + named non-speaking. minor:true if under 18. sceneCount = scenes they appear in. dialogueLineCount = dialogue blocks.
6. Locations: consolidate equivalent spaces (JOHN'S KITCHEN == KITCHEN - JOHN'S HOUSE). Track totalEighths per location.
7. Production flags: set TRUE if ANY scene triggers it - drives insurance/union/safety.
8. Return ONLY valid JSON. No markdown fences, no preface, no trailing text.
9. Exhaustive but not speculative - don't invent props that aren't mentioned or clearly implied.
10. Flag high-liability items (weapons, stunts, minors, firearms, animals, vehicle action) aggressively - missed flag = missed insurance rider.

JUDGMENT CALLS
- "Room is on fire" -> sfx:["controlled fire"], specialEquipment:["fire safety officer","extinguishers"], hasStunts:true if talent near it.
- "She drives fast" -> vehicles:["hero car"], stunts:["driving"], hasVehicleAction:true.
- Rain/snow/fog at scale -> sfx (practical rig) unless scope implies VFX-only.
- Phone screens shown -> props:["cell phone"], vfx:["phone screen inserts"].
- Blood/gore -> makeup:["blood rig","prosthetic wound"] + sfx if pumping.

JSON SCHEMA (return exactly this shape):
{
  "title": string,
  "logline": string,
  "genre": string,
  "format": "feature"|"short"|"pilot"|"episode"|"commercial"|"music_video",
  "pageCount": number,
  "estimatedRuntimeMinutes": number,
  "scenes": [{
    "number": string, "heading": string, "intExt": "INT"|"EXT"|"INT/EXT"|"EXT/INT",
    "location": string, "subLocation": string,
    "timeOfDay": "DAY"|"NIGHT"|"DAWN"|"DUSK"|"CONTINUOUS"|"LATER"|"MORNING"|"EVENING"|"MAGIC HOUR",
    "pageCount": number, "eighths": number, "synopsis": string,
    "characters": [string], "extras": {"count": number, "description": string},
    "props": [string], "wardrobe": [string], "makeup": [string], "setDressing": [string],
    "vehicles": [string], "animals": [string], "weapons": [string],
    "sfx": [string], "vfx": [string], "stunts": [string],
    "music": [string], "sound": [string], "specialEquipment": [string],
    "minorsOnSet": bool, "nudity": bool, "intimacy": bool
  }],
  "characters": [{
    "name": string, "type": "lead"|"supporting"|"day_player"|"extra"|"voice",
    "age": string, "gender": string, "description": string, "arc": string,
    "sceneCount": number, "dialogueLineCount": number,
    "firstScene": string, "lastScene": string,
    "specialSkillsRequired": [string], "minor": bool
  }],
  "locations": [{
    "name": string, "type": "practical"|"stage"|"location"|"backlot",
    "intExt": "INT"|"EXT"|"BOTH", "scenes": [string],
    "totalEighths": number, "complexity": "low"|"medium"|"high",
    "permitRequirements": [string]
  }],
  "productionFlags": {
    "hasMinors": bool, "hasStunts": bool, "hasFirearms": bool, "hasAnimals": bool,
    "hasVfx": bool, "hasNightWork": bool, "hasWaterWork": bool,
    "hasVehicleAction": bool, "hasIntimacy": bool,
    "unionConsiderations": [string]
  }
}`;

exports.handler = async (event) => {
  const t0 = Date.now();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'POST only' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(500, { ok: false, error: 'GEMINI_API_KEY missing' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { ok: false, error: 'Invalid JSON' }); }

  const scriptText = (body.scriptText || '').trim();
  if (!scriptText) return json(400, { ok: false, error: 'scriptText required' });
  if (scriptText.length > 1500000) {
    return json(413, { ok: false, error: 'Script too large (>1.5M chars).' });
  }

  const userTitle = body.title || 'Untitled';
  const userFormat = body.format || 'feature';

  const userMsg =
    `Break down this screenplay. Title hint: "${userTitle}". Format hint: ${userFormat}.\n\n` +
    `=== SCRIPT START ===\n${scriptText}\n=== SCRIPT END ===`;

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
          maxOutputTokens: MAX_OUTPUT_TOKENS
        }
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return json(resp.status, { ok: false, error: 'Gemini API ' + resp.status, detail: errText.slice(0, 600) });
    }

    const data = await resp.json();
    const raw = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!raw) {
      return json(502, { ok: false, error: 'Empty response from Gemini', detail: JSON.stringify(data).slice(0, 600) });
    }

    let breakdown;
    try {
      breakdown = JSON.parse(extractJson(raw));
    } catch (e) {
      return json(502, { ok: false, error: 'Model returned non-JSON', preview: raw.slice(0, 800) });
    }

    return json(200, {
      ok: true,
      breakdown,
      usage: data.usageMetadata || null,
      ms: Date.now() - t0
    });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text.trim();
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type'
  };
}
function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', ...cors() },
    body: JSON.stringify(body)
  };
}
