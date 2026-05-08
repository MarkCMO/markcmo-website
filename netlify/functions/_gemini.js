// Shared Gemini call helper for all WETYR Studio background functions.
// Returns parsed JSON or throws.

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

async function callGeminiJSON({ key, system, user, maxOutputTokens = 8192 }) {
  const resp = await fetch(API_URL + '?key=' + encodeURIComponent(key), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
        maxOutputTokens,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });
  if (!resp.ok) throw new Error('Gemini ' + resp.status + ': ' + (await resp.text()).slice(0, 600));
  const data = await resp.json();
  const raw = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  if (!raw) throw new Error('Empty Gemini response');
  return safeParse(raw) || (() => { throw new Error('Gemini returned non-JSON: ' + raw.slice(0, 500)); })();
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

module.exports = { callGeminiJSON, safeParse };
