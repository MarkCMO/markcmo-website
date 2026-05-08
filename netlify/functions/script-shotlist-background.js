// WETYR Studios - Shot List BACKGROUND function
// Generates a director's shot list per scene from the breakdown.
// Storyboard image generation is deferred (would use Gemini Vision multimodal).

const { setJob } = require('./_wetyr_jobs');
const { callGeminiJSON } = require('./_gemini');

const SYSTEM_PROMPT = `You are a veteran cinematographer/director generating a SHOT LIST from a script breakdown.

For each scene given, propose 3-8 specific shots a working DP would shoot to cover it. Be opinionated about coverage - prioritize visual storytelling over master+coverage shopping lists.

For each shot, include: shot number, type (WIDE/MED/CU/ECU/INSERT/OTS/POV/MASTER/2-SHOT), angle (HIGH/LOW/EYE/DUTCH/OVERHEAD), movement (STATIC/PAN/TILT/DOLLY/CRANE/HANDHELD/STEADICAM), lens (wide/normal/long/anamorphic), and a one-line description of the action and intent.

Flag any shot that needs SPECIAL EQUIPMENT (drone, crane, underwater housing, gimbal, motion control) or is HIGH RISK (stunt, pyro, animal, vehicle insert).

OUTPUT JSON ONLY:
{
  "scenes": [{
    "sceneNumber": string,
    "heading": string,
    "totalShots": number,
    "estimatedSetups": number,
    "shots": [{
      "number": string,
      "type": string,
      "angle": string,
      "movement": string,
      "lens": string,
      "description": string,
      "specialEquipment": [string],
      "highRisk": bool,
      "notes": string
    }]
  }],
  "summary": {
    "totalScenes": number,
    "totalShots": number,
    "totalSetups": number,
    "highRiskCount": number,
    "specialEquipmentNeeded": [string]
  }
}
No prose. JSON only.`;

const CHUNK_SCENES = 12;

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { jobId, breakdown } = body;
  if (!jobId) return { statusCode: 400, body: 'jobId required' };

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { await setJob(jobId, { status: 'error', error: 'GEMINI_API_KEY missing' }); return { statusCode: 500, body: '' }; }
    if (!breakdown || !breakdown.scenes?.length) { await setJob(jobId, { status: 'error', error: 'breakdown.scenes required' }); return { statusCode: 400, body: '' }; }

    const scenes = breakdown.scenes;
    const chunks = [];
    for (let i = 0; i < scenes.length; i += CHUNK_SCENES) chunks.push(scenes.slice(i, i + CHUNK_SCENES));
    await setJob(jobId, { progress: `shooting ${chunks.length} chunks of scenes` });

    const tasks = chunks.map((chunk) => () => callGeminiJSON({
      key, system: SYSTEM_PROMPT,
      user: `Generate shot list for these ${chunk.length} scenes from "${breakdown.title}":\n\n${JSON.stringify(chunk)}`,
      maxOutputTokens: 8192
    }));

    const results = await runConcurrent(tasks, 4);

    const allScenes = [];
    let totalShots = 0, totalSetups = 0, highRisk = 0;
    const specialEq = new Set();
    for (const r of results) {
      for (const sc of r.scenes || []) {
        allScenes.push(sc);
        totalShots += sc.totalShots || (sc.shots || []).length;
        totalSetups += sc.estimatedSetups || 0;
        for (const sh of sc.shots || []) {
          if (sh.highRisk) highRisk++;
          for (const e of sh.specialEquipment || []) specialEq.add(e);
        }
      }
    }

    const shotlist = {
      scenes: allScenes,
      summary: {
        totalScenes: allScenes.length,
        totalShots, totalSetups, highRiskCount: highRisk,
        specialEquipmentNeeded: [...specialEq]
      },
      generatedAt: new Date().toISOString()
    };

    await setJob(jobId, { status: 'complete', progress: 'done', shotlist });
    return { statusCode: 200, body: '' };
  } catch (e) {
    await setJob(jobId, { status: 'error', error: String(e.message || e) });
    return { statusCode: 500, body: '' };
  }
};

async function runConcurrent(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (true) { const i = next++; if (i >= tasks.length) return; results[i] = await tasks[i](); }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}
