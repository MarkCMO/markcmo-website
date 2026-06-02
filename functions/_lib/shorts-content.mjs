// _lib/shorts-content.mjs
// Short-form video banks for the MarkCMO playbook. Four distinct formats, each
// rendered with its OWN look by scripts/gen-shorts.js (not the carousel style):
//   STATS    -> big-number "stat reveal"      (navy, giant gold numeral, 4s)
//   MYTHS    -> "myth vs truth" two-card flip  (red card -> gold card, 5s)
//   STORIES  -> "story build" line-by-line     (light paper bg, ink text, 6s)
//   HOTTAKES -> single contrarian line, looping (solid gold bg, ink text, 3s)
//
// Voice: founder-marketing, plain, punchy. House rule: NO em/en dashes, hyphens
// and commas only. Each entry is self-contained so the generator can render it
// without touching the carousel content.

// num = the hero figure; line = the payoff; sub = the one-line takeaway.
export const STATS = [
  { id: 'stat01', kicker: 'Lead response', num: '5x', line: 'Reply in 5 minutes instead of 5 hours and you close up to 5x more of the same leads.', sub: 'Speed is free conversion.' },
  { id: 'stat02', kicker: 'The follow-up', num: '97%', line: '97% of buyers are not ready on day one. The follow-up is the actual business.', sub: 'The fortune is in the follow-up.' },
  { id: 'stat03', kicker: 'Positioning', num: '1', line: 'One sentence that names who it is for and what they get beats a 30-page brand deck.', sub: 'Clarity closes.' },
  { id: 'stat04', kicker: 'Ad spend', num: '$1', line: 'You do not need a big budget. You need one offer that pays you back on the first dollar.', sub: 'Profit first, scale second.' },
  { id: 'stat05', kicker: 'The hook', num: '3s', line: 'You get 3 seconds to stop the scroll. Lead with the result, not the intro.', sub: 'Hook or be skipped.' },
];

// myth = the comfortable lie; truth = the correction.
export const MYTHS = [
  { id: 'myth01', kicker: 'Positioning', myth: 'More posts means more customers.', truth: 'One clear offer beats ten clever posts.' },
  { id: 'myth02', kicker: 'Branding', myth: 'Your logo is your brand.', truth: 'Your promise is your brand. The logo just wears it.' },
  { id: 'myth03', kicker: 'Paid ads', myth: 'Boosting the post is running ads.', truth: 'Boosting buys reach. A funnel buys customers.' },
  { id: 'myth04', kicker: 'Growth', myth: 'You need to go viral.', truth: 'You need 100 right people, not a million wrong ones.' },
  { id: 'myth05', kicker: 'Content', myth: 'Post more and the algorithm rewards you.', truth: 'Post things people save and send. That is the reward.' },
];

// lines = revealed one at a time; punch = the final highlighted payoff.
export const STORIES = [
  { id: 'story01', kicker: 'True story', lines: ['A founder spent $40k on ads.', 'Leads poured in.', 'Almost none closed.', 'We changed one thing.', 'Not the ad. The follow-up.'], punch: 'Same traffic. 3x the customers.' },
  { id: 'story02', kicker: 'Watch this', lines: ['Two businesses.', 'Same exact product.', 'One shouts features.', 'One names the problem.'], punch: 'People buy the problem you solve.' },
  { id: 'story03', kicker: 'Real talk', lines: ['He had 50,000 followers.', 'And zero customers.', 'Likes do not pay invoices.', 'We added one clear ask.'], punch: 'Attention is not income until you ask for the sale.' },
];

// take = a single contrarian statement that loops.
export const HOTTAKES = [
  { id: 'take01', take: 'Your logo is not your brand. Your promise is.' },
  { id: 'take02', take: 'If you cannot say who it is for in one sentence, neither can your customer.' },
  { id: 'take03', take: 'Going viral is a vanity metric. Getting saved is a buying signal.' },
  { id: 'take04', take: 'You do not have a traffic problem. You have an offer problem.' },
  { id: 'take05', take: 'Boosting a post is not marketing. It is renting attention you will lose.' },
];

// ── A/B/C HOOK TEST ───────────────────────────────────────────────────────────
// Same core claim ("you have an offer/leak problem, not a traffic problem"), same
// format (hottake look), same CTA (AUDIT -> /leak-audit), same hashtags. The ONLY
// variable is the hook angle, so engagement deltas isolate the hook. See the
// ATTENTION ARCHITECTURE brief, TEST BACKLOG #1: curiosity-gap vs specificity vs
// identity-callout. take = on-screen line; caption = the IG caption opener (echoes
// the same hook); cta = per-item override consumed by gen-shorts.js.
const ABC_CTA = { word: 'AUDIT', line: 'Comment AUDIT for the free leak audit' };
const ABC_TAIL = 'Most "I need more leads" problems are really "my funnel leaks the leads I already pay for" problems. More traffic just drains faster. Fix the leak first.';
export const ABCTEST = [
  { id: 'abc-curiosity', angle: 'curiosity-gap',   take: 'Your ads are not the reason your ads stopped working.',                cta: ABC_CTA, caption: `Your ads are not the reason your ads stopped working. ${ABC_TAIL}` },
  { id: 'abc-specific',  angle: 'specificity',      take: '9 of 10 businesses buying more traffic are paying to widen a leak.', cta: ABC_CTA, caption: `9 of 10 businesses buying more traffic are paying to widen a leak. ${ABC_TAIL}` },
  { id: 'abc-identity',  angle: 'identity-callout', take: 'If you are a founder blaming the algorithm, you are funding the leak.', cta: ABC_CTA, caption: `If you are a founder blaming the algorithm, you are funding the leak. ${ABC_TAIL}` },
];

export const SHORTS = { stat: STATS, myth: MYTHS, story: STORIES, hottake: HOTTAKES, abc: ABCTEST };
