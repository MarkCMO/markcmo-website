// _middleware.js - Global maintenance banner for CF Pages
// Toggle: wrangler pages secret put MAINTENANCE_MESSAGE --project-name=<site>
// Disable: wrangler pages secret delete MAINTENANCE_MESSAGE --project-name=<site>

const BANNER_CSS = `
  #maint-bar{
    position:fixed;top:0;left:0;right:0;z-index:99999;
    background:#0f172a;
    border-bottom:2px solid #f97316;
    color:#f1f5f9;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;
    font-size:13.5px;font-weight:450;letter-spacing:0.01em;
    padding:11px 48px;
    display:flex;align-items:center;justify-content:center;gap:8px;
    box-shadow:0 2px 16px rgba(0,0,0,.4);
    text-align:center;line-height:1.4;
  }
  #maint-bar .maint-icon{font-size:15px;flex-shrink:0;opacity:.9;}
  #maint-bar .maint-label{
    font-weight:700;color:#fb923c;
    font-size:13.5px;margin-right:4px;
    text-transform:uppercase;letter-spacing:0.06em;font-size:11px;
  }
  #maint-bar .maint-sep{color:#475569;margin:0 6px;}
  #maint-bar .maint-text{color:#cbd5e1;}
  #maint-bar .maint-close{
    position:absolute;right:14px;top:50%;transform:translateY(-50%);
    background:none;border:none;color:#64748b;font-size:18px;
    cursor:pointer;line-height:1;padding:4px 8px;transition:color .15s;
  }
  #maint-bar .maint-close:hover{color:#f1f5f9;}
  body{padding-top:46px !important;}
`;

const BANNER_SCRIPT = `
  (function(){
    var bar=document.getElementById('maint-bar');
    if(!bar)return;
    var key='maint_v2_'+encodeURIComponent(bar.dataset.msg||'').slice(0,40);
    if(sessionStorage.getItem(key)){bar.style.display='none';document.body.style.paddingTop='0';return;}
    bar.querySelector('.maint-close').addEventListener('click',function(){
      bar.style.display='none';document.body.style.paddingTop='0';sessionStorage.setItem(key,'1');
    });
  })();
`;

class HeadInjector {
  constructor(css) { this.css = css; }
  element(el) {
    el.append(`<style>${this.css}</style>`, { html: true });
  }
}

class BodyBannerInjector {
  constructor(message) { this.message = message; }
  element(el) {
    const safe = this.message.replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const html = `<div id="maint-bar" data-msg="${safe}">
  <span class="maint-icon">&#9888;</span>
  <span class="maint-label">Maintenance</span>
  <span class="maint-sep">&mdash;</span>
  <span class="maint-text">${safe}</span>
  <button class="maint-close" aria-label="Dismiss">&times;</button>
</div>
<script>${BANNER_SCRIPT}<\/script>`;
    el.prepend(html, { html: true });
  }
}

export async function onRequest(context) {
  const { request, env, next } = context;

  const message = (env.MAINTENANCE_MESSAGE || '').trim();

  if (!message) return next();

  const url = new URL(request.url);
  const ext = url.pathname.split('.').pop().toLowerCase();
  const skipExts = new Set(['css','js','json','xml','txt','ico','png','jpg','jpeg','webp','svg','gif','woff','woff2','ttf','pdf','zip','map']);
  if (skipExts.has(ext)) return next();
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const response = await next();

  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;

  return new HTMLRewriter()
    .on('head', new HeadInjector(BANNER_CSS))
    .on('body', new BodyBannerInjector(message))
    .transform(response);
}
