// WETYR Arena realtime market feed
// Cloudflare Worker + Durable Object.
//
// One MarketSession Durable Object per session id (e.g. "MNQ" or a competition id).
// It holds the authoritative current price and fans identical ticks out to every
// connected trader over WebSocket. Fills are computed server-side by pf-trade,
// which reads GET /session/:id/price, so no client can spoof or front-run price.
//
// Data source is pluggable:
//   - No DATABENTO_KEY set  -> internal ReplayFeed (seeded synthetic NQ session,
//     zero data cost, identical ticks for everyone = cheat-resistant). Good for the test.
//   - Live data             -> a small relay (ingesting Databento's binary live feed)
//     POSTs ticks to /session/:id/ingest with the INGEST_SECRET. The DO just
//     rebroadcasts them. This keeps the Worker simple and vendor-agnostic; Databento's
//     native live feed is binary-socket, which is better handled by a relay than inside
//     a Worker. (A JSON-WS vendor could connect directly from the DO instead.)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean); // ["session", ":id", ...]
    if (parts[0] === "session" && parts[1]) {
      const id = parts[1];
      const stub = env.MARKET_SESSION.get(env.MARKET_SESSION.idFromName(id));
      return stub.fetch(request);
    }
    return new Response("WETYR Arena realtime feed", { status: 200 });
  },
};

export class MarketSession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Set();
    this.price = null;
    this.lastTick = null;
    this.replayTimer = null;
    this.replay = new ReplayFeed();
    this.live = !!env.DATABENTO_KEY; // live = ticks arrive via /ingest from a relay
  }

  async fetch(request) {
    const url = new URL(request.url);

    // --- WebSocket join: stream ticks to this trader ---
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.sockets.add(server);
      if (this.lastTick) server.send(JSON.stringify(this.lastTick));
      server.addEventListener("close", () => {
        this.sockets.delete(server);
        if (this.sockets.size === 0) this.stopReplay();
      });
      server.addEventListener("error", () => this.sockets.delete(server));
      if (!this.live) this.startReplay(); // self-driving feed only while someone is watching
      return new Response(null, { status: 101, webSocket: client });
    }

    // --- server-authoritative price (pf-trade fills against this) ---
    if (url.pathname.endsWith("/price")) {
      return Response.json({ price: this.price, ts: this.lastTick && this.lastTick.ts });
    }

    // --- live data relay pushes ticks here ---
    if (url.pathname.endsWith("/ingest") && request.method === "POST") {
      if (this.env.INGEST_SECRET && request.headers.get("x-ingest-secret") !== this.env.INGEST_SECRET) {
        return new Response("forbidden", { status: 403 });
      }
      const tick = await request.json(); // { price, ts, symbol }
      this.broadcast({ price: tick.price, ts: tick.ts || Date.now(), symbol: tick.symbol, src: "live" });
      return Response.json({ ok: true });
    }

    return new Response("ok");
  }

  broadcast(tick) {
    this.price = tick.price;
    this.lastTick = tick;
    const msg = JSON.stringify(tick);
    for (const ws of this.sockets) {
      try { ws.send(msg); } catch (_) { this.sockets.delete(ws); }
    }
  }

  startReplay() {
    if (this.replayTimer || this.live) return;
    const tickOnce = () => {
      const t = this.replay.next();
      this.broadcast({ price: t.price, ts: Date.now(), symbol: "MNQ", src: "replay" });
      this.replayTimer = setTimeout(tickOnce, 500); // ~2 ticks/sec
    };
    tickOnce();
  }

  stopReplay() {
    if (this.replayTimer) { clearTimeout(this.replayTimer); this.replayTimer = null; }
  }
}

// Seeded synthetic NQ-style price stream. Deterministic walk with an opening
// volatility burst, snapped to 0.25 ticks. Same sequence every session id run.
class ReplayFeed {
  constructor(seed = 20260930) {
    this._rng = mulberry32(seed);
    this.price = 19180;
    this.i = 0;
  }
  next() {
    const vol = this.i < 30 ? 3.5 : 2.0; // opening burst then calmer
    const drift = Math.sin(this.i / 80) * 0.6 + (this._rng() - 0.5) * 0.5;
    this.price += drift * vol + (this._rng() - 0.5) * vol;
    this.price = Math.round(this.price * 4) / 4; // 0.25 tick
    this.i++;
    return { price: this.price };
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Databento live integration note ---
// Databento's live feed is binary (DBN) over a raw socket, which is awkward inside a
// Worker. Recommended path: a tiny relay (Node/container) authenticates to Databento
// with DATABENTO_KEY, subscribes to NQ/ES (CME GLBX), normalizes each trade/quote to
// { price, ts, symbol }, and POSTs to /session/<symbol>/ingest with the x-ingest-secret
// header. The DO above rebroadcasts. Requires a CME real-time display license for
// showing live prices to end users (per-user pro/non-pro fees). Until that is in place,
// the ReplayFeed serves identical synthetic ticks at zero cost.
