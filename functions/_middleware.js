// _middleware.js - Global maintenance banner for CF Pages
// Toggle: wrangler pages secret put MAINTENANCE_MESSAGE --project-name=<site>
// Disable: wrangler pages secret delete MAINTENANCE_MESSAGE --project-name=<site>

const BANNER_CSS = `
  #maint-bar{
    position:fixed;top:0;left:0;right:0;z-index:99999;
    background:#1a1a2e;border-bottom:3px solid #f97316;
    color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-size:14px;padding:10px 48px 10px 16px;
    display:flex;align-items:center;gap:10px;
    box-shadow:0 2px 12px rgba(0,0,0,.35);
  }
  #maint-bar .maint-icon{font-size:18px;flex-shrink:0;}
  #maint-bar .maint-msg{flex:1;line-height:1.4;}
  #maint-bar .maint-msg strong{color:#f97316;}
  #maint-bar .maint-close{
    position:absolute;right:12px;top:50%;transform:translateY(-50%);
    background:none;border:none;color:#aaa;font-size:20px;
    cursor:pointer;line-height:1;padding:4px 8px;
  }
  #maint-bar .maint-close:hover{color:#fff;}
  body{padding-top:52px !important;}
`;

const BANNER_SCRIPT = `
  (function(){
    var key='maint_dismissed_'+encodeURIComponent(document.getElementById('maint-bar').dataset.msg||'');
    if(sessionStorage.getItem(key)){
      document.getElementById('maint-bar').style.display='none';
      document.body.style.paddingTop='0';
      return;
    }
    document.querySelector('.maint-close').addEventListener('click',function(){
      document.getElementById('maint-bar').style.display='none';
      document.body.style.paddingTop='0';
      sessionStorage.setItem(key,'1');
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
    const html = `<div id="maint-bar" data-msg="${this.message.replace(/"/g,'&quot;')}">
  <span class="maint-icon">&#9888;&#65039;</span>
  <span class="maint-msg"><strong>Site Update in Progress</strong> &mdash; ${this.message}</span>
  <button class="maint-close" aria-label="Dismiss">&times;</button>
</div>
<script>${BANNER_SCRIPT}<\/script>`;
    el.prepend(html, { html: true });
  }
}

export async function onRequest(context) {
  const { request, env, next } = context;

  const message = (env.MAINTENANCE_MESSAGE || '').trim();

  // Pass through if no message set
  if (!message) return next();

  // Pass through non-GET requests and non-HTML paths
  const url = new URL(request.url);
  const ext = url.pathname.split('.').pop().toLowerCase();
  const skipExts = new Set(['css','js','json','xml','txt','ico','png','jpg','jpeg','webp','svg','gif','woff','woff2','ttf','pdf','zip']);
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
