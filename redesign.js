/**
 * redesign.js
 * Completely rebuilds index.html with a modern "Executive Authority" layout.
 * Preserves all <head> SEO/JSON-LD content, replaces everything after <body>.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'index.html');
const html = fs.readFileSync(SRC, 'utf8');

// ── Extract <head> content (preserve all SEO/JSON-LD/meta) ──────────────────
const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
const headContent = headMatch ? headMatch[1] : '';

// ── Extract scripts at end of body (quiz, modal, form, nav) ─────────────────
const scriptMatches = html.match(/<script(?!.*application\/ld\+json)[\s\S]*?<\/script>/gi) || [];
// Keep only inline scripts (not src-only GA/GTM ones that are already in head)
const bodyScripts = scriptMatches
  .filter(s => !s.includes('googletagmanager') && !s.includes('cloudflare-static'))
  .join('\n');

// ── New embedded CSS ─────────────────────────────────────────────────────────
const NEW_CSS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
/* ─── RESET & BASE ─── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; overflow-x: hidden; font-size: 16px; }
body {
  font-family: 'Inter', sans-serif;
  background: #ffffff;
  color: #0a0a0a;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
a { text-decoration: none; color: inherit; }
img { display: block; max-width: 100%; }
ul { list-style: none; }

/* ─── CSS VARS ─── */
:root {
  --blue: #2563EB;
  --blue-dark: #1D4ED8;
  --blue-light: #EFF6FF;
  --ink: #0a0a0a;
  --ink-mid: #374151;
  --ink-muted: #6B7280;
  --ink-faint: #9CA3AF;
  --bg: #ffffff;
  --bg-alt: #F9FAFB;
  --bg-dark: #0a0a0a;
  --border: #E5E7EB;
  --gold: #2563EB;
}

/* ─── NAV ─── */
.site-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  padding: 0 5vw;
  display: flex; align-items: center; justify-content: space-between;
  height: 68px;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
  transition: box-shadow 0.2s;
}
.site-nav.scrolled { box-shadow: 0 2px 20px rgba(0,0,0,0.06); }
.nav-logo {
  display: flex; align-items: center; gap: 10px;
  font-family: 'Syne', sans-serif; font-size: 1.05rem; font-weight: 700;
  color: var(--ink); letter-spacing: -0.02em;
}
.nav-logo-mark {
  width: 34px; height: 34px; border-radius: 8px;
  background: var(--blue); color: #fff;
  font-size: 0.85rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}
.nav-links { display: flex; align-items: center; gap: 2rem; }
.nav-links a {
  font-size: 0.875rem; font-weight: 500; color: var(--ink-mid);
  transition: color 0.15s;
}
.nav-links a:hover { color: var(--blue); }
.nav-links .nav-academy {
  color: var(--blue); font-weight: 600;
}
.nav-cta-btn {
  background: var(--blue); color: #fff !important;
  padding: 0.5rem 1.25rem; border-radius: 8px;
  font-size: 0.875rem; font-weight: 600;
  transition: background 0.15s, transform 0.15s;
}
.nav-cta-btn:hover { background: var(--blue-dark) !important; transform: translateY(-1px); }
.nav-hamburger {
  display: none; flex-direction: column; gap: 5px;
  cursor: pointer; padding: 4px;
}
.nav-hamburger span {
  display: block; width: 22px; height: 2px;
  background: var(--ink); border-radius: 2px; transition: all 0.2s;
}
.mobile-nav-drawer {
  display: none; position: fixed; inset: 0; z-index: 99;
  background: #fff; padding: 90px 6vw 40px;
  flex-direction: column; gap: 1.5rem;
}
.mobile-nav-drawer.open { display: flex; }
.mobile-nav-drawer a {
  font-size: 1.2rem; font-weight: 600; color: var(--ink);
  padding: 0.6rem 0; border-bottom: 1px solid var(--border);
}

