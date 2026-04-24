// WETYR Studios - Script Upload / Normalizer
// Accepts a script in PDF / Fountain / FDX / plain text and returns normalized text.
// For scanned PDFs (no extractable text), falls back to Mistral OCR.
//
// POST { filename: string, contentType: string, dataBase64: string }
// -> { ok: true, text: string, pageCount: number, method: 'pdf-text'|'fountain'|'fdx'|'txt'|'ocr' }
//
// Env: MISTRAL_API_KEY (optional, only needed for scanned PDFs)

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { ok: false, error: 'Invalid JSON' }); }

  const { filename = '', contentType = '', dataBase64 = '' } = body;
  if (!dataBase64) return json(400, { ok: false, error: 'dataBase64 required' });

  const buf = Buffer.from(dataBase64, 'base64');
  const lower = filename.toLowerCase();

  try {
    // .fountain or .txt
    if (lower.endsWith('.fountain') || lower.endsWith('.txt') || contentType.startsWith('text/')) {
      const text = buf.toString('utf8');
      return json(200, { ok: true, text, pageCount: estimatePages(text), method: lower.endsWith('.fountain') ? 'fountain' : 'txt' });
    }

    // .fdx (Final Draft XML)
    if (lower.endsWith('.fdx') || contentType.includes('xml')) {
      const xml = buf.toString('utf8');
      const text = fdxToText(xml);
      return json(200, { ok: true, text, pageCount: estimatePages(text), method: 'fdx' });
    }

    // .pdf - try pdf-parse first (handles FlateDecode + most standard encodings),
    // fall back to Mistral OCR for scanned or exotic PDFs.
    if (lower.endsWith('.pdf') || contentType === 'application/pdf') {
      let text = '';
      let pageCount = 0;
      try {
        const pdfParse = require('pdf-parse');
        const parsed = await pdfParse(buf);
        text = (parsed.text || '').trim();
        pageCount = parsed.numpages || 0;
      } catch (err) {
        // pdf-parse failed outright - fall through to OCR
      }

      const looksReal = text.length > 500 && /[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(text);
      if (looksReal) {
        return json(200, { ok: true, text, pageCount: pageCount || estimatePages(text), method: 'pdf-text' });
      }

      // Scanned PDF or exotic encoding - OCR path
      const mistralKey = process.env.MISTRAL_API_KEY;
      if (!mistralKey) {
        return json(422, {
          ok: false,
          error: 'PDF text extraction failed and MISTRAL_API_KEY is not set.',
          hint: 'Set MISTRAL_API_KEY in Netlify env vars, or upload a .fdx / .fountain / .txt file.'
        });
      }
      const ocrText = await mistralOcr(buf, mistralKey);
      return json(200, { ok: true, text: ocrText, pageCount: estimatePages(ocrText), method: 'ocr' });
    }

    return json(415, { ok: false, error: 'Unsupported file type. Use .pdf, .fdx, .fountain, or .txt' });
  } catch (e) {
    return json(500, { ok: false, error: String(e.message || e) });
  }
};

// Minimal PDF text extractor. Pulls text from uncompressed content streams
// and simple Tj/TJ operators. Works for most modern PDF screenplays exported
// by Final Draft, Highland, WriterDuet, etc. Scanned PDFs return empty -> OCR.
function extractPdfText(buf) {
  const s = buf.toString('latin1');
  const pieces = [];
  // Decompressed text streams often show up as (text) Tj or [(text) ...] TJ
  const rx = /\(((?:\\[\\()nrtbf]|\\[0-7]{1,3}|[^\\()])*)\)\s*(?:Tj|TJ|'|")/g;
  let m;
  while ((m = rx.exec(s)) !== null) {
    pieces.push(unescapePdfString(m[1]));
  }
  return pieces.join(' ').replace(/\s+/g, ' ').trim();
}

function unescapePdfString(s) {
  return s
    .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

// Final Draft .fdx is XML with <Paragraph Type="Scene Heading|Action|Character|Dialogue|Parenthetical|Transition">
// Extract the visible text in order, preserving screenplay structure.
function fdxToText(xml) {
  const out = [];
  const paraRx = /<Paragraph([^>]*)>([\s\S]*?)<\/Paragraph>/g;
  let m;
  while ((m = paraRx.exec(xml)) !== null) {
    const attrs = m[1];
    const inner = m[2];
    const typeMatch = attrs.match(/Type="([^"]+)"/);
    const type = typeMatch ? typeMatch[1] : 'Action';
    const textRx = /<Text[^>]*>([\s\S]*?)<\/Text>/g;
    const chunks = [];
    let tm;
    while ((tm = textRx.exec(inner)) !== null) {
      chunks.push(tm[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
    }
    const line = chunks.join('').trim();
    if (!line) continue;
    switch (type) {
      case 'Scene Heading': out.push('\n\n' + line.toUpperCase() + '\n'); break;
      case 'Character':     out.push('\n' + line.toUpperCase()); break;
      case 'Parenthetical': out.push('(' + line.replace(/^\(|\)$/g, '') + ')'); break;
      case 'Dialogue':      out.push(line); break;
      case 'Transition':    out.push('\n' + line.toUpperCase() + '\n'); break;
      case 'Action':
      default:              out.push('\n' + line);
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function estimatePages(text) {
  // Screenplay convention: ~55 lines per page, ~250 words per page.
  const words = (text.match(/\S+/g) || []).length;
  return Math.max(1, Math.round(words / 250));
}

async function mistralOcr(buf, key) {
  // Mistral OCR takes a document_url - for local files, pass a data URL
  // with the PDF base64-encoded so we don't need a separate upload step.
  const dataUrl = 'data:application/pdf;base64,' + buf.toString('base64');
  const resp = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        document_url: dataUrl
      },
      include_image_base64: false
    })
  });
  if (!resp.ok) throw new Error('Mistral OCR ' + resp.status + ': ' + (await resp.text()).slice(0, 300));
  const data = await resp.json();
  const pages = data.pages || [];
  return pages.map(p => p.markdown || p.text || '').join('\n\n').trim();
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type'
  };
}
function json(statusCode, body) {
  return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(body) };
}
