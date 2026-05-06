/**
 * redesign2.js - Dark, bold, modern agency design for markcmo.com
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'index.html');
const html = fs.readFileSync(SRC, 'utf8');

// Extract <head> (preserve all SEO/JSON-LD)
const headMatch = html.match(/<head>([\s\S]*?)<\/head>/i);
const headContent = headMatch ? headMatch[1] : '';
const cleanHead = headContent
  .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/gi, '')
  .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/gi, '')
  .replace(/<link[^>]*style\.css[^>]*>/gi, '')
  .replace(/<style>[\s\S]*?<\/style>/gi, '')
  .replace(/<meta name="theme-color"[^>]*>/gi, '<meta name="theme-color" content="#0A0A0F" />');

const NEW_CSS = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ══════════════════════════════════════════════
   MARKCMO - DARK AUTHORITY DESIGN 2026
   ══════════════════════════════════════════════ */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; overflow-x: hidden; }
body {
  font-family: 'Space Grotesk', sans-serif;
  background: #0A0A0F;
  color: #FFFFFF;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}
a { text-decoration: none; color: inherit; }
img { display: block; max-width: 100%; }
ul { list-style: none; }

:root {
  --bg:      #0A0A0F;
  --bg2:     #111118;
  --bg3:     #18181F;
  --card:    #141419;
  --border:  rgba(255,255,255,0.07);
  --accent:  #4F7EFF;
  --accent2: #7B9FFF;
  --accent-glow: rgba(79,126,255,0.25);
  --text:    #FFFFFF;
  --text2:   #A1A1AA;
  --text3:   #52525B;
}

/* ─── NAV ─── */
.nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  height: 64px; padding: 0 5vw;
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(10,10,15,0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
}
.nav-logo {
  font-family: 'Outfit', sans-serif; font-size: 1.15rem; font-weight: 700;
  color: #fff; display: flex; align-items: center; gap: 10px;
}
.nav-logo-icon {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--accent); display: flex; align-items: center;
  justify-content: center; font-size: 0.9rem; font-weight: 900;
}
.nav-links { display: flex; align-items: center; gap: 2.5rem; }
.nav-links a { font-size: 0.875rem; font-weight: 500; color: var(--text2); transition: color 0.15s; }
.nav-links a:hover { color: #fff; }
.nav-btn {
  font-size: 0.875rem; font-weight: 600; color: #fff;
  background: var(--accent); padding: 0.5rem 1.25rem;
  border-radius: 8px; transition: opacity 0.15s, transform 0.15s;
}
.nav-btn:hover { opacity: 0.88; transform: translateY(-1px); }
.nav-hamburger {
  display: none; flex-direction: column; gap: 5px; cursor: pointer; padding: 4px;
}
.nav-hamburger span { display: block; width: 22px; height: 2px; background: #fff; border-radius: 2px; }
.mobile-drawer {
  display: none; position: fixed; inset: 0; z-index: 99;
  background: var(--bg); padding: 80px 6vw 40px;
  flex-direction: column; gap: 1.5rem;
}
.mobile-drawer.open { display: flex; }
.mobile-drawer a { font-size: 1.2rem; font-weight: 600; color: #fff; padding: 0.6rem 0; border-bottom: 1px solid var(--border); }

/* ─── HERO ─── */
.hero {
  min-height: 100vh; padding-top: 64px;
  display: flex; flex-direction: column; justify-content: center;
  position: relative; overflow: hidden;
  padding-left: 6vw; padding-right: 6vw;
}
/* Glow orbs */
.hero::before {
  content: '';
  position: absolute; top: 10%; right: 5%; z-index: 0;
  width: 600px; height: 600px; border-radius: 50%;
  background: radial-gradient(circle, rgba(79,126,255,0.12) 0%, transparent 70%);
  pointer-events: none;
}
.hero::after {
  content: '';
  position: absolute; bottom: 15%; left: 10%; z-index: 0;
  width: 400px; height: 400px; border-radius: 50%;
  background: radial-gradient(circle, rgba(123,159,255,0.07) 0%, transparent 70%);
  pointer-events: none;
}
.hero-inner {
  max-width: 1300px; margin: 0 auto; width: 100%;
  display: grid; grid-template-columns: 1fr auto;
  align-items: center; gap: 4rem;
  position: relative; z-index: 1;
  padding: 5rem 0;
}
.hero-left { max-width: 820px; }
.hero-kicker {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 0.75rem; font-weight: 600; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--accent);
  margin-bottom: 2rem;
}
.hero-kicker::before {
  content: ''; width: 8px; height: 8px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 12px var(--accent);
  animation: blink 2s ease-in-out infinite;
}
@keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
.hero-h1 {
  font-family: 'Outfit', sans-serif;
  font-size: clamp(3.5rem, 7.5vw, 8rem);
  font-weight: 900; line-height: 0.95;
  letter-spacing: -0.03em; color: #fff;
  margin-bottom: 2rem;
}
.hero-h1 .line-accent {
  color: transparent;
  -webkit-text-stroke: 2px var(--accent);
  display: block;
}
.hero-h1 .line-normal { display: block; }
.hero-sub {
  font-size: 1.125rem; line-height: 1.75; color: var(--text2);
  max-width: 540px; margin-bottom: 2.5rem;
}
.hero-actions { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 3rem; }
.btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--accent); color: #fff;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.9375rem; font-weight: 700;
  padding: 0.875rem 2rem; border-radius: 10px;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 0 32px var(--accent-glow);
}
.btn-primary:hover { transform: translateY(-3px); box-shadow: 0 8px 40px rgba(79,126,255,0.45); }
.btn-secondary {
  display: inline-flex; align-items: center; gap: 8px;
  border: 1px solid var(--border); color: var(--text2);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.9375rem; font-weight: 500;
  padding: 0.875rem 2rem; border-radius: 10px;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.btn-secondary:hover { border-color: var(--accent); color: var(--accent); background: rgba(79,126,255,0.07); }
.hero-trust { display: flex; flex-wrap: wrap; gap: 1rem 2rem; }
.hero-trust-item {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.8125rem; color: var(--text3); font-weight: 500;
}
.hero-trust-dot {
  width: 16px; height: 16px; border-radius: 50%;
  background: rgba(79,126,255,0.15); border: 1px solid rgba(79,126,255,0.3);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.55rem; color: var(--accent);
}
/* Hero right: stat stack */
.hero-stats-stack {
  display: flex; flex-direction: column; gap: 1rem; flex-shrink: 0;
}
.hero-stat-card {
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: 16px; padding: 1.5rem 2rem;
  min-width: 180px; text-align: center;
  transition: border-color 0.2s, background 0.2s;
}
.hero-stat-card:hover { border-color: rgba(79,126,255,0.3); background: var(--card); }
.hero-stat-num {
  font-family: 'Outfit', sans-serif; font-size: 2.5rem;
  font-weight: 900; color: var(--accent); line-height: 1;
  margin-bottom: 0.3rem; letter-spacing: -0.02em;
}
.hero-stat-label { font-size: 0.75rem; color: var(--text3); font-weight: 500; }

/* ─── MARQUEE ─── */
.marquee-band {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 1rem 0; overflow: hidden; white-space: nowrap;
  background: var(--bg2);
}
.marquee-inner { display: inline-flex; gap: 3rem; animation: marquee 30s linear infinite; }
.marquee-word { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text3); }
.marquee-sep { color: var(--accent); }
@keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }

/* ─── STATS ─── */
.stats-section {
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
}
.stats-inner {
  max-width: 1200px; margin: 0 auto; padding: 0 6vw;
  display: grid; grid-template-columns: repeat(4, 1fr);
}
.stat-block {
  padding: 3rem 1.5rem; text-align: center;
  border-right: 1px solid var(--border);
  transition: background 0.2s;
}
.stat-block:last-child { border-right: none; }
.stat-block:hover { background: var(--bg3); }
.stat-block-num {
  font-family: 'Outfit', sans-serif; font-size: 3rem;
  font-weight: 900; color: #fff; line-height: 1;
  margin-bottom: 0.4rem; letter-spacing: -0.03em;
}
.stat-block-num span { color: var(--accent); }
.stat-block-label { font-size: 0.8125rem; color: var(--text3); font-weight: 500; }

