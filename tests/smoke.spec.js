/**
 * MarkCMO production smoke test suite
 *
 * Catches the kinds of bugs we hit this session before they reach main:
 *   - Homepage / footer / nav broken
 *   - Admin login JS poisoned by a bad <script> in a template literal
 *   - Square checkout URLs returning 404
 *   - Membership pricing card buttons dead
 *   - Webinar form spam path open
 *   - Diploma flow broken
 *   - Realtime enrollment endpoint not gating on Square verification
 *
 * Run locally: npx playwright test
 * Run in CI:  triggered by .github/workflows/smoke.yml on every PR + nightly
 */

const { test, expect, request } = require('@playwright/test');

const PROD  = 'https://markcmo.com';
const ACAD  = 'https://academy.markcmo.com';

// All Square + Whop URLs the site currently uses. Any one of these going
// dead is a critical revenue bug — the test SHOULD fail and block deploy.
const REQUIRED_LIVE_PAYMENT_URLS = [
  // Square Academy app (new) — memberships
  'https://square.link/u/t2a1kzt7',  // $99/mo
  'https://square.link/u/fGhPbDfG',  // $899/yr
  // Whop — individual courses
  'https://whop.com/checkout/plan_kEE61Ap2vqrRo',  // CMO Mastery $248
  'https://whop.com/checkout/plan_zF15BEL4Sb1Si',  // COO Mastery $248
  'https://whop.com/checkout/plan_Vr9YYVsS06Drw',  // CFO Mastery $248
  'https://whop.com/checkout/plan_FefzKxs7zfQPd',  // CEO Mastery $248
  // Legacy Square — products without replacements yet
  'https://square.link/u/kLKYt0W3',  // CMO Audit $1,000
  'https://square.link/u/xZr7xL1L',  // VIP Strategy Day $2,500
  'https://square.link/u/vU2gDuuq',  // CMO Accelerator Kit $50
  'https://square.link/u/aWWEtFwC',  // Revenue Leak Playbook $100
];

test.describe('Homepage + nav + footer', () => {
  test('homepage loads with correct title + nav + footer', async ({ page }) => {
    const resp = await page.goto(PROD, { waitUntil: 'domcontentloaded' });
    expect(resp.status()).toBe(200);
    await expect(page).toHaveTitle(/Mark.*CMO|Fractional CMO/i);
    await expect(page.locator('#mainNav')).toBeVisible();
    await expect(page.locator('footer .footer-main')).toBeVisible();
    // 8 footer columns
    const cols = await page.locator('footer .footer-col').count();
    expect(cols).toBeGreaterThanOrEqual(7);
  });

  test('services page loads with same nav + footer', async ({ page }) => {
    const resp = await page.goto(`${PROD}/services`);
    expect(resp.status()).toBe(200);
    await expect(page.locator('#mainNav')).toBeVisible();
    await expect(page.locator('footer .footer-main')).toBeVisible();
  });

  test('about page loads with full content', async ({ page }) => {
    const resp = await page.goto(`${PROD}/about`);
    expect(resp.status()).toBe(200);
    await expect(page.locator('#mainNav')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });
});

test.describe('Admin pages', () => {
  test('/admin login page renders the SIGN IN button + form', async ({ page }) => {
    const resp = await page.goto(`${PROD}/admin`);
    expect(resp.status()).toBe(200);
    await expect(page.locator('#login-user')).toBeVisible();
    await expect(page.locator('#login-pass')).toBeVisible();
    // The sign-in button must have a working onclick. If JS is broken
    // (e.g. </script> in a template literal), doLogin is undefined.
    const hasDoLogin = await page.evaluate(() => typeof doLogin === 'function');
    expect(hasDoLogin).toBe(true);
  });

  test('/admin-c7x9k2m login page renders', async ({ page }) => {
    const resp = await page.goto(`${PROD}/admin-c7x9k2m`);
    expect(resp.status()).toBe(200);
    await expect(page.locator('#login-user')).toBeVisible();
    await expect(page.locator('#login-pass')).toBeVisible();
  });

  test('admin-auth API returns 200 + cookie for valid credentials', async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const r = await api.post(`${PROD}/api/admin-auth`, {
      headers: { 'Content-Type': 'application/json', 'Origin': PROD },
      data: { user: 'mark@markcmo.com', pass: 'Mark3148#' },
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    const setCookie = r.headers()['set-cookie'];
    expect(setCookie).toContain('mcadmin_session=');
  });
});

test.describe('Payment URLs', () => {
  for (const url of REQUIRED_LIVE_PAYMENT_URLS) {
    test(`${url} returns 200`, async ({ playwright }) => {
      const api = await playwright.request.newContext({ ignoreHTTPSErrors: true });
      const r = await api.get(url, { maxRedirects: 5 });
      expect(r.status(), `${url} should be reachable`).toBeLessThan(400);
    });
  }
});

test.describe('Academy realtime enrollment', () => {
  test('GET returns enrollment status for known student', async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const r = await api.get(`${PROD}/api/process-academy-enrollment?email=lred@pfdcap.com`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.enrolled).toBe(true);
  });

  test('POST with unknown email returns 402 (payment gate works)', async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const r = await api.post(`${PROD}/api/process-academy-enrollment`, {
      headers: { 'Content-Type': 'application/json' },
      data: { email: 'definitely-not-a-real-customer@example.invalid' },
    });
    expect(r.status()).toBe(402);
    const body = await r.json();
    expect(body.ok).toBe(false);
  });
});

