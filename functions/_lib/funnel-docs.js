// functions/_lib/funnel-docs.js
// ─────────────────────────────────────────────────────────────────────────────
// The three engagement documents the client e-signs after accepting a proposal:
// a mutual NDA, the engagement letter (scope + fees + term), and the master
// services agreement. Pure merge templates - data in, document HTML out. The
// sign page renders these; /api/funnel/sign records the signature.
//
// Plain, readable contract language. Not a substitute for counsel, but a real,
// merged, signable document - not a placeholder.
// ─────────────────────────────────────────────────────────────────────────────

export const DOC_ORDER = ['nda', 'engagement_letter', 'msa'];
export const DOC_LABELS = {
  nda: 'Mutual Non-Disclosure Agreement',
  engagement_letter: 'Engagement Letter',
  msa: 'Master Services Agreement',
};

const PROVIDER = 'WETYR Corp (operating as MarkCMO)';
const PROVIDER_SHORT = 'MarkCMO';
const GOVERNING = 'the State of Florida';

export function renderDoc(type, ctx = {}) {
  const c = normalize(ctx);
  if (type === 'nda') return { title: DOC_LABELS.nda, html: nda(c) };
  if (type === 'engagement_letter') return { title: DOC_LABELS.engagement_letter, html: engagement(c) };
  if (type === 'msa') return { title: DOC_LABELS.msa, html: msa(c) };
  return { title: 'Document', html: '<p>Document unavailable.</p>' };
}

function normalize(x) {
  const monthly = num(x.monthlyFee);
  const onetime = num(x.onetimeFee);
  return {
    clientName: clean(x.clientName) || 'Client',
    contactName: clean(x.contactName) || '',
    contactTitle: clean(x.contactTitle) || '',
    date: clean(x.date) || todayLabel(x.now),
    tier: clean(x.tier) || '',
    engagementLabel: x.engagementType === 'STRATEGY_PLUS_EXECUTION' ? 'Strategy + Execution (VIP)' : 'Strategy Partnership',
    monthly, monthlyLabel: monthly ? money(monthly) : 'as quoted',
    onetime, onetimeLabel: onetime ? money(onetime) : null,
    termMonths: int(x.termMonths) || 12,
    cadence: clean(x.cadence) || 'Biweekly',
    modules: Array.isArray(x.modules) ? x.modules : [],
    exclusions: Array.isArray(x.exclusions) && x.exclusions.length ? x.exclusions : DEFAULT_EXCLUSIONS,
  };
}

const DEFAULT_EXCLUSIONS = [
  'Paid advertising spend itself (media budget is paid by Client directly to the platforms)',
  'Third-party software, tool, and subscription costs',
  'Design or video production beyond what is named in the scope',
  'Legal, accounting, or tax services',
];

// ── 1. Mutual NDA ────────────────────────────────────────────────────────────
function nda(c) {
  return wrap([
    p(`This Mutual Non-Disclosure Agreement (this "Agreement") is entered into as of ${b(c.date)} by and between ${b(PROVIDER)} ("${PROVIDER_SHORT}") and ${b(c.clientName)} ("Client"). ${PROVIDER_SHORT} and Client are each a "Party" and together the "Parties."`),
    clause('1. Purpose', `The Parties wish to explore and carry out a business relationship in which each may disclose to the other certain confidential and proprietary information. This Agreement governs the protection of that information.`),
    clause('2. Confidential Information', `"Confidential Information" means any non-public information disclosed by one Party (the "Disclosing Party") to the other (the "Receiving Party"), whether oral, written, or electronic, including business strategy, financials, customer and prospect data, marketing plans, pricing, methods, and any information that a reasonable person would understand to be confidential.`),
    clause('3. Obligations', `The Receiving Party shall (a) use the Confidential Information solely for the purpose above, (b) protect it with at least the same degree of care it uses for its own confidential information and no less than reasonable care, and (c) not disclose it to any third party except to its employees, contractors, or advisors who need to know it and are bound by confidentiality obligations no less protective than these.`),
    clause('4. Exclusions', `Confidential Information does not include information that (a) is or becomes public through no fault of the Receiving Party, (b) was lawfully known to the Receiving Party before disclosure, (c) is rightfully received from a third party without restriction, or (d) is independently developed without use of the Confidential Information.`),
    clause('5. Compelled Disclosure', `If the Receiving Party is legally compelled to disclose Confidential Information, it shall give prompt notice to the Disclosing Party (where lawful) and disclose only the portion legally required.`),
    clause('6. Term', `This Agreement begins on the date above and the confidentiality obligations continue for ${b('three (3) years')} after the date of disclosure, or for so long as the information remains a trade secret, whichever is longer.`),
    clause('7. No License; Return', `No license or ownership is granted by disclosure. Upon written request, the Receiving Party will return or destroy the Confidential Information in its possession.`),
    clause('8. Governing Law', `This Agreement is governed by the laws of ${b(GOVERNING)}, without regard to conflict-of-laws principles.`),
    p(`By signing below, each Party agrees to be bound by this Agreement.`),
  ]);
}

