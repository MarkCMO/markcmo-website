/**
 * LinkedIn Follow Widget — markcmo.com
 * Floating card with follow/connect CTAs + live stats display.
 *
 * ── UPDATE YOUR STATS BELOW ─────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ── CONFIG — update these with your actual LinkedIn stats ── */
  var CFG = {
    profileUrl:  'https://www.linkedin.com/in/marklgabrielli/',
    name:        'Mark Gabrielli',
    title:       'Fractional CMO & COO',
    company:     'WETYR Corp',
    followers:   '12.4K',   // ← paste your real follower count here
    connections: '500+',    // ← or exact number, e.g. "847"
    storageKey:  'mgLiWidgetDismissed',
    hideDays:    30          // days to stay hidden after dismiss
  };

  /* ── Don't show again if recently dismissed ── */
  try {
    var ts = parseInt(localStorage.getItem(CFG.storageKey) || '0', 10);
    if (ts && Date.now() - ts < CFG.hideDays * 864e5) return;
  } catch (e) {}

  /* ── Don't show on admin pages ── */
  if (/admin/i.test(location.pathname)) return;

  /* ── Inject CSS ──────────────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    /* Container */
    '#mg-li-widget{',
      'position:fixed;bottom:28px;left:24px;z-index:9990;',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;',
      'transform:translateY(0);transition:transform .35s cubic-bezier(.22,.61,.36,1);',
    '}',

    /* Card */
    '#mg-li-card{',
      'background:#0d0d10;',
      'border:1px solid rgba(201,168,76,.32);',
      'border-radius:12px;',
      'padding:0;',
      'width:260px;',
      'box-shadow:0 8px 40px rgba(0,0,0,.55),0 2px 8px rgba(0,0,0,.4),inset 0 1px 0 rgba(201,168,76,.1);',
      'overflow:hidden;',
      'transform-origin:bottom left;',
      'animation:mgLiSlideIn .4s cubic-bezier(.22,.61,.36,1) forwards;',
    '}',
    '@keyframes mgLiSlideIn{',
      'from{opacity:0;transform:translateY(20px) scale(.96)}',
      'to{opacity:1;transform:translateY(0) scale(1)}',
    '}',

    /* Gold header bar */
    '#mg-li-header{',
      'background:linear-gradient(135deg,rgba(201,168,76,.18) 0%,rgba(201,168,76,.06) 100%);',
      'border-bottom:1px solid rgba(201,168,76,.18);',
      'padding:14px 14px 12px;',
      'display:flex;align-items:flex-start;gap:10px;position:relative;',
    '}',

    /* Avatar */
    '#mg-li-avatar{',
      'width:44px;height:44px;border-radius:50%;',
      'background:linear-gradient(135deg,#C9A84C 0%,#a07830 100%);',
      'display:flex;align-items:center;justify-content:center;',
      'font-size:16px;font-weight:800;color:#000;flex-shrink:0;',
      'border:2px solid rgba(201,168,76,.5);',
      'letter-spacing:-.5px;',
    '}',

    /* Name + title */
    '#mg-li-info{flex:1;min-width:0;}',
    '#mg-li-name{',
      'font-size:13.5px;font-weight:700;color:#f0ede8;',
      'line-height:1.2;margin-bottom:2px;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
    '}',
    '#mg-li-title{',
      'font-size:11px;color:#999;line-height:1.4;',
      'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;',
    '}',

    /* LinkedIn badge */
    '#mg-li-badge{',
      'position:absolute;top:10px;right:36px;',
      'width:20px;height:20px;border-radius:4px;',
      'background:#0A66C2;',
      'display:flex;align-items:center;justify-content:center;',
      'flex-shrink:0;',
    '}',
    '#mg-li-badge svg{width:13px;height:13px;fill:#fff;}',

    /* Dismiss */
    '#mg-li-dismiss{',
      'position:absolute;top:8px;right:10px;',
      'background:none;border:none;cursor:pointer;',
      'color:#555;font-size:16px;line-height:1;padding:4px;border-radius:4px;',
      'transition:color .15s;',
    '}',
    '#mg-li-dismiss:hover{color:#aaa;}',

    /* Stats row */
    '#mg-li-stats{',
      'display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,.06);',
    '}',
    '.mg-li-stat{',
      'flex:1;padding:10px 0;text-align:center;',
      'border-right:1px solid rgba(255,255,255,.06);',
    '}',
    '.mg-li-stat:last-child{border-right:none;}',
    '.mg-li-stat-val{',
      'font-size:14px;font-weight:800;color:#C9A84C;',
      'font-variant-numeric:tabular-nums;line-height:1;',
    '}',
    '.mg-li-stat-label{',
      'font-size:9.5px;letter-spacing:.04em;text-transform:uppercase;',
      'color:#555;margin-top:3px;',
    '}',

    /* Expertise tags */
    '#mg-li-tags{',
      'padding:8px 12px;',
      'display:flex;flex-wrap:wrap;gap:4px;',
      'border-bottom:1px solid rgba(255,255,255,.06);',
    '}',
    '.mg-li-tag{',
      'font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;',
      'color:#888;background:rgba(255,255,255,.04);',
      'border:1px solid rgba(255,255,255,.07);',
      'border-radius:4px;padding:3px 7px;',
    '}',

    /* CTA buttons */
    '#mg-li-ctas{padding:10px 12px 12px;display:flex;gap:7px;}',
    '#mg-li-follow{',
      'flex:1;padding:9px 0;border-radius:6px;',
      'background:#0A66C2;border:none;cursor:pointer;',
      'font-size:12px;font-weight:700;color:#fff;',
      'letter-spacing:.03em;transition:background .15s;',
      'display:flex;align-items:center;justify-content:center;gap:5px;',
      'text-decoration:none;',
    '}',
    '#mg-li-follow:hover{background:#0856a7;}',
    '#mg-li-connect{',
      'flex:1;padding:9px 0;border-radius:6px;',
      'background:none;border:1px solid rgba(201,168,76,.35);cursor:pointer;',
      'font-size:12px;font-weight:700;color:#C9A84C;',
      'letter-spacing:.03em;transition:all .15s;',
      'display:flex;align-items:center;justify-content:center;gap:5px;',
      'text-decoration:none;',
    '}',
    '#mg-li-connect:hover{background:rgba(201,168,76,.1);border-color:#C9A84C;}',

    /* Pulse dot on follower count */
    '#mg-li-pulse{',
      'display:inline-block;width:6px;height:6px;',
      'border-radius:50%;background:#C9A84C;',
      'margin-right:4px;vertical-align:middle;',
      'animation:mgPulse 2.2s ease-in-out infinite;',
    '}',
    '@keyframes mgPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}',

    /* Mobile: smaller */
    '@media(max-width:480px){',
      '#mg-li-widget{bottom:80px;left:12px;}',
      '#mg-li-card{width:230px;}',
    '}',
  ].join('');
  document.head.appendChild(style);

  /* ── Build widget HTML ───────────────────────────────────────────────────── */
  var wrap = document.createElement('div');
  wrap.id = 'mg-li-widget';

  wrap.innerHTML = [
    '<div id="mg-li-card">',

      /* Header */
      '<div id="mg-li-header">',
        '<div id="mg-li-avatar">MG</div>',
        '<div id="mg-li-info">',
          '<div id="mg-li-name">', CFG.name, '</div>',
          '<div id="mg-li-title">', CFG.title, ' &middot; ', CFG.company, '</div>',
        '</div>',

        /* LinkedIn blue badge */
        '<div id="mg-li-badge">',
          '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
            '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
          '</svg>',
        '</div>',

        '<button id="mg-li-dismiss" aria-label="Close">&#x2715;</button>',
      '</div>',

      /* Stats */
      '<div id="mg-li-stats">',
        '<div class="mg-li-stat">',
          '<div class="mg-li-stat-val"><span id="mg-li-pulse"></span>', CFG.followers, '</div>',
          '<div class="mg-li-stat-label">Followers</div>',
        '</div>',
        '<div class="mg-li-stat">',
          '<div class="mg-li-stat-val">', CFG.connections, '</div>',
          '<div class="mg-li-stat-label">Connections</div>',
        '</div>',
        '<div class="mg-li-stat">',
          '<div class="mg-li-stat-val">15+</div>',
          '<div class="mg-li-stat-label">Years Exp</div>',
        '</div>',
      '</div>',

      /* Expertise tags */
      '<div id="mg-li-tags">',
        '<span class="mg-li-tag">CMO</span>',
        '<span class="mg-li-tag">COO</span>',
        '<span class="mg-li-tag">CEO</span>',
        '<span class="mg-li-tag">CFO</span>',
        '<span class="mg-li-tag">CTO</span>',
        '<span class="mg-li-tag">Fractional</span>',
      '</div>',

      /* CTAs */
      '<div id="mg-li-ctas">',
        '<a id="mg-li-follow" href="', CFG.profileUrl, '" target="_blank" rel="noopener noreferrer">',
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">',
            '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
          '</svg>',
          'Follow',
        '</a>',
        '<a id="mg-li-connect" href="', CFG.profileUrl, '" target="_blank" rel="noopener noreferrer">',
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">',
            '<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-3-9a9 9 0 100 18A9 9 0 0012 3zm0-2C5.373 1 1 5.373 1 12s4.373 11 11 11 11-4.373 11-11S18.627 1 12 1z"/>',
          '</svg>',
          'Connect',
        '</a>',
      '</div>',

    '</div>',
  ].join('');

  /* ── Mount + dismiss logic ───────────────────────────────────────────────── */
  function mount() {
    document.body.appendChild(wrap);

    document.getElementById('mg-li-dismiss').addEventListener('click', function () {
      wrap.style.transform = 'translateY(120%)';
      wrap.style.opacity = '0';
      wrap.style.transition = 'transform .3s ease, opacity .25s ease';
      setTimeout(function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }, 320);
      try { localStorage.setItem(CFG.storageKey, String(Date.now())); } catch (e) {}
    });
  }

  /* Small delay so it doesn't flash on first paint */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(mount, 900); });
  } else {
    setTimeout(mount, 900);
  }

}());
