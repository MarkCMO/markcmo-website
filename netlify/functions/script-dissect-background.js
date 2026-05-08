// WETYR Studios - Script Dissector BACKGROUND function
//
// Netlify routes any function ending in -background to a 15-min runtime
// and returns 202 to caller immediately. We use that to do unbounded
// chunked Gemini work without hitting the 26s sync function cap.
//
// Result is persisted to Netlify Blobs (store: wetyr-jobs) keyed by jobId.
// Client polls /script-result?jobId=X to read status + result.
//
// POST { jobId, scriptText, title?, format? }

const { setJob } = require('./_wetyr_jobs');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const CHUNK_CHARS = 60000;
const MAX_OUTPUT_TOKENS = 8192;
const MAX_CONCURRENCY = 3;
const RETRY_MS = 2500;

const SYSTEM_META = `You are the WETYR Studios Script Breakdown Engine - a veteran 1st AD with 25 years of feature experience.

You are being given the FULL TEXT of a screenplay. Return ONLY high-level metadata as JSON. Do NOT enumerate scenes.

Return JSON matching:
{
  "title": string,
  "logline": string (1-2 sentences),
  "genre": string,
  "format": "feature"|"short"|"pilot"|"episode"|"commercial"|"music_video",
  "estimatedRuntimeMinutes": number,
  "productionFlags": {
    "hasMinors": bool, "hasStunts": bool, "hasFirearms": bool, "hasAnimals": bool,
    "hasVfx": bool, "hasNightWork": bool, "hasWaterWork": bool,
    "hasVehicleAction": bool, "hasIntimacy": bool,
    "unionConsiderations": [string]
  }
}
No prose. JSON only.`;

const SYSTEM_CHUNK = `You are a 1st AD breaking down a CHUNK of a larger screenplay.

Return JSON with ONLY scenes, characters, and locations found in THIS chunk. Do NOT produce title/logline/format - those are handled separately.

RULES
1. Tag every element: props, wardrobe, vehicles, weapons, animals, sfx, vfx, stunts, specialEquipment.
2. Page count: 1 page = 8/8. pageCount is decimal; eighths is integer 1/8 units.
3. Scene number: use the script's numbers if present; otherwise use the heading itself as the number.
4. Characters: every speaking role + named non-speaking. minor:true if under 18. sceneCount/dialogueLineCount = count WITHIN THIS CHUNK only.
5. Locations: consolidate equivalent spaces. totalEighths = eighths WITHIN THIS CHUNK only.
6. Flag high-liability items aggressively (weapons, stunts, minors, firearms, animals, vehicle action, water).
7. Return ONLY valid JSON. No prose, no fences.

OUTPUT SCHEMA:
{
  "scenes": [{
    "number": string, "heading": string,
    "intExt": "INT"|"EXT"|"INT/EXT"|"EXT/INT",
    "location": string, "subLocation": string,
    "timeOfDay": "DAY"|"NIGHT"|"DAWN"|"DUSK"|"CONTINUOUS"|"LATER"|"MORNING"|"EVENING"|"MAGIC HOUR",
    "pageCount": number, "eighths": number, "synopsis": string,
    "characters": [string],
    "extras": {"count": number, "description": string},
    "props": [string], "wardrobe": [string], "makeup": [string], "setDressing": [string],
    "vehicles": [string], "animals": [string], "weapons": [string],
    "sfx": [string], "vfx": [string], "stunts": [string],
    "music": [string], "sound": [string], "specialEquipment": [string],
    "minorsOnSet": bool, "nudity": bool, "intimacy": bool
  }],
  "characters": [{
    "name": string, "type": "lead"|"supporting"|"day_player"|"extra"|"voice",
    "age": string, "gender": string, "description": string,
    "sceneCount": number, "dialogueLineCount": number,
    "firstScene": string, "lastScene": string,
    "specialSkillsRequired": [string], "minor": bool
  }],
  "locations": [{
    "name": string, "type": "practical"|"stage"|"location"|"backlot",
    "intExt": "INT"|"EXT"|"BOTH", "scenes": [string],
    "totalEighths": number, "complexity": "low"|"medium"|"high",
    "permitRequirements": [string]
  }]
}`;

