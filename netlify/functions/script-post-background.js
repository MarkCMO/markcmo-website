// WETYR Studios - Post-Production Plan BACKGROUND function
// Plans the full post pipeline: edit, color, sound mix, VFX shot pulls,
// music score, deliverables. Uses breakdown + budget + schedule.

const { setJob } = require('./_wetyr_jobs');
const { callGeminiJSON } = require('./_gemini');

const SYSTEM_PROMPT = `You are a Post-Production Supervisor planning the FULL post pipeline.

For the production, generate:
- Editorial schedule: assistant editor, editor, room rentals, weeks of cut
- Locked picture target date and turnover date for VFX
- VFX plan: pull EVERY scene flagged for VFX from the breakdown, list per-shot complexity (Low/Med/High), assign vendor type (boutique vs facility), and estimate cost
- Color pipeline: dailies LUT, conform, primary grade, finishing colorist, days of color
- Sound: ADR session count, Foley days, sound design days, mix days (5.1 + Atmos), mix stage type
- Music: composer or licensed, spotting session, score weeks, music supervisor for licensing
- Deliverables checklist by distributor type (theatrical / streaming / festival): IMF, ProRes, Closed Captions, Dolby Vision/HDR, M&E stems, dialogue stems, deliverable due dates relative to wrap

OUTPUT JSON ONLY:
{
  "schedule": {
    "wrapDate": string,
    "lockedPicture": string,
    "vfxTurnover": string,
    "soundTurnover": string,
    "finalDelivery": string,
    "totalPostWeeks": number
  },
  "editorial": { "editor": string, "weeks": number, "assistantEditor": bool, "roomRental": string, "estimatedCost": number },
  "vfx": {
    "shotCount": number,
    "shotsByComplexity": { "low": number, "medium": number, "high": number },
    "vendor": string,
    "weeks": number,
    "estimatedCost": number,
    "shotList": [{ "scene": string, "description": string, "complexity": string, "estCost": number }]
  },
  "color": { "colorist": string, "days": number, "deliverables": [string], "estimatedCost": number },
  "sound": { "adrSessions": number, "foleyDays": number, "designDays": number, "mixFormat": [string], "mixDays": number, "mixStage": string, "estimatedCost": number },
  "music": { "model": string, "composer": string, "weeks": number, "musicSupervisor": bool, "estimatedCost": number },
  "deliverables": [{
    "distributor": string,
    "format": string,
    "specs": [string],
    "dueDate": string
  }],
  "summary": { "totalPostBudget": number, "estimatedPostMonths": number }
}
No prose. JSON only.`;

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { jobId, breakdown, schedule, budget, context = {} } = body;
  if (!jobId) return { statusCode: 400, body: 'jobId required' };

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { await setJob(jobId, { status: 'error', error: 'GEMINI_API_KEY missing' }); return { statusCode: 500, body: '' }; }
    if (!breakdown) { await setJob(jobId, { status: 'error', error: 'breakdown required' }); return { statusCode: 400, body: '' }; }

    await setJob(jobId, { progress: 'planning post' });

    const compact = {
      title: breakdown.title,
      format: breakdown.format,
      pageCount: breakdown.pageCount,
      shootDays: schedule?.days?.length || null,
      tier: context.budgetTier || 'indie',
      productionFlags: breakdown.productionFlags || {},
      vfxScenes: (breakdown.scenes || []).filter(s => (s.vfx || []).length > 0).map(s => ({
        number: s.number, heading: s.heading?.slice(0, 80), vfx: s.vfx
      })),
      budgetTopSheet: budget?.topSheet || null
    };

    const post = await callGeminiJSON({
      key, system: SYSTEM_PROMPT,
      user: 'Plan the full post-production pipeline.\n\nCONTEXT:\n' + JSON.stringify(compact, null, 2),
      maxOutputTokens: 16384
    });

    await setJob(jobId, { status: 'complete', progress: 'done', post: { ...post, generatedAt: new Date().toISOString() } });
    return { statusCode: 200, body: '' };
  } catch (e) {
    await setJob(jobId, { status: 'error', error: String(e.message || e) });
    return { statusCode: 500, body: '' };
  }
};