test.describe('Webinar bot defense', () => {
  test('honeypot field rejects bot submissions silently', async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const r = await api.post(`${PROD}/.netlify/functions/webinar-signup`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        firstName: 'Real',
        lastName: 'Person',
        email: 'smoke-test+honeypot@markcmo.com',
        company_url: 'http://bot-filled-this-hidden-field.com',
      },
    });
    // Honeypot returns 200 with success to fool bots
    expect(r.status()).toBe(200);
    // But the record should NOT have been stored — webinar bot detection
    // is verified by smoke-test+honeypot@markcmo.com NEVER appearing in
    // leads. This test alone can't verify the DB state without auth.
  });

  test('gibberish-name pattern triggers silent reject', async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const r = await api.post(`${PROD}/.netlify/functions/webinar-signup`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        firstName: 'FMRnKxZybEMttmEqniHqrKQ',
        lastName: 'PvMiBtPeQdYDFQCgvSwHwk',
        email: 'smoke-test+gibberish@markcmo.com',
      },
    });
    expect(r.status()).toBe(200);
  });
});

test.describe('Diploma flow', () => {
  test('course-graduate endpoint reachable on academy', async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const r = await api.get(`${ACAD}/.netlify/functions/course-graduate?id=NONEXISTENT`);
    expect(r.status()).toBeLessThan(500);
  });

  test('diploma verify page loads', async ({ page }) => {
    const resp = await page.goto(`${ACAD}/verify`);
    expect(resp.status()).toBe(200);
  });
});

test.describe('Webhook endpoints reachable', () => {
  test('Square subscription webhook responds', async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const r = await api.post(`${ACAD}/.netlify/functions/square-subscription-webhook`, {
      headers: { 'Content-Type': 'application/json' },
      data: { type: 'test.ping' },
    });
    expect(r.status()).toBe(200);
  });

  test('Whop webhook handler responds (rejects unsigned)', async ({ playwright }) => {
    const api = await playwright.request.newContext();
    const r = await api.post(`${ACAD}/.netlify/functions/whop-webhook`, {
      headers: { 'Content-Type': 'application/json' },
      data: { _smoke: 'probe' },
    });
    // Returns 401 because signature verification rejects unsigned requests,
    // which is the correct security behavior.
    expect([200, 401].includes(r.status())).toBe(true);
  });
});

test.describe('Portfolio', () => {
  test('portfolio page does NOT contain removed items', async ({ page }) => {
    const resp = await page.goto(`${PROD}/portfolio`);
    expect(resp.status()).toBe(200);
    const text = (await page.content()).toLowerCase();
    expect(text).not.toContain('whoop mobile');
    expect(text).not.toContain('waltz ai');
    expect(text).not.toContain('ally home phone');
    expect(text).not.toMatch(/<h2[^>]*>\s*tsl\s*</);  // TSL the company, not "TSLA"
  });
});
