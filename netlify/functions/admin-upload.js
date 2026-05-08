// netlify/functions/admin-upload.js
// Handles document uploads from admin panel
// Files are saved to Netlify's built-in file system via base64 → stored as metadata in JSONBin
// Actual files must be placed in /public/pdfs/ via Git or Netlify deploy, this records metadata

// NOTE ON FILE STORAGE:
// Netlify Functions are stateless, they cannot write permanent files to disk.
// For production file storage, we recommend one of:
//   Option A: Netlify Blobs (beta), native Netlify key-value storage
//   Option B: Cloudflare R2 or AWS S3, store files, return public URL
//   Option C: Manual, you upload files via Git to /public/pdfs/, this function just records metadata
//
// This implementation uses Netlify Blobs (available on Netlify Pro/free with feature flag).
// Enable at: app.netlify.com → Site settings → Feature flags → Netlify Blobs

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { JSONBIN_API_KEY, JSONBIN_DOCS_BIN_ID } = process.env;

  try {
    // Parse multipart form, Netlify doesn't parse multipart automatically
    // We expect JSON body with { name, category, base64, mimeType, size }
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request format. Send JSON with base64 file.' }) };
    }

    const { name, category, base64, mimeType, size } = body;
    if (!name || !base64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing name or file data' }) };
    }

    // Store file in Netlify Blobs
    const store = getStore('documents');
    const fileBuffer = Buffer.from(base64, 'base64');
    const blobKey = `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    
    await store.set(blobKey, fileBuffer, {
      metadata: { name, mimeType, category }
    });

    const publicUrl = `https://markcmo.com/pdfs/${blobKey}`;

    // Record metadata in JSONBin
    const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_DOCS_BIN_ID}/latest`, {
      headers: { 'X-Master-Key': JSONBIN_API_KEY }
    });
    const getData = await getRes.json();
    const existing = getData.record?.docs || [];

    const docEntry = {
      key: blobKey,
      name,
      category: category || 'other',
      mimeType,
      size: formatBytes(size),
      url: publicUrl,
      uploadedAt: new Date().toISOString()
    };

    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_DOCS_BIN_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
      body: JSON.stringify({ docs: [...existing, docEntry] })
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ success: true, url: publicUrl, key: blobKey })
    };

  } catch (err) {
    console.error('Upload error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

function formatBytes(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
