// WETYR Studios - Purchase Orders BACKGROUND function
// Aggregates all props/wardrobe/set-dressing/vehicles/weapons/sfx materials
// from the breakdown and generates department-level POs ready to send to vendors.

const { setJob } = require('./_wetyr_jobs');
const { callGeminiJSON } = require('./_gemini');

const SYSTEM_PROMPT = `You are a veteran Production Coordinator generating PURCHASE ORDERS from a tagged breakdown.

For each department (Props, Wardrobe, Set Dressing, Vehicles, Weapons/Armory, SFX, Catering, Camera Rental, Grip & Electric Rental, Sound Rental), aggregate all required items, dedupe, and produce a vendor-ready PO with realistic quantities, unit prices, vendors, and lead times.

Pricing reference (US, 2024-2025): use realistic numbers for the budget tier provided. Studio tier: name vendors (Independent Studio Services for props, Western Costume for wardrobe, Picture Car Warehouse for vehicles, ISS for armory, Keslow/Panavision for camera, MBS for grip/electric, Sound Devices for sound). Indie tier: smaller regional vendors, lower prices.

For consumables (food, water, supplies): assume 1 case water/person/day, 3 meals/person/day for full crew + cast.

OUTPUT JSON ONLY:
{
  "orders": [{
    "department": string,
    "vendor": string,
    "vendorContact": string,
    "leadTimeDays": number,
    "items": [{
      "description": string,
      "quantity": number,
      "unit": string,
      "unitPrice": number,
      "lineTotal": number,
      "scenesUsed": [string],
      "notes": string
    }],
    "subtotal": number,
    "tax": number,
    "deliveryDate": string,
    "deliveryAddress": string,
    "notes": string
  }],
  "grandTotal": number,
  "summary": {
    "totalOrders": number,
    "totalLineItems": number,
    "longestLeadTime": number
  }
}
No prose. JSON only.`;

exports.handler = async (event) => {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { jobId, breakdown, schedule, context = {} } = body;
  if (!jobId) return { statusCode: 400, body: 'jobId required' };

  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) { await setJob(jobId, { status: 'error', error: 'GEMINI_API_KEY missing' }); return { statusCode: 500, body: '' }; }
    if (!breakdown) { await setJob(jobId, { status: 'error', error: 'breakdown required' }); return { statusCode: 400, body: '' }; }

    await setJob(jobId, { progress: 'aggregating elements' });

    // Compact: feed only what's needed.
    const compact = {
      title: breakdown.title,
      format: breakdown.format,
      sceneCount: breakdown.scenes?.length || 0,
      shootDays: schedule?.days?.length || null,
      tier: context.budgetTier || 'indie',
      union: context.union || 'non-union',
      elementsByCategory: {
        props: aggregate(breakdown.scenes, 'props'),
        wardrobe: aggregate(breakdown.scenes, 'wardrobe'),
        setDressing: aggregate(breakdown.scenes, 'setDressing'),
        vehicles: aggregate(breakdown.scenes, 'vehicles'),
        weapons: aggregate(breakdown.scenes, 'weapons'),
        sfx: aggregate(breakdown.scenes, 'sfx'),
        specialEquipment: aggregate(breakdown.scenes, 'specialEquipment')
      },
      castSize: breakdown.characters?.length || 0,
      crewEstimate: estimateCrew(context.budgetTier || 'indie')
    };

    const orders = await callGeminiJSON({
      key, system: SYSTEM_PROMPT,
      user: 'Generate department-level purchase orders.\n\nCONTEXT:\n' + JSON.stringify(compact, null, 2),
      maxOutputTokens: 8192
    });

    await setJob(jobId, { status: 'complete', progress: 'done', orders: { ...orders, generatedAt: new Date().toISOString(), context } });
    return { statusCode: 200, body: '' };
  } catch (e) {
    await setJob(jobId, { status: 'error', error: String(e.message || e) });
    return { statusCode: 500, body: '' };
  }
};

// Build a frequency-weighted list of unique elements from scenes.
function aggregate(scenes, field) {
  const counts = new Map();
  for (const s of scenes || []) {
    for (const item of s[field] || []) {
      const k = (item || '').toString().trim();
      if (!k) continue;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([item, n]) => ({ item, sceneCount: n }));
}

function estimateCrew(tier) {
  return ({
    ultralow: 8, micro: 18, indie: 35, midrange: 80, studio: 150, tentpole: 250, blockbuster: 400
  })[tier] || 35;
}
