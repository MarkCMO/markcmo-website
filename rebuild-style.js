/**
 * rebuild-style.js
 * Replaces the first embedded <style>…</style> block in index.html
 * with the new "Clean Authority 2026" design system.
 * Run: node rebuild-style.js
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'index.html');
let html = fs.readFileSync(file, 'utf8');

/* ── New embedded CSS ─────────────────────────────────────── */
const NEW_STYLE = `
  <style>
    /* ═══════════════════════════════════════════════════════════
       MARKCMO.COM - HOMEPAGE "CLEAN AUTHORITY" 2026
       White · Midnight · Electric Blue · Sky
       ═══════════════════════════════════════════════════════════ */
    :root {
      --ink:     #0F172A;
      --blue:    #2563EB;
      --blue-h:  #1D4ED8;
      --blue-l:  #3B82F6;
      --blue-p:  #EFF6FF;
      --sky:     #0EA5E9;
      --white:   #FFFFFF;
      --off:     #F8FAFC;
      --mid:     #64748B;
      --muted:   #94A3B8;
      --border:  #E2E8F0;
      --navy:    #0F172A;
      /* legacy aliases used in HTML */
      --gold:    #2563EB;
      --gold-light: #3B82F6;
      --light-grey: #64748B;
      --charcoal:  #F1F5F9;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; overflow-x: hidden; }
    body {
      font-family: 'Barlow', sans-serif;
      background: #FFFFFF;
      color: #0F172A;
      overflow-x: hidden;
    }
    body::before { display: none; }

    /* ─── HERO ─── */
    #hero {
      background: #FFFFFF;
      min-height: 100vh;
      display: grid;
      grid-template-columns: 52fr 48fr;
      align-items: center;
      position: relative;
      overflow: hidden;
    }
    .hero-bg {
      position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(ellipse at 85% 15%, rgba(37,99,235,0.07) 0%, transparent 55%),
        radial-gradient(ellipse at 10% 85%, rgba(14,165,233,0.05) 0%, transparent 50%);
    }
    .hero-grid-lines {
      position: absolute; inset: 0; pointer-events: none;
      background-image:
        linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px);
      background-size: 64px 64px;
    }
    .hero-content {
      display: flex; flex-direction: column; justify-content: center;
      padding: 9rem 4rem 7rem 8vw;
      position: relative; z-index: 1;
      animation: fadeUp 0.8s ease both;
    }
    .hero-eyebrow {
      display: inline-flex; align-items: center; gap: 0.6rem;
      font-family: 'DM Mono', monospace; font-size: 0.68rem;
      letter-spacing: 0.22em; text-transform: uppercase; color: #2563EB;
      margin-bottom: 1.6rem; font-weight: 600;
    }
    .hero-eyebrow::before {
      content: ''; display: block; width: 2rem; height: 2px;
      background: #2563EB; border-radius: 2px;
    }
    h1 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: clamp(4rem, 8vw, 8.5rem);
      font-weight: 400; line-height: 0.9; letter-spacing: 0.01em;
      color: #0F172A; margin-bottom: 1.8rem;
    }
    h1 em { font-style: normal; color: #2563EB; display: block; }
    h1 strong { display: block; font-weight: inherit; color: #0F172A; }
    .hero-sub {
      font-size: 1.1rem; line-height: 1.8; color: #64748B;
      max-width: 500px; margin-bottom: 2.5rem;
    }
    .hero-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: #2563EB; color: #FFFFFF;
      font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; padding: 1rem 2.2rem;
      text-decoration: none; border-radius: 10px;
      box-shadow: 0 4px 20px rgba(37,99,235,0.30);
      transition: all 0.2s; border: none; cursor: pointer;
    }
    .btn-primary:hover { background: #1D4ED8; transform: translateY(-3px); box-shadow: 0 10px 32px rgba(37,99,235,0.38); }
    .btn-ghost {
      display: inline-flex; align-items: center; gap: 0.5rem;
      border: 2px solid rgba(37,99,235,0.30); color: #2563EB;
      font-size: 0.78rem; font-weight: 600; letter-spacing: 0.1em;
      text-transform: uppercase; padding: 1rem 2rem;
      text-decoration: none; border-radius: 10px; background: transparent;
      transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: #2563EB; background: rgba(37,99,235,0.06); color: #1D4ED8; }

    /* Hero visual column */
    .hero-visual {
      position: relative; z-index: 1;
      display: flex; flex-direction: column;
      padding: 9rem 8vw 7rem 2rem;
      animation: fadeUp 0.8s 0.15s ease both;
    }
    .hero-portrait-frame {
      position: relative; width: 100%;
      border-radius: 16px; overflow: hidden; background: #E8F0FF;
    }
    .hero-portrait-frame::before {
      content: ''; position: absolute;
      top: -18px; left: -18px; right: 18px; bottom: 18px;
      border: 2px solid rgba(37,99,235,0.22); border-radius: 16px; z-index: -1;
    }
    .hero-portrait-frame::after {
      content: ''; position: absolute;
      bottom: -18px; right: -18px; left: 18px; top: 18px;
      background: rgba(37,99,235,0.07); border-radius: 16px; z-index: -2;
    }
    .hero-portrait-img {
      width: 100%; display: block; height: 500px;
      object-fit: cover; object-position: center 8%;
    }
    .hero-name-badge {
      background: rgba(255,255,255,0.96); backdrop-filter: blur(12px);
      border: 1px solid rgba(37,99,235,0.14); border-bottom: none;
      border-radius: 10px 10px 0 0;
      padding: 1rem 1.6rem;
      display: flex; justify-content: space-between; align-items: center;
    }
    .badge-title {
      font-family: 'Bebas Neue', sans-serif; font-size: 1.4rem;
      letter-spacing: 0.1em; color: #0F172A;
    }
    .badge-sub {
      font-family: 'DM Mono', monospace; font-size: 0.6rem;
      letter-spacing: 0.15em; text-transform: uppercase; color: #2563EB;
    }
    .hero-stats {
      display: grid; grid-template-columns: repeat(3, 1fr);
      background: #0F172A; border-radius: 0 0 10px 10px; overflow: hidden;
    }
    .hero-stat { padding: 1.3rem 1rem; border-right: 1px solid rgba(255,255,255,0.06); text-align: center; }
    .hero-stat:last-child { border-right: none; }
    .hero-stat-num {
      font-family: 'Bebas Neue', sans-serif; font-size: 2.2rem;
      color: #3B82F6; line-height: 1; margin-bottom: 0.15rem;
    }
    .hero-stat-label {
      font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase;
      color: rgba(255,255,255,0.4); font-family: 'DM Mono', monospace;
    }
    .hero-portfolio-btn {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      background: rgba(37,99,235,0.05); border: 1px solid rgba(37,99,235,0.18);
      border-top: none; border-radius: 0 0 10px 10px;
      padding: 0.85rem 1.4rem; text-decoration: none; transition: all 0.22s;
    }
    .hero-portfolio-btn:hover { background: rgba(37,99,235,0.10); border-color: rgba(37,99,235,0.40); }
    .hpb-icon { font-size: 1rem; color: #2563EB; flex-shrink: 0; }
    .hpb-text { font-family: 'DM Mono', monospace; font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; flex: 1; }
    .hpb-arrow { font-family: 'DM Mono', monospace; font-size: 0.65rem; color: #2563EB; white-space: nowrap; }
    .htb-item { display: flex; align-items: center; gap: 0.6rem; font-size: 0.82rem; color: #64748B; }
    .htb-icon { color: #2563EB; font-size: 0.75rem; flex-shrink: 0; font-weight: 700; width: 14px; }

    /* ─── TICKER ─── */
    .ticker {
      background: #0F172A; padding: 0.72rem 0;
      overflow: hidden; white-space: nowrap;
      border-top: 1px solid rgba(37,99,235,0.18);
      border-bottom: 1px solid rgba(37,99,235,0.18);
    }
    .ticker-inner { display: inline-flex; gap: 3rem; animation: ticker 30s linear infinite; }
    .ticker-item { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.55); }
    .ticker-sep { color: #3B82F6; }
    @keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }

    /* ─── SECTION COMMONS ─── */
    section { padding: 7rem 6vw; position: relative; }
    .section-label {
      font-family: 'DM Mono', monospace; font-size: 0.65rem;
      letter-spacing: 0.22em; text-transform: uppercase; color: #2563EB;
      display: inline-flex; align-items: center; gap: 0.7rem; margin-bottom: 0.8rem;
    }
    .section-label::after { content: ''; display: block; width: 1.8rem; height: 2px; background: #2563EB; border-radius: 2px; }
    h2 {
      font-family: 'Bebas Neue', sans-serif;
      font-size: clamp(2.2rem, 4vw, 3.8rem);
      font-weight: 400; line-height: 1.05; color: #0F172A; margin-bottom: 1.2rem;
    }
    h2 em { font-style: normal; color: #2563EB; }
    .section-body { font-size: 1rem; line-height: 1.8; color: #64748B; max-width: 640px; }

    /* ─── ABOUT ─── */
    #about { background: #F8FAFC; }
    .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center; max-width: 1200px; margin: 0 auto; }
    .about-card {
      background: #FFFFFF; border: 1px solid #E2E8F0;
      border-left: 4px solid #2563EB; border-radius: 0 10px 10px 0;
      padding: 1.4rem 2rem; margin-bottom: 1rem;
      transition: transform 0.22s, box-shadow 0.22s;
    }
    .about-card:hover { transform: translateX(5px); box-shadow: 0 4px 20px rgba(37,99,235,0.08); }
    .about-card-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.2rem; color: #2563EB; margin-bottom: 0.4rem; }
    .about-card p { font-size: 0.88rem; line-height: 1.7; color: #64748B; margin: 0; }
    .skills-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 2rem; }
    .skill-tag {
      font-family: 'DM Mono', monospace; font-size: 0.62rem; letter-spacing: 0.08em;
      text-transform: uppercase; padding: 0.35rem 0.9rem;
      border: 1px solid rgba(37,99,235,0.22); color: #2563EB;
      background: #EFF6FF; border-radius: 999px; font-weight: 600;
    }

    /* ─── SERVICES ─── */
    #services { background: #FFFFFF; }
    .services-header { max-width: 1200px; margin: 0 auto 4rem; }
    .services-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
    .service-card {
      background: #FFFFFF; border: 1px solid #E2E8F0;
      border-top: 4px solid #2563EB; border-radius: 12px;
      padding: 2.5rem 2rem; position: relative;
      transition: all 0.25s; box-shadow: 0 2px 12px rgba(0,0,0,0.04);
    }
    .service-card:hover { transform: translateY(-8px); box-shadow: 0 20px 56px rgba(37,99,235,0.13); border-color: rgba(37,99,235,0.25); }
    .service-num { font-family: 'DM Mono', monospace; font-size: 0.6rem; letter-spacing: 0.2em; color: #94A3B8; margin-bottom: 1.3rem; }
    .service-icon { font-size: 2.2rem; margin-bottom: 1.2rem; display: block; }
    .service-card h3 { font-family: 'Bebas Neue', sans-serif; font-size: 1.8rem; color: #0F172A; margin-bottom: 0.8rem; line-height: 1.1; }
    .service-card p { font-size: 0.9rem; line-height: 1.7; color: #64748B; margin-bottom: 1.5rem; }
    .service-features { list-style: none; }
    .service-features li { font-size: 0.82rem; color: #475569; padding: 0.4rem 0; border-bottom: 1px solid #F1F5F9; display: flex; align-items: center; gap: 0.5rem; }
    .service-features li::before { content: '→'; color: #2563EB; font-size: 0.7rem; flex-shrink: 0; }

    /* ─── PROOF / STATS ─── */
    #proof { background: #0F172A; padding: 7rem 6vw; }
    .proof-container { max-width: 1200px; margin: 0 auto; }
    .proof-container .section-label { color: #3B82F6; }
    .proof-container .section-label::after { background: #3B82F6; }
    .proof-container h2 { color: #FFFFFF; }
    .proof-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; margin-top: 3.5rem; }
    .proof-item { padding: 3rem 2rem; border-right: 1px solid rgba(255,255,255,0.06); text-align: center; transition: background 0.2s; }
    .proof-item:hover { background: rgba(37,99,235,0.08); }
    .proof-item:last-child { border-right: none; }
    .proof-num { font-family: 'Bebas Neue', sans-serif; font-size: 4.5rem; color: #3B82F6; line-height: 1; }
    .proof-label { font-size: 0.68rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.35); margin-top: 0.5rem; font-family: 'DM Mono', monospace; }
    .industries-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 3.5rem; }
    .ind-tag { font-size: 0.75rem; padding: 0.45rem 1rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); color: rgba(255,255,255,0.5); border-radius: 999px; transition: all 0.2s; }
    .ind-tag:hover { background: rgba(37,99,235,0.18); border-color: rgba(37,99,235,0.4); color: #fff; }

    /* ─── SCORECARD ─── */
    #scorecard { background: #F8FAFC; }
    .scorecard-container { max-width: 860px; margin: 0 auto; }
    .scorecard-wrapper { background: #FFFFFF; border: 1px solid #E2E8F0; border-top: 4px solid #2563EB; border-radius: 16px; padding: 3rem; margin-top: 3rem; box-shadow: 0 4px 28px rgba(0,0,0,0.06); }
    .scorecard-header { text-align: center; margin-bottom: 2.5rem; }
    .scorecard-header h3 { font-family: 'Bebas Neue', sans-serif; font-size: 2rem; color: #0F172A; margin-bottom: 0.5rem; }
    .scorecard-header p { color: #64748B; font-size: 0.9rem; }
    .quiz-step { display: none; }
    .quiz-step.active { display: block; }
    .quiz-progress { display: flex; gap: 0.3rem; margin-bottom: 2.5rem; }
    .quiz-progress-dot { flex: 1; height: 4px; background: #E2E8F0; border-radius: 4px; transition: background 0.3s; }
    .quiz-progress-dot.filled { background: #2563EB; }
    .quiz-q { font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem; color: #0F172A; margin-bottom: 1.5rem; }
    .quiz-options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
    .quiz-opt { padding: 1rem 1.2rem; border: 1.5px solid #E2E8F0; background: #F8FAFC; color: #475569; font-size: 0.88rem; cursor: pointer; transition: all 0.2s; text-align: left; border-radius: 10px; }
    .quiz-opt:hover, .quiz-opt.selected { border-color: #2563EB; background: #EFF6FF; color: #1E293B; }
    .quiz-result { display: none; }
    .quiz-result.show { display: block; text-align: center; }
    .result-score-ring { width: 120px; height: 120px; border-radius: 50%; background: conic-gradient(#2563EB 0deg, #E2E8F0 0deg); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; font-family: 'Bebas Neue', sans-serif; font-size: 2.5rem; color: #2563EB; transition: background 1s; }
    .result-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.8rem; color: #0F172A; margin-bottom: 0.8rem; }
    .result-desc { color: #64748B; font-size: 0.9rem; line-height: 1.7; max-width: 500px; margin: 0 auto 2rem; }
    .quiz-input-group { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; margin-bottom: 0.7rem; }
    .quiz-input { width: 100%; background: #F8FAFC; border: 1.5px solid #E2E8F0; color: #0F172A; padding: 0.9rem 1rem; font-family: 'Barlow', sans-serif; font-size: 0.88rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s; border-radius: 10px; }
    .quiz-input:focus { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .quiz-input::placeholder { color: #94A3B8; }
    .quiz-submit { width: 100%; background: #2563EB; color: #FFFFFF; border: none; padding: 1rem; font-family: 'Barlow', sans-serif; font-size: 0.82rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; border-radius: 10px; margin-top: 0.5rem; box-shadow: 0 4px 16px rgba(37,99,235,0.25); }
    .quiz-submit:hover { background: #1D4ED8; transform: translateY(-2px); }

    /* ─── BOOK / CALENDLY ─── */
    #book { background: #FFFFFF; }
    .book-container { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center; }
    .book-left h2 { margin-bottom: 1rem; }
    .book-left p { color: #64748B; font-size: 0.95rem; line-height: 1.8; margin-bottom: 1.5rem; }
    .book-perks { list-style: none; }
    .book-perks li { font-size: 0.88rem; color: #475569; padding: 0.5rem 0; display: flex; align-items: center; gap: 0.6rem; border-bottom: 1px solid #F1F5F9; }
    .book-perks li span { color: #2563EB; font-size: 1rem; }
    .calendly-embed { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; min-height: 580px; display: flex; align-items: center; justify-content: center; }
    .calendly-placeholder { text-align: center; padding: 3rem 2rem; }
    .calendly-placeholder h4 { font-family: 'Bebas Neue', sans-serif; font-size: 1.5rem; color: #0F172A; margin-bottom: 1rem; }
    .calendly-placeholder p { color: #64748B; font-size: 0.85rem; margin-bottom: 1.5rem; }

    /* ─── TESTIMONIALS ─── */
    #testimonials { background: #F8FAFC; }
    .testimonials-header { max-width: 1200px; margin: 0 auto 3rem; }
    .testimonials-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
    .testimonial-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 2.5rem; box-shadow: 0 2px 14px rgba(0,0,0,0.04); transition: all 0.25s; position: relative; }
    .testimonial-card:hover { transform: translateY(-5px); box-shadow: 0 16px 48px rgba(37,99,235,0.10); }
    .testimonial-card::before { content: '"'; font-family: 'Bebas Neue', sans-serif; font-size: 6rem; color: #EFF6FF; line-height: 1; position: absolute; top: 0.5rem; right: 1.5rem; }
    .testimonial-text { font-size: 0.9rem; line-height: 1.8; color: #475569; margin-bottom: 1.5rem; }
    .testimonial-author { display: flex; align-items: center; gap: 0.8rem; }
    .author-avatar { width: 44px; height: 44px; border-radius: 50%; background: #EFF6FF; border: 2px solid rgba(37,99,235,0.18); display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 1.1rem; color: #2563EB; flex-shrink: 0; }
    .author-name { font-weight: 700; font-size: 0.88rem; color: #0F172A; }
    .author-title { font-size: 0.75rem; color: #94A3B8; }

    /* ─── BLOG ─── */
    #blog { background: #FFFFFF; }
    .blog-container { max-width: 1200px; margin: 0 auto; }
    .blog-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3rem; }
    .blog-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
    .blog-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; transition: all 0.25s; text-decoration: none; display: block; box-shadow: 0 2px 14px rgba(0,0,0,0.04); }
    .blog-card:hover { transform: translateY(-6px); box-shadow: 0 16px 48px rgba(37,99,235,0.10); border-color: rgba(37,99,235,0.2); }
    .blog-img { aspect-ratio: 16/9; background: #F1F5F9; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; border-bottom: 1px solid #E2E8F0; }
    .blog-body { padding: 1.8rem; }
    .blog-tag { font-family: 'DM Mono', monospace; font-size: 0.6rem; letter-spacing: 0.15em; text-transform: uppercase; color: #2563EB; margin-bottom: 0.7rem; display: block; }
    .blog-title { font-family: 'Bebas Neue', sans-serif; font-size: 1.3rem; color: #0F172A; line-height: 1.2; margin-bottom: 0.7rem; }
    .blog-excerpt { font-size: 0.82rem; line-height: 1.7; color: #64748B; margin-bottom: 1rem; }
    .blog-meta { font-family: 'DM Mono', monospace; font-size: 0.6rem; color: #94A3B8; }

    /* ─── FOOTER ─── */
    footer {
      background: #0F172A !important;
      border-top: 3px solid #2563EB !important;
      padding: 4.5rem 6vw 2rem !important;
    }
    .footer-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 3rem; margin-bottom: 3rem; }
    .footer-logo { font-family: 'Bebas Neue', sans-serif; font-size: 1.8rem; color: #FFFFFF !important; margin-bottom: 1rem; }
    .footer-logo span { color: #3B82F6 !important; }
    .footer-desc { font-size: 0.85rem; color: rgba(255,255,255,0.42) !important; line-height: 1.7; margin-bottom: 1.5rem; }
    .social-links { display: flex; gap: 0.8rem; }
    .social-link { width: 36px; height: 36px; border: 1px solid rgba(255,255,255,0.12) !important; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.42) !important; text-decoration: none; font-size: 0.8rem; transition: all 0.2s; }
    .social-link:hover { border-color: #3B82F6 !important; color: #3B82F6 !important; background: rgba(37,99,235,0.15); }
    .footer-col h4 { font-family: 'DM Mono', monospace; font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; color: #3B82F6 !important; margin-bottom: 1.2rem; }
    .footer-col ul { list-style: none; }
    .footer-col li { margin-bottom: 0.6rem; }
    .footer-col a { font-size: 0.82rem; color: rgba(255,255,255,0.42) !important; text-decoration: none; transition: color 0.2s; }
    .footer-col a:hover { color: #FFFFFF !important; }
    .footer-bottom { max-width: 1200px; margin: 0 auto; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; }
    .footer-bottom p { font-size: 0.72rem; color: rgba(255,255,255,0.22) !important; }

    /* ─── MODAL ─── */
    .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.82); z-index: 200; overflow-y: auto; backdrop-filter: blur(6px); }
    .modal-overlay.open { display: flex; align-items: flex-start; justify-content: center; padding: 6rem 2rem 3rem; }
    .modal-box { background: #FFFFFF; border-radius: 16px; max-width: 780px; width: 100%; padding: 3rem; position: relative; box-shadow: 0 24px 80px rgba(0,0,0,0.18); }
    .modal-close { position: absolute; top: 1.5rem; right: 1.5rem; background: #F8FAFC; border: 1px solid #E2E8F0; color: #64748B; cursor: pointer; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; transition: all 0.2s; border-radius: 8px; }
    .modal-close:hover { border-color: #2563EB; color: #2563EB; }
    .modal-tag { font-family: 'DM Mono', monospace; font-size: 0.62rem; letter-spacing: 0.15em; text-transform: uppercase; color: #2563EB; margin-bottom: 1rem; }
    .modal-title { font-family: 'Bebas Neue', sans-serif; font-size: 2.2rem; color: #0F172A; line-height: 1.1; margin-bottom: 1.5rem; }
    .modal-content { font-size: 0.93rem; line-height: 1.9; color: #64748B; }
    .modal-content h3 { font-family: 'Bebas Neue', sans-serif; font-size: 1.4rem; color: #0F172A; margin: 1.5rem 0 0.5rem; }
    .modal-content p { margin-bottom: 1rem; }

    /* ─── ANIMATIONS ─── */
    @keyframes fadeUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
    .reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.7s ease, transform 0.7s ease; }
    .reveal.visible { opacity: 1; transform: none; }

    /* ─── CURSOR ─── */
    html, body, * { cursor: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAARCAYAAADUryzEAAAAV0lEQVR42mMQFBT8z0AJABlwbFnIf4oNINsQZAPIMgTdAJINwWYASYbgMoBoQ/AZQJQhhAwgaAguA4iOHXSFJMcKSANME4yNjEkKSLLzxcAbgBwWDPQGAEWguILiE6w1AAAAAElFTkSuQmCC') 0 0, default !important; }

    /* ─── RESPONSIVE ─── */
    @media (max-width: 1100px) {
      #hero { grid-template-columns: 1fr; min-height: unset; }
      .hero-content { padding: 8rem 6vw 3rem; }
      .hero-visual { padding: 1rem 6vw 4rem; }
      .hero-portrait-img { height: 400px !important; }
      .about-grid { grid-template-columns: 1fr; gap: 3rem; }
      .services-grid { grid-template-columns: repeat(2, 1fr); }
      .book-container { grid-template-columns: 1fr; gap: 3rem; }
      .footer-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 768px) {
      section { padding: 5rem 5vw; }
      h1 { font-size: clamp(3rem, 10vw, 5rem) !important; }
      .services-grid { grid-template-columns: 1fr; }
      .proof-grid { grid-template-columns: repeat(2, 1fr); }
      .testimonials-grid { grid-template-columns: 1fr; }
      .blog-grid { grid-template-columns: 1fr; }
      .quiz-options { grid-template-columns: 1fr; }
      .quiz-input-group { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      section { padding: 4rem 5vw; }
      h1 { font-size: clamp(2.8rem, 12vw, 4rem) !important; }
      .hero-actions { flex-direction: column; align-items: stretch; }
      .hero-actions a { text-align: center; }
      .proof-grid { grid-template-columns: 1fr 1fr; }
      .footer-grid { grid-template-columns: 1fr; }
      .hero-portrait-img { height: 280px !important; }
    }
    @media (max-width: 900px) {
      .nav-links { display: none !important; }
      .nav-mobile-links { display: flex !important; }
    }
  </style>`;

/* ── Replace the FIRST <style>…</style> block in <head> ───── */
// Match from the first <style> tag to its closing </style>
const replaced = html.replace(/<style>[\s\S]*?<\/style>/, NEW_STYLE);

if (replaced === html) {
  console.error('ERROR: Could not find <style> block to replace!');
  process.exit(1);
}

/* ── Also fix gold inline JS hover on Academy button ────────── */
const fixedAcademy = replaced
  .replace(/this\.style\.background='#000';this\.style\.color='#C9A84C'/g,
           "this.style.background='#1D4ED8';this.style.color='#FFFFFF'")
  .replace(/this\.style\.background='#C9A84C';this\.style\.color='#000'/g,
           "this.style.background='#2563EB';this.style.color='#FFFFFF'");

fs.writeFileSync(file, fixedAcademy, 'utf8');
console.log('✅  index.html rebuilt with Clean Authority design.');
