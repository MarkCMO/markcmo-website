// AUTO-GENERATED. Do not edit.
// CACHE-BUST-2026-06-08T13:00Z-bundle-v3
// The CF Pages bundler appears to hash this shim file and skip the rebuild
// when only the imported netlify/functions/calendly-webhook.js changes. This
// header rotates each time the upstream handler changes so the bundle is
// forced to refresh. If the live audit log lacks handler_version after a
// deploy, bump the version suffix above.
import { dispatchSingle } from '../_lib/netlify-shim.js';
import * as mod from '../../netlify/functions/calendly-webhook.js';
export async function onRequest(context) { return dispatchSingle(mod, context); }