exports.handler = async (event) => {
  const t0 = Date.now();

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { jobId } = body;
  if (!jobId) return { statusCode: 400, body: 'jobId required' };

  const writeStatus = async (patch) => {
    try { await setJob(jobId, patch); } catch (e) { /* best-effort */ }
  };

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      await writeStatus({ status: 'error', error: 'GEMINI_API_KEY missing' });
      return { statusCode: 500, body: '' };
    }

    const scriptText = (body.scriptText || '').trim();
    if (!scriptText) {
      await writeStatus({ status: 'error', error: 'scriptText required' });
      return { statusCode: 400, body: '' };
    }

    const userTitle = body.title || 'Untitled';
    const userFormat = body.format || 'feature';

    await writeStatus({ progress: 'splitting' });
    const chunks = splitScript(scriptText, CHUNK_CHARS);
    await writeStatus({ progress: `dissecting ${chunks.length} chunks`, totalChunks: chunks.length });

    const metaInput = chunks.length === 1 ? scriptText : summariseForMeta(scriptText);

    const tasks = [
      () => callGemini(key, SYSTEM_META, `Title hint: "${userTitle}". Format hint: ${userFormat}.\n\n${metaInput}`),
      ...chunks.map((c, i) => () => callGemini(key, SYSTEM_CHUNK, `Chunk ${i + 1} of ${chunks.length}:\n\n${c}`))
    ];
    const results = await runConcurrent(tasks, MAX_CONCURRENCY);
    const [metaResult, ...chunkResults] = results;

    await writeStatus({ progress: 'merging' });
    const meta = safeParse(metaResult.text) || {};
    const chunkBreakdowns = chunkResults.map(r => safeParse(r.text) || { scenes: [], characters: [], locations: [] });
    const merged = mergeBreakdowns(chunkBreakdowns, meta, userTitle, userFormat);

    await writeStatus({
      status: 'complete',
      progress: 'done',
      breakdown: merged,
      chunks: chunks.length,
      ms: Date.now() - t0
    });
    return { statusCode: 200, body: '' };
  } catch (e) {
    await writeStatus({ status: 'error', error: String(e.message || e), ms: Date.now() - t0 });
    return { statusCode: 500, body: '' };
  }
};

// ─── Script splitter ────────────────────────────────────────────
function splitScript(text, maxChars) {
  // Split at scene headings (INT./EXT./I/E.) so chunk boundaries are clean.
  const sceneRegex = /(?=^\s*(?:INT\.?\s|EXT\.?\s|INT\.?\/EXT\.?\s|I\/E\.?\s|INT\s+EXT))/gmi;
  const scenes = text.split(sceneRegex);
  if (scenes.length <= 1) {
    // No scene boundaries detected - fall back to paragraph split.
    const paras = text.split(/\n\n+/);
    return packChunks(paras, maxChars, '\n\n');
  }
  return packChunks(scenes, maxChars, '');
}

function packChunks(parts, maxChars, sep) {
  const chunks = [];
  let current = '';
  for (const part of parts) {
    if (!part) continue;
    if (current.length + part.length + sep.length > maxChars && current) {
      chunks.push(current);
      current = part;
    } else {
      current = current ? current + sep + part : part;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [parts.join(sep)];
}

function summariseForMeta(text) {
  // Pull the first ~5k chars (title page + opening), last ~2k (closing),
  // and every scene heading in between. Enough context for meta + flags
  // without sending the full script.
  const first = text.slice(0, 5000);
  const last = text.slice(-2000);
  const headings = (text.match(/^\s*(?:INT\.?\s|EXT\.?\s|INT\.?\/EXT\.?\s|I\/E\.?\s).*$/gmi) || []).join('\n');
  return `[OPENING]\n${first}\n\n[SCENE HEADINGS]\n${headings}\n\n[CLOSING]\n${last}`;
}

// ─── Gemini call with one retry on 429 ──────────────────────────
async function callGemini(key, systemPrompt, userText, attempt = 0) {
  const resp = await fetch(API_URL + '?key=' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });
  if (resp.status === 429 && attempt < 1) {
    await new Promise(r => setTimeout(r, RETRY_MS));
    return callGemini(key, systemPrompt, userText, attempt + 1);
  }
  if (!resp.ok) throw new Error('Gemini ' + resp.status + ': ' + (await resp.text()).slice(0, 1500));
  const data = await resp.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  return { text, usage: data.usageMetadata };
}

// Run async tasks with bounded concurrency, preserving order.
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
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { return JSON.parse(raw.slice(first, last + 1)); } catch { return null; }
    }
    return null;
  }
}

