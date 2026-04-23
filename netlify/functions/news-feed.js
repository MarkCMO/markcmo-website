// WETYR Film Intel - server-side RSS proxy for trade news.
// Avoids rss2json rate limits + CORS issues. Cached 10 min in-memory per cold start.
// Netlify free tier: 125k invocations/month.

const FEEDS = [
  { src: 'VARIETY',   url: 'https://variety.com/feed/' },
  { src: 'DEADLINE',  url: 'https://deadline.com/feed/' },
  { src: 'INDIEWIRE', url: 'https://www.indiewire.com/feed/' },
  { src: 'THE WRAP',  url: 'https://www.thewrap.com/feed/' },
  { src: 'THR',       url: 'https://www.hollywoodreporter.com/feed/' },
];

let cache = { at: 0, data: null };
const TTL_MS = 10 * 60 * 1000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; WETYR-FilmIntel/1.0; +https://markcmo.com)',
  'Accept': 'application/rss+xml, application/xml, text/xml; q=0.9, */*; q=0.8',
};

function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .trim();
}

function pick(block, tag) {
  const re = new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : '';
}

function pickAttr(block, tag, attr) {
  const re = new RegExp('<' + tag + '[^>]*' + attr + '=["\']([^"\']+)["\']', 'i');
  const m = block.match(re);
  return m ? m[1] : '';
}

function parseRss(xml, src) {
  const items = [];
  // <item>...</item> blocks (RSS 2.0)
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) && items.length < 6) {
    const block = m[0];
    items.push({
      src: src,
      title: pick(block, 'title'),
      link: pick(block, 'link') || pickAttr(block, 'link', 'href'),
      author: pick(block, 'dc:creator') || pick(block, 'author') || '',
      date: pick(block, 'pubDate') || pick(block, 'dc:date') || '',
    });
  }
  // <entry>...</entry> blocks (Atom fallback)
  if (items.length === 0) {
    const entryRe = /<entry[\s>][\s\S]*?<\/entry>/gi;
    while ((m = entryRe.exec(xml)) && items.length < 6) {
      const block = m[0];
      items.push({
        src: src,
        title: pick(block, 'title'),
        link: pickAttr(block, 'link', 'href') || pick(block, 'id'),
        author: pick(block, 'name') || '',
        date: pick(block, 'updated') || pick(block, 'published') || '',
      });
    }
  }
  return items.filter(x => x.title && x.link);
}

async function fetchFeed(feed) {
  try {
    // Race the fetch against an 8s timeout so a single slow source can't tank the response.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(feed.url, { headers: HEADERS, signal: ctrl.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!r.ok) return [];
    const xml = await r.text();
    return parseRss(xml, feed.src);
  } catch (e) {
    return [];
  }
}

exports.handler = async () => {
  const now = Date.now();
  if (cache.data && (now - cache.at) < TTL_MS) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT',
      },
      body: JSON.stringify(cache.data),
    };
  }

  const results = await Promise.all(FEEDS.map(fetchFeed));
  const items = results.flat();

  const payload = {
    fetchedAt: new Date().toISOString(),
    sourceCount: FEEDS.length,
    sourcesOk: results.filter(r => r.length > 0).length,
    items: items,
  };

  // Only cache if we got something - don't lock in a failure for 10 min.
  if (items.length > 0) {
    cache = { at: now, data: payload };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
      'X-Cache': 'MISS',
    },
    body: JSON.stringify(payload),
  };
};
