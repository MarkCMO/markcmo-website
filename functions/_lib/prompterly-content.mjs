// _lib/prompterly-content.mjs
// STAGED Prompterly promo carousels - NOT yet wired into the @markcmo autoposter.
// These promote the Prompterly app (AI prompt helper; one-time IAP, 5 free
// sessions then pay). Kept separate from daily-content.mjs on purpose: @markcmo
// is Mark's fractional-CMO personal brand, so app-promo should run on a Prompterly
// account (or be approved before mixing into the personal-brand rotation).
//
// To generate slide assets:   node scripts/gen-slides.js  (after wiring) OR a
// dedicated run. To go live, Mark decides the target IG account, then we point
// an autoposter at this bank.
//
// Set PROMPTERLY_LINK to the real App Store URL before shipping.

export const PROMPTERLY_LINK = 'apps.apple.com/app/prompterly'; // TODO: replace with the live App Store URL
export const PROMPTERLY_HASHTAGS = '#chatgpt #aiprompts #promptengineering #aitools #productivity #chatgpttips #aihacks #promptly #artificialintelligence #aiassistant';

export const PROMPTERLY_DAYS = [
  {
    day: 1, kind: 'carousel', app: 'prompterly',
    title: 'Why ChatGPT Gives You Generic Answers', format: 'Carousel - 7 slides', pillar: 'PROBLEM/FIX',
    slides: [
      { k: 'AI PROMPTS', h: 'Why ChatGPT gives you generic, useless answers (and the 30-second fix).', b: '(Hook slide. No body text.)' },
      { k: 'THE REASON', h: 'You are asking, not directing.', b: '"Write me a caption" gives everyone the same average answer. The model fills the gaps you left blank with the most generic option.' },
      { k: 'FIX 1', h: 'Give it a role.', b: '"You are a senior copywriter for a fitness brand." A role narrows the model to the right voice instantly.' },
      { k: 'FIX 2', h: 'Give it context.', b: 'Who is it for, what is the goal, what is the tone. The model is only as specific as the brief you hand it.' },
      { k: 'FIX 3', h: 'Show an example.', b: 'Paste one example of what good looks like. One sample beats five paragraphs of instructions.' },
      { k: 'THE RESULT', h: 'Same model. 10x better output. Every time.', b: 'Save this. The gap is never the AI, it is the prompt.' },
      { k: 'CTA', h: 'Want the prompts done for you?', b: `Prompterly writes pro-level prompts in seconds. Download it -> ${PROMPTERLY_LINK}` },
    ],
    caption: `ChatGPT is not the problem, your prompt is. Here is the 30-second fix that turns generic answers into pro-level output. Save it. Want it done for you? Prompterly builds the prompt for you. Link in bio.`,
    cta: 'Save this + download Prompterly.',
  },
  {
    day: 2, kind: 'carousel', app: 'prompterly',
    title: 'The 5-Part Prompt Formula', format: 'Carousel - 8 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'STEAL THIS', h: 'The 5-part formula behind every prompt that actually works.', b: '(Hook slide. No body text.)' },
      { k: 'PART 1', h: 'Role.', b: 'Tell it who to be. "You are an expert email marketer." This sets the skill level and the voice.' },
      { k: 'PART 2', h: 'Task.', b: 'One clear job. "Write a 3-email welcome sequence." Vague task, vague result.' },
      { k: 'PART 3', h: 'Context.', b: 'The details only you know. Audience, product, goal, constraints. This is where the magic lives.' },
      { k: 'PART 4', h: 'Format.', b: 'Tell it how to answer. Bullet points, a table, 50 words, no jargon. Shape the output up front.' },
      { k: 'PART 5', h: 'Example.', b: 'Show one sample of good. The model copies patterns better than it follows rules.' },
      { k: 'PUT IT TOGETHER', h: 'Role + Task + Context + Format + Example = a prompt that delivers.', b: 'Save this and use it on your next prompt.' },
      { k: 'CTA', h: 'Skip the formula. Let Prompterly build it.', b: `Pro prompts in seconds, no guessing -> ${PROMPTERLY_LINK}` },
    ],
    caption: `Every great AI output comes from the same 5-part prompt formula: Role, Task, Context, Format, Example. Save it. Or skip the work and let Prompterly build the prompt for you. Link in bio.`,
    cta: 'Save this + download Prompterly.',
  },
  {
    day: 3, kind: 'carousel', app: 'prompterly',
    title: 'Stop Typing "Write Me A..."', format: 'Carousel - 7 slides', pillar: 'CONTRARIAN',
    slides: [
      { k: 'STOP', h: 'Stop typing "write me a..." into ChatGPT. It is why your results are mid.', b: '(Hook slide. No body text.)' },
      { k: 'THE TRAP', h: '"Write me a..." asks the model to guess.', b: 'And it guesses average, because you gave it nothing to aim at.' },
      { k: 'INSTEAD 1', h: 'Start with who it is for.', b: 'The audience changes everything. Lead with it and the whole answer sharpens.' },
      { k: 'INSTEAD 2', h: 'Name the outcome you want.', b: 'More replies? More clicks? Say it. The model optimizes for the goal you make explicit.' },
      { k: 'INSTEAD 3', h: 'Add one constraint.', b: 'Under 50 words. No emojis. Casual tone. Constraints force quality.' },
      { k: 'THE SHIFT', h: 'Direct it like an employee, not a magic 8-ball.', b: 'You already know the answer you want. Tell it. Save this.' },
      { k: 'CTA', h: 'Let Prompterly direct it for you.', b: `Type your idea, get a pro prompt back -> ${PROMPTERLY_LINK}` },
    ],
    caption: `"Write me a..." is why ChatGPT gives you mid results. Direct it like an employee, not a magic 8-ball. Save this. Want it automatic? Prompterly turns your idea into a pro prompt. Link in bio.`,
    cta: 'Save this + download Prompterly.',
  },
  {
    day: 4, kind: 'carousel', app: 'prompterly',
    title: '7 Prompts That Actually Work', format: 'Carousel - 9 slides', pillar: 'LISTICLE',
    slides: [
      { k: 'STEAL THESE', h: '7 ChatGPT prompts that actually get pro results. Save all 7.', b: '(Hook slide. No body text.)' },
      { k: 'PROMPT 1', h: 'The critic.', b: '"Act as a tough editor. Find the 3 weakest parts of this and fix them."' },
      { k: 'PROMPT 2', h: 'The simplifier.', b: '"Explain this like I am smart but busy. 5 bullets, no jargon."' },
      { k: 'PROMPT 3', h: 'The brainstormer.', b: '"Give me 10 angles on this, ranked from safe to bold."' },
      { k: 'PROMPT 4', h: 'The rewriter.', b: '"Rewrite this in the voice of [person/brand], keep the meaning."' },
      { k: 'PROMPT 5', h: 'The planner.', b: '"Turn this goal into a step-by-step plan with deadlines."' },
      { k: 'PROMPT 6', h: 'The devil.', b: '"Argue the strongest case against this idea so I can stress-test it."' },
      { k: 'PROMPT 7', h: 'The finisher.', b: '"What did I forget? List the gaps before I ship this."' },
      { k: 'CTA', h: 'Want 100s more, built for your task?', b: `Prompterly has a prompt for everything -> ${PROMPTERLY_LINK}` },
    ],
    caption: `7 prompts that turn ChatGPT from a toy into a tool. Save all 7 and use them this week. Want hundreds more built for your exact task? That is Prompterly. Link in bio.`,
    cta: 'Save this + download Prompterly.',
  },
];