// ─── Merger ─────────────────────────────────────────────────────
function mergeBreakdowns(chunks, meta, fallbackTitle, fallbackFormat) {
  const scenes = [];
  const charMap = new Map();
  const locMap = new Map();

  let sceneIdx = 1;
  for (const c of chunks) {
    for (const s of c.scenes || []) {
      if (!s.number || s.number === '') s.number = String(sceneIdx);
      scenes.push(s);
      sceneIdx++;
    }
    for (const ch of c.characters || []) {
      const key = (ch.name || '').toUpperCase().trim();
      if (!key) continue;
      const ex = charMap.get(key);
      if (!ex) {
        charMap.set(key, { ...ch });
      } else {
        ex.sceneCount = (ex.sceneCount || 0) + (ch.sceneCount || 0);
        ex.dialogueLineCount = (ex.dialogueLineCount || 0) + (ch.dialogueLineCount || 0);
        ex.specialSkillsRequired = uniq([...(ex.specialSkillsRequired || []), ...(ch.specialSkillsRequired || [])]);
        if (ch.minor) ex.minor = true;
        if (!ex.lastScene && ch.lastScene) ex.lastScene = ch.lastScene;
        else if (ch.lastScene) ex.lastScene = ch.lastScene;
        if (!ex.description && ch.description) ex.description = ch.description;
      }
    }
    for (const l of c.locations || []) {
      const key = normalizeLoc(l.name);
      if (!key) continue;
      const ex = locMap.get(key);
      if (!ex) {
        locMap.set(key, { ...l, scenes: [...(l.scenes || [])] });
      } else {
        ex.totalEighths = (ex.totalEighths || 0) + (l.totalEighths || 0);
        ex.scenes = uniq([...(ex.scenes || []), ...(l.scenes || [])]);
        if (l.intExt && ex.intExt && l.intExt !== ex.intExt) ex.intExt = 'BOTH';
        if (l.permitRequirements) ex.permitRequirements = uniq([...(ex.permitRequirements || []), ...(l.permitRequirements || [])]);
        if (l.complexity === 'high' || ex.complexity === 'high') ex.complexity = 'high';
      }
    }
  }

  // Re-classify character types based on total dialogue count across full script.
  const allChars = [...charMap.values()].sort((a, b) => (b.dialogueLineCount || 0) - (a.dialogueLineCount || 0));
  allChars.forEach((c, i) => {
    if ((c.dialogueLineCount || 0) === 0) c.type = c.type || 'extra';
    else if (i < 3) c.type = 'lead';
    else if (i < 10) c.type = 'supporting';
    else c.type = 'day_player';
  });

  const totalEighths = scenes.reduce((s, sc) => s + (sc.eighths || 0), 0);
  const totalPages = scenes.reduce((s, sc) => s + (sc.pageCount || 0), 0);

  return {
    title: meta.title || fallbackTitle,
    logline: meta.logline || '',
    genre: meta.genre || '',
    format: meta.format || fallbackFormat,
    pageCount: Math.round(totalPages * 100) / 100 || Math.round(totalEighths / 8 * 100) / 100,
    estimatedRuntimeMinutes: meta.estimatedRuntimeMinutes || Math.round(totalPages),
    scenes,
    characters: allChars,
    locations: [...locMap.values()],
    productionFlags: meta.productionFlags || rollUpFlags(scenes)
  };
}

function rollUpFlags(scenes) {
  // Fallback: infer production flags from merged scenes if meta didn't return them.
  const flags = {
    hasMinors: false, hasStunts: false, hasFirearms: false, hasAnimals: false,
    hasVfx: false, hasNightWork: false, hasWaterWork: false,
    hasVehicleAction: false, hasIntimacy: false, unionConsiderations: []
  };
  for (const s of scenes) {
    if (s.minorsOnSet) flags.hasMinors = true;
    if ((s.stunts || []).length) flags.hasStunts = true;
    if ((s.weapons || []).length) flags.hasFirearms = true;
    if ((s.animals || []).length) flags.hasAnimals = true;
    if ((s.vfx || []).length) flags.hasVfx = true;
    if (s.timeOfDay === 'NIGHT') flags.hasNightWork = true;
    if ((s.vehicles || []).length || (s.stunts || []).some(st => /drive|chase|crash/i.test(st))) flags.hasVehicleAction = true;
    if (s.intimacy) flags.hasIntimacy = true;
    if ((s.specialEquipment || []).some(e => /water|underwater|marine/i.test(e))) flags.hasWaterWork = true;
  }
  return flags;
}

function normalizeLoc(name) {
  return (name || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
function uniq(arr) { return [...new Set(arr)]; }

// ─── HTTP helpers ───────────────────────────────────────────────
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