// ── 2. Engagement Letter ─────────────────────────────────────────────────────
function engagement(c) {
  const modules = c.modules.length
    ? `<ul class="dl">${c.modules.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`
    : '';
  const onetimeLine = c.onetimeLabel
    ? p(`<b>One-time items.</b> ${b(c.onetimeLabel)} for the audit and onboarding work named in the scope, invoiced at the start of the engagement.`)
    : '';
  return wrap([
    p(`This Engagement Letter confirms the terms under which ${b(PROVIDER)} ("${PROVIDER_SHORT}") will provide fractional marketing leadership services to ${b(c.clientName)} ("Client"), effective ${b(c.date)}.`),
    clause('1. Engagement', `${PROVIDER_SHORT} is engaged as Client's fractional Chief Marketing Officer on the ${b(c.tier || 'agreed')} tier, structured as a ${b(c.engagementLabel)}. ${PROVIDER_SHORT} acts as the strategic engine for Client's revenue growth and ties its work to revenue outcomes, not activity.`),
    clause('2. Scope', `The engagement focuses on the following, sequenced for impact:${modules || ' the priorities agreed during the strategy call and confirmed in the intake.'}`),
    clause('3. Fees', `<b>Retainer.</b> ${b(c.monthlyLabel)}${c.monthly ? ' per month' : ''}, invoiced monthly in advance. The first invoice is due at the start of the engagement and engages the work.`),
    onetimeLine,
    clause('4. Term & Cadence', `The initial term is ${b(c.termMonths + ' months')}, continuing month-to-month thereafter unless either Party gives ${b('30 days')} written notice. Working cadence is ${b(c.cadence.toLowerCase())} with reporting tied to the metrics agreed at kickoff.`),
    clause('5. What is not included', `To prevent scope creep, the following are excluded from the retainer and billed or paid separately:<ul class="dl">${c.exclusions.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`),
    clause('6. Relationship', `This Engagement Letter is governed by and incorporates the Master Services Agreement signed alongside it. Where they conflict on commercial terms (fees, scope, term), this Engagement Letter controls.`),
    p(`By signing below, Client engages ${PROVIDER_SHORT} on these terms.`),
  ]);
}

// ── 3. Master Services Agreement ─────────────────────────────────────────────
function msa(c) {
  return wrap([
    p(`This Master Services Agreement (this "Agreement") is entered into as of ${b(c.date)} between ${b(PROVIDER)} ("${PROVIDER_SHORT}") and ${b(c.clientName)} ("Client") and governs all services provided under any engagement letter or statement of work between the Parties.`),
    clause('1. Services', `${PROVIDER_SHORT} will provide the services described in the applicable engagement letter ("Services") with reasonable skill and care, consistent with professional fractional-CMO standards.`),
    clause('2. Fees & Payment', `Client will pay the fees stated in the engagement letter. Invoices are due on receipt unless stated otherwise. Late amounts may accrue interest at 1.5% per month or the maximum allowed by law. Fees are exclusive of taxes and third-party costs.`),
    clause('3. Term & Termination', `This Agreement continues while any engagement is active. Either Party may terminate an engagement on ${b('30 days')} written notice, or immediately for material breach not cured within 15 days of notice. On termination, Client pays for Services performed through the termination date.`),
    clause('4. Intellectual Property', `Strategy, plans, and deliverables created specifically for Client become Client's property upon full payment. ${PROVIDER_SHORT} retains ownership of its pre-existing methods, frameworks, templates, and know-how, and may use general skills and learnings on other engagements. ${PROVIDER_SHORT} grants Client a perpetual license to use such retained materials embedded in the deliverables.`),
    clause('5. Confidentiality', `Each Party will protect the other's confidential information consistent with the Mutual NDA signed alongside this Agreement, which is incorporated by reference.`),
    clause('6. Warranties & Disclaimer', `${PROVIDER_SHORT} warrants it will perform the Services professionally. ${PROVIDER_SHORT} does not guarantee specific revenue, ranking, or business results, which depend on factors outside its control. Except as stated, the Services are provided "as is" without other warranties.`),
    clause('7. Limitation of Liability', `To the maximum extent permitted by law, neither Party is liable for indirect, incidental, or consequential damages. Each Party's total liability under this Agreement will not exceed the fees paid by Client in the ${b('three (3) months')} preceding the claim.`),
    clause('8. Independent Contractor', `${PROVIDER_SHORT} is an independent contractor, not an employee, partner, or agent of Client. ${PROVIDER_SHORT} may use qualified subcontractors (including other fractional CMOs operating under the ${PROVIDER_SHORT} brand) and remains responsible for the Services.`),
    clause('9. Non-Solicitation', `During the engagement and for 12 months after, neither Party will solicit for employment the other's personnel directly involved in the Services, without written consent.`),
    clause('10. Governing Law & Disputes', `This Agreement is governed by the laws of ${b(GOVERNING)}. The Parties will attempt to resolve disputes in good faith before pursuing other remedies.`),
    clause('11. Entire Agreement', `This Agreement, with the engagement letter and NDA, is the entire agreement between the Parties and supersedes prior discussions. It may be amended only in writing signed by both Parties. Electronic signatures are valid and binding.`),
    p(`By signing below, Client agrees to be bound by this Agreement.`),
  ]);
}

// ── small builders ───────────────────────────────────────────────────────────
function wrap(parts) { return `<div class="doc">${parts.join('')}</div>`; }
function p(html) { return `<p>${html}</p>`; }
function clause(h, body) { return `<h4>${esc(h)}</h4><p>${body}</p>`; }
function b(s) { return `<strong>${esc(s)}</strong>`; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function num(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }
function int(v) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; }
function money(n) { return '$' + Number(n).toLocaleString('en-US'); }
function clean(s) { return String(s == null ? '' : s).trim(); }
function todayLabel(now) {
  const d = now ? new Date(now) : null;
  if (!d || isNaN(d)) return '________________';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
