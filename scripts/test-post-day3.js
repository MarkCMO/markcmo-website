// One-off test: publish Day 3's carousel to @officialmarkcmo using the EXACT
// production poster (publishCarousel). Reads creds from MarkChat/.dev.vars.
// Run: node scripts/test-post-day3.js
const fs = require('fs');

function dotenv(p) {
  const o = {};
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const s = l.trim();
    if (s && !s.startsWith('#') && s.includes('=')) {
      const i = s.indexOf('=');
      o[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    }
  }
  return o;
}

(async () => {
  const mc = dotenv('C:\\Users\\13219\\Desktop\\MarkChat\\.dev.vars');
  const c = await import('../functions/_lib/daily-content.mjs');
  const { publishCarousel } = await import('../functions/_lib/ig-poster.mjs');
  const day = c.DAYS[2]; // Day 3
  const base = 'https://markcmo.com';
  const urls = day.slides.map((_, i) =>
    `${base}/daily-assets/day03-slide${String(i + 1).padStart(2, '0')}.jpg`);
  const caption = `${day.caption}\n\n${c.HASHTAGS}`;
  console.log(`Publishing Day ${day.day} - ${day.title} | ${urls.length} slides`);
  try {
    const r = await publishCarousel({ igUserId: mc.IG_USER_ID, token: mc.IG_ACCESS_TOKEN, imageUrls: urls, caption });
    console.log('PUBLISHED OK ->', JSON.stringify(r));
  } catch (e) {
    console.error('PUBLISH FAILED:', e.message);
    process.exit(1);
  }
})();
