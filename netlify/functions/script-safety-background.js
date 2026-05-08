// WETYR Studios - Safety + Insurance BACKGROUND function
// From production flags + tagged elements, generates per-risk safety memos
// and the insurance riders/COIs needed before the first day of shooting.

const { setJob } = require('./_wetyr_jobs');
const { callGeminiJSON } = require('./_gemini');

const SYSTEM_PROMPT = `You are a Production Safety Officer + Insurance Coordinator generating safety memos and insurance rider checklists.

For each high-liability item flagged in the breakdown (firearms, stunts, animals, water, fire, vehicles, minors, intimate scenes, special effects, aerial work), produce:
- Risk category and OSHA/IATSE reference
- Required personnel on set (e.g. "weapons coordinator", "stunt coordinator with SAG signatory", "studio teacher / welfare worker")
- Required certifications (e.g. NFPA 160 for pyro, USDA license for animals)
- Insurance rider needed + carrier types (production package, E&O, workers comp, hired/non-owned auto, animal mortality)
- Daily safety meeting topics
- Stop-work triggers
- Required forms (e.g. SAG-AFTRA Minor Permit, OSHA 300 log entry)

ALSO produce the master Certificate of Insurance (COI) requirements list for the entire production.

Use Industry Bulletin standards (IATSE General Code of Safe Practices, AMPTP Safety Bulletins #1-43).

OUTPUT JSON ONLY:
{
  "riskMemos": [{
    "risk": string,
    "category": string,
    "scenesAffected": [string],
    "iatsceBulletin": string,
    "requiredPersonnel": [string],
    "requiredCertifications": [string],
    "insuranceRider": string,
    "dailyMeetingTopics": [string],
    "stopWorkTriggers": [string],
    "requiredForms": [string],
    "additionalCost": string
  }],
  "coiRequirements": {
    "generalLiability": string,
    "autoLiability": string,
    "workersComp": string,
    "umbrella": string,
    "additionalInsureds": [string],
    "specialRiders": [string]
  },
  "summary": {
    "totalRiskCategories": number,
    "highSeverity": number,
    "estimatedInsurancePremium": string
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
    if (!breakdown) { await setJob(jobId, { status: 'error', error: 'breakdown required' }); return { statusCode: 400, body: '' }; }

    await setJob(jobId, { progress: 'analyzing risks' });

    // Build a risk-affected scene index from the breakdown.
    const flags = breakdown.productionFlags || {};
    const scenesByRisk = {
      firearms: scenesWith(breakdown.scenes, 'weapons'),
      stunts: scenesWith(breakdown.scenes, 'stunts'),
      animals: scenesWith(breakdown.scenes, 'animals'),
      vehicles: scenesWith(breakdown.scenes, 'vehicles'),
      sfx: scenesWith(breakdown.scenes, 'sfx'),
      vfx: scenesWith(breakdown.scenes, 'vfx'),
      minors: (breakdown.scenes || []).filter(s => s.minorsOnSet).map(s => s.number),
      night: (breakdown.scenes || []).filter(s => s.timeOfDay === 'NIGHT').map(s => s.number)
    };

    const compact = {
      title: breakdown.title,
      tier: context.budgetTier || 'indie',
      shootState: context.shootState || 'CA',
      union: context.union || 'non-union',
      productionFlags: flags,
      scenesByRisk
    };

    const safety = await callGeminiJSON({
      key, system: SYSTEM_PROMPT,
      user: 'Generate safety memos + insurance rider list.\n\nCONTEXT:\n' + JSON.stringify(compact, null, 2),
      maxOutputTokens: 8192
    });

    await setJob(jobId, { status: 'complete', progress: 'done', safety: { ...safety, generatedAt: new Date().toISOString() } });
    return { statusCode: 200, body: '' };
  } catch (e) {
    await setJob(jobId, { status: 'error', error: String(e.message || e) });
    return { statusCode: 500, body: '' };
  }
};

function scenesWith(scenes, field) {
  return (scenes || []).filter(s => (s[field] || []).length > 0).map(s => s.number);
}
