// AUTO-GENERATED hybrid route: HTML page from KV, API via ?action= param
import { dispatchSingle } from '../_lib/netlify-shim.js';
import * as mod from '../../netlify/functions/public-blog.js';
export async function onRequest(context) {
  const url = new URL(context.request.url);
  // API calls include ?action= — dispatch to the Netlify function handler
  if (url.searchParams.has('action')) {
    return dispatchSingle(mod, context);
  }
  // No action param — fall through to root [[path]].js KV page server
  return context.next();
}