/* ─── HERO ─── */
.hero {
  min-height: 100vh;
  padding-top: 68px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  max-width: 1400px;
  margin: 0 auto;
  padding-left: 6vw;
  padding-right: 6vw;
  gap: 4rem;
}
.hero-left { padding: 5rem 0; }
.hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--blue-light); border: 1px solid rgba(37,99,235,0.2);
  color: var(--blue); font-size: 0.75rem; font-weight: 600;
  letter-spacing: 0.08em; text-transform: uppercase;
  padding: 0.4rem 0.9rem; border-radius: 999px;
  margin-bottom: 1.75rem;
}
.hero-badge::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%;
  background: var(--blue); animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.hero-h1 {
  font-family: 'Syne', sans-serif;
  font-size: clamp(3rem, 5.5vw, 5.5rem);
  font-weight: 800; line-height: 1.03;
  letter-spacing: -0.03em; color: var(--ink);
  margin-bottom: 1.5rem;
}
.hero-h1 .accent { color: var(--blue); }
.hero-sub {
  font-size: 1.0625rem; line-height: 1.75; color: var(--ink-mid);
  max-width: 460px; margin-bottom: 2.25rem;
}
.hero-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 2.5rem; }
.btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--blue); color: #fff;
  font-size: 0.9375rem; font-weight: 600;
  padding: 0.8125rem 1.75rem; border-radius: 10px;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 4px 14px rgba(37,99,235,0.3);
}
.btn-primary:hover {
  background: var(--blue-dark); transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(37,99,235,0.38);
}
.btn-outline {
  display: inline-flex; align-items: center; gap: 8px;
  border: 1.5px solid var(--border); color: var(--ink-mid);
  font-size: 0.9375rem; font-weight: 500;
  padding: 0.8125rem 1.75rem; border-radius: 10px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.btn-outline:hover {
  border-color: var(--blue); color: var(--blue);
  background: var(--blue-light);
}
.hero-trust {
  display: flex; flex-wrap: wrap; gap: 1rem 1.75rem;
  align-items: center;
}
.hero-trust-item {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.8125rem; color: var(--ink-muted); font-weight: 500;
}
.hero-trust-item::before {
  content: '✓'; font-size: 0.7rem; font-weight: 700;
  color: var(--blue); background: var(--blue-light);
  width: 18px; height: 18px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
/* Hero right side */
.hero-right {
  position: relative; padding: 5rem 0;
  display: flex; flex-direction: column; gap: 1rem;
}
.hero-photo-wrap {
  position: relative; border-radius: 20px; overflow: hidden;
  background: #E8F0FF; aspect-ratio: 4/5; max-height: 520px;
}
.hero-photo-wrap img {
  width: 100%; height: 100%; object-fit: cover; object-position: center 10%;
}
/* Floating stat cards */
.hero-float-card {
  position: absolute;
  background: #fff; border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  padding: 0.875rem 1.1rem;
  display: flex; align-items: center; gap: 10px;
}
.hero-float-card.card-tl {
  top: 1.5rem; left: -2rem;
}
.hero-float-card.card-br {
  bottom: 2rem; right: -2rem;
}
.hero-float-card.card-bm {
  bottom: -1.5rem; left: 50%; transform: translateX(-50%);
}
.hfc-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: var(--blue-light); color: var(--blue);
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; flex-shrink: 0;
}
.hfc-num {
  font-family: 'Syne', sans-serif; font-size: 1.3rem;
  font-weight: 800; color: var(--ink); line-height: 1;
}
.hfc-label { font-size: 0.7rem; color: var(--ink-muted); font-weight: 500; }

/* ─── MARQUEE ─── */
.marquee-wrap {
  background: var(--bg-dark); padding: 0.9rem 0;
  overflow: hidden; white-space: nowrap;
  border-top: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-top: 2rem;
}
.marquee-track {
  display: inline-flex; gap: 2.5rem;
  animation: marquee 28s linear infinite;
}
.marquee-item {
  font-size: 0.75rem; font-weight: 600;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: rgba(255,255,255,0.45);
}
.marquee-dot { color: var(--blue); }
@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

/* ─── STATS BAR ─── */
.stats-bar {
  background: var(--bg-alt);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.stats-bar-inner {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(4, 1fr);
  padding: 0 6vw;
}
.stat-item {
  padding: 2.5rem 2rem;
  border-right: 1px solid var(--border);
  text-align: center;
}
.stat-item:last-child { border-right: none; }
.stat-num {
  font-family: 'Syne', sans-serif; font-size: 2.75rem;
  font-weight: 800; color: var(--blue); line-height: 1;
  margin-bottom: 0.4rem; letter-spacing: -0.02em;
}
.stat-label {
  font-size: 0.8125rem; color: var(--ink-muted); font-weight: 500;
}

/* ─── SECTIONS COMMON ─── */
section { padding: 6rem 6vw; }
.section-kicker {
  font-size: 0.75rem; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--blue); margin-bottom: 0.75rem;
  display: flex; align-items: center; gap: 8px;
}
.section-kicker::after {
  content: ''; display: block; width: 24px; height: 2px;
  background: var(--blue); border-radius: 2px;
}
.section-title {
  font-family: 'Syne', sans-serif;
  font-size: clamp(2rem, 3.5vw, 3rem);
  font-weight: 800; line-height: 1.1;
  letter-spacing: -0.025em; color: var(--ink);
  margin-bottom: 1rem;
}
.section-title .accent { color: var(--blue); }
.section-body {
  font-size: 1.0625rem; line-height: 1.75; color: var(--ink-mid);
  max-width: 600px;
}

/* ─── SERVICES (BENTO GRID) ─── */
#services { background: var(--bg); }
.services-intro {
  max-width: 1200px; margin: 0 auto 3rem;
  display: flex; justify-content: space-between; align-items: flex-end;
  flex-wrap: wrap; gap: 1.5rem;
}
.services-grid {
  max-width: 1200px; margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 1.25rem;
}
.svc-card {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 2.25rem;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  position: relative; overflow: hidden;
}
.svc-card:hover {
  border-color: rgba(37,99,235,0.3);
  box-shadow: 0 12px 40px rgba(37,99,235,0.1);
  transform: translateY(-4px);
}
.svc-card.featured {
  grid-column: span 2;
  background: var(--bg-dark); color: #fff;
  border-color: transparent;
}
.svc-card.featured::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(37,99,235,0.15) 0%, transparent 60%);
  pointer-events: none;
}
.svc-num {
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.15em;
  text-transform: uppercase; color: var(--ink-faint);
  margin-bottom: 1.25rem;
}
.svc-card.featured .svc-num { color: rgba(255,255,255,0.35); }
.svc-icon {
  width: 48px; height: 48px; border-radius: 12px;
  background: var(--blue-light); color: var(--blue);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem; margin-bottom: 1.25rem;
}
.svc-card.featured .svc-icon {
  background: rgba(37,99,235,0.2); color: #60A5FA;
}
.svc-title {
  font-family: 'Syne', sans-serif; font-size: 1.5rem;
  font-weight: 800; color: var(--ink); margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
}
.svc-card.featured .svc-title { color: #fff; }
.svc-desc {
  font-size: 0.9375rem; line-height: 1.65; color: var(--ink-mid);
  margin-bottom: 1.5rem;
}
.svc-card.featured .svc-desc { color: rgba(255,255,255,0.65); }
.svc-features {
  display: flex; flex-direction: column; gap: 0.5rem;
}
.svc-feature {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.875rem; color: var(--ink-mid);
}
.svc-card.featured .svc-feature { color: rgba(255,255,255,0.7); }
.svc-feature::before {
  content: '→'; color: var(--blue); font-size: 0.7rem;
  font-weight: 700; flex-shrink: 0;
}
.svc-card.featured .svc-feature::before { color: #60A5FA; }
.svc-link {
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 1.75rem; font-size: 0.875rem; font-weight: 600;
  color: var(--blue); transition: gap 0.15s;
}
.svc-card.featured .svc-link { color: #60A5FA; }
.svc-link:hover { gap: 10px; }

/* ─── ABOUT ─── */
#about { background: var(--bg-alt); }
.about-grid {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 5rem; align-items: center;
}
.about-photo-wrap {
  position: relative; border-radius: 20px; overflow: hidden;
  aspect-ratio: 3/4; max-height: 580px;
}
.about-photo-wrap img {
  width: 100%; height: 100%; object-fit: cover; object-position: center 5%;
}
.about-photo-tag {
  position: absolute; bottom: 1.5rem; left: 1.5rem; right: 1.5rem;
  background: rgba(255,255,255,0.95); backdrop-filter: blur(8px);
  border-radius: 12px; padding: 1rem 1.25rem;
  display: flex; justify-content: space-between; align-items: center;
}
.apt-name { font-family: 'Syne', sans-serif; font-size: 1rem; font-weight: 800; }
.apt-title { font-size: 0.75rem; color: var(--ink-muted); margin-top: 2px; }
.apt-badge {
  background: var(--blue); color: #fff;
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em;
  text-transform: uppercase; padding: 4px 10px; border-radius: 999px;
}
.about-content { display: flex; flex-direction: column; gap: 1.75rem; }
.about-cards { display: flex; flex-direction: column; gap: 1rem; }
.about-card {
  background: #fff; border: 1px solid var(--border);
  border-left: 3px solid var(--blue); border-radius: 0 12px 12px 0;
  padding: 1.25rem 1.5rem;
  transition: transform 0.2s, box-shadow 0.2s;
}
.about-card:hover { transform: translateX(4px); box-shadow: 0 4px 20px rgba(37,99,235,0.07); }
.about-card-title {
  font-weight: 700; font-size: 0.9375rem; color: var(--ink);
  margin-bottom: 0.35rem;
}
.about-card-body { font-size: 0.875rem; line-height: 1.65; color: var(--ink-muted); }
.skills-wrap { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.skill-pill {
  font-size: 0.75rem; font-weight: 600; color: var(--blue);
  background: var(--blue-light); border: 1px solid rgba(37,99,235,0.15);
  padding: 0.3rem 0.85rem; border-radius: 999px;
}

/* ─── TESTIMONIALS ─── */
#testimonials { background: var(--bg-dark); }
.testimonials-header {
  max-width: 1200px; margin: 0 auto 3.5rem;
  display: flex; justify-content: space-between; align-items: flex-end;
  flex-wrap: wrap; gap: 1rem;
}
.testimonials-header .section-kicker { color: #60A5FA; }
.testimonials-header .section-kicker::after { background: #60A5FA; }
.testimonials-header .section-title { color: #fff; }
.testi-grid {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}
.testi-card {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px; padding: 2rem;
  transition: background 0.2s;
}
.testi-card:hover { background: rgba(255,255,255,0.08); }
.testi-quote {
  font-size: 3rem; line-height: 1; color: var(--blue);
  margin-bottom: 1rem; font-family: Georgia, serif;
}
.testi-text {
  font-size: 0.9375rem; line-height: 1.75;
  color: rgba(255,255,255,0.75); margin-bottom: 1.5rem;
}
.testi-author { display: flex; align-items: center; gap: 12px; }
.testi-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: var(--blue); color: #fff;
  font-size: 0.9rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.testi-name { font-weight: 700; font-size: 0.9rem; color: #fff; }
.testi-role { font-size: 0.775rem; color: rgba(255,255,255,0.45); }

/* ─── PROOF INDUSTRIES ─── */
#proof { background: var(--bg); }
.proof-container { max-width: 1200px; margin: 0 auto; }
.proof-header {
  display: flex; justify-content: space-between; align-items: flex-end;
  margin-bottom: 3rem; flex-wrap: wrap; gap: 1rem;
}
.ind-grid {
  display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 2.5rem;
}
.ind-chip {
  font-size: 0.8125rem; font-weight: 600; color: var(--ink-mid);
  background: var(--bg-alt); border: 1px solid var(--border);
  padding: 0.45rem 1rem; border-radius: 999px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.ind-chip:hover {
  border-color: var(--blue); color: var(--blue);
  background: var(--blue-light);
}

/* ─── SCORECARD ─── */
#scorecard { background: var(--bg-alt); }
.scorecard-wrap { max-width: 760px; margin: 0 auto; }
.scorecard-intro { text-align: center; margin-bottom: 2.5rem; }
.quiz-box {
  background: #fff; border: 1px solid var(--border);
  border-radius: 20px; overflow: hidden;
  box-shadow: 0 8px 40px rgba(0,0,0,0.06);
}
.quiz-header {
  background: var(--bg-dark); padding: 1.75rem 2rem;
  display: flex; justify-content: space-between; align-items: center;
}
.quiz-header-title {
  font-family: 'Syne', sans-serif; font-size: 1.1rem;
  font-weight: 800; color: #fff;
}
.quiz-header-sub { font-size: 0.8rem; color: rgba(255,255,255,0.5); margin-top: 2px; }
.quiz-dots {
  display: flex; gap: 6px;
}
.quiz-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(255,255,255,0.2); transition: background 0.2s;
}
.quiz-dot.filled { background: var(--blue); }
.quiz-body { padding: 2.25rem 2rem; }
.quiz-step { display: none; }
.quiz-step.active { display: block; }
.quiz-question {
  font-family: 'Syne', sans-serif; font-size: 1.15rem;
  font-weight: 700; color: var(--ink); margin-bottom: 1.5rem;
  letter-spacing: -0.01em; line-height: 1.4;
}
.quiz-options { display: flex; flex-direction: column; gap: 0.625rem; }
.quiz-opt {
  text-align: left; padding: 0.875rem 1.25rem;
  border: 1.5px solid var(--border); border-radius: 10px;
  background: var(--bg-alt); color: var(--ink-mid);
  font-size: 0.9375rem; font-family: 'Inter', sans-serif;
  cursor: pointer; transition: all 0.15s;
}
.quiz-opt:hover { border-color: var(--blue); color: var(--blue); background: var(--blue-light); }
.quiz-opt.selected { border-color: var(--blue); background: var(--blue); color: #fff; }
.quiz-footer { padding: 0 2rem 1.75rem; display: flex; justify-content: flex-end; }
.quiz-step-label { font-size: 0.8rem; color: var(--ink-faint); }
.quiz-result { display: none; padding: 2.25rem 2rem; text-align: center; }
.quiz-result.show { display: block; }
.quiz-score-ring {
  width: 90px; height: 90px; border-radius: 50%;
  background: conic-gradient(var(--blue) 0deg, #E5E7EB 0deg);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 1.5rem;
  font-family: 'Syne', sans-serif; font-size: 1.3rem; font-weight: 800; color: var(--ink);
}
.quiz-result-title { font-family: 'Syne', sans-serif; font-size: 1.35rem; font-weight: 800; margin-bottom: 0.75rem; }
.quiz-result-desc { font-size: 0.9375rem; line-height: 1.7; color: var(--ink-mid); margin-bottom: 1.75rem; max-width: 500px; margin-left: auto; margin-right: auto; }
.quiz-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem; }
.quiz-input {
  width: 100%; padding: 0.75rem 1rem; border: 1.5px solid var(--border);
  border-radius: 8px; font-size: 0.9375rem; font-family: 'Inter', sans-serif;
  color: var(--ink); outline: none; transition: border-color 0.15s;
}
.quiz-input:focus { border-color: var(--blue); }
.quiz-submit {
  width: 100%; padding: 0.9rem; background: var(--blue); color: #fff;
  font-size: 0.9375rem; font-weight: 600; border: none; border-radius: 8px;
  cursor: pointer; font-family: 'Inter', sans-serif;
  transition: background 0.15s; margin-top: 0.75rem;
}
.quiz-submit:hover { background: var(--blue-dark); }
.quiz-privacy { font-size: 0.75rem; color: var(--ink-faint); margin-top: 0.75rem; }

/* ─── BOOK / CTA ─── */
#book { background: var(--blue); padding: 6rem 6vw; }
.book-inner {
  max-width: 1100px; margin: 0 auto;
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 4rem; align-items: center;
}
.book-left .section-kicker { color: rgba(255,255,255,0.7); }
.book-left .section-kicker::after { background: rgba(255,255,255,0.5); }
.book-left .section-title { color: #fff; }
.book-left .section-body { color: rgba(255,255,255,0.7); max-width: 400px; }
.book-perks { margin-top: 1.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
.book-perk {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.9375rem; color: rgba(255,255,255,0.85);
}
.book-perk-dot {
  width: 20px; height: 20px; border-radius: 50%;
  background: rgba(255,255,255,0.15); color: #fff;
  font-size: 0.65rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.book-right {
  background: #fff; border-radius: 20px;
  padding: 2.5rem;
}
.book-right-head {
  font-family: 'Syne', sans-serif; font-size: 1.25rem; font-weight: 800;
  color: var(--ink); margin-bottom: 0.5rem;
}
.book-right-sub { font-size: 0.875rem; color: var(--ink-muted); margin-bottom: 1.75rem; }
.book-btn {
  display: block; width: 100%;
  background: var(--blue); color: #fff;
  text-align: center; padding: 1rem;
  border-radius: 10px; font-size: 1rem; font-weight: 600;
  transition: background 0.15s; margin-bottom: 1rem;
}
.book-btn:hover { background: var(--blue-dark); }
.book-note { font-size: 0.8rem; color: var(--ink-faint); text-align: center; }
.book-calendly-wrap {
  margin-top: 1.5rem; border-radius: 12px; overflow: hidden;
  border: 1px solid var(--border);
}

/* ─── BLOG ─── */
#blog { background: var(--bg); }
.blog-header {
  max-width: 1200px; margin: 0 auto 2.5rem;
  display: flex; justify-content: space-between; align-items: flex-end;
  flex-wrap: wrap; gap: 1rem;
}
.blog-all-link {
  font-size: 0.875rem; font-weight: 600; color: var(--blue);
  display: flex; align-items: center; gap: 6px;
  transition: gap 0.15s;
}
.blog-all-link:hover { gap: 10px; }
.blog-grid {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}
.blog-card {
  background: var(--bg-alt); border: 1px solid var(--border);
  border-radius: 16px; overflow: hidden; cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}
.blog-card:hover {
  border-color: rgba(37,99,235,0.25);
  box-shadow: 0 12px 40px rgba(37,99,235,0.08);
  transform: translateY(-4px);
}
.blog-card-top {
  height: 130px; background: var(--blue-light);
  display: flex; align-items: center; justify-content: center;
  font-size: 3rem;
}
.blog-card-body { padding: 1.5rem; }
.blog-tag {
  display: inline-block; font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--blue); background: var(--blue-light);
  border: 1px solid rgba(37,99,235,0.15);
  padding: 0.2rem 0.6rem; border-radius: 999px; margin-bottom: 0.75rem;
}
.blog-title {
  font-family: 'Syne', sans-serif; font-size: 1rem;
  font-weight: 800; color: var(--ink); margin-bottom: 0.65rem;
  line-height: 1.35; letter-spacing: -0.01em;
}
.blog-excerpt {
  font-size: 0.8375rem; line-height: 1.65; color: var(--ink-muted);
  margin-bottom: 1rem;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.blog-meta { font-size: 0.75rem; color: var(--ink-faint); }

/* ─── FOOTER ─── */
footer {
  background: var(--bg-dark);
  border-top: 1px solid rgba(255,255,255,0.06);
}
.footer-mega {
  max-width: 1400px; margin: 0 auto;
  padding: 4rem 6vw 3rem;
  display: grid;
  grid-template-columns: 2fr repeat(7, 1fr);
  gap: 2rem;
}
.footer-brand-logo {
  font-family: 'Syne', sans-serif; font-size: 1.1rem;
  font-weight: 800; color: #fff; margin-bottom: 0.75rem;
}
.footer-brand-logo span { color: var(--blue); }
.footer-desc {
  font-size: 0.825rem; line-height: 1.7;
  color: rgba(255,255,255,0.45); margin-bottom: 1.25rem;
}
.footer-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem; }
.footer-tag {
  font-size: 0.65rem; font-weight: 600; letter-spacing: 0.06em;
  text-transform: uppercase; color: rgba(255,255,255,0.4);
  border: 1px solid rgba(255,255,255,0.12);
  padding: 0.25rem 0.6rem; border-radius: 4px;
}
.footer-socials { display: flex; gap: 0.6rem; }
.footer-social {
  width: 32px; height: 32px; border-radius: 8px;
  background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.6);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8rem; font-weight: 700;
  transition: background 0.15s, color 0.15s;
}
.footer-social:hover { background: var(--blue); color: #fff; }
.footer-col h4 {
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: rgba(255,255,255,0.6);
  margin-bottom: 1rem;
}
.footer-col ul { display: flex; flex-direction: column; gap: 0.55rem; }
.footer-col ul li a {
  font-size: 0.8125rem; color: rgba(255,255,255,0.4);
  transition: color 0.15s;
}
.footer-col ul li a:hover { color: rgba(255,255,255,0.85); }
.footer-bottom {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 1.5rem 6vw; max-width: 1400px; margin: 0 auto;
}
.footer-bottom-row {
  display: flex; justify-content: space-between;
  align-items: center; flex-wrap: wrap; gap: 0.5rem;
}
.footer-copy { font-size: 0.8rem; color: rgba(255,255,255,0.3); }
.footer-bottom-links {
  display: flex; gap: 1.25rem;
}
.footer-bottom-links a { font-size: 0.8rem; color: rgba(255,255,255,0.3); transition: color 0.15s; }
.footer-bottom-links a:hover { color: rgba(255,255,255,0.7); }
.footer-latest {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 1rem 6vw; max-width: 1400px; margin: 0 auto;
  display: flex; gap: 2rem; flex-wrap: wrap; align-items: center;
}
.footer-latest-label {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.15em;
  text-transform: uppercase; color: var(--blue); flex-shrink: 0;
}
.footer-latest-links { display: flex; flex-wrap: wrap; gap: 1rem; }
.footer-latest-links a { font-size: 0.8rem; color: rgba(255,255,255,0.35); transition: color 0.15s; }
.footer-latest-links a:hover { color: rgba(255,255,255,0.7); }
.footer-latest-links .primary-link { color: var(--blue); font-weight: 600; }

/* ─── MODALS ─── */
.modal-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
  display: none; align-items: center; justify-content: center;
  padding: 2rem;
}
.modal-overlay.open { display: flex; }
.modal-box {
  background: #fff; border-radius: 20px; padding: 2.5rem;
  max-width: 680px; width: 100%; max-height: 85vh;
  overflow-y: auto; position: relative;
}
.modal-close {
  position: absolute; top: 1.25rem; right: 1.25rem;
  background: var(--bg-alt); border: none; cursor: pointer;
  width: 32px; height: 32px; border-radius: 50%; font-size: 0.9rem;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.modal-close:hover { background: var(--border); }
.modal-tag { font-size: 0.75rem; color: var(--blue); font-weight: 600; margin-bottom: 0.75rem; }
.modal-title { font-family: 'Syne', sans-serif; font-size: 1.4rem; font-weight: 800; color: var(--ink); margin-bottom: 1.5rem; line-height: 1.25; }
.modal-content p { font-size: 0.9375rem; line-height: 1.75; color: var(--ink-mid); margin-bottom: 1rem; }
.modal-content h3 { font-family: 'Syne', sans-serif; font-size: 1.05rem; font-weight: 800; color: var(--ink); margin: 1.5rem 0 0.5rem; }

/* ─── REVEAL ANIMATION ─── */
.reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.55s ease, transform 0.55s ease; }
.reveal.visible { opacity: 1; transform: translateY(0); }

/* ─── RESPONSIVE ─── */
@media (max-width: 1100px) {
  .hero { grid-template-columns: 1fr 1fr; gap: 2.5rem; }
  .footer-mega { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .footer-brand-col { grid-column: span 4; }
}
@media (max-width: 900px) {
  .hero { grid-template-columns: 1fr; text-align: center; }
  .hero-left { padding: 4rem 0 1rem; }
  .hero-sub { margin-left: auto; margin-right: auto; }
  .hero-actions { justify-content: center; }
  .hero-trust { justify-content: center; }
  .hero-right { padding: 0 0 4rem; }
  .hero-float-card.card-tl { top: 1rem; left: 0.5rem; }
  .hero-float-card.card-br { bottom: 1rem; right: 0.5rem; }
  .services-grid { grid-template-columns: 1fr; }
  .svc-card.featured { grid-column: span 1; }
  .about-grid { grid-template-columns: 1fr; }
  .about-photo-wrap { max-height: 360px; }
  .testi-grid { grid-template-columns: 1fr; }
  .stats-bar-inner { grid-template-columns: 1fr 1fr; }
  .stat-item:nth-child(2) { border-right: none; }
  .blog-grid { grid-template-columns: 1fr; }
  .book-inner { grid-template-columns: 1fr; }
  .nav-links { display: none; }
  .nav-hamburger { display: flex; }
  .footer-mega { grid-template-columns: 1fr 1fr; }
  .footer-brand-col { grid-column: span 2; }
  .quiz-inputs { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  section { padding: 4rem 5vw; }
  .hero-h1 { font-size: 2.6rem; }
  .stats-bar-inner { grid-template-columns: 1fr 1fr; }
  .footer-mega { grid-template-columns: 1fr 1fr; padding: 3rem 5vw 2rem; }
}
</style>`;

// ── New HTML body ────────────────────────────────────────────────────────────
const NEW_BODY = `
<body>

<!-- NAV -->
<nav class="site-nav" id="siteNav">
  <a href="index.html" class="nav-logo">
    <div class="nav-logo-mark">M</div>
    Mark Gabrielli
  </a>
  <ul class="nav-links">
    <li><a href="about.html">About</a></li>
    <li><a href="services.html">Services</a></li>
    <li><a href="portfolio.html">Portfolio</a></li>
    <li><a href="results.html">Results</a></li>
    <li><a href="blog.html">Insights</a></li>
    <li><a href="https://academy.markcmo.com" target="_blank" class="nav-academy">🎓 Academy</a></li>
    <li><a href="book.html" class="nav-cta-btn">Book a Free Call</a></li>
  </ul>
  <div class="nav-hamburger" id="navHamburger">
    <span></span><span></span><span></span>
  </div>
</nav>

<div class="mobile-nav-drawer" id="mobileDrawer">
  <a href="about.html">About</a>
  <a href="services.html">Services</a>
  <a href="portfolio.html">Portfolio</a>
  <a href="results.html">Results</a>
  <a href="blog.html">Insights</a>
  <a href="https://academy.markcmo.com" target="_blank">🎓 Academy</a>
  <a href="book.html" style="color:#2563EB;font-weight:700;">Book a Free Strategy Call →</a>
</div>

<!-- HERO -->
<section class="hero" id="hero">
  <div class="hero-left reveal">
    <div class="hero-badge">Fractional C-Suite Executive</div>
    <h1 class="hero-h1">
      I find what's<br>
      <span class="accent">breaking</span><br>
      your business.
    </h1>
    <p class="hero-sub">
      15+ years. Three continents. Healthcare, aerospace, SaaS, automotive, logistics. I've built companies from zero and scaled global teams of 50+. I find what's broken, fix what matters, and build what lasts - without the full-time cost.
    </p>
    <div class="hero-actions">
      <a href="book.html" class="btn-primary">Book a Free Strategy Call →</a>
      <a href="#scorecard" class="btn-outline">Take the Business Scorecard</a>
    </div>
    <div class="hero-trust">
      <div class="hero-trust-item">Fractional CMO &amp; COO</div>
      <div class="hero-trust-item">Healthcare &amp; Aerospace</div>
      <div class="hero-trust-item">Global · NA · EMEA · APAC</div>
      <div class="hero-trust-item">4.0 Biological Sciences · CST Certified</div>
    </div>
  </div>
  <div class="hero-right reveal" style="transition-delay:0.15s;">
    <div class="hero-photo-wrap">
      <img src="og-image.jpg" alt="Mark Gabrielli - Fractional CMO & COO" loading="eager" onerror="this.style.background='#E8F0FF';this.style.minHeight='480px'" />
      <div class="hero-float-card card-tl">
        <div class="hfc-icon">📈</div>
        <div>
          <div class="hfc-num">400%</div>
          <div class="hfc-label">ROAS Delivered</div>
        </div>
      </div>
      <div class="hero-float-card card-br">
        <div class="hfc-icon">🏆</div>
        <div>
          <div class="hfc-num">15+</div>
          <div class="hfc-label">Years Experience</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- MARQUEE -->
<div class="marquee-wrap">
  <div class="marquee-track">
    <span class="marquee-item">SaaS</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Healthcare</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Aerospace</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Fintech</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">eCommerce</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Logistics</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">AI Companies</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Manufacturing</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Professional Services</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Automotive</span><span class="marquee-dot">✦</span>
    <!-- duplicate for seamless loop -->
    <span class="marquee-item">SaaS</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Healthcare</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Aerospace</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Fintech</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">eCommerce</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Logistics</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">AI Companies</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Manufacturing</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Professional Services</span><span class="marquee-dot">✦</span>
    <span class="marquee-item">Automotive</span><span class="marquee-dot">✦</span>
  </div>
</div>

<!-- STATS BAR -->
<div class="stats-bar">
  <div class="stats-bar-inner">
    <div class="stat-item reveal">
      <div class="stat-num">$3M+</div>
      <div class="stat-label">Qualified Leads Generated</div>
    </div>
    <div class="stat-item reveal" style="transition-delay:0.1s;">
      <div class="stat-num">400%</div>
      <div class="stat-label">ROAS for D2C Startup</div>
    </div>
    <div class="stat-item reveal" style="transition-delay:0.2s;">
      <div class="stat-num">15+</div>
      <div class="stat-label">Years of Experience</div>
    </div>
    <div class="stat-item reveal" style="transition-delay:0.3s;">
      <div class="stat-num">10+</div>
      <div class="stat-label">Industries Served</div>
    </div>
  </div>
</div>

<!-- SERVICES -->
<section id="services">
  <div class="services-intro">
    <div>
      <div class="section-kicker">What I Do</div>
      <h2 class="section-title">C-suite expertise.<br><span class="accent">Fraction of the cost.</span></h2>
    </div>
    <a href="services.html" class="btn-outline">View All Services →</a>
  </div>
  <div class="services-grid">

    <div class="svc-card featured reveal">
      <div class="svc-num">01</div>
      <div class="svc-icon">📈</div>
      <h3 class="svc-title">Fractional CMO</h3>
      <p class="svc-desc">Full-stack marketing leadership embedded in your organization. From positioning to pipeline, I own your growth engine and tie every dollar to measurable revenue outcomes.</p>
      <div class="svc-features">
        <div class="svc-feature">Go-to-market strategy &amp; execution</div>
        <div class="svc-feature">Brand positioning &amp; messaging</div>
        <div class="svc-feature">Paid media &amp; funnel architecture</div>
        <div class="svc-feature">AI-powered campaign systems</div>
        <div class="svc-feature">KPI dashboards &amp; revenue ops</div>
        <div class="svc-feature">Team building &amp; leadership</div>
      </div>
      <a href="fractional-cmo.html" class="svc-link">Learn more →</a>
    </div>

    <div class="svc-card reveal" style="transition-delay:0.1s;">
      <div class="svc-num">02</div>
      <div class="svc-icon">⚙️</div>
      <h3 class="svc-title">Fractional COO</h3>
      <p class="svc-desc">Operational excellence delivered. I audit, redesign, and implement the processes that make your business run at peak performance.</p>
      <div class="svc-features">
        <div class="svc-feature">Operational audit &amp; rewire</div>
        <div class="svc-feature">Workflow automation</div>
        <div class="svc-feature">Systems &amp; tech stack optimization</div>
        <div class="svc-feature">Hiring &amp; team structure</div>
        <div class="svc-feature">OKR &amp; performance frameworks</div>
      </div>
      <a href="fractional-coo.html" class="svc-link">Learn more →</a>
    </div>

    <div class="svc-card reveal" style="transition-delay:0.2s;">
      <div class="svc-num">03</div>
      <div class="svc-icon">🏆</div>
      <h3 class="svc-title">Executive Advisory</h3>
      <p class="svc-desc">Whatever C-suite role your business needs most right now, I step in, align with your vision, and deliver senior leadership on demand.</p>
      <div class="svc-features">
        <div class="svc-feature">Business transformation strategy</div>
        <div class="svc-feature">Investor prep &amp; growth playbooks</div>
        <div class="svc-feature">Executive coaching &amp; mentoring</div>
        <div class="svc-feature">M&amp;A readiness &amp; positioning</div>
        <div class="svc-feature">Crisis management &amp; turnaround</div>
      </div>
      <a href="executive-advisory.html" class="svc-link">Learn more →</a>
    </div>

  </div>
</section>

<!-- ABOUT -->
<section id="about">
  <div class="about-grid">
    <div class="about-photo-wrap reveal">
      <img src="og-image.jpg" alt="Mark Gabrielli" loading="lazy" onerror="this.parentElement.style.background='#E8F0FF'" />
      <div class="about-photo-tag">
        <div>
          <div class="apt-name">Mark Gabrielli</div>
          <div class="apt-title">Fractional CMO &amp; COO · WETYR Corp</div>
        </div>
        <div class="apt-badge">Available Now</div>
      </div>
    </div>
    <div class="about-content reveal" style="transition-delay:0.15s;">
      <div>
        <div class="section-kicker">About Mark</div>
        <h2 class="section-title">Visionary by nature.<br><span class="accent">Operator by choice.</span></h2>
        <p class="section-body">
          I'm Mark Gabrielli - a business strategist operating at the intersection of human psychology and operational excellence. I don't just advise from the sidelines; I embed myself in your organization, identify what's truly broken, and build the systems that fix it for good.
        </p>
      </div>
      <div class="about-cards">
        <div class="about-card">
          <div class="about-card-title">🎯 The Diagnostic Advantage</div>
          <div class="about-card-body">Most consultants recommend. I diagnose. Within the first engagement, I identify the hidden constraints - organizational, operational, or psychological - that are capping your growth.</div>
        </div>
        <div class="about-card">
          <div class="about-card-title">⚡ Speed to Results</div>
          <div class="about-card-body">You don't have months to wait for ROI. I build systems that show measurable impact fast - from automating workflows to rebuilding go-to-market strategy from the ground up.</div>
        </div>
        <div class="about-card">
          <div class="about-card-title">🧠 Psychology Meets Business</div>
          <div class="about-card-body">My edge is understanding why people - your customers, your team, your market - do what they do. That insight drives every strategy I build and every decision I guide.</div>
        </div>
      </div>
      <div class="skills-wrap">
        <span class="skill-pill">Negotiation</span>
        <span class="skill-pill">Brand Strategy</span>
        <span class="skill-pill">Growth Marketing</span>
        <span class="skill-pill">SaaS Development</span>
        <span class="skill-pill">Team Building</span>
        <span class="skill-pill">Executive Coaching</span>
        <span class="skill-pill">Content Strategy</span>
        <span class="skill-pill">Human Psychology</span>
        <span class="skill-pill">Revenue Operations</span>
        <span class="skill-pill">Management Consulting</span>
      </div>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section id="testimonials">
  <div class="testimonials-header">
    <div>
      <div class="section-kicker">Social Proof</div>
      <h2 class="section-title" style="color:#fff;">What clients <span class="accent">say.</span></h2>
    </div>
    <a href="testimonials.html" style="font-size:0.875rem;font-weight:600;color:rgba(255,255,255,0.5);display:flex;align-items:center;gap:6px;">All testimonials →</a>
  </div>
  <div class="testi-grid">
    <div class="testi-card reveal">
      <div class="testi-quote">"</div>
      <p class="testi-text">Mark diagnosed our marketing problem in the first call. Within 90 days, we had a complete system rebuild - new funnel, new positioning, and leads we could actually close. He sees things others simply miss.</p>
      <div class="testi-author">
        <div class="testi-avatar">R</div>
        <div>
          <div class="testi-name">Robert T.</div>
          <div class="testi-role">CEO, SaaS Platform</div>
        </div>
      </div>
    </div>
    <div class="testi-card reveal" style="transition-delay:0.1s;">
      <div class="testi-quote">"</div>
      <p class="testi-text">We hired Mark as a fractional COO and he rewired how we operate entirely. Automation replaced hours of manual work. Our team finally has clarity and our numbers prove it. Wish we'd done this sooner.</p>
      <div class="testi-author">
        <div class="testi-avatar">J</div>
        <div>
          <div class="testi-name">Jennifer M.</div>
          <div class="testi-role">Founder, eCommerce Brand</div>
        </div>
      </div>
    </div>
    <div class="testi-card reveal" style="transition-delay:0.2s;">
      <div class="testi-quote">"</div>
      <p class="testi-text">Mark's understanding of human psychology and business strategy is unlike anyone I've worked with. He doesn't just help you grow - he helps you understand why your business was stuck in the first place.</p>
      <div class="testi-author">
        <div class="testi-avatar">D</div>
        <div>
          <div class="testi-name">David K.</div>
          <div class="testi-role">Managing Partner, Fintech Firm</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- INDUSTRIES -->
<section id="proof">
  <div class="proof-container">
    <div class="proof-header reveal">
      <div>
        <div class="section-kicker">Industries</div>
        <h2 class="section-title">10+ industries.<br><span class="accent">One standard.</span></h2>
      </div>
      <p class="section-body" style="max-width:360px;">From healthcare operating rooms to SaaS boardrooms - I bring the same diagnostic approach to every sector.</p>
    </div>
    <div class="ind-grid reveal" style="transition-delay:0.1s;">
      <span class="ind-chip">SaaS</span>
      <span class="ind-chip">eCommerce</span>
      <span class="ind-chip">Fintech</span>
      <span class="ind-chip">Health Tech</span>
      <span class="ind-chip">Logistics</span>
      <span class="ind-chip">Aerospace</span>
      <span class="ind-chip">Mobile Apps</span>
      <span class="ind-chip">Consumer Brands</span>
      <span class="ind-chip">AI Companies</span>
      <span class="ind-chip">Professional Services</span>
      <span class="ind-chip">Startups</span>
      <span class="ind-chip">Manufacturing</span>
      <span class="ind-chip">Automotive</span>
      <span class="ind-chip">Growth-Stage Companies</span>
    </div>
  </div>
</section>

<!-- SCORECARD -->
<section id="scorecard">
  <div class="scorecard-wrap">
    <div class="scorecard-intro reveal">
      <div class="section-kicker" style="justify-content:center;">Free Tool</div>
      <h2 class="section-title" style="text-align:center;">Is your business leaving<br><span class="accent">money on the table?</span></h2>
      <p class="section-body" style="text-align:center;margin:0 auto;">Take the 60-second Business Health Scorecard and find out exactly where your biggest growth gaps are - and what to do about them.</p>
    </div>
    <div class="quiz-box reveal" style="transition-delay:0.15s;">
      <div class="quiz-header">
        <div>
          <div class="quiz-header-title">Business Health Scorecard</div>
          <div class="quiz-header-sub">7 questions · 60 seconds · Personalized insights</div>
        </div>
        <div class="quiz-dots" id="quizProgress">
          <div class="quiz-dot filled"></div>
          <div class="quiz-dot"></div>
          <div class="quiz-dot"></div>
          <div class="quiz-dot"></div>
          <div class="quiz-dot"></div>
          <div class="quiz-dot"></div>
          <div class="quiz-dot"></div>
        </div>
      </div>
      <div class="quiz-body">
        <div class="quiz-step active" data-step="0">
          <div class="quiz-question">How clearly defined is your marketing strategy right now?</div>
          <div class="quiz-options">
            <button class="quiz-opt" data-score="1">We're figuring it out as we go</button>
            <button class="quiz-opt" data-score="2">We have some ideas but no real plan</button>
            <button class="quiz-opt" data-score="3">We have a strategy but struggle to execute</button>
            <button class="quiz-opt" data-score="4">We have a clear, documented strategy</button>
          </div>
        </div>
        <div class="quiz-step" data-step="1">
          <div class="quiz-question">How well do your operations run day-to-day?</div>
          <div class="quiz-options">
            <button class="quiz-opt" data-score="1">Lots of fires - chaos is normal</button>
            <button class="quiz-opt" data-score="2">Some processes exist but aren't followed</button>
            <button class="quiz-opt" data-score="3">Mostly consistent, but inefficiencies exist</button>
            <button class="quiz-opt" data-score="4">Streamlined and highly efficient</button>
          </div>
        </div>
        <div class="quiz-step" data-step="2">
          <div class="quiz-question">How well do you understand your customer's psychology and buying triggers?</div>
          <div class="quiz-options">
            <button class="quiz-opt" data-score="1">We don't really think about it</button>
            <button class="quiz-opt" data-score="2">We have some assumptions, unvalidated</button>
            <button class="quiz-opt" data-score="3">We have decent insight but don't use it</button>
            <button class="quiz-opt" data-score="4">Deep understanding powering our messaging</button>
          </div>
        </div>
        <div class="quiz-step" data-step="3">
          <div class="quiz-question">How effective is your current lead generation?</div>
          <div class="quiz-options">
            <button class="quiz-opt" data-score="1">We rely on referrals and hope</button>
            <button class="quiz-opt" data-score="2">Some leads coming in, but inconsistent</button>
            <button class="quiz-opt" data-score="3">Decent pipeline but conversion rates are low</button>
            <button class="quiz-opt" data-score="4">Consistent, predictable pipeline with strong conversion</button>
          </div>
        </div>
        <div class="quiz-step" data-step="4">
          <div class="quiz-question">How aligned is your leadership team around shared goals?</div>
          <div class="quiz-options">
            <button class="quiz-opt" data-score="1">We're often pulling in different directions</button>
            <button class="quiz-opt" data-score="2">Some alignment, but gaps exist</button>
            <button class="quiz-opt" data-score="3">Generally aligned, with occasional friction</button>
            <button class="quiz-opt" data-score="4">Fully aligned with clear shared objectives</button>
          </div>
        </div>
        <div class="quiz-step" data-step="5">
          <div class="quiz-question">How data-driven are your business decisions?</div>
          <div class="quiz-options">
            <button class="quiz-opt" data-score="1">We mostly go with gut feeling</button>
            <button class="quiz-opt" data-score="2">We look at data but not consistently</button>
            <button class="quiz-opt" data-score="3">We use data but our reporting needs work</button>
            <button class="quiz-opt" data-score="4">Decisions are driven by real-time dashboards</button>
          </div>
        </div>
        <div class="quiz-step" data-step="6">
          <div class="quiz-question">What is your biggest business challenge right now?</div>
          <div class="quiz-options">
            <button class="quiz-opt" data-score="2">Not enough leads or customers</button>
            <button class="quiz-opt" data-score="2">Revenue is inconsistent or plateaued</button>
            <button class="quiz-opt" data-score="2">Operations are chaotic or inefficient</button>
            <button class="quiz-opt" data-score="2">We're growing but can't keep up with demand</button>
          </div>
        </div>
        <div class="quiz-result" id="quizResult">
          <div class="quiz-score-ring" id="scoreRing">0%</div>
          <div class="quiz-result-title" id="resultTitle">Calculating...</div>
          <p class="quiz-result-desc" id="resultDesc"></p>
          <div class="quiz-inputs">
            <input class="quiz-input" type="text" id="leadName" placeholder="Your Name" />
            <input class="quiz-input" type="text" id="leadCompany" placeholder="Company Name" />
          </div>
          <input class="quiz-input" type="email" id="leadEmail" placeholder="Business Email" style="width:100%;margin-bottom:0;" />
          <button class="quiz-submit" onclick="submitLead()">Send Me My Free Business Report</button>
          <p class="quiz-privacy">No spam. Just your results + a direct line to Mark.</p>
        </div>
      </div>
      <div class="quiz-footer">
        <span class="quiz-step-label" id="quizStepLabel">Question 1 of 7</span>
      </div>
    </div>
  </div>
</section>

<!-- BOOK A CALL -->
<section id="book">
  <div class="book-inner">
    <div class="book-left reveal">
      <div class="section-kicker">Book a Call</div>
      <h2 class="section-title">30 Minutes.<br>Clarity Guaranteed.</h2>
      <p class="section-body">No pitch. No pressure. Just a direct conversation about your biggest challenge - and what to do about it.</p>
      <div class="book-perks">
        <div class="book-perk"><div class="book-perk-dot">✦</div>Your #1 growth constraint identified</div>
        <div class="book-perk"><div class="book-perk-dot">✦</div>Frank assessment of your strategy</div>
        <div class="book-perk"><div class="book-perk-dot">✦</div>At least 3 actionable ideas to take away</div>
        <div class="book-perk"><div class="book-perk-dot">✦</div>Zero obligation - 100% free</div>
      </div>
    </div>
    <div class="book-right reveal" style="transition-delay:0.15s;">
      <div class="book-right-head">Schedule Your Free Call</div>
      <div class="book-right-sub">Pick a time that works for you - calendar opens immediately</div>
      <a href="book.html" class="book-btn">Book Your Call Now →</a>
      <p class="book-note">Or pick a time directly below</p>
      <div class="book-calendly-wrap" id="calendlyHolder">
        <div style="height:480px;display:flex;align-items:center;justify-content:center;background:#F9FAFB;color:#9CA3AF;font-size:0.875rem;">Loading calendar...</div>
      </div>
    </div>
  </div>
</section>

<!-- BLOG -->
<section id="blog">
  <div class="blog-header">
    <div>
      <div class="section-kicker">Insights</div>
      <h2 class="section-title">From the <span class="accent">field.</span></h2>
    </div>
    <a href="blog.html" class="blog-all-link">All Articles →</a>
  </div>
  <div class="blog-grid">
    <div class="blog-card reveal" onclick="openModal('blog1')">
      <div class="blog-card-top">📊</div>
      <div class="blog-card-body">
        <div class="blog-tag">Fractional CMO</div>
        <div class="blog-title">Why Your Marketing Isn't Working, And It's Not the Budget</div>
        <div class="blog-excerpt">Most companies throw more money at broken funnels. The real problem is almost never spend - it's strategy, positioning, or psychological misalignment with your customer.</div>
        <div class="blog-meta">Feb 2026 · 5 min read</div>
      </div>
    </div>
    <div class="blog-card reveal" style="transition-delay:0.1s;" onclick="openModal('blog2')">
      <div class="blog-card-top">⚙️</div>
      <div class="blog-card-body">
        <div class="blog-tag">Operations</div>
        <div class="blog-title">The 5 Operational Blind Spots Killing Growth-Stage Companies</div>
        <div class="blog-excerpt">After auditing dozens of growing businesses, the same five operational gaps surface over and over - and almost none of them are visible from the inside.</div>
        <div class="blog-meta">Jan 2026 · 6 min read</div>
      </div>
    </div>
    <div class="blog-card reveal" style="transition-delay:0.2s;" onclick="openModal('blog3')">
      <div class="blog-card-top">🧠</div>
      <div class="blog-card-body">
        <div class="blog-tag">Psychology &amp; Business</div>
        <div class="blog-title">The Human Psychology Framework Every Business Leader Needs</div>
        <div class="blog-excerpt">Understanding why your customers, team, and partners make decisions isn't soft science - it's the hardest business edge you can build. Here's how to build it.</div>
        <div class="blog-meta">Dec 2025 · 7 min read</div>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="footer-mega">
    <div class="footer-brand-col">
      <div class="footer-brand-logo">Mark <span>Gabrielli</span></div>
      <p class="footer-desc">Fractional CMO, COO &amp; Executive Consultant. I help businesses from $1M to $100M find what's broken, build what scales, and execute what others only talk about.</p>
      <div class="footer-tags">
        <span class="footer-tag">WETYR Founder</span>
        <span class="footer-tag">Fractional C-Suite</span>
        <span class="footer-tag">AI Strategist</span>
        <span class="footer-tag">CST Certified</span>
      </div>
      <div class="footer-socials">
        <a href="https://www.linkedin.com/in/marklgabrielli/" target="_blank" rel="noopener" class="footer-social">in</a>
        <a href="mailto:mark@markcmo.com" class="footer-social">@</a>
      </div>
    </div>
    <div class="footer-col">
      <h4>C-Suite</h4>
      <ul>
        <li><a href="fractional-cmo.html">Fractional CMO</a></li>
        <li><a href="fractional-coo.html">Fractional COO</a></li>
        <li><a href="fractional-ceo.html">Fractional CEO</a></li>
        <li><a href="fractional-cto.html">Fractional CTO</a></li>
        <li><a href="fractional-cfo.html">Fractional CFO</a></li>
        <li><a href="executive-advisory.html">Executive Advisory</a></li>
        <li><a href="services.html">All Services</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Marketing</h4>
      <ul>
        <li><a href="demand-generation.html">Demand Generation</a></li>
        <li><a href="lead-generation.html">Lead Generation</a></li>
        <li><a href="content-marketing.html">Content Marketing</a></li>
        <li><a href="account-based-marketing.html">ABM</a></li>
        <li><a href="go-to-market-strategy.html">Go-to-Market</a></li>
        <li><a href="marketing-audit.html">Marketing Audit</a></li>
        <li><a href="marketing-strategy.html">Marketing Strategy</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Compare</h4>
      <ul>
        <li><a href="fractional-cmo-cost.html">CMO Cost</a></li>
        <li><a href="fractional-cmo-vs-full-time-cmo.html">vs Full-Time CMO</a></li>
        <li><a href="fractional-cmo-vs-agency.html">vs Agency</a></li>
        <li><a href="fractional-cmo-vs-vp-marketing.html">vs VP Marketing</a></li>
        <li><a href="fractional-cmo-vs-interim-cmo.html">vs Interim CMO</a></li>
        <li><a href="chief-outsiders-alternative.html">Chief Outsiders Alt.</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>By Stage</h4>
      <ul>
        <li><a href="fractional-cmo-pre-revenue.html">Pre-Revenue</a></li>
        <li><a href="fractional-cmo-series-a.html">Series A</a></li>
        <li><a href="fractional-cmo-series-b.html">Series B</a></li>
        <li><a href="fractional-cmo-bootstrapped-companies.html">Bootstrapped</a></li>
        <li><a href="fractional-cmo-pe-backed-companies.html">PE-Backed</a></li>
        <li><a href="fractional-cmo-venture-capital.html">VC-Backed</a></li>
        <li><a href="best-fractional-cmo.html">Best Fractional CMO</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Industries</h4>
      <ul>
        <li><a href="fractional-cmo-saas.html">SaaS</a></li>
        <li><a href="fractional-cmo-healthcare.html">Healthcare</a></li>
        <li><a href="fractional-cmo-fintech.html">Fintech</a></li>
        <li><a href="fractional-cmo-ai.html">AI Companies</a></li>
        <li><a href="fractional-cmo-b2b.html">B2B</a></li>
        <li><a href="fractional-cmo-ecommerce.html">eCommerce</a></li>
        <li><a href="industries.html">All Industries</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Cities</h4>
      <ul>
        <li><a href="fractional-cmo-dallas-fort-worth.html">Dallas-Fort Worth</a></li>
        <li><a href="fractional-cmo-greater-houston.html">Houston</a></li>
        <li><a href="fractional-cmo-greater-chicago.html">Chicago</a></li>
        <li><a href="fractional-cmo-greater-atlanta.html">Atlanta</a></li>
        <li><a href="fractional-cmo-greater-miami.html">Miami</a></li>
        <li><a href="fractional-cmo-greater-boston.html">Boston</a></li>
        <li><a href="fractional-cmo-near-me.html">CMO Near Me</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>Learn</h4>
      <ul>
        <li><a href="blog.html">Insights &amp; Blog</a></li>
        <li><a href="about.html">About Mark</a></li>
        <li><a href="testimonials.html">Testimonials</a></li>
        <li><a href="faq.html">FAQ</a></li>
        <li><a href="contact.html">Contact</a></li>
        <li><a href="https://academy.markcmo.com" target="_blank" style="color:#2563EB;font-weight:600;">🎓 MarkCMO Academy</a></li>
      </ul>
    </div>
  </div>

  <div class="footer-latest">
    <span class="footer-latest-label">Latest Articles</span>
    <div class="footer-latest-links">
      <a href="/blog.html" class="primary-link">All Insights →</a>
      <a href="/blog-what-is-a-fractional-cmo.html">What is a Fractional CMO</a>
      <a href="/blog-go-to-market-strategy.html">Go-to-Market Strategy</a>
      <a href="/blog-b2b-marketing-strategy.html">B2B Marketing Strategy</a>
      <a href="/blog-demand-generation-guide.html">Demand Generation Guide</a>
      <a href="/blog-saas-marketing-guide.html">SaaS Marketing Guide</a>
      <a href="/fractional-cmo-cost.html">Fractional CMO Cost 2025</a>
    </div>
  </div>

  <div class="footer-bottom">
    <div class="footer-bottom-row">
      <span class="footer-copy">&copy; 2026 Mark Gabrielli &middot; markcmo.com &middot; All rights reserved.</span>
      <div class="footer-bottom-links">
        <a href="https://www.linkedin.com/in/marklgabrielli/" target="_blank" rel="noopener">LinkedIn</a>
        <a href="https://x.com/markgcmo" target="_blank" rel="noopener">X / Twitter</a>
        <a href="https://medium.com/@mark_louis_gabrielli_jr" target="_blank" rel="noopener">Medium</a>
        <a href="https://www.tiktok.com/@mark.gabrielli.cmo" target="_blank" rel="noopener">TikTok</a>
      </div>
    </div>
    <p style="font-size:0.75rem;color:rgba(255,255,255,0.15);margin-top:0.5rem;line-height:1.6;">
      Fractional CMO &middot; Fractional COO &middot; Fractional CEO &middot; Chief Marketing Officer &middot; Go-to-Market Strategy &middot; Demand Generation &middot; Marketing Audit &middot; AI Automation &middot; SaaS Strategy &middot; Executive Advisory &middot; Cape Canaveral, FL &middot; Global &middot; All 50 States
    </p>
  </div>
</footer>

<!-- BLOG MODALS -->
<div class="modal-overlay" id="modal-blog1">
  <div class="modal-box">
    <button class="modal-close" onclick="closeModal('blog1')">✕</button>
    <div class="modal-tag">Fractional CMO · Feb 2026 · 5 min read</div>
    <div class="modal-title">Why Your Marketing Isn't Working, And It's Not the Budget</div>
    <div class="modal-content">
      <p>I've audited hundreds of marketing programs across SaaS, eCommerce, fintech, and consumer brands. And the most consistent discovery? The problem almost never comes down to budget.</p>
      <h3>The Real Culprit: Strategic Misalignment</h3>
      <p>When a marketing program underperforms, business owners almost universally believe the answer is more spend. More ads. More content. More volume. But pouring fuel into a broken engine doesn't make it run - it makes it burn.</p>
      <p>The real issue is almost always one of three things: your positioning doesn't resonate, your funnel has a structural leak, or your messaging doesn't match your customer's actual psychological triggers.</p>
      <h3>Positioning: The Foundation Everything Else Depends On</h3>
      <p>Positioning is not your tagline. It's the answer to a deeply specific question: "Why should this exact person choose you, right now, over every other option?" When positioning is weak, even the best creative falls flat.</p>
      <h3>What to Do Instead</h3>
      <p>Before adjusting a single dollar of spend, audit these three things: (1) Can your best customer explain what you do in one sentence that would make another ideal customer want to buy? (2) Does your funnel have a stage where prospects consistently drop off? (3) Does your messaging speak to outcomes and emotions, or features and specs?</p>
    </div>
  </div>
</div>
<div class="modal-overlay" id="modal-blog2">
  <div class="modal-box">
    <button class="modal-close" onclick="closeModal('blog2')">✕</button>
    <div class="modal-tag">Operations · Jan 2026 · 6 min read</div>
    <div class="modal-title">The 5 Operational Blind Spots Killing Growth-Stage Companies</div>
    <div class="modal-content">
      <p>Growth creates chaos. That's not a failure - it's physics. The problem is that most growth-stage companies mistake the symptoms for the disease.</p>
      <h3>Blind Spot #1: Role Ambiguity at Scale</h3>
      <p>When you're small, everyone does everything. That's a feature. When you're scaling, it becomes a fatal bug. Unclear ownership means tasks fall through the cracks and accountability evaporates.</p>
      <h3>Blind Spot #2: The Absence of a Decision Framework</h3>
      <p>In most growing companies, decisions still flow through the founder by default. This creates a bottleneck that slows everything and trains your team not to think.</p>
      <h3>Blind Spot #3: Manual Processes Masquerading as Workflows</h3>
      <p>Your team calls it "the process." I call it a set of tasks that someone executes the same way every time because nobody has built a system to do it automatically. Across a 20-person company, this typically costs 80-120 hours per week.</p>
      <h3>Blind Spot #4: Misaligned Metrics</h3>
      <p>Activity metrics feel productive. Outcome metrics tell the truth. When teams are rewarded for activity, you get a lot of motion and not enough progress.</p>
      <h3>Blind Spot #5: Culture Drift</h3>
      <p>Culture isn't a mission statement - it's what actually happens when nobody is watching. Rapid hiring during growth phases often dilutes the standards that made your early team great.</p>
    </div>
  </div>
</div>
<div class="modal-overlay" id="modal-blog3">
  <div class="modal-box">
    <button class="modal-close" onclick="closeModal('blog3')">✕</button>
    <div class="modal-tag">Psychology &amp; Business · Dec 2025 · 7 min read</div>
    <div class="modal-title">The Human Psychology Framework Every Business Leader Needs</div>
    <div class="modal-content">
      <p>Business strategy is mostly taught as a set of rational frameworks. But they miss the most powerful force in any business - the human beings making decisions inside it and outside it.</p>
      <h3>The Decision Architecture Principle</h3>
      <p>Every decision your customer makes is preceded by an emotional state they're trying to move toward or away from. The most effective marketing activates - it moves people emotionally before it convinces them logically.</p>
      <h3>Inside the Organization</h3>
      <p>Your team doesn't underperform because they lack skill - they underperform because their psychological needs (autonomy, mastery, belonging, significance) aren't being met by the environment you've created.</p>
      <h3>How to Apply This Immediately</h3>
      <p>Ask one question in your next customer interview: "What were you afraid would happen if you didn't solve this problem?" The answer will reshape your positioning more than any competitive analysis ever will.</p>
    </div>
  </div>
</div>

<script>
// Nav scroll effect
const nav = document.getElementById('siteNav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
});

// Mobile nav
const hamburger = document.getElementById('navHamburger');
const drawer = document.getElementById('mobileDrawer');
hamburger.addEventListener('click', () => {
  drawer.classList.toggle('open');
});
drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => drawer.classList.remove('open')));

// Scroll reveal
const reveals = document.querySelectorAll('.reveal');
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealIO.unobserve(e.target); } });
}, { threshold: 0.08 });
reveals.forEach(el => revealIO.observe(el));

// Quiz logic
let currentStep = 0;
let totalScore = 0;
const totalSteps = 7;
function updateDots(step) {
  document.querySelectorAll('.quiz-dot').forEach((d, i) => d.classList.toggle('filled', i <= step));
  const lbl = document.getElementById('quizStepLabel');
  if (lbl) lbl.textContent = 'Question ' + (step + 1) + ' of ' + totalSteps;
}
document.querySelectorAll('.quiz-opt').forEach(btn => {
  btn.addEventListener('click', function() {
    const step = this.closest('.quiz-step');
    step.querySelectorAll('.quiz-opt').forEach(b => b.classList.remove('selected'));
    this.classList.add('selected');
    totalScore += parseInt(this.dataset.score);
    setTimeout(() => {
      step.classList.remove('active');
      currentStep++;
      if (currentStep < totalSteps) {
        document.querySelector('.quiz-step[data-step="' + currentStep + '"]').classList.add('active');
        updateDots(currentStep);
      } else {
        showResults();
      }
    }, 300);
  });
});
function showResults() {
  document.getElementById('quizResult').classList.add('show');
  const pct = Math.round((totalScore / 28) * 100);
  const ring = document.getElementById('scoreRing');
  const deg = Math.round((pct / 100) * 360);
  ring.style.background = 'conic-gradient(#2563EB ' + deg + 'deg, #E5E7EB ' + deg + 'deg)';
  ring.textContent = pct + '%';
  let title, desc;
  if (pct < 40) { title = '🚨 High-Risk Zone'; desc = 'Your business has significant structural gaps in marketing, operations, or both. These are fixable fast - but you need a clear diagnosis before investing more resources.'; }
  else if (pct < 65) { title = '⚠️ Growth is Being Throttled'; desc = "You've built a foundation, but you're leaving significant revenue on the table. Specific gaps in your funnel, operations, or team alignment are quietly capping your potential."; }
  else if (pct < 85) { title = '📈 Strong - But Room to Scale'; desc = "You're operating well, but there are strategic opportunities you're not fully capturing. A focused executive eye could open up your next growth level."; }
  else { title = '🏆 High-Performing Operation'; desc = "You're running a tight ship. The question now is scale - how do you compound what's working and build systems that sustain growth without adding chaos?"; }
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultDesc').textContent = desc;
}
function submitLead() {
  const name = document.getElementById('leadName').value;
  const email = document.getElementById('leadEmail').value;
  const company = document.getElementById('leadCompany').value;
  if (!name || !email) { alert('Please enter your name and email.'); return; }
  document.getElementById('quizResult').innerHTML = '<div style="padding:1rem;text-align:center;"><div style="font-size:2.5rem;margin-bottom:1rem;">✅</div><div style="font-family:Syne,sans-serif;font-size:1.2rem;font-weight:800;margin-bottom:0.75rem;">You\'re all set, ' + name.split(' ')[0] + '!</div><p style="color:#6B7280;margin-bottom:1.5rem;">Your personalized Business Health Report is on its way to <strong>' + email + '</strong>. Mark will review your results personally.</p><a href="book.html" class="btn-primary" style="display:inline-flex;">Book a Free Strategy Call →</a></div>';
}

// Blog modals
function openModal(id) { document.getElementById('modal-' + id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById('modal-' + id).classList.remove('open'); document.body.style.overflow = ''; }
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', function(e) { if (e.target === this) { this.classList.remove('open'); document.body.style.overflow = ''; } }));

// Calendly
const CALENDLY_URL = 'https://calendly.com/marklgabriellijr/discovery-call-marketing-clone';
if (CALENDLY_URL) {
  const holder = document.getElementById('calendlyHolder');
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = 'https://assets.calendly.com/assets/external/widget.css';
  document.head.appendChild(link);
  holder.innerHTML = '<div class="calendly-inline-widget" data-url="' + CALENDLY_URL + '" style="min-width:280px;height:480px;"></div>';
  const s = document.createElement('script');
  s.src = 'https://assets.calendly.com/assets/external/widget.js';
  document.body.appendChild(s);
}
</script>

</body>`;

// ── Assemble new HTML ────────────────────────────────────────────────────────
// Strip old font links from head (we add new ones in NEW_CSS)
const cleanHead = headContent
  .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '')
  .replace(/<link[^>]*style\.css[^>]*>/gi, '')
  .replace(/<style>[\s\S]*?<\/style>/gi, '')
  .replace(/<meta name="theme-color"[^>]*>/gi, '<meta name="theme-color" content="#2563EB" />');

const newHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${cleanHead}
${NEW_CSS}
</head>
${NEW_BODY}
</html>`;

fs.writeFileSync(SRC, newHtml, 'utf8');
console.log('✅  index.html completely redesigned and saved.');
