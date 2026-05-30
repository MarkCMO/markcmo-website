#!/usr/bin/env node
// fix-lead-form-position.js
//
// The catch-all CF Pages Function (functions/[[path]].js) does footer
// replacement on any page whose footer uses .footer-main class without
// site-footer-css. Its replacement strategy slices everything between
// `</footer>` and `</body>`, keeping only <script> tags from that region.
//
// In 27 landing pages the "Talk to Mark / Get Clarity" LEAD FORM v2 section
// was placed AFTER </footer> but before </body> — so it gets silently
// dropped by the server before the page reaches the user. That's why the
// fractional-cmo.html live response is 65KB while the source is 79KB.
//
// This script moves that block to immediately BEFORE <footer> in each
// affected file, which is its structurally-correct position anyway.

'use strict';
const fs = require('fs');
const path = require('path');

const FILES = [
  'b2b-demand-generation.html',
  'best-fractional-cmo-florida.html',
  'best-fractional-cmo.html',
  'cac-ltv-calculator.html',
  'chief-marketing-officer.html',
  'cmo-readiness-quiz.html',
  'faq.html',
  'fractional-cmo-ai.html',
  'fractional-cmo-cost-calculator.html',
  'fractional-cmo-cost.html',
  'fractional-cmo-cybersecurity.html',
  'fractional-cmo-definition.html',
  'fractional-cmo-for-b2b.html',
  'fractional-cmo-for-pe-portfolio.html',
  'fractional-cmo-for-saas.html',
  'fractional-cmo-for-startups.html',
  'fractional-cmo-hospitality.html',
  'fractional-cmo-private-equity.html',
  'fractional-cmo-roi.html',
  'fractional-cmo-tech.html',
  'fractional-cmo-venture-capital.html',
  'fractional-cmo.html',
  'how-to-hire-a-fractional-cmo.html',
  'marketing-budget-calculator.html',
  'marketing-leadership.html',
  'pipeline-calculator.html',
  'what-is-a-fractional-cmo.html',
];

const ROOT = path.resolve(__dirname, '..');
const START_MARKER = '<!-- LEAD FORM v2 -->';
const END_MARKER = '<!-- END LEAD FORM v2 -->';

let movedCount = 0;
let skippedCount = 0;
let errorCount = 0;

for (const f of FILES) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) {
    console.log(`SKIP ${f} (missing)`);
    skippedCount++;
    continue;
  }
  const src = fs.readFileSync(fp, 'utf8');

  const startIdx = src.indexOf(START_MARKER);
  const endIdx = src.indexOf(END_MARKER);
  const footerIdx = src.indexOf('<footer');

  if (startIdx === -1 || endIdx === -1) {
    console.log(`SKIP ${f} (no LEAD FORM v2 markers)`);
    skippedCount++;
    continue;
  }
  if (footerIdx === -1) {
    console.log(`SKIP ${f} (no <footer> found)`);
    skippedCount++;
    continue;
  }

  // If block is already before footer, nothing to do
  if (endIdx < footerIdx) {
    console.log(`SKIP ${f} (already before <footer>)`);
    skippedCount++;
    continue;
  }

  // Extract the full block including markers + trailing newline
  const blockEnd = endIdx + END_MARKER.length;
  const block = src.slice(startIdx, blockEnd);

  // Build the new file:
  //   1. Everything from 0 to <footer> position
  //   2. The block (with one trailing newline to keep formatting)
  //   3. <footer> and everything until startIdx
  //   4. Everything after blockEnd
  // We also want to clean up any stray newlines/whitespace around the
  // original block location.
  const before = src.slice(0, footerIdx);
  const middle = src.slice(footerIdx, startIdx);
  const after = src.slice(blockEnd);

  // Trim trailing whitespace from before so the block sits flush
  const trimmedBefore = before.replace(/\s+$/, '');
  // Trim leading whitespace from after so we don't leave a gap where the
  // block used to be
  const trimmedAfter = after.replace(/^\s+/, '\n');

  const next = trimmedBefore + '\n\n' + block + '\n\n' + middle + trimmedAfter;

  // Sanity check: the block should now appear before the first <footer>
  const newStart = next.indexOf(START_MARKER);
  const newFooter = next.indexOf('<footer');
  if (newStart === -1 || newStart > newFooter) {
    console.log(`ERROR ${f} (move failed sanity check)`);
    errorCount++;
    continue;
  }

  fs.writeFileSync(fp, next);
  console.log(`MOVED ${f}`);
  movedCount++;
}

console.log(`\nDone. moved=${movedCount} skipped=${skippedCount} errors=${errorCount}`);
process.exit(errorCount > 0 ? 1 : 0);