/* ─── SERVICES ─── */
.services-section { padding: 8rem 6vw; background: var(--bg); }
.services-inner { max-width: 1200px; margin: 0 auto; }
.section-eyebrow {
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.15em;
  text-transform: uppercase; color: var(--accent);
  margin-bottom: 1rem; display: flex; align-items: center; gap: 10px;
}
.section-eyebrow::before { content:''; width:24px; height:2px; background:var(--accent); border-radius:2px; }
.section-h2 {
  font-family: 'Outfit', sans-serif;
  font-size: clamp(2.25rem, 4vw, 3.75rem);
  font-weight: 900; letter-spacing: -0.03em; line-height: 1.05;
  color: #fff; margin-bottom: 1.5rem;
}
.section-h2 em { font-style: normal; color: transparent; -webkit-text-stroke: 1.5px var(--accent); }
.section-body { font-size: 1rem; line-height: 1.8; color: var(--text2); max-width: 560px; }
.services-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3.5rem; flex-wrap: wrap; gap: 1.5rem; }
.services-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: 20px; overflow: hidden;
}
.svc {
  background: var(--bg);
  padding: 2.75rem 2.25rem;
  position: relative;
  transition: background 0.25s;
}
.svc:hover { background: var(--bg3); }
.svc.highlight { background: var(--bg3); }
.svc-tag {
  font-size: 0.65rem; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--accent);
  background: rgba(79,126,255,0.1); border: 1px solid rgba(79,126,255,0.2);
  padding: 0.3rem 0.75rem; border-radius: 999px; display: inline-block;
  margin-bottom: 1.5rem;
}
.svc-icon { font-size: 2rem; margin-bottom: 1.25rem; }
.svc-title {
  font-family: 'Outfit', sans-serif; font-size: 1.5rem;
  font-weight: 800; color: #fff; margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
}
.svc-desc { font-size: 0.9rem; line-height: 1.7; color: var(--text2); margin-bottom: 1.75rem; }
.svc-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 2rem; }
.svc-list-item {
  font-size: 0.85rem; color: var(--text2);
  display: flex; align-items: center; gap: 8px;
}
.svc-list-item::before { content:'→'; color:var(--accent); font-size:0.75rem; flex-shrink:0; }
.svc-link {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.875rem; font-weight: 600; color: var(--accent);
  transition: gap 0.15s;
}
.svc-link:hover { gap: 10px; }

