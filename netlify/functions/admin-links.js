// netlify/functions/admin-links.js
// CRUD for access link tokens — called by admin.html

const crypto = require("crypto");

function generateToken() {
  return crypto.randomBytes(16).toString("base64url"); // e.g. "a7Kf3mN9pQ2rXvZw"
}

exports.handler = async (event) => {
  const { JSONBIN_API_KEY, JSONBIN_LINKS_BIN_ID } = process.env;
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers };
  }

  // ── GET: list all links ──
  if (event.httpMethod === "GET") {
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_LINKS_BIN_ID}/latest`, {
        headers: { "X-Master-Key": JSONBIN_API_KEY }
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify({ links: data.record?.links || [] }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ── POST: create new link ──
  if (event.httpMethod === "POST") {
    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) }; }

    const { action } = body;

    if (action === "create") {
      const { targetUrl, label, recipientName, recipientEmail, singleUse, expiryDays, formId } = body;

      if (!targetUrl || !label) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "targetUrl and label required" }) };
      }

      const token = generateToken();
      const now = new Date();
      const expiresAt = expiryDays ? new Date(now.getTime() + expiryDays * 86400000).toISOString() : null;

      const newLink = {
        id: crypto.randomUUID(),
        token,
        formId: formId || null,
        label,
        targetUrl,
        recipientName: recipientName || "",
        recipientEmail: recipientEmail || "",
        singleUse: !!singleUse,
        expiresAt,
        expiryDays: expiryDays || null,
        createdAt: now.toISOString(),
        usedAt: null,
        lastClickedAt: null,
        clicks: 0,
        clickLog: []
      };

      try {
        // Fetch existing
        const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_LINKS_BIN_ID}/latest`, {
          headers: { "X-Master-Key": JSONBIN_API_KEY }
        });
        const getData = await getRes.json();
        const existing = getData.record?.links || [];

        await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_LINKS_BIN_ID}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_API_KEY },
          body: JSON.stringify({ links: [...existing, newLink] })
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            token,
            accessUrl: `https://markcmo.com/access?token=${token}`,
            link: newLink
          })
        };
      } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
      }
    }

    if (action === "revoke") {
      const { id } = body;
      try {
        const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_LINKS_BIN_ID}/latest`, {
          headers: { "X-Master-Key": JSONBIN_API_KEY }
        });
        const getData = await getRes.json();
        const links = (getData.record?.links || []).filter(l => l.id !== id);

        await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_LINKS_BIN_ID}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_API_KEY },
          body: JSON.stringify({ links })
        });

        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
      }
    }

    if (action === "rotate") {
      // Revoke old token, create new one with same settings
      const { id } = body;
      try {
        const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_LINKS_BIN_ID}/latest`, {
          headers: { "X-Master-Key": JSONBIN_API_KEY }
        });
        const getData = await getRes.json();
        const links = getData.record?.links || [];
        const idx = links.findIndex(l => l.id === id);
        if (idx === -1) return { statusCode: 404, headers, body: JSON.stringify({ error: "Link not found" }) };

        const old = links[idx];
        const newToken = generateToken();
        links[idx] = {
          ...old,
          token: newToken,
          usedAt: null,
          lastClickedAt: null,
          clicks: 0,
          clickLog: [],
          rotatedAt: new Date().toISOString(),
          previousToken: old.token
        };

        await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_LINKS_BIN_ID}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_API_KEY },
          body: JSON.stringify({ links })
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            token: newToken,
            accessUrl: `https://markcmo.com/access?token=${newToken}`
          })
        };
      } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
      }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown action" }) };
  }

  return { statusCode: 405, headers, body: "Method Not Allowed" };
};
