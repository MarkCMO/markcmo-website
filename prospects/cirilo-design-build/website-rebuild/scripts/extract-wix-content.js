// extract-wix-content.js
// Pull meaningful content out of scraped Wix HTML pages.
// Outputs one JSON file per page with title, meta, headings, paragraphs,
// image URLs, and internal links. Strips the Wix runtime cruft.

const fs = require('fs');
const path = require('path');

const SCRAPED = path.join(__dirname, '..', '_scraped');
const OUT = path.join(SCRAPED, 'extracted');
fs.mkdirSync(OUT, { recursive: true });

const PAGES = fs.readdirSync(SCRAPED).filter(f => f.endsWith('.html'));

function strip(s) {
  return (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchAll(html, re) {
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function uniq(arr) { return [...new Set(arr)]; }

function extract(html, slug) {
  const title = strip((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  const desc  = strip((html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1]);
  const ogTitle = strip((html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) || [])[1]);
  const ogDesc  = strip((html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i) || [])[1]);

  // Wix renders H1-H6 inside its own wrapper divs. Pull both real header tags and data-attribute "richTextEl" patterns.
  const h1 = uniq(matchAll(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(strip).filter(Boolean));
  const h2 = uniq(matchAll(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi).map(strip).filter(Boolean));
  const h3 = uniq(matchAll(html, /<h3[^>]*>([\s\S]*?)<\/h3>/gi).map(strip).filter(Boolean));
  const h4 = uniq(matchAll(html, /<h4[^>]*>([\s\S]*?)<\/h4>/gi).map(strip).filter(Boolean));
  const h5 = uniq(matchAll(html, /<h5[^>]*>([\s\S]*?)<\/h5>/gi).map(strip).filter(Boolean));
  const h6 = uniq(matchAll(html, /<h6[^>]*>([\s\S]*?)<\/h6>/gi).map(strip).filter(Boolean));

  // Paragraphs and rich text (Wix wraps copy in spans/divs)
  const paragraphs = uniq(matchAll(html, /<p[^>]*>([\s\S]*?)<\/p>/gi).map(strip).filter(t => t && t.length > 8));

  // Image URLs (Wix uses static.wixstatic.com)
  const imgSrcs = uniq(
    matchAll(html, /<img[^>]+src="([^"]+)"/gi)
      .concat(matchAll(html, /<img[^>]+data-src="([^"]+)"/gi))
      .concat(matchAll(html, /background-image:\s*url\(([^)]+)\)/gi).map(u => u.replace(/['"]/g, '')))
      .filter(u => u.includes('wixstatic.com') || u.match(/\.(jpg|jpeg|png|webp|svg|gif)(\?|$)/i))
  );

  // Internal links (paths starting with / or to cirilodb.com)
  const links = uniq(
    matchAll(html, /<a[^>]+href="([^"]+)"/gi)
      .filter(href => href.startsWith('/') || href.includes('cirilodb.com'))
      .filter(href => !href.startsWith('#') && !href.startsWith('javascript:'))
  );

  // Buttons / CTAs (Wix renders these as buttons or styled spans)
  const buttons = uniq(matchAll(html, /<button[^>]*>([\s\S]*?)<\/button>/gi).map(strip).filter(t => t && t.length < 80));

  // Phone numbers + emails
  const phones = uniq(matchAll(html, /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g));
  const emails = uniq(matchAll(html, /([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)
    .filter(e => !e.includes('wix') && !e.includes('sentry') && !e.includes('google')));

  // Body text length signal (how much real content lives on the page)
  const bodyTextRough = strip(html).split(' ').length;

  return {
    slug,
    title,
    metaDescription: desc,
    ogTitle,
    ogDescription: ogDesc,
    headings: { h1, h2, h3, h4, h5, h6 },
    paragraphs,
    buttons,
    images: imgSrcs,
    internalLinks: links,
    phones,
    emails,
    wordCountApprox: bodyTextRough,
    rawHtmlBytes: html.length,
  };
}

const summary = { pages: [] };

for (const file of PAGES) {
  const html = fs.readFileSync(path.join(SCRAPED, file), 'utf8');
  const slug = file.replace(/\.html$/, '');
  const data = extract(html, slug);
  fs.writeFileSync(path.join(OUT, `${slug}.json`), JSON.stringify(data, null, 2));
  summary.pages.push({
    slug,
    title: data.title,
    h1Count: data.headings.h1.length,
    h2Count: data.headings.h2.length,
    paragraphCount: data.paragraphs.length,
    imageCount: data.images.length,
    wordCountApprox: data.wordCountApprox,
  });
  console.log(`${slug.padEnd(40)} h1:${data.headings.h1.length} h2:${data.headings.h2.length} p:${data.paragraphs.length} img:${data.images.length} words:${data.wordCountApprox}`);
}

fs.writeFileSync(path.join(OUT, '_summary.json'), JSON.stringify(summary, null, 2));
console.log(`\nWrote ${PAGES.length} extraction files + _summary.json to ${OUT}`);