/* ─── ABOUT ─── */
.about-section { padding: 8rem 6vw; background: var(--bg2); }
.about-inner {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: 1fr 1fr; gap: 6rem; align-items: center;
}
.about-visual { position: relative; }
.about-img-wrap {
  border-radius: 20px; overflow: hidden; position: relative;
  aspect-ratio: 3/4; max-height: 580px;
  border: 1px solid var(--border);
}
.about-img-wrap img { width:100%; height:100%; object-fit:cover; object-position:center 5%; }
.about-img-wrap::after {
  content:''; position:absolute; inset:0;
  background: linear-gradient(to top, rgba(10,10,15,0.6) 0%, transparent 50%);
}
.about-img-badge {
  position: absolute; bottom:1.5rem; left:1.5rem; right:1.5rem;
  z-index: 2;
  background: rgba(18,18,25,0.9); backdrop-filter: blur(12px);
  border: 1px solid var(--border); border-radius: 14px;
  padding: 1.25rem 1.5rem;
  display: flex; justify-content: space-between; align-items: center;
}
.aib-name { font-family:'Outfit',sans-serif; font-size:1.05rem; font-weight:800; color:#fff; }
.aib-title { font-size:0.75rem; color:var(--text3); margin-top:2px; }
.aib-status {
  background: rgba(79,126,255,0.15); border: 1px solid rgba(79,126,255,0.3);
  color: var(--accent); font-size:0.65rem; font-weight:700;
  letter-spacing:0.08em; text-transform:uppercase;
  padding:5px 12px; border-radius:999px;
}
.about-content { display:flex; flex-direction:column; gap:2rem; }
.about-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 14px; padding: 1.5rem;
  transition: border-color 0.2s, background 0.2s;
}
.about-card:hover { border-color: rgba(79,126,255,0.2); background: var(--bg3); }
.about-card-head { display:flex; align-items:center; gap:10px; margin-bottom:0.6rem; }
.about-card-icon { font-size:1.2rem; }
.about-card-title { font-weight:700; font-size:0.9375rem; color:#fff; }
.about-card-body { font-size:0.875rem; line-height:1.7; color:var(--text2); }
.skills-row { display:flex; flex-wrap:wrap; gap:0.5rem; }
.skill {
  font-size:0.75rem; font-weight:600; color:var(--text2);
  background: var(--bg3); border:1px solid var(--border);
  padding:0.35rem 0.85rem; border-radius:999px;
  transition: border-color 0.15s, color 0.15s;
}
.skill:hover { border-color:rgba(79,126,255,0.3); color:var(--accent); }

/* ─── TESTIMONIALS ─── */
.testi-section { padding: 8rem 6vw; background: var(--bg); }
.testi-inner { max-width: 1200px; margin: 0 auto; }
.testi-header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:3.5rem; flex-wrap:wrap; gap:1rem; }
.testi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.25rem; }
.testi-card {
  background: var(--bg3); border:1px solid var(--border);
  border-radius:20px; padding:2.25rem;
  transition: border-color 0.2s, background 0.2s, transform 0.2s;
}
.testi-card:hover { border-color:rgba(79,126,255,0.2); background:var(--card); transform:translateY(-4px); }
.testi-stars { color: var(--accent); font-size:0.85rem; margin-bottom:1.25rem; letter-spacing:2px; }
.testi-text { font-size:0.9375rem; line-height:1.75; color:var(--text2); margin-bottom:1.75rem; }
.testi-person { display:flex; align-items:center; gap:12px; }
.testi-avatar {
  width:40px; height:40px; border-radius:50%;
  background: var(--accent); color:#fff;
  font-weight:700; font-size:1rem;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.testi-name { font-weight:700; font-size:0.9rem; color:#fff; }
.testi-role { font-size:0.75rem; color:var(--text3); margin-top:1px; }

/* ─── INDUSTRIES ─── */
.industries-section { padding:6rem 6vw; background:var(--bg2); border-top:1px solid var(--border); }
.industries-inner { max-width:1200px; margin:0 auto; }
.industries-header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:2.5rem; flex-wrap:wrap; gap:1rem; }
.ind-tags { display:flex; flex-wrap:wrap; gap:0.75rem; }
.ind-tag {
  font-size:0.8125rem; font-weight:600; color:var(--text2);
  background: var(--bg3); border:1px solid var(--border);
  padding:0.5rem 1.1rem; border-radius:999px;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.ind-tag:hover { border-color:rgba(79,126,255,0.3); color:var(--accent); background:rgba(79,126,255,0.07); }

/* ─── SCORECARD ─── */
.quiz-section { padding:8rem 6vw; background:var(--bg); }
.quiz-wrap { max-width:700px; margin:0 auto; }
.quiz-intro { text-align:center; margin-bottom:3rem; }
.quiz-card {
  background: var(--bg2); border:1px solid var(--border);
  border-radius:24px; overflow:hidden;
}
.quiz-top {
  padding:2rem 2.5rem;
  border-bottom:1px solid var(--border);
  display:flex; justify-content:space-between; align-items:center;
}
.quiz-top-title { font-family:'Outfit',sans-serif; font-size:1.15rem; font-weight:800; color:#fff; }
.quiz-top-sub { font-size:0.8rem; color:var(--text3); margin-top:3px; }
.q-dots { display:flex; gap:6px; }
.q-dot { width:8px; height:8px; border-radius:50%; background:var(--bg3); border:1px solid var(--border); transition:all 0.2s; }
.q-dot.on { background:var(--accent); border-color:var(--accent); box-shadow:0 0 8px var(--accent-glow); }
.quiz-content { padding:2.5rem; }
.q-step { display:none; }
.q-step.active { display:block; }
.q-text { font-family:'Outfit',sans-serif; font-size:1.15rem; font-weight:700; color:#fff; margin-bottom:1.75rem; line-height:1.4; }
.q-opts { display:flex; flex-direction:column; gap:0.75rem; }
.q-opt {
  text-align:left; padding:1rem 1.25rem;
  background:var(--bg3); border:1px solid var(--border);
  border-radius:12px; color:var(--text2);
  font-size:0.9375rem; font-family:'Space Grotesk',sans-serif;
  cursor:pointer; transition:all 0.15s;
}
.q-opt:hover { border-color:rgba(79,126,255,0.4); color:#fff; background:rgba(79,126,255,0.07); }
.q-opt.selected { border-color:var(--accent); background:rgba(79,126,255,0.12); color:#fff; }
.quiz-foot { padding:0 2.5rem 2rem; display:flex; justify-content:flex-end; }
.q-step-lbl { font-size:0.8rem; color:var(--text3); }
.q-result { display:none; padding:2.5rem; text-align:center; }
.q-result.show { display:block; }
.q-ring {
  width:96px; height:96px; border-radius:50%;
  margin:0 auto 1.5rem;
  background: conic-gradient(var(--accent) 0deg, rgba(255,255,255,0.05) 0deg);
  display:flex; align-items:center; justify-content:center;
  font-family:'Outfit',sans-serif; font-size:1.4rem; font-weight:900; color:#fff;
}
.q-result-title { font-family:'Outfit',sans-serif; font-size:1.35rem; font-weight:800; color:#fff; margin-bottom:0.75rem; }
.q-result-desc { font-size:0.9375rem; line-height:1.75; color:var(--text2); margin-bottom:2rem; max-width:480px; margin-left:auto; margin-right:auto; }
.q-inputs { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-bottom:0.75rem; }
.q-input {
  width:100%; padding:0.875rem 1rem;
  background:var(--bg3); border:1px solid var(--border);
  border-radius:10px; color:#fff; font-size:0.9375rem;
  font-family:'Space Grotesk',sans-serif; outline:none; transition:border-color 0.15s;
}
.q-input::placeholder { color:var(--text3); }
.q-input:focus { border-color:var(--accent); }
.q-submit {
  width:100%; padding:1rem; margin-top:0.75rem;
  background:var(--accent); color:#fff; border:none;
  border-radius:10px; font-size:1rem; font-weight:700;
  font-family:'Space Grotesk',sans-serif; cursor:pointer;
  transition:opacity 0.15s, transform 0.15s;
  box-shadow:0 0 24px var(--accent-glow);
}
.q-submit:hover { opacity:0.9; transform:translateY(-2px); }
.q-privacy { font-size:0.75rem; color:var(--text3); margin-top:0.75rem; }

/* ─── CTA / BOOK ─── */
.cta-section {
  padding:8rem 6vw; background:var(--bg2);
  position:relative; overflow:hidden;
}
.cta-section::before {
  content:''; position:absolute; top:-200px; left:50%; transform:translateX(-50%);
  width:800px; height:800px; border-radius:50%;
  background: radial-gradient(circle, rgba(79,126,255,0.08) 0%, transparent 70%);
  pointer-events:none;
}
.cta-inner { max-width:900px; margin:0 auto; text-align:center; position:relative; z-index:1; }
.cta-h2 {
  font-family:'Outfit',sans-serif;
  font-size:clamp(2.5rem,5vw,5rem);
  font-weight:900; letter-spacing:-0.03em; line-height:1.0;
  color:#fff; margin-bottom:1.25rem;
}
.cta-h2 em { font-style:normal; color:var(--accent); }
.cta-sub { font-size:1.0625rem; color:var(--text2); line-height:1.75; max-width:520px; margin:0 auto 2.5rem; }
.cta-perks {
  display:flex; justify-content:center; flex-wrap:wrap; gap:0.75rem 2rem;
  margin-bottom:2.5rem;
}
.cta-perk { font-size:0.875rem; color:var(--text2); display:flex; align-items:center; gap:6px; }
.cta-perk::before { content:'✓'; color:var(--accent); font-weight:700; font-size:0.8rem; }
.cta-actions { display:flex; justify-content:center; flex-wrap:wrap; gap:1rem; margin-bottom:3rem; }
.cta-calendly {
  background:var(--bg3); border:1px solid var(--border);
  border-radius:20px; overflow:hidden; max-width:860px; margin:0 auto;
}

/* ─── BLOG ─── */
.blog-section { padding:8rem 6vw; background:var(--bg); }
.blog-inner { max-width:1200px; margin:0 auto; }
.blog-header { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:3rem; flex-wrap:wrap; gap:1rem; }
.blog-link { font-size:0.875rem; font-weight:600; color:var(--accent); display:flex; align-items:center; gap:6px; transition:gap 0.15s; }
.blog-link:hover { gap:10px; }
.blog-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1.25rem; }
.blog-card {
  background:var(--bg3); border:1px solid var(--border);
  border-radius:20px; overflow:hidden; cursor:pointer;
  transition:border-color 0.2s, background 0.2s, transform 0.2s;
}
.blog-card:hover { border-color:rgba(79,126,255,0.25); background:var(--card); transform:translateY(-6px); }
.blog-card-img {
  height:140px; background:var(--card);
  display:flex; align-items:center; justify-content:center;
  font-size:3rem; border-bottom:1px solid var(--border);
}
.blog-card-body { padding:1.75rem; }
.blog-pill {
  display:inline-block; font-size:0.7rem; font-weight:700;
  letter-spacing:0.08em; text-transform:uppercase;
  color:var(--accent); background:rgba(79,126,255,0.1);
  border:1px solid rgba(79,126,255,0.2);
  padding:0.2rem 0.7rem; border-radius:999px; margin-bottom:0.9rem;
}
.blog-title {
  font-family:'Outfit',sans-serif; font-size:1.05rem; font-weight:800;
  color:#fff; margin-bottom:0.65rem; line-height:1.35; letter-spacing:-0.01em;
}
.blog-excerpt { font-size:0.85rem; line-height:1.65; color:var(--text2); margin-bottom:1rem;
  display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
}
.blog-meta { font-size:0.75rem; color:var(--text3); }

/* ─── FOOTER ─── */
footer { background:var(--bg2); border-top:1px solid var(--border); }
.footer-main {
  max-width:1400px; margin:0 auto; padding:4rem 6vw 3rem;
  display:grid; grid-template-columns:2fr repeat(7,1fr); gap:2rem;
}
.footer-brand { }
.footer-logo-text { font-family:'Outfit',sans-serif; font-size:1.1rem; font-weight:800; color:#fff; margin-bottom:0.75rem; }
.footer-logo-text span { color:var(--accent); }
.footer-about { font-size:0.825rem; line-height:1.7; color:var(--text3); margin-bottom:1.25rem; }
.footer-chips { display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:1.25rem; }
.footer-chip {
  font-size:0.65rem; font-weight:600; letter-spacing:0.06em; text-transform:uppercase;
  color:var(--text3); border:1px solid var(--border);
  padding:0.25rem 0.6rem; border-radius:4px;
}
.footer-socials { display:flex; gap:0.6rem; }
.footer-soc {
  width:34px; height:34px; border-radius:8px;
  background:var(--bg3); border:1px solid var(--border);
  color:var(--text3); display:flex; align-items:center; justify-content:center;
  font-size:0.8rem; font-weight:700; transition:all 0.15s;
}
.footer-soc:hover { background:var(--accent); border-color:var(--accent); color:#fff; }
.footer-col h4 {
  font-size:0.7rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase;
  color:var(--text3); margin-bottom:1rem;
}
.footer-col ul { display:flex; flex-direction:column; gap:0.6rem; }
.footer-col ul li a { font-size:0.8125rem; color:var(--text3); transition:color 0.15s; }
.footer-col ul li a:hover { color:#fff; }
.footer-bar {
  border-top:1px solid var(--border);
  padding:1.5rem 6vw; max-width:1400px; margin:0 auto;
  display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;
}
.footer-copy { font-size:0.8rem; color:var(--text3); }
.footer-bar-links { display:flex; gap:1.25rem; }
.footer-bar-links a { font-size:0.8rem; color:var(--text3); transition:color 0.15s; }
.footer-bar-links a:hover { color:#fff; }

/* ─── MODALS ─── */
.modal-overlay {
  position:fixed; inset:0; z-index:200;
  background:rgba(0,0,0,0.85); backdrop-filter:blur(6px);
  display:none; align-items:center; justify-content:center; padding:2rem;
}
.modal-overlay.open { display:flex; }
.modal-box {
  background:var(--bg2); border:1px solid var(--border);
  border-radius:24px; padding:2.5rem;
  max-width:680px; width:100%; max-height:85vh; overflow-y:auto; position:relative;
}
.modal-close {
  position:absolute; top:1.25rem; right:1.25rem;
  background:var(--bg3); border:1px solid var(--border); cursor:pointer;
  width:32px; height:32px; border-radius:50%; font-size:0.85rem;
  color:var(--text2); display:flex; align-items:center; justify-content:center;
  transition:background 0.15s;
}
.modal-close:hover { background:var(--border); }
.modal-tag { font-size:0.75rem; color:var(--accent); font-weight:600; margin-bottom:0.75rem; }
.modal-title { font-family:'Outfit',sans-serif; font-size:1.4rem; font-weight:800; color:#fff; margin-bottom:1.5rem; line-height:1.25; }
.modal-content p { font-size:0.9375rem; line-height:1.75; color:var(--text2); margin-bottom:1rem; }
.modal-content h3 { font-family:'Outfit',sans-serif; font-size:1.05rem; font-weight:800; color:#fff; margin:1.5rem 0 0.5rem; }

/* ─── REVEAL ─── */
.reveal { opacity:0; transform:translateY(28px); transition:opacity 0.6s ease, transform 0.6s ease; }
.reveal.visible { opacity:1; transform:translateY(0); }

/* ─── RESPONSIVE ─── */
@media (max-width:1100px) {
  .footer-main { grid-template-columns:1fr 1fr 1fr 1fr; }
  .footer-brand { grid-column:span 4; }
}
@media (max-width:900px) {
  .hero-inner { grid-template-columns:1fr; }
  .hero-stats-stack { flex-direction:row; justify-content:center; }
  .stats-inner { grid-template-columns:1fr 1fr; }
  .stat-block:nth-child(2) { border-right:none; }
  .services-grid { grid-template-columns:1fr; }
  .about-inner { grid-template-columns:1fr; }
  .about-img-wrap { max-height:360px; }
  .testi-grid { grid-template-columns:1fr; }
  .blog-grid { grid-template-columns:1fr; }
  .nav-links { display:none; }
  .nav-hamburger { display:flex; }
  .footer-main { grid-template-columns:1fr 1fr; }
  .footer-brand { grid-column:span 2; }
  .q-inputs { grid-template-columns:1fr; }
}
@media (max-width:600px) {
  .hero-h1 { font-size:3rem; }
  .stats-inner { grid-template-columns:1fr 1fr; }
  .hero-stats-stack { flex-direction:column; align-items:center; }
}
</style>`;

const NEW_BODY = `
<body>

<nav class="nav" id="mainNav">
  <a href="index.html" class="nav-logo">
    <div class="nav-logo-icon">M</div>
    Mark Gabrielli
  </a>
  <ul class="nav-links">
    <li><a href="about.html">About</a></li>
    <li><a href="services.html">Services</a></li>
    <li><a href="portfolio.html">Portfolio</a></li>
    <li><a href="results.html">Results</a></li>
    <li><a href="blog.html">Insights</a></li>
    <li><a href="https://academy.markcmo.com" target="_blank" style="color:var(--accent);">🎓 Academy</a></li>
    <li><a href="book.html" class="nav-btn">Book a Free Call</a></li>
  </ul>
  <div class="nav-hamburger" id="navHam"><span></span><span></span><span></span></div>
</nav>

<div class="mobile-drawer" id="mobileDrawer">
  <a href="about.html">About</a>
  <a href="services.html">Services</a>
  <a href="portfolio.html">Portfolio</a>
  <a href="results.html">Results</a>
  <a href="blog.html">Insights</a>
  <a href="https://academy.markcmo.com" target="_blank">🎓 Academy</a>
  <a href="book.html" style="color:var(--accent);font-weight:700;">Book a Free Strategy Call →</a>
</div>

<!-- HERO -->
<section class="hero" id="hero">
  <div class="hero-inner">
    <div class="hero-left reveal">
      <div class="hero-kicker">Fractional C-Suite Executive</div>
      <h1 class="hero-h1">
        <span class="line-normal">I find what's</span>
        <span class="line-accent">breaking</span>
        <span class="line-normal">your business.</span>
      </h1>
      <p class="hero-sub">15+ years. Three continents. Healthcare, aerospace, SaaS, automotive, logistics. I've built companies from zero and scaled global teams of 50+. I find what's broken, fix what matters, and build what lasts - without the full-time cost.</p>
      <div class="hero-actions">
        <a href="book.html" class="btn-primary">Book a Free Strategy Call →</a>
        <a href="#scorecard" class="btn-secondary">Take the Business Scorecard</a>
      </div>
      <div class="hero-trust">
        <div class="hero-trust-item"><div class="hero-trust-dot">✓</div>Fractional CMO &amp; COO</div>
        <div class="hero-trust-item"><div class="hero-trust-dot">✓</div>Healthcare &amp; Aerospace</div>
        <div class="hero-trust-item"><div class="hero-trust-dot">✓</div>Global · NA · EMEA · APAC</div>
        <div class="hero-trust-item"><div class="hero-trust-dot">✓</div>4.0 Bio Sciences · CST Certified</div>
      </div>
    </div>
    <div class="hero-stats-stack reveal" style="transition-delay:0.2s;">
      <div class="hero-stat-card">
        <div class="hero-stat-num">$3M+</div>
        <div class="hero-stat-label">Qualified Leads Generated</div>
      </div>
      <div class="hero-stat-card">
        <div class="hero-stat-num">400%</div>
        <div class="hero-stat-label">ROAS Delivered</div>
      </div>
      <div class="hero-stat-card">
        <div class="hero-stat-num">15+</div>
        <div class="hero-stat-label">Years of Experience</div>
      </div>
    </div>
  </div>
</section>

<!-- MARQUEE -->
<div class="marquee-band">
  <div class="marquee-inner">
    <span class="marquee-word">SaaS</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Healthcare</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Aerospace</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Fintech</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">eCommerce</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">AI Companies</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Manufacturing</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Professional Services</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Logistics</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Automotive</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">SaaS</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Healthcare</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Aerospace</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Fintech</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">eCommerce</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">AI Companies</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Manufacturing</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Professional Services</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Logistics</span><span class="marquee-sep">✦</span>
    <span class="marquee-word">Automotive</span><span class="marquee-sep">✦</span>
  </div>
</div>

<!-- STATS -->
<div class="stats-section">
  <div class="stats-inner">
    <div class="stat-block reveal">
      <div class="stat-block-num">$3<span>M+</span></div>
      <div class="stat-block-label">Qualified Leads Generated</div>
    </div>
    <div class="stat-block reveal" style="transition-delay:0.1s;">
      <div class="stat-block-num">400<span>%</span></div>
      <div class="stat-block-label">ROAS for D2C Startup</div>
    </div>
    <div class="stat-block reveal" style="transition-delay:0.2s;">
      <div class="stat-block-num">15<span>+</span></div>
      <div class="stat-block-label">Years of Experience</div>
    </div>
    <div class="stat-block reveal" style="transition-delay:0.3s;">
      <div class="stat-block-num">10<span>+</span></div>
      <div class="stat-block-label">Industries Served</div>
    </div>
  </div>
</div>

<!-- SERVICES -->
<section class="services-section" id="services">
  <div class="services-inner">
    <div class="services-header reveal">
      <div>
        <div class="section-eyebrow">What I Do</div>
        <h2 class="section-h2">C-suite expertise.<br><em>Fraction of the cost.</em></h2>
      </div>
      <a href="services.html" class="btn-secondary">All Services →</a>
    </div>
    <div class="services-grid">
      <div class="svc highlight reveal">
        <div class="svc-tag">01 · Fractional CMO</div>
        <div class="svc-icon">📈</div>
        <div class="svc-title">Fractional CMO</div>
        <div class="svc-desc">Full-stack marketing leadership embedded in your organization. From positioning to pipeline, I own your growth engine and tie every dollar to measurable revenue outcomes.</div>
        <div class="svc-list">
          <div class="svc-list-item">Go-to-market strategy &amp; execution</div>
          <div class="svc-list-item">Brand positioning &amp; messaging</div>
          <div class="svc-list-item">Paid media &amp; funnel architecture</div>
          <div class="svc-list-item">AI-powered campaign systems</div>
          <div class="svc-list-item">KPI dashboards &amp; revenue ops</div>
        </div>
        <a href="fractional-cmo.html" class="svc-link">Learn more →</a>
      </div>
      <div class="svc reveal" style="transition-delay:0.1s;">
        <div class="svc-tag">02 · Fractional COO</div>
        <div class="svc-icon">⚙️</div>
        <div class="svc-title">Fractional COO</div>
        <div class="svc-desc">Operational excellence delivered. I audit, redesign, and implement the processes that make your business run at peak performance.</div>
        <div class="svc-list">
          <div class="svc-list-item">Operational audit &amp; rewire</div>
          <div class="svc-list-item">Workflow automation</div>
          <div class="svc-list-item">Systems &amp; tech stack optimization</div>
          <div class="svc-list-item">Hiring &amp; team structure</div>
          <div class="svc-list-item">OKR &amp; performance frameworks</div>
        </div>
        <a href="fractional-coo.html" class="svc-link">Learn more →</a>
      </div>
      <div class="svc reveal" style="transition-delay:0.2s;">
        <div class="svc-tag">03 · Executive Advisory</div>
        <div class="svc-icon">🏆</div>
        <div class="svc-title">Executive Advisory</div>
        <div class="svc-desc">Whatever C-suite role your business needs most right now, I step in, align with your vision, and deliver senior leadership on demand.</div>
        <div class="svc-list">
          <div class="svc-list-item">Business transformation strategy</div>
          <div class="svc-list-item">Investor prep &amp; growth playbooks</div>
          <div class="svc-list-item">Executive coaching &amp; mentoring</div>
          <div class="svc-list-item">M&amp;A readiness &amp; positioning</div>
          <div class="svc-list-item">Crisis management &amp; turnaround</div>
        </div>
        <a href="executive-advisory.html" class="svc-link">Learn more →</a>
      </div>
    </div>
  </div>
</section>

<!-- ABOUT -->
<section class="about-section" id="about">
  <div class="about-inner">
    <div class="about-visual reveal">
      <div class="about-img-wrap">
        <img src="og-image.jpg" alt="Mark Gabrielli" loading="lazy" onerror="this.parentElement.style.background='#18181F';this.style.display='none'" />
        <div class="about-img-badge">
          <div>
            <div class="aib-name">Mark Gabrielli</div>
            <div class="aib-title">Fractional CMO &amp; COO · WETYR Corp</div>
          </div>
          <div class="aib-status">Available Now</div>
        </div>
      </div>
    </div>
    <div class="about-content reveal" style="transition-delay:0.15s;">
      <div>
        <div class="section-eyebrow">About Mark</div>
        <h2 class="section-h2">Visionary by nature.<br><em>Operator by choice.</em></h2>
        <p class="section-body">I'm Mark Gabrielli - a business strategist operating at the intersection of human psychology and operational excellence. I don't just advise from the sidelines. I embed myself in your organization, identify what's truly broken, and build the systems that fix it for good.</p>
      </div>
      <div class="about-card">
        <div class="about-card-head"><span class="about-card-icon">🎯</span><span class="about-card-title">The Diagnostic Advantage</span></div>
        <div class="about-card-body">Most consultants recommend. I diagnose. Within the first engagement, I identify the hidden constraints - organizational, operational, or psychological - that are capping your growth.</div>
      </div>
      <div class="about-card">
        <div class="about-card-head"><span class="about-card-icon">⚡</span><span class="about-card-title">Speed to Results</span></div>
        <div class="about-card-body">You don't have months to wait for ROI. I build systems that show measurable impact fast - from automating workflows to rebuilding go-to-market strategy from the ground up.</div>
      </div>
      <div class="about-card">
        <div class="about-card-head"><span class="about-card-icon">🧠</span><span class="about-card-title">Psychology Meets Business</span></div>
        <div class="about-card-body">My edge is understanding why people - your customers, your team, your market - do what they do. That insight drives every strategy I build and every decision I guide.</div>
      </div>
      <div class="skills-row">
        <span class="skill">Negotiation</span><span class="skill">Brand Strategy</span>
        <span class="skill">Growth Marketing</span><span class="skill">SaaS Development</span>
        <span class="skill">Team Building</span><span class="skill">Executive Coaching</span>
        <span class="skill">Human Psychology</span><span class="skill">Revenue Operations</span>
        <span class="skill">Content Strategy</span><span class="skill">Management Consulting</span>
      </div>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section class="testi-section" id="testimonials">
  <div class="testi-inner">
    <div class="testi-header reveal">
      <div>
        <div class="section-eyebrow">Social Proof</div>
        <h2 class="section-h2">What clients <em>say.</em></h2>
      </div>
      <a href="testimonials.html" style="font-size:0.875rem;font-weight:600;color:var(--text3);display:flex;align-items:center;gap:6px;">All testimonials →</a>
    </div>
    <div class="testi-grid">
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">Mark diagnosed our marketing problem in the first call. Within 90 days, we had a complete system rebuild - new funnel, new positioning, and leads we could actually close. He sees things others simply miss.</p>
        <div class="testi-person">
          <div class="testi-avatar">R</div>
          <div><div class="testi-name">Robert T.</div><div class="testi-role">CEO, SaaS Platform</div></div>
        </div>
      </div>
      <div class="testi-card reveal" style="transition-delay:0.1s;">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">We hired Mark as a fractional COO and he rewired how we operate entirely. Automation replaced hours of manual work. Our team finally has clarity and our numbers prove it.</p>
        <div class="testi-person">
          <div class="testi-avatar">J</div>
          <div><div class="testi-name">Jennifer M.</div><div class="testi-role">Founder, eCommerce Brand</div></div>
        </div>
      </div>
      <div class="testi-card reveal" style="transition-delay:0.2s;">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">Mark's understanding of human psychology and business strategy is unlike anyone I've worked with. He doesn't just help you grow - he helps you understand why your business was stuck in the first place.</p>
        <div class="testi-person">
          <div class="testi-avatar">D</div>
          <div><div class="testi-name">David K.</div><div class="testi-role">Managing Partner, Fintech Firm</div></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- INDUSTRIES -->
<section class="industries-section" id="proof">
  <div class="industries-inner">
    <div class="industries-header reveal">
      <div>
        <div class="section-eyebrow">Industries</div>
        <h2 class="section-h2">10+ industries.<br><em>One standard.</em></h2>
      </div>
      <p class="section-body" style="max-width:340px;">From OR rooms to SaaS boardrooms - the same diagnostic approach, every time.</p>
    </div>
    <div class="ind-tags reveal" style="transition-delay:0.1s;">
      <span class="ind-tag">SaaS</span><span class="ind-tag">eCommerce</span><span class="ind-tag">Fintech</span>
      <span class="ind-tag">Health Tech</span><span class="ind-tag">Logistics</span><span class="ind-tag">Aerospace</span>
      <span class="ind-tag">Mobile Apps</span><span class="ind-tag">Consumer Brands</span><span class="ind-tag">AI Companies</span>
      <span class="ind-tag">Professional Services</span><span class="ind-tag">Startups</span><span class="ind-tag">Manufacturing</span>
      <span class="ind-tag">Automotive</span><span class="ind-tag">Growth-Stage Companies</span>
    </div>
  </div>
</section>

<!-- SCORECARD -->
<section class="quiz-section" id="scorecard">
  <div class="quiz-wrap">
    <div class="quiz-intro reveal">
      <div class="section-eyebrow" style="justify-content:center;">Free Tool</div>
      <h2 class="section-h2" style="text-align:center;">Is your business leaving<br><em>money on the table?</em></h2>
      <p class="section-body" style="text-align:center;margin:0 auto;">60 seconds. Personalized growth gap analysis.</p>
    </div>
    <div class="quiz-card reveal" style="transition-delay:0.15s;">
      <div class="quiz-top">
        <div>
          <div class="quiz-top-title">Business Health Scorecard</div>
          <div class="quiz-top-sub">7 questions · 60 seconds · Personalized insights</div>
        </div>
        <div class="q-dots" id="qDots">
          <div class="q-dot on"></div><div class="q-dot"></div><div class="q-dot"></div>
          <div class="q-dot"></div><div class="q-dot"></div><div class="q-dot"></div><div class="q-dot"></div>
        </div>
      </div>
      <div class="quiz-content">
        <div class="q-step active" data-step="0">
          <div class="q-text">How clearly defined is your marketing strategy right now?</div>
          <div class="q-opts">
            <button class="q-opt" data-score="1">We're figuring it out as we go</button>
            <button class="q-opt" data-score="2">We have some ideas but no real plan</button>
            <button class="q-opt" data-score="3">We have a strategy but struggle to execute</button>
            <button class="q-opt" data-score="4">We have a clear, documented strategy</button>
          </div>
        </div>
        <div class="q-step" data-step="1">
          <div class="q-text">How well do your operations run day-to-day?</div>
          <div class="q-opts">
            <button class="q-opt" data-score="1">Lots of fires - chaos is normal</button>
            <button class="q-opt" data-score="2">Some processes exist but aren't followed</button>
            <button class="q-opt" data-score="3">Mostly consistent, but inefficiencies exist</button>
            <button class="q-opt" data-score="4">Streamlined and highly efficient</button>
          </div>
        </div>
        <div class="q-step" data-step="2">
          <div class="q-text">How well do you understand your customer's buying triggers?</div>
          <div class="q-opts">
            <button class="q-opt" data-score="1">We don't really think about it</button>
            <button class="q-opt" data-score="2">We have assumptions, unvalidated</button>
            <button class="q-opt" data-score="3">We have decent insight but don't use it</button>
            <button class="q-opt" data-score="4">Deep understanding powering our messaging</button>
          </div>
        </div>
        <div class="q-step" data-step="3">
          <div class="q-text">How effective is your current lead generation?</div>
          <div class="q-opts">
            <button class="q-opt" data-score="1">We rely on referrals and hope</button>
            <button class="q-opt" data-score="2">Some leads coming in, but inconsistent</button>
            <button class="q-opt" data-score="3">Decent pipeline but conversion rates are low</button>
            <button class="q-opt" data-score="4">Consistent, predictable pipeline</button>
          </div>
        </div>
        <div class="q-step" data-step="4">
          <div class="q-text">How aligned is your leadership team?</div>
          <div class="q-opts">
            <button class="q-opt" data-score="1">Pulling in different directions</button>
            <button class="q-opt" data-score="2">Some alignment, but gaps exist</button>
            <button class="q-opt" data-score="3">Generally aligned, with occasional friction</button>
            <button class="q-opt" data-score="4">Fully aligned with clear shared objectives</button>
          </div>
        </div>
        <div class="q-step" data-step="5">
          <div class="q-text">How data-driven are your business decisions?</div>
          <div class="q-opts">
            <button class="q-opt" data-score="1">Mostly gut feeling</button>
            <button class="q-opt" data-score="2">We look at data but not consistently</button>
            <button class="q-opt" data-score="3">We use data but reporting needs work</button>
            <button class="q-opt" data-score="4">Real-time dashboards drive decisions</button>
          </div>
        </div>
        <div class="q-step" data-step="6">
          <div class="q-text">What's your biggest challenge right now?</div>
          <div class="q-opts">
            <button class="q-opt" data-score="2">Not enough leads or customers</button>
            <button class="q-opt" data-score="2">Revenue is inconsistent or plateaued</button>
            <button class="q-opt" data-score="2">Operations are chaotic</button>
            <button class="q-opt" data-score="2">Growing but can't keep up with demand</button>
          </div>
        </div>
        <div class="q-result" id="quizResult">
          <div class="q-ring" id="scoreRing">0%</div>
          <div class="q-result-title" id="resultTitle">Calculating...</div>
          <p class="q-result-desc" id="resultDesc"></p>
          <div class="q-inputs">
            <input class="q-input" type="text" id="leadName" placeholder="Your Name" />
            <input class="q-input" type="text" id="leadCompany" placeholder="Company Name" />
          </div>
          <input class="q-input" type="email" id="leadEmail" placeholder="Business Email" style="width:100%;margin-bottom:0;" />
          <button class="q-submit" onclick="submitLead()">Send Me My Free Business Report</button>
          <p class="q-privacy">No spam. Just your results + a direct line to Mark.</p>
        </div>
      </div>
      <div class="quiz-foot"><span class="q-step-lbl" id="qStepLbl">Question 1 of 7</span></div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-section" id="book">
  <div class="cta-inner reveal">
    <div class="section-eyebrow" style="justify-content:center;">Book a Call</div>
    <h2 class="cta-h2">30 Minutes.<br><em>Clarity Guaranteed.</em></h2>
    <p class="cta-sub">No pitch. No pressure. Just a direct conversation about your biggest challenge - and what to do about it.</p>
    <div class="cta-perks">
      <div class="cta-perk">Your #1 growth constraint identified</div>
      <div class="cta-perk">Frank assessment of your strategy</div>
      <div class="cta-perk">3+ actionable ideas to take away</div>
      <div class="cta-perk">Zero obligation - 100% free</div>
    </div>
    <div class="cta-actions">
      <a href="book.html" class="btn-primary">Book Your Call Now →</a>
      <a href="contact.html" class="btn-secondary">Send a Message</a>
    </div>
    <div class="cta-calendly" id="calendlyHolder">
      <div style="height:520px;display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:0.875rem;">Loading calendar...</div>
    </div>
  </div>
</section>

<!-- BLOG -->
<section class="blog-section" id="blog">
  <div class="blog-inner">
    <div class="blog-header reveal">
      <div>
        <div class="section-eyebrow">Insights</div>
        <h2 class="section-h2">From the <em>field.</em></h2>
      </div>
      <a href="blog.html" class="blog-link">All Articles →</a>
    </div>
    <div class="blog-grid">
      <div class="blog-card reveal" onclick="openModal('blog1')">
        <div class="blog-card-img">📊</div>
        <div class="blog-card-body">
          <div class="blog-pill">Fractional CMO</div>
          <div class="blog-title">Why Your Marketing Isn't Working, And It's Not the Budget</div>
          <div class="blog-excerpt">Most companies throw more money at broken funnels. The real problem is almost never spend - it's strategy, positioning, or psychological misalignment with your customer.</div>
          <div class="blog-meta">Feb 2026 · 5 min read</div>
        </div>
      </div>
      <div class="blog-card reveal" style="transition-delay:0.1s;" onclick="openModal('blog2')">
        <div class="blog-card-img">⚙️</div>
        <div class="blog-card-body">
          <div class="blog-pill">Operations</div>
          <div class="blog-title">The 5 Operational Blind Spots Killing Growth-Stage Companies</div>
          <div class="blog-excerpt">After auditing dozens of growing businesses, the same five operational gaps surface over and over - and almost none of them are visible from the inside.</div>
          <div class="blog-meta">Jan 2026 · 6 min read</div>
        </div>
      </div>
      <div class="blog-card reveal" style="transition-delay:0.2s;" onclick="openModal('blog3')">
        <div class="blog-card-img">🧠</div>
        <div class="blog-card-body">
          <div class="blog-pill">Psychology &amp; Business</div>
          <div class="blog-title">The Human Psychology Framework Every Business Leader Needs</div>
          <div class="blog-excerpt">Understanding why your customers, team, and partners make decisions isn't soft science - it's the hardest business edge you can build. Here's how to build it.</div>
          <div class="blog-meta">Dec 2025 · 7 min read</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div class="footer-main">
    <div class="footer-brand">
      <div class="footer-logo-text">Mark <span>Gabrielli</span></div>
      <p class="footer-about">Fractional CMO, COO &amp; Executive Consultant. I help businesses from $1M to $100M find what's broken, build what scales, and execute what others only talk about.</p>
      <div class="footer-chips">
        <span class="footer-chip">WETYR Founder</span><span class="footer-chip">Fractional C-Suite</span>
        <span class="footer-chip">AI Strategist</span><span class="footer-chip">CST Certified</span>
      </div>
      <div class="footer-socials">
        <a href="https://www.linkedin.com/in/marklgabrielli/" target="_blank" rel="noopener" class="footer-soc">in</a>
        <a href="mailto:mark@markcmo.com" class="footer-soc">@</a>
      </div>
    </div>
    <div class="footer-col"><h4>C-Suite</h4><ul>
      <li><a href="fractional-cmo.html">Fractional CMO</a></li>
      <li><a href="fractional-coo.html">Fractional COO</a></li>
      <li><a href="fractional-ceo.html">Fractional CEO</a></li>
      <li><a href="fractional-cto.html">Fractional CTO</a></li>
      <li><a href="fractional-cfo.html">Fractional CFO</a></li>
      <li><a href="executive-advisory.html">Executive Advisory</a></li>
      <li><a href="services.html">All Services</a></li>
    </ul></div>
    <div class="footer-col"><h4>Marketing</h4><ul>
      <li><a href="demand-generation.html">Demand Generation</a></li>
      <li><a href="lead-generation.html">Lead Generation</a></li>
      <li><a href="content-marketing.html">Content Marketing</a></li>
      <li><a href="account-based-marketing.html">ABM</a></li>
      <li><a href="go-to-market-strategy.html">Go-to-Market</a></li>
      <li><a href="marketing-audit.html">Marketing Audit</a></li>
      <li><a href="marketing-strategy.html">Marketing Strategy</a></li>
    </ul></div>
    <div class="footer-col"><h4>Compare</h4><ul>
      <li><a href="fractional-cmo-cost.html">CMO Cost</a></li>
      <li><a href="fractional-cmo-vs-full-time-cmo.html">vs Full-Time CMO</a></li>
      <li><a href="fractional-cmo-vs-agency.html">vs Agency</a></li>
      <li><a href="fractional-cmo-vs-vp-marketing.html">vs VP Marketing</a></li>
      <li><a href="fractional-cmo-vs-interim-cmo.html">vs Interim CMO</a></li>
      <li><a href="chief-outsiders-alternative.html">Chief Outsiders Alt.</a></li>
    </ul></div>
    <div class="footer-col"><h4>By Stage</h4><ul>
      <li><a href="fractional-cmo-pre-revenue.html">Pre-Revenue</a></li>
      <li><a href="fractional-cmo-series-a.html">Series A</a></li>
      <li><a href="fractional-cmo-series-b.html">Series B</a></li>
      <li><a href="fractional-cmo-bootstrapped-companies.html">Bootstrapped</a></li>
      <li><a href="fractional-cmo-pe-backed-companies.html">PE-Backed</a></li>
      <li><a href="fractional-cmo-venture-capital.html">VC-Backed</a></li>
      <li><a href="best-fractional-cmo.html">Best Fractional CMO</a></li>
    </ul></div>
    <div class="footer-col"><h4>Industries</h4><ul>
      <li><a href="fractional-cmo-saas.html">SaaS</a></li>
      <li><a href="fractional-cmo-healthcare.html">Healthcare</a></li>
      <li><a href="fractional-cmo-fintech.html">Fintech</a></li>
      <li><a href="fractional-cmo-ai.html">AI Companies</a></li>
      <li><a href="fractional-cmo-b2b.html">B2B</a></li>
      <li><a href="fractional-cmo-ecommerce.html">eCommerce</a></li>
      <li><a href="industries.html">All Industries</a></li>
    </ul></div>
    <div class="footer-col"><h4>Cities</h4><ul>
      <li><a href="fractional-cmo-dallas-fort-worth.html">Dallas-Fort Worth</a></li>
      <li><a href="fractional-cmo-greater-houston.html">Houston</a></li>
      <li><a href="fractional-cmo-greater-chicago.html">Chicago</a></li>
      <li><a href="fractional-cmo-greater-atlanta.html">Atlanta</a></li>
      <li><a href="fractional-cmo-greater-miami.html">Miami</a></li>
      <li><a href="fractional-cmo-greater-boston.html">Boston</a></li>
      <li><a href="fractional-cmo-near-me.html">CMO Near Me</a></li>
    </ul></div>
    <div class="footer-col"><h4>Learn</h4><ul>
      <li><a href="blog.html">Insights &amp; Blog</a></li>
      <li><a href="about.html">About Mark</a></li>
      <li><a href="testimonials.html">Testimonials</a></li>
      <li><a href="faq.html">FAQ</a></li>
      <li><a href="contact.html">Contact</a></li>
      <li><a href="https://academy.markcmo.com" target="_blank" style="color:var(--accent);font-weight:600;">🎓 Academy</a></li>
    </ul></div>
  </div>
  <div class="footer-bar">
    <span class="footer-copy">&copy; 2026 Mark Gabrielli · markcmo.com · All rights reserved.</span>
    <div class="footer-bar-links">
      <a href="https://www.linkedin.com/in/marklgabrielli/" target="_blank" rel="noopener">LinkedIn</a>
      <a href="https://x.com/markgcmo" target="_blank" rel="noopener">X / Twitter</a>
      <a href="https://medium.com/@mark_louis_gabrielli_jr" target="_blank" rel="noopener">Medium</a>
      <a href="https://www.tiktok.com/@mark.gabrielli.cmo" target="_blank" rel="noopener">TikTok</a>
    </div>
  </div>
</footer>

<!-- MODALS -->
<div class="modal-overlay" id="modal-blog1">
  <div class="modal-box">
    <button class="modal-close" onclick="closeModal('blog1')">✕</button>
    <div class="modal-tag">Fractional CMO · Feb 2026 · 5 min read</div>
    <div class="modal-title">Why Your Marketing Isn't Working, And It's Not the Budget</div>
    <div class="modal-content">
      <p>I've audited hundreds of marketing programs. The problem almost never comes down to budget.</p>
      <h3>The Real Culprit: Strategic Misalignment</h3>
      <p>When a marketing program underperforms, business owners almost universally believe the answer is more spend. But pouring fuel into a broken engine doesn't make it run - it makes it burn.</p>
      <p>The real issue is almost always: positioning doesn't resonate, the funnel has a structural leak, or messaging doesn't match your customer's psychological triggers.</p>
      <h3>Positioning: The Foundation Everything Depends On</h3>
      <p>Positioning is the answer to: "Why should this exact person choose you, right now, over every other option?" When positioning is weak, even the best creative falls flat.</p>
      <h3>What to Do Instead</h3>
      <p>Before adjusting a single dollar of spend, audit: (1) Can your best customer explain what you do in one sentence? (2) Where does your funnel leak? (3) Does your messaging speak to outcomes, or features and specs?</p>
    </div>
  </div>
</div>
<div class="modal-overlay" id="modal-blog2">
  <div class="modal-box">
    <button class="modal-close" onclick="closeModal('blog2')">✕</button>
    <div class="modal-tag">Operations · Jan 2026 · 6 min read</div>
    <div class="modal-title">The 5 Operational Blind Spots Killing Growth-Stage Companies</div>
    <div class="modal-content">
      <p>Growth creates chaos. The problem is that most companies mistake the symptoms for the disease.</p>
      <h3>Blind Spot #1: Role Ambiguity at Scale</h3>
      <p>Unclear ownership means tasks fall through the cracks, accountability evaporates, and your best people quietly disengage.</p>
      <h3>Blind Spot #2: No Decision Framework</h3>
      <p>When every call goes upstairs, it creates a bottleneck and trains your team not to think.</p>
      <h3>Blind Spot #3: Manual Processes as "Workflows"</h3>
      <p>Across a 20-person company, this typically costs 80-120 hours per week.</p>
      <h3>Blind Spot #4: Misaligned Metrics</h3>
      <p>Activity metrics feel productive. Outcome metrics tell the truth.</p>
      <h3>Blind Spot #5: Culture Drift</h3>
      <p>Rapid hiring during growth phases often dilutes the standards that made your early team great.</p>
    </div>
  </div>
</div>
<div class="modal-overlay" id="modal-blog3">
  <div class="modal-box">
    <button class="modal-close" onclick="closeModal('blog3')">✕</button>
    <div class="modal-tag">Psychology &amp; Business · Dec 2025 · 7 min read</div>
    <div class="modal-title">The Human Psychology Framework Every Business Leader Needs</div>
    <div class="modal-content">
      <p>Business strategy misses the most powerful force in any business - the human beings making decisions inside and outside it.</p>
      <h3>The Decision Architecture Principle</h3>
      <p>Every customer decision is preceded by an emotional state they're trying to move toward or away from. The most effective marketing activates - it moves people emotionally before convincing them logically.</p>
      <h3>Inside the Organization</h3>
      <p>Your team doesn't underperform because they lack skill - they underperform because their psychological needs (autonomy, mastery, belonging, significance) aren't met by the environment you've created.</p>
      <h3>How to Apply This Now</h3>
      <p>Ask your next customer: "What were you afraid would happen if you didn't solve this problem?" That answer reshapes your positioning more than any competitive analysis will.</p>
    </div>
  </div>
</div>

<script>
// Nav scroll
const nav = document.getElementById('mainNav');
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20));

// Mobile nav
const ham = document.getElementById('navHam');
const drawer = document.getElementById('mobileDrawer');
ham.addEventListener('click', () => drawer.classList.toggle('open'));
drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => drawer.classList.remove('open')));

// Reveal
const reveals = document.querySelectorAll('.reveal');
const revIO = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revIO.unobserve(e.target); } });
}, { threshold: 0.07 });
reveals.forEach(el => revIO.observe(el));

// Quiz
let curStep = 0, score = 0;
const STEPS = 7;
function updateDots(s) {
  document.querySelectorAll('.q-dot').forEach((d, i) => d.classList.toggle('on', i <= s));
  const lbl = document.getElementById('qStepLbl');
  if (lbl) lbl.textContent = 'Question ' + (s + 1) + ' of ' + STEPS;
}
document.querySelectorAll('.q-opt').forEach(btn => {
  btn.addEventListener('click', function() {
    this.closest('.q-step').querySelectorAll('.q-opt').forEach(b => b.classList.remove('selected'));
    this.classList.add('selected');
    score += parseInt(this.dataset.score);
    setTimeout(() => {
      this.closest('.q-step').classList.remove('active');
      curStep++;
      if (curStep < STEPS) {
        document.querySelector('.q-step[data-step="' + curStep + '"]').classList.add('active');
        updateDots(curStep);
      } else { showResults(); }
    }, 280);
  });
});
function showResults() {
  document.getElementById('quizResult').classList.add('show');
  const pct = Math.round((score / 28) * 100);
  const ring = document.getElementById('scoreRing');
  ring.style.background = 'conic-gradient(#4F7EFF ' + Math.round(pct/100*360) + 'deg, rgba(255,255,255,0.05) 0deg)';
  ring.textContent = pct + '%';
  let t, d;
  if (pct < 40) { t = '🚨 High-Risk Zone'; d = 'Significant structural gaps in marketing, operations, or both. Fixable fast - but you need a clear diagnosis first.'; }
  else if (pct < 65) { t = '⚠️ Growth is Being Throttled'; d = "You've built a foundation, but specific gaps are quietly capping your potential."; }
  else if (pct < 85) { t = '📈 Strong - But Room to Scale'; d = "Operating well, but there are strategic opportunities not yet fully captured."; }
  else { t = '🏆 High-Performing Operation'; d = "Running a tight ship. The question now: how do you compound what's working?"; }
  document.getElementById('resultTitle').textContent = t;
  document.getElementById('resultDesc').textContent = d;
}
function submitLead() {
  const n = document.getElementById('leadName').value;
  const e = document.getElementById('leadEmail').value;
  const c = document.getElementById('leadCompany').value;
  if (!n || !e) { alert('Please enter your name and email.'); return; }
  document.getElementById('quizResult').innerHTML = '<div style="padding:1rem;"><div style="font-size:2.5rem;margin-bottom:1rem;">✅</div><div style="font-family:Outfit,sans-serif;font-size:1.2rem;font-weight:800;color:#fff;margin-bottom:0.75rem;">You\'re all set, ' + n.split(' ')[0] + '!</div><p style="color:#A1A1AA;margin-bottom:1.5rem;">Your Business Health Report is on its way to <strong style="color:#4F7EFF;">' + e + '</strong>.</p><a href="book.html" class="btn-primary" style="display:inline-flex;">Book a Free Strategy Call →</a></div>';
}

// Modals
function openModal(id) { document.getElementById('modal-' + id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById('modal-' + id).classList.remove('open'); document.body.style.overflow = ''; }
document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', function(e) { if (e.target === this) { this.classList.remove('open'); document.body.style.overflow = ''; } }));

// Calendly
(function() {
  const url = 'https://calendly.com/marklgabriellijr/discovery-call-marketing-clone';
  const holder = document.getElementById('calendlyHolder');
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = 'https://assets.calendly.com/assets/external/widget.css';
  document.head.appendChild(link);
  holder.innerHTML = '<div class="calendly-inline-widget" data-url="' + url + '?hide_gdpr_banner=1&background_color=111118&text_color=ffffff&primary_color=4F7EFF" style="min-width:280px;height:520px;"></div>';
  const s = document.createElement('script');
  s.src = 'https://assets.calendly.com/assets/external/widget.js';
  document.body.appendChild(s);
})();
</script>

</body>`;

const newHtml = `<!DOCTYPE html>
<html lang="en">
<head>
${cleanHead}
${NEW_CSS}
</head>
${NEW_BODY}
</html>`;

fs.writeFileSync(SRC, newHtml, 'utf8');
console.log('✅  index.html redesigned - dark, bold, modern.');
