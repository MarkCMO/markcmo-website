// _daily-content.js
// The 30-day MarkCMO Instagram content bank, structured for the daily
// 6am email (daily-content-email.js). Mirrors the produced files
// 08/09/10/11-weekN-content-ready.md from the Mark Gabrielli Personal Brand folder.
// kind: 'reel' | 'carousel'. Reels use hook/script/onscreen. Carousels use slides.

export const HASHTAGS = '#fractionalcmo #founder #startupmarketing #b2bmarketing #marketingstrategy #founderlife #smallbusinessmarketing #demandgen #gtm #marketingtips';
export const AUDIT_LINK = 'markcmo.com/leak-audit.html';

export const DAYS = [
  // ───────────────────────── WEEK 1 — Name their pain ─────────────────────────
  {
    day: 1, week: 1, theme: 'Name their pain', kind: 'reel', face: true,
    title: 'Identity Reel — PIN THIS', format: 'Reel (face). Pin this once live.', pillar: 'PROOF / BUILD',
    cover: 'The CMO who actually *builds* (gold on "builds")',
    hook: 'I run multiple businesses at once. The thing that makes that possible is the exact same thing most founders are missing: a marketing system.',
    script: `Here is the rare part. Most marketers have never built a company. Most founders have never run real marketing. I do both. I have spent 15 years across healthcare, aerospace, SaaS, and automotive, building companies from zero and scaling teams.

So when I look at a founder's marketing, I do not see campaigns. I see leaks. Places where revenue is quietly draining out, that you cannot see because you are too close to it.

On this account I am going to show you exactly where those leaks are and how to plug them. The same way I do it when a founder hires me as their fractional CMO.

If you are a founder doing your own marketing and you are tired of guessing, follow along. This is for you.`,
    onscreen: ['I build AND market', "Founders don't see leaks", 'I find them', 'Follow if you do your own marketing'],
    caption: `You did not start a company to become a marketer. But if you are doing your own marketing right now, you probably are, and that is usually where the money leaks out.

I am a fractional CMO for founders. I find the leaks and plug them so you can keep building.

Comment AUDIT and I will send you the 9-point leak audit I run on every founder's marketing.`,
    cta: 'Follow + comment AUDIT for the leak checklist.',
  },
  {
    day: 2, week: 1, theme: 'Name their pain', kind: 'reel', face: false,
    title: 'Homepage Teardown', format: 'Reel (faceless screen-record of a generic founder homepage)', pillar: 'TEARDOWN',
    cover: 'Your homepage is *leaking* customers',
    hook: 'Your homepage is costing you customers and you cannot see it. Watch.',
    script: `This is a typical founder homepage. Looks fine. It is leaking in three places.

One. The offer. I have been on this page for ten seconds and I still cannot tell you exactly what they sell or who it is for. A confused buyer never buys. [Highlight the vague headline.]

Two. No proof. It talks about them, their mission, their story. Nowhere does it show me a result somebody else got. Without proof you compete on price. [Scroll past the 'about us' block.]

Three. No capture. If I am not ready to buy today, and 97% of people are not, there is no way for them to follow up with me. The attention they paid for just walks out the door. [Point at the missing email capture.]

Three leaks, on one page, before the fold. This is the kind of thing I find in 60 seconds, and every one of them is fixable this week.`,
    onscreen: ['Leak 1: no clear offer', 'Leak 2: no proof', 'Leak 3: no capture', 'All fixable this week'],
    caption: `Three leaks on one homepage, found in under a minute: no clear offer, no proof, no way to capture the 97% who are not ready to buy yet.

These are not design problems. They are revenue problems.

Comment AUDIT and I will send you the full 9-point check I run on founder marketing.`,
    cta: 'Comment AUDIT, I will send you the full 9-point check.',
  },
  {
    day: 3, week: 1, theme: 'Name their pain', kind: 'carousel',
    title: 'The Money Scaling Cycle', format: 'Carousel — 8 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'FOUNDER MARKETING', h: 'The marketing system that lets one person run multiple businesses. In 7 slides.', b: '(Hook slide. Your face bottom-right. No body text.)' },
      { k: 'THE TRAP', h: 'Founders scale effort, not systems.', b: 'More hustle, more hours, more tabs open. It does not compound. A system runs whether or not you feel like it this week.' },
      { k: 'STAGE 1', h: 'Clarity.', b: 'A stranger should know what you sell, who it is for, and why it wins, in one sentence. Everything downstream is capped by this.' },
      { k: 'STAGE 2', h: 'Capture.', b: '97% of visitors are not ready today. Give them one reason to leave an email or a DM, or you are paying for attention and throwing it away.' },
      { k: 'STAGE 3', h: 'Follow-up.', b: 'Most sales happen on the 5th to 12th touch. Automate the nurture once and it closes the people you would have lost to your inbox.' },
      { k: 'STAGE 4', h: 'Proof and speed.', b: 'Show results before they have to decide, and answer fast. Trust plus speed beats a bigger ad budget.' },
      { k: 'THE WHOLE THING', h: 'Clarity -> Capture -> Follow-up -> Proof. Run on repeat.', b: 'Save this. Audit yourself against it tonight.' },
      { k: 'CTA', h: 'Want the full 9-point version?', b: `Comment AUDIT and I will send it. Or grab it at ${AUDIT_LINK}` },
    ],
    caption: `Most founders scale effort. The ones who win scale a system. Here is the one I run. Save it, then comment AUDIT and I will send you the 9-point leak audit that shows you which stage you are losing money in.`,
    cta: 'Save this + comment AUDIT.',
  },
  {
    day: 4, week: 1, theme: 'Name their pain', kind: 'reel', face: true,
    title: 'One-Sentence Proof Reel', format: 'Reel (face)', pillar: 'PROOF',
    cover: 'One *sentence*. Conversions up.',
    hook: "I added one sentence to a founder's website and their conversions went up. Here is the exact sentence.",
    script: `The site said, and I am barely exaggerating, "We deliver innovative solutions that empower your business." Nobody knows what that means. A confused buyer never buys.

So we replaced it with one line in this format: I help [who] get [result] without [pain], in [timeframe].

For them it became: "I help home-service founders book more jobs without spending on ads, in 30 days."

That is it. Same traffic, same product. The only thing that changed is that a stranger could now instantly tell if it was for them. Clarity is the cheapest growth lever you have, and almost nobody pulls it.

Look at your own homepage right now. Can a stranger pass that test in one sentence? If not, that is leak number one, and it is capping everything else.`,
    onscreen: ["Before: 'innovative solutions'", 'After: I help [who] get [result] without [pain]', 'Same traffic. More sales.', 'Clarity is free.'],
    caption: `The fix to Leak #1 (the Offer Leak) is one sentence: I help [who] get [result] without [pain], in [timeframe]. Put it everywhere, in plain language, no jargon.

Which of these describes your homepage right now? Comment AUDIT and I will send you all 9 leaks to check.`,
    cta: 'Comment AUDIT.',
  },
  {
    day: 5, week: 1, theme: 'Name their pain', kind: 'reel', face: true,
    title: 'Stop Hiring Agencies', format: 'Reel (face). Confident, fair, not ranty.', pillar: 'TEARDOWN',
    cover: 'Stop hiring *agencies*, founders',
    hook: 'Stop hiring marketing agencies, founders. Here is what they are not going to tell you.',
    script: `This is not agency-bashing. Good agencies exist. But here is the structural problem for a founder.

An agency is paid to execute tactics. Run the ads, post the content, ship the deliverables. They are accountable to activity, not to your P&L. So you can pay for twelve months of "marketing" and still have no idea why your pipeline is inconsistent.

What most founders actually need first is not more tactics. It is someone who owns the strategy, finds what is broken, and is accountable to revenue. That is what a fractional CMO does. I sit on your side of the table, diagnose the leaks, and then direct the tactics, including agencies if you have them.

The order matters. Strategy and accountability first. Tactics second. Do it backwards and you are just buying activity and hoping.

If your marketing feels busy but not productive, that is the tell.`,
    onscreen: ['Agencies = tactics', 'Accountable to activity, not revenue', 'Strategy first. Tactics second.', 'Busy does not equal productive'],
    caption: `Not anti-agency. Pro-order-of-operations. Most founders buy tactics before they have strategy and accountability, then wonder why the pipeline is still inconsistent.

Follow for the founder's-eye view of marketing.`,
    cta: "Follow for the founder's-eye view of marketing.",
  },
  {
    day: 6, week: 1, theme: 'Name their pain', kind: 'reel', face: true,
    title: 'Build Log: Daily Monitor', format: 'Reel (face). Show real footage/screens of what you built.', pillar: 'BUILD',
    cover: 'What I shipped this week',
    hook: 'Here is what I actually shipped this week, and the marketing lesson hiding inside it.',
    script: `This week I built a daily health check for one of my sites. Every morning it automatically tests the booking calendar and the lead forms and emails me if anything is broken, before a single customer hits a dead link.

Here is the marketing lesson, and it is leak number eight, the Speed Leak. The fastest way to lose a lead is to make them raise their hand and then hit silence. A broken form, a slow reply, a calendar that does not load. You never even know it happened.

So the principle is: instrument the moment of intent. The second someone tries to buy or book, that path has to work and you have to know instantly if it does not.

You do not need my exact system. You need to go test your own contact form and your own calendar right now, on your phone, like a customer would. Most founders have never done it. That is the leak.`,
    onscreen: ['Built: daily forms + calendar check', 'Leak #8: the Speed Leak', 'Instrument the moment of intent', 'Go test your own form right now'],
    caption: `Shipped a monitor that checks my booking calendar and lead forms every day and alerts me before a customer ever hits a dead link. The lesson for your business: test your own contact form and calendar today, as if you were a customer. The silent failures are the expensive ones.

Building in public, follow along.`,
    cta: 'Building in public, follow along. (soft)',
  },
  {
    day: 7, week: 1, theme: 'Name their pain', kind: 'carousel',
    title: 'The 9 Leaks', format: 'Carousel — 11 slides (use the leak-card component)', pillar: 'PROOF / FRAMEWORK',
    slides: [
      { k: 'FOUNDER MARKETING', h: '9 places founders quietly lose revenue.', b: 'Sub: "Count yours as you swipe." (Hook slide, face bottom-right.)' },
      { k: 'LEAK 01 — THE OFFER', h: 'A stranger cannot tell what you sell in one sentence.', b: 'A confused buyer never buys.' },
      { k: 'LEAK 02 — TRACKING', h: 'You cannot say, with numbers, where your last 10 customers came from.', b: '' },
      { k: 'LEAK 03 — CAPTURE', h: 'Visitors who are not ready to buy leave with no way for you to follow up.', b: '' },
      { k: 'LEAK 04 — FOLLOW-UP', h: 'Leads come in and sit in your inbox until they go cold.', b: '' },
      { k: 'LEAK 05 — PROOF', h: 'Prospects have to decide before they ever see results others got.', b: '' },
      { k: 'LEAK 06 — CHANNEL', h: 'Spread thin across five channels, winning on none.', b: '' },
      { k: 'LEAK 07 — RETARGETING', h: 'Warm visitors who engaged never see your offer a second time.', b: '' },
      { k: 'LEAK 08 — SPEED', h: 'A lead raises their hand and waits hours, or days, for a reply.', b: '' },
      { k: 'LEAK 09 — CONSISTENCY', h: 'Marketing stops the week client work gets busy.', b: '' },
      { k: 'CTA', h: 'How many did you fail?', b: `3 or more is normal and fixable. Comment AUDIT for the full version with the one-week fix for each. ${AUDIT_LINK}` },
    ],
    caption: `9 places founders quietly lose revenue. Most fail 4 to 6 of these and have no idea. Go through all 9, count your leaks, then comment AUDIT and I will send you the full version with the one-week fix for each.

Failing 3 or more? That is the cheapest problem in your business to fix, because the demand is already there.`,
    cta: 'Comment AUDIT for the full version.',
  },

  // ───────────────────────── WEEK 2 — Show the system ─────────────────────────
  {
    day: 8, week: 2, theme: 'Show the system', kind: 'reel', face: true,
    title: 'Effort vs System', format: 'Reel (face)', pillar: 'FRAMEWORK',
    cover: "Stop scaling *effort*",
    hook: 'Most founders try to scale effort. The ones who actually win scale a system. Here is the difference, because it is the whole game.',
    script: `Scaling effort looks like this. More hours. More tabs open. You personally posting, replying, following up, remembering. It works right up until you get busy, and then the whole thing stops. That is not a marketing engine, that is you being the engine.

Scaling a system looks different. The offer is written down so it sells the same whether you are in the room or not. The capture runs on its own. The follow-up emails go out without you touching them. Proof gets shown automatically before anyone has to decide.

Here is the test. If you took a two-week vacation, would your marketing keep producing leads? If the honest answer is no, you do not have a system, you have a to-do list. And a to-do list does not compound.

The good news, you do not need more hours. You need to convert the three or four things you already do by hand into things that run on their own. That is exactly what I build for founders.`,
    onscreen: ["Effort = you're the engine", 'System = runs without you', 'Vacation test: would leads still come?', 'Convert hand-work into auto-work'],
    caption: `Effort does not compound. A system does. The test is simple: if you disappeared for two weeks, would your marketing still produce leads? If not, you are the engine, and that is the ceiling on your growth.

Comment AUDIT and I will send you the 9-point check that shows which parts of your marketing are still running on you instead of running on their own.`,
    cta: 'Comment AUDIT.',
  },
  {
    day: 9, week: 2, theme: 'Show the system', kind: 'reel', face: false,
    title: 'Capture + Follow-up Teardown', format: 'Reel (faceless screen-record of a founder site running paid traffic)', pillar: 'TEARDOWN',
    cover: '97 of 100 just *walked out*',
    hook: 'This founder pays for ads, then lets 97 percent of the traffic walk straight out the door. Watch it leak.',
    script: `Here is the setup. They are running ads, so they are paying for every click. Let me show you what happens to that money.

A hundred people land here. [Show the landing page.] Three of them are ready to buy today, so three convert. Fine. But the other 97 are not ready yet, and look, there is nothing on this page asking for an email, no lead magnet, no reason to stay in touch. So those 97 leave, and there is no way to ever reach them again. That is leak number three, the capture leak.

Now say they did capture an email. Watch what happens next on most founder sites. [Show an empty inbox or no automation.] Nothing. The lead sits there until the founder personally remembers to follow up, which, when client work hits, is never. That is leak number four, the follow-up leak.

So they are paying full price for a hundred visitors and keeping the value of three. The fix is not more ad spend. It is one capture offer plus one automated follow-up sequence, and suddenly the same hundred visitors are worth five or ten times more.`,
    onscreen: ['Paying for 100 clicks', 'Only 3 ready today', 'Leak 3: no capture', 'Leak 4: no follow-up', 'Same traffic, 5-10x the value'],
    caption: `Two leaks that quietly waste most founders' ad budget: no way to capture the 97 percent who are not ready today, and no automated follow-up for the few they do capture. You end up paying for a hundred visitors and keeping three.

Fixing this does not cost more. It makes the spend you already have worth multiples more. Comment AUDIT and I will send you the full 9-point check.`,
    cta: 'Comment AUDIT.',
  },
  {
    day: 10, week: 2, theme: 'Show the system', kind: 'carousel',
    title: 'The 5-Email Sequence', format: 'Carousel — 8 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'FOUNDER MARKETING', h: 'The 5 emails every founder should have running right now.', b: 'Sub: "Set it once. It closes leads while you work." (Hook slide, face bottom-right.)' },
      { k: 'THE LEAK', h: 'Most sales happen on the 5th to 12th touch.', b: 'But most founders send zero. The lead comes in, sits in the inbox, and goes cold. Automate five emails and you catch the people you were losing.' },
      { k: 'EMAIL 1 — DELIVER', h: 'Give them what you promised, instantly.', b: 'They gave you an email for a reason. Send the lead magnet in the first minute. Speed builds trust before you ask for anything.' },
      { k: 'EMAIL 2 — VALUE', h: 'Teach one useful thing. No pitch.', b: 'Day 1 or 2. Solve one small problem they actually have. You are earning the right to their attention, not spending it.' },
      { k: 'EMAIL 3 — STORY', h: 'Show them someone like them.', b: 'Day 3 or 4. A short story of a customer who had their problem and got out of it. They need to see themselves in it.' },
      { k: 'EMAIL 4 — PROOF', h: 'Show the result, with a number.', b: 'Day 5 or 6. A specific before and after. Proof closes the trust gap that pitching never can.' },
      { k: 'EMAIL 5 — OFFER', h: 'Make one clear ask.', b: 'Day 7 or 8. Now you invite them to the next step. By here they trust you, so the ask feels like help, not a pitch.' },
      { k: 'CTA', h: 'This runs while you do client work.', b: `Comment AUDIT and I will show you where else your follow-up leaks. ${AUDIT_LINK}` },
    ],
    caption: `Most founders capture a lead and then go silent until it goes cold. Here is the 5-email sequence that closes those leads for you while you do client work. Steal it slide by slide, then comment AUDIT and I will send you the 9-point audit that shows where else your follow-up is leaking.`,
    cta: 'Save this + comment AUDIT.',
  },
  {
    day: 11, week: 2, theme: 'Show the system', kind: 'reel', face: true,
    title: '400 Dead Leads Proof', format: 'Reel (face)', pillar: 'PROOF',
    cover: 'One email. *Dead* leads woke up.',
    hook: 'A founder had 400 leads sitting dead in a spreadsheet. We sent one email and some of them woke up. Here is what the email did.',
    script: `This founder had been collecting emails for a year and never once mailed them. Four hundred people who at some point raised their hand, then heard nothing. Most founders think those leads are dead. They are not dead, they are just cold.

So we did not get clever. We sent one plain email. No design, no graphics. It said, in normal language, here is the one mistake I see founders in your spot make, here is how to fix it, and if you want me to look at yours, reply to this email.

That is it. Within a day, replies came in. Not all 400, you never get all of them. But a chunk of people who that founder had written off as gone were suddenly back in a conversation.

The lesson is not about the email. It is this, the list you already have is worth more than the traffic you are chasing. Most founders ignore the asset they already paid for and go buy more clicks. Go look at how many leads you are sitting on and have never contacted. That is found money.`,
    onscreen: ['400 leads, never emailed', 'Cold is not dead', 'One plain email', 'Replies in 24 hours', 'Your list = found money'],
    caption: `The leads you already have are worth more than the traffic you are chasing. This founder sat on 400 contacts for a year, sent one plain-text email, and reopened conversations they thought were gone.

How many leads are sitting in your inbox or spreadsheet that you have never followed up with? Comment AUDIT and I will send you the 9 leaks to check, follow-up included.`,
    cta: 'Want me to find yours? Comment AUDIT.',
  },
  {
    day: 12, week: 2, theme: 'Show the system', kind: 'reel', face: true,
    title: '$0 Launch Build Log', format: 'Reel (face). Show real footage/screens of the launch.', pillar: 'BUILD',
    cover: 'I launched it for *$0*',
    hook: 'I launched a product this month with a zero dollar ad budget. Here is the exact play, and the part you can copy.',
    script: `No ad spend. Here is what I did instead, in order.

One. Before I built anything, I posted about the problem it solves for two weeks straight and watched who replied. That told me people actually wanted it, and it gave me a warm list before launch day.

Two. I went back to those exact people, one by one, and told them it was coming. Not a blast, real messages. By launch day I was not talking to strangers, I was talking to people who already raised their hand.

Three. On launch I made one clear offer with a reason to act now, and I sent it to that warm group first, not to the cold public.

Here is the transferable part, and it is leak-adjacent. Most founders build in private, then launch to silence, then scramble to find an audience. Flip it. Build the audience while you build the product, by talking about the problem out loud. Demand first, product second. That is how one person launches without a budget.`,
    onscreen: ['$0 ad budget', '1. Post the problem, watch who replies', '2. DM the hand-raisers', '3. One clear offer, warm list first', 'Demand first, product second'],
    caption: `Launched a product this month with zero ad spend. The whole play: build the audience while you build the product by talking about the problem out loud, so launch day is warm instead of cold. Demand first, product second.

Most founders do it backwards and launch to silence. Follow for more $0 plays you can actually copy.`,
    cta: 'Follow for more $0 plays.',
  },
  {
    day: 13, week: 2, theme: 'Show the system', kind: 'reel', face: true,
    title: "Followers Don't Pay Bills", format: 'Reel (face). Calm, confident.', pillar: 'TEARDOWN',
    cover: "Followers don't pay *bills*",
    hook: 'Your follower count does not pay your bills. Here is the metric that actually does, and why chasing the wrong one keeps founders broke and busy.',
    script: `I know accounts with a hundred thousand followers making no money, and accounts with two thousand booking clients every week. Followers are not the scoreboard. They are a byproduct.

Here is the chain that actually pays you. Content gets saved and shared, because saves and shares mean it was useful, not just entertaining. Useful content drives DMs, people raising their hand. DMs turn into conversations. Conversations turn into booked calls. Booked calls turn into clients. That is the chain. Followers are nowhere in it.

So if you are going to obsess over one number this month, do not make it followers. Make it conversations started. How many people reached out because something you posted named a problem they have. That number maps directly to revenue. Follower count maps to your ego.

Post things that get saved, because a save is someone saying I need to come back to this. That is the signal that you are building a business, not an audience.`,
    onscreen: ['100k followers, $0', '2k followers, booked solid', 'Saves -> DMs -> calls -> clients', 'Chase conversations, not followers'],
    caption: `Followers map to your ego. Conversations started map to your revenue. I know six-figure-follower accounts making nothing and tiny accounts booked solid. The difference is whether the content gets saved and shared, because that is what turns into DMs, calls, and clients.

Chase the number that pays you. Follow for the founder's-eye view of marketing.`,
    cta: 'Follow (soft).',
  },
  {
    day: 14, week: 2, theme: 'Show the system', kind: 'carousel',
    title: 'What a Fractional CMO Does', format: 'Carousel — 9 slides', pillar: 'PROOF',
    slides: [
      { k: 'FOUNDER MARKETING', h: 'What a fractional CMO actually does.', b: 'Sub: "In plain English. Swipe." (Hook slide, face bottom-right.)' },
      { k: 'NOT THIS', h: "It is not 'run my ads' or 'post my content.'", b: 'That is tactics. You can hire a freelancer for tactics. A CMO sits one level up from all of it.' },
      { k: '1 — OWNS THE STRATEGY', h: 'Decides what to do and what to ignore.', b: 'One clear plan tied to revenue, instead of you reacting to whatever marketing idea you saw this week.' },
      { k: '2 — FINDS THE LEAKS', h: 'Diagnoses where revenue is draining.', b: 'Offer, capture, follow-up, proof, speed. Names the broken parts you are too close to see.' },
      { k: '3 — BUILDS THE SYSTEM', h: 'Turns hand-work into things that run on their own.', b: 'Capture, nurture, proof, all automated, so marketing keeps producing when you get busy.' },
      { k: '4 — DIRECTS THE TACTICS', h: 'Points the freelancers and tools at the right target.', b: 'Ads, content, email, whoever runs them now answers to one strategy instead of guessing.' },
      { k: '5 — OWNS THE NUMBER', h: 'Accountable to revenue, not activity.', b: "Not 'we posted 12 times.' Instead, 'here is what it produced and what we change next.'" },
      { k: 'WITHOUT', h: 'All of it without a full-time hire or a long agency retainer.', b: 'You get the senior brain, part-time, pointed at your P&L.' },
      { k: 'CTA', h: 'Doing all 5 of these yourself?', b: `That is the leak. Comment AUDIT or DM me 'CMO'. ${AUDIT_LINK}` },
    ],
    caption: `Founders keep asking what a fractional CMO actually does, so here it is in plain English, no jargon. If you are doing all of this yourself right now, that is the problem. Comment AUDIT and I will show you which part is leaking the most, or DM me and we will talk.`,
    cta: "Comment AUDIT or DM me 'CMO'.",
  },

  // ───────────────────────── WEEK 3 — Build trust + authority ─────────────────
  {
    day: 15, week: 3, theme: 'Build trust + authority', kind: 'reel', face: true,
    title: 'Fix It In This Order', format: 'Reel (face)', pillar: 'FRAMEWORK',
    cover: 'Fix it in this *order*',
    hook: 'If I had to fix a founder\'s marketing in 7 days, here is the exact order I would do it in. The order is the whole point, because most people do it backwards.',
    script: `Most founders fix marketing in random order, whatever feels urgent. That is why it never adds up. Here is the order that actually compounds.

Day one and two, the offer. Can a stranger tell what you sell and who it is for in one sentence. Nothing downstream works until this is clear, so it goes first.

Day three, tracking. You cannot fix what you cannot see. Get to where you can say, with numbers, where your last ten customers came from. One day of setup.

Day four and five, capture. Give the people who are not ready today a reason to leave an email. You are plugging the biggest leak, the 97 percent who currently vanish.

Day six, follow-up. One automated sequence so captured leads do not go cold in your inbox.

Day seven, proof. Put one real result, with a number, in front of people before they have to decide.

Notice the order. Clarity, then visibility, then capture, then follow-up, then proof. Do it backwards, run ads before the offer is clear, and you are just paying to push traffic through a leaking pipe faster.`,
    onscreen: ['Day 1-2: the offer', 'Day 3: tracking', 'Day 4-5: capture', 'Day 6: follow-up', 'Day 7: proof', 'Order is the whole point'],
    caption: `The order matters more than the tactics. Clarity, then tracking, then capture, then follow-up, then proof. Most founders do it backwards, run ads before the offer is even clear, and wonder why the spend disappears.

Comment AUDIT and I will send you the full 9-point checklist in the order I would actually fix them.`,
    cta: 'Comment AUDIT for the full checklist.',
  },
  {
    day: 16, week: 3, theme: 'Build trust + authority', kind: 'reel', face: false,
    title: 'Same Product, Two Marketers', format: 'Reel (faceless side-by-side screen-record of two versions of a page)', pillar: 'TEARDOWN',
    cover: 'Same product. One *wins*.',
    hook: 'Same exact product, two different marketers. One page sells, one page dies. Watch what actually separates them.',
    script: `Identical product. I built two versions of the page so you can see the difference clean.

Version A, the one that dies. The headline talks about the company. "We are passionate about innovative solutions." Below it, a wall of features. Nowhere does it say who this is for or what result you get. A stranger reads it and has no idea if it is for them, so they leave.

Version B, same product. The headline says exactly who it is for and the result they get, in one line. Right under it, one specific proof point with a number. Then one clear next step. That is it.

Here is the lesson. Bad marketing talks about you. Good marketing talks about them, the buyer, their problem, their result. The product did not change. The budget did not change. The only thing that changed is whose story the page tells.

Look at your own homepage. Count how many sentences are about you versus about the customer. If it is mostly you, that is the leak, and it is free to fix today.`,
    onscreen: ['Same product, 2 pages', 'Bad: talks about you', 'Good: talks about them', "Count your 'we' vs 'you'"],
    caption: `Same product, same budget, opposite results. The losing page talks about the company. The winning page talks about the buyer, their problem, their result. That is the entire difference, and it costs nothing to fix.

Go count the 'we' versus 'you' on your homepage. Comment AUDIT and I will send you the full 9-point check.`,
    cta: 'Comment AUDIT.',
  },
  {
    day: 17, week: 3, theme: 'Build trust + authority', kind: 'carousel',
    title: '7 Marketing Truths', format: 'Carousel — 9 slides', pillar: 'BUILD',
    slides: [
      { k: 'FOUNDER MARKETING', h: '15 years of building taught me 7 marketing truths.', b: 'Sub: "Most of them the hard way. Swipe." (Hook slide, face bottom-right.)' },
      { k: 'TRUTH 1', h: 'A confused buyer never buys.', b: 'Clarity beats clever every time. If they have to think about what you do, you already lost them.' },
      { k: 'TRUTH 2', h: 'You do not have a traffic problem.', b: 'Almost nobody does. You have a conversion problem. More traffic into a leaking funnel just loses money faster.' },
      { k: 'TRUTH 3', h: 'The list beats the launch.', b: 'The audience you build before you sell is worth more than any single launch. Build it while you build the product.' },
      { k: 'TRUTH 4', h: 'Proof closes what pitching cannot.', b: 'One specific result with a number beats a paragraph of adjectives. Show, do not claim.' },
      { k: 'TRUTH 5', h: 'Speed is a feature.', b: 'The fastest reply usually wins the deal, not the best one. A lead that waits is a lead that cools.' },
      { k: 'TRUTH 6', h: 'Boring and consistent beats clever and sporadic.', b: 'The founder who posts the same useful thing every week wins over the one chasing a viral moment.' },
      { k: 'TRUTH 7', h: 'You are too close to see your own leaks.', b: 'Every founder is. That is not a weakness, it is why an outside read is worth so much.' },
      { k: 'CTA', h: 'Which of these are you breaking?', b: `Comment AUDIT and I will show you. ${AUDIT_LINK}` },
    ],
    caption: `Building businesses for 15 years taught me these the hard way, mostly by getting them wrong first. Save the ones that hit. Then comment AUDIT if you want me to show you which of these you are currently breaking.`,
    cta: 'Save + follow.',
  },
  {
    day: 18, week: 3, theme: 'Build trust + authority', kind: 'reel', face: true,
    title: 'The Tracking Leak Proof', format: 'Reel (face)', pillar: 'PROOF',
    cover: "'I don't know where they *come from*'",
    hook: 'A founder told me, I do not know where my customers come from. I told him that one sentence was costing him real money. Here is why.',
    script: `He was doing fine, revenue coming in, but when I asked where his last ten customers came from, he genuinely could not tell me. Some ads, some referrals, maybe some from a podcast. He was guessing.

Here is why that is expensive. If you do not know what is working, you cannot do more of it, and you cannot stop doing what is not. So you spread money across everything and hope. You are paying for five channels when two are carrying the whole thing.

The fix is not fancy. We set up one simple way to tag where every lead came from. Ask new leads how they found you. Use basic tracking links. Within a few weeks he could see it plainly, two channels were producing almost everything, and two others he was funding were dead.

He cut the dead ones, put that money into the two winners, and his cost per customer dropped, without spending an extra dollar. That is leak number two, tracking. You cannot scale what you cannot see, and most founders are flying blind.`,
    onscreen: ["Can't name your last 10 customers' sources?", "That's leak #2: tracking", 'Blind = funding dead channels', 'See it, cut the losers, scale the winners'],
    caption: `If you cannot say with numbers where your last ten customers came from, you are funding channels that do not work and starving the ones that do. That is leak number two, and it is one of the cheapest to fix.

You cannot scale what you cannot see. Comment AUDIT and I will send you all 9 leaks to check.`,
    cta: 'Comment AUDIT.',
  },
  {
    day: 19, week: 3, theme: 'Build trust + authority', kind: 'reel', face: true,
    title: 'Something Broke Build Log', format: 'Reel (face). Show the real issue + fix on screen.', pillar: 'BUILD',
    cover: 'Something *broke* this week',
    hook: 'Something broke on one of my sites this week. Here is how I caught it, how I fixed it, and the marketing lesson hiding in it.',
    script: `I am not going to pretend everything I build works the first time. This week a form on one of my sites silently stopped sending. No error, no warning. People were filling it out and the submissions were going nowhere.

I only caught it because I have a daily check that tests my own forms and booking calendar like a customer would, and it emailed me the second it failed. Without that, I would have lost a week of leads and never known.

Here is the lesson, and it is leak number eight, the speed leak, but the silent version. The most expensive failures in your marketing are the ones you never see. A form that quietly breaks. A calendar that will not load on mobile. A reply that never sends. The lead raises their hand, hits silence, and you do not even know it happened.

So the principle is, instrument the moment of intent. Test your own contact form and your own booking link today, on your phone, like a stranger. Most founders have never once done it. Go find out if yours even works.`,
    onscreen: ['A form silently broke', 'Caught it with a daily check', 'Silent failures are the expensive ones', 'Test your own form today'],
    caption: `Real behind-the-scenes: a form on one of my sites silently stopped sending this week. Caught it with a daily check that tests my forms and calendar like a customer would. Without it, a week of leads gone and I would never have known.

The silent failures are the expensive ones. Go test your own contact form and booking link today, on your phone. Building in public, follow along.`,
    cta: 'Follow (soft).',
  },
  {
    day: 20, week: 3, theme: 'Build trust + authority', kind: 'reel', face: true,
    title: 'Traffic vs Conversion', format: 'Reel (face)', pillar: 'TEARDOWN',
    cover: 'Not a *traffic* problem',
    hook: 'You do not have a traffic problem. You have a conversion problem. Here is the 10-second way to tell which one you actually have.',
    script: `Every founder's instinct when sales are slow is the same, I need more traffic. More ads, more reach, more posts. Sometimes that is right. Usually it is not.

Here is how to tell. Look at the traffic you already get. Out of every hundred people who land on your page, how many take any action, an email, a reply, a purchase. If that number is tiny, one or two, more traffic will not save you. You will just lose more people faster. That is a conversion problem, and it lives on your page, not in your ad budget.

A conversion problem is actually good news, because it is cheaper to fix. You are already paying for the attention. Plug the leak, the unclear offer, the missing capture, the no proof, and the exact same traffic suddenly produces multiples more.

So before you spend a dollar getting more people to the page, make the page worth landing on. Pouring traffic into a leaking funnel is the most common, most expensive mistake founders make.`,
    onscreen: ["Slow sales? 'I need more traffic'", 'Usually wrong', 'Few of 100 act = conversion problem', 'Fix the page before buying traffic'],
    caption: `More traffic is the founder's reflex when sales are slow. Usually it is the wrong fix. If only one or two of every hundred visitors take any action, the leak is conversion, not traffic, and that is the cheaper one to fix because you already paid for the attention.

Pouring traffic into a leaking funnel just loses money faster. Comment AUDIT to find your real bottleneck.`,
    cta: 'Comment AUDIT to find your real bottleneck.',
  },
  {
    day: 21, week: 3, theme: 'Build trust + authority', kind: 'carousel',
    title: 'The Founder Marketing Stack', format: 'Carousel — 9 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'FOUNDER MARKETING', h: 'The founder marketing stack: what you actually need.', b: 'Sub: "One tool per job. Skip the rest. Swipe." (Hook slide, face bottom-right.)' },
      { k: 'THE TRAP', h: 'More tools is not more marketing.', b: 'A stack of 14 subscriptions you half-use is not a system. It is overwhelm with a monthly bill. You need one tool per job, not one per impulse.' },
      { k: 'JOB 1 — A HOME', h: 'One page that clearly sells.', b: 'A simple site or landing page. Not a redesign. One page a stranger understands in ten seconds.' },
      { k: 'JOB 2 — CAPTURE', h: 'A way to collect emails.', b: 'A form plus a lead magnet. This plugs the biggest leak, the people who are not ready today.' },
      { k: 'JOB 3 — FOLLOW-UP', h: 'Email automation.', b: 'One tool that sends your sequence on its own. This is what closes leads while you do client work.' },
      { k: 'JOB 4 — SEE IT', h: 'Basic tracking.', b: 'Enough to know where leads come from. You cannot scale what you cannot see. This does not need to be fancy.' },
      { k: 'JOB 5 — BOOK IT', h: 'A scheduling link.', b: 'One click for a lead to book time with you. Every extra step between intent and booked is a leak.' },
      { k: 'SKIP', h: 'What you do not need yet.', b: 'A second analytics suite, five social schedulers, an AI tool for everything. Master the five jobs first. Tools do not fix strategy.' },
      { k: 'CTA', h: 'Missing one of these jobs entirely?', b: `That is usually the leak. Comment AUDIT and I will show you which. ${AUDIT_LINK}` },
    ],
    caption: `You do not need 14 tools. You need one per job. Here is the entire marketing stack a founder actually needs, and the stuff you can skip. Save it the next time you are tempted to buy another subscription. Comment AUDIT and I will show you which job you are missing entirely.`,
    cta: 'Save + comment AUDIT.',
  },

  // ───────────────────────── WEEK 4 — Convert ─────────────────────────────────
  {
    day: 22, week: 4, theme: 'Convert', kind: 'reel', face: true,
    title: 'First 30 Days', format: 'Reel (face)', pillar: 'PROOF',
    cover: 'What happens when you *hand it over*',
    hook: 'Here is exactly what happens in the first 30 days when a founder hands me their marketing. No mystery, no long contract, just the play.',
    script: `Founders hesitate to hand off marketing because it feels like a black box. So let me make it concrete. Here is the first 30 days.

Week one, I diagnose. I run the full 9-point audit on everything you have, offer, capture, follow-up, proof, tracking, all of it, and I hand you a ranked list of where you are actually losing money. You see the leaks plainly, often for the first time.

Week two, we fix the biggest one. Not all nine, the single leak costing you the most. Usually that is the offer or the capture, and it is usually fixable in days, not months.

Week three, we turn on the system. Capture plus an automated follow-up sequence, so leads stop dying in your inbox.

Week four, we measure. Now we can see what changed and decide the next leak to plug.

That is it. No twelve-month retainer, no disappearing into a black box. Diagnose, fix the biggest leak, build the system, measure. You stay building, I run the marketing.`,
    onscreen: ['Week 1: diagnose (9-point audit)', 'Week 2: fix the biggest leak', 'Week 3: turn on the system', 'Week 4: measure', 'No black box, no 12-month lock-in'],
    caption: `Handing off your marketing should not feel like a black box. Here is the literal first 30 days: diagnose with the 9-point audit, fix the single biggest leak, turn on the capture-and-follow-up system, then measure. No twelve-month retainer to find out if it works.

If that is what you need, comment CMO and we will talk.`,
    cta: "Comment CMO if that is what you need.",
  },
  {
    day: 23, week: 4, theme: 'Convert', kind: 'reel', face: false,
    title: '60-Second Live Audit', format: 'Reel (faceless, fast-paced screen-record of a real funnel)', pillar: 'TEARDOWN',
    cover: '3 leaks in *60 seconds*',
    hook: 'I audited a founder\'s funnel live. I found three leaks in the first 60 seconds. Time me.',
    script: `Clock starts now. This is a real founder funnel, top to bottom.

Leak one, ten seconds in. The headline. I still cannot tell what they sell or who it is for. Vague offer, top of the funnel, capping everything below it. [Highlight the headline.]

Leak two, thirty seconds. I scroll the whole page and there is no email capture anywhere. Every visitor who is not ready today leaves for good. [Scroll past, point at the gap.]

Leak three, fifty seconds. I find the contact form, fill it out, and there is no confirmation, no auto-reply, nothing. The lead has no idea if it even went through, and the founder has no system to follow up. [Submit, show the dead end.]

Sixty seconds, three leaks, offer, capture, follow-up. This is not a special case, this is the typical founder funnel. And the speed I just did that at is exactly the value of an outside set of eyes. You cannot see this on your own site because you built it. I can see it in a minute.`,
    onscreen: ['0:10 leak 1: vague offer', '0:30 leak 2: no capture', '0:50 leak 3: no follow-up', "60 sec. That's the value of outside eyes."],
    caption: `Three leaks in 60 seconds on a real founder funnel: vague offer, no capture, no follow-up. Not a special case, the typical one. The speed is the point, you cannot see this on your own site because you built it.

Want yours audited the same way? Comment AUDIT.`,
    cta: 'Want yours audited? Comment AUDIT.',
  },
  {
    day: 24, week: 4, theme: 'Convert', kind: 'carousel',
    title: 'Agency vs Fractional CMO', format: 'Carousel — 9 slides', pillar: 'PROOF',
    slides: [
      { k: 'FOUNDER MARKETING', h: 'Before you hire a marketing agency, read this.', b: 'Sub: "Not anti-agency. Pro knowing what you buy. Swipe." (Hook slide, face bottom-right.)' },
      { k: 'THE REAL QUESTION', h: 'Do you need execution, or do you need a brain?', b: 'Most founders buy execution when what they are missing is strategy and accountability. Wrong order, wasted money.' },
      { k: 'AGENCY', h: 'Paid to execute tactics.', b: 'Run the ads, ship the content, hit the deliverables. Great, once someone has decided what the right tactics even are.' },
      { k: 'AGENCY', h: 'Accountable to activity, not your P&L.', b: 'You can pay 12 months and still not know why pipeline is inconsistent. They did the work. The work was just pointed at the wrong thing.' },
      { k: 'FRACTIONAL CMO', h: 'Paid to own the outcome.', b: 'Diagnoses what is broken, decides the strategy, and is accountable to revenue, not to how many posts went out.' },
      { k: 'FRACTIONAL CMO', h: 'Sits on your side of the table.', b: 'Then directs the tactics, including an agency if you have one. Strategy first, execution second.' },
      { k: 'THE ORDER', h: 'Strategy and accountability first. Tactics second.', b: 'Do it backwards and you are buying activity and hoping. That is the most common founder marketing mistake.' },
      { k: 'WHEN TO CALL ME', h: 'If marketing feels busy but not productive.', b: 'That is the tell that you are missing the brain, not the hands. That is the gap a fractional CMO fills.' },
      { k: 'CTA', h: 'Not sure which you need?', b: `Comment CMO and I will tell you straight. ${AUDIT_LINK}` },
    ],
    caption: `Before you sign an agency retainer, read this. Not anti-agency, pro knowing what you are actually buying. Save it, send it to a founder about to drop 5 figures, and if you are not sure which you need, comment CMO and I will tell you straight.`,
    cta: "Comment CMO.",
  },
  {
    day: 25, week: 4, theme: 'Convert', kind: 'reel', face: true,
    title: 'The Cycle in 60 Seconds', format: 'Reel (face). Tight and energetic.', pillar: 'FRAMEWORK',
    cover: 'The whole system in *60 sec*',
    hook: 'The entire marketing system that lets one person run multiple businesses, in 60 seconds. Save this one.',
    script: `Four stages. This is the Money Scaling Cycle, and it runs on repeat.

Stage one, clarity. A stranger knows what you sell, who it is for, and why it wins, in one sentence. Everything downstream is capped by this, so it goes first.

Stage two, capture. 97 percent of visitors are not ready today. Give them one reason to leave an email or a DM, or you are paying for attention and throwing it away.

Stage three, follow-up. Most sales happen on the fifth to twelfth touch. Automate the nurture once and it closes the people you would have lost to your inbox.

Stage four, proof and speed. Show real results before they have to decide, and reply fast. Trust plus speed beats a bigger budget.

That is the whole cycle. Clarity, capture, follow-up, proof. Run it on repeat and your marketing produces whether or not you feel like it this week. That is the difference between a system and a to-do list.

Audit yourself against these four tonight. Whichever stage you are weakest on is where your money is leaking right now.`,
    onscreen: ['1. Clarity', '2. Capture', '3. Follow-up', '4. Proof + speed', 'Run on repeat'],
    caption: `The Money Scaling Cycle in 60 seconds: clarity, capture, follow-up, proof, run on repeat. The stage you are weakest on is where your revenue is leaking right now.

Save this, audit yourself against the four tonight, then comment AUDIT and I will send you the full 9-point version.`,
    cta: 'Comment AUDIT.',
  },
  {
    day: 26, week: 4, theme: 'Convert', kind: 'reel', face: true,
    title: 'DM-to-Fix Proof', format: 'Reel (face)', pillar: 'PROOF',
    cover: 'A DM. Then a real *fix*.',
    hook: "A founder DM'd me one of the audit leaks last week. Here is the exact fix I gave him, free, in about four minutes.",
    script: `He had taken the audit, scored himself, and DM'd me, my worst one is follow-up, leads just sit there. So I gave him the fix on the spot, no pitch.

I told him, you do not need a fancy tool yet. Today, write three emails. One, send the thing they signed up for instantly. Two, a day later, teach them one useful thing with no pitch. Three, two days after that, show one result with a number and invite a reply. Set those to send automatically off your form. That is it.

He did it that week. A few days later he messaged back, two old leads replied to email three and one booked a call.

I am showing you this for two reasons. One, that fix works, go do it. Two, this is literally how working with me starts, you find your worst leak, you tell me, I give you the fix. The audit is not a trick to get you on a call. It is the actual first step of the work.

Your move is the same as his. Find your worst leak first.`,
    onscreen: ["He DM'd: 'follow-up is my worst'", 'Free fix: 3 automated emails', '2 leads replied, 1 booked', 'The audit IS the first step'],
    caption: `A founder DM'd me his worst audit leak, follow-up. I gave him the fix free: three automated emails off his form. A few days later, two cold leads replied and one booked a call.

That is how working with me actually starts. Find your worst leak, tell me, get the fix. Comment AUDIT to start the same conversation.`,
    cta: 'Comment AUDIT to start the same convo.',
  },
  {
    day: 27, week: 4, theme: 'Convert', kind: 'reel', face: true,
    title: 'Month in Review', format: 'Reel (face). Show real numbers/clips from the month.', pillar: 'BUILD',
    cover: 'Month in *review*',
    hook: 'One month on this account. Here is what I built, what worked, what flopped, and what I am changing. The real scoreboard.',
    script: `I am going to do this the way I would want a founder to do it, honestly, with the real numbers, not a highlight reel.

What I built. 30 days of content, four pillars, plus the audit funnel that captures and follows up on its own.

What worked. The teardowns and the proof posts pulled the most saves and the most DMs. People want to see a real leak found and fixed, not theory. That is signal, so I am doing more of those.

What flopped. A couple of the framework posts were too abstract. Good idea, weak hook, low saves. My fault, the hook did not name a pain fast enough. Lesson I preach and just relearned, the first line is 80 percent of it.

What I am changing next month. More teardowns, tighter hooks, one direct offer a week, and I am turning a $10 a day ad on my best-performing reel.

That is the scoreboard. The reason I show it, founders trust operators who show the real numbers, not gurus who only show wins. Building in public means building in public.`,
    onscreen: ['Built: 30 days + the funnel', 'Worked: teardowns + proof', 'Flopped: abstract frameworks (weak hooks)', 'Next: tighter hooks, 1 offer/week, ads on'],
    caption: `One month in, the real scoreboard. Worked: teardowns and proof posts, the most saves and DMs. Flopped: a couple of frameworks with weak hooks, my fault, the first line did not name a pain fast enough. Next month: tighter hooks, more teardowns, one direct offer a week, ads on the top reel.

Founders trust operators who show the real numbers. Follow along.`,
    cta: 'Follow (soft).',
  },
  {
    day: 28, week: 4, theme: 'Convert', kind: 'reel', face: true,
    title: 'Too Close To See It', format: 'Reel (face)', pillar: 'TEARDOWN',
    cover: "You're too *close* to it",
    hook: 'The number one reason a founder\'s marketing fails is not budget or talent. It is that you are too close to it. Here is what that means.',
    script: `You built the business. You know it better than anyone alive. And that is exactly the problem with marketing it.

When you are that close, you cannot read your own homepage like a stranger. You fill in the blanks automatically. The headline that makes no sense to a first-time visitor reads perfectly fine to you, because you already know what you mean. You literally cannot see the leak, because your brain patches it every time.

This is not a flaw in you. It is true of every founder, including me on my own stuff. It is why I have a daily check on my own sites and why I get outside eyes on my own funnels. The person inside the building cannot see the whole building.

That is the entire case for an outside operator. Not because you are not smart, you obviously are, you built the thing. But because a fresh set of expert eyes will spot in 60 seconds what you have walked past for a year.

If your marketing feels off but you cannot put your finger on why, that is the tell. You are too close. Get an outside read.`,
    onscreen: ['You know it too well', "You can't read your page like a stranger", 'Your brain patches the leak', "That's the case for outside eyes"],
    caption: `The number one reason founder marketing fails is not budget or talent, it is proximity. You are too close to read your own page like a stranger, so your brain patches the leaks automatically and you walk past them for a year. True of every founder, me included.

That is the whole case for an outside read. Comment CMO for one on yours.`,
    cta: "Comment CMO for an outside read on yours.",
  },
  {
    day: 29, week: 4, theme: 'Convert', kind: 'carousel',
    title: '30-Day Turnaround Plan', format: 'Carousel — 8 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'FOUNDER MARKETING', h: 'Your 30-day marketing turnaround plan.', b: 'Sub: "Week by week. In the right order. Swipe." (Hook slide, face bottom-right.)' },
      { k: 'THE RULE', h: 'Fix in order, not all at once.', b: 'Trying to fix everything fixes nothing. One leak per week, biggest first. Order is what makes it compound.' },
      { k: 'WEEK 1 — CLARITY', h: 'Make the offer obvious.', b: 'Rewrite your homepage to one line: I help [who] get [result] without [pain]. Nothing downstream works until this is clear.' },
      { k: 'WEEK 2 — CAPTURE', h: 'Stop the 97 percent from vanishing.', b: 'Add one lead magnet and one form. Give the not-ready-today visitors a reason to leave an email. This plugs your biggest leak.' },
      { k: 'WEEK 3 — FOLLOW-UP', h: 'Turn on the autopilot.', b: 'Write the 5-email sequence and automate it off the form. Now leads get nurtured while you do client work.' },
      { k: 'WEEK 4 — PROOF + SEE IT', h: 'Add proof, then measure.', b: 'Put one real result with a number on the page. Set up basic tracking so you finally know what is working.' },
      { k: 'THE WHOLE PLAN', h: 'Clarity, capture, follow-up, proof. One per week.', b: 'Run this and in 30 days the same traffic produces multiples more. Save it and start Monday.' },
      { k: 'CTA', h: 'Not sure which week to start on?', b: `Comment AUDIT and I will tell you, based on your biggest leak. ${AUDIT_LINK}` },
    ],
    caption: `Your founder marketing turnaround, one month, week by week. This is the exact order I would fix it in. Save it and run it yourself, or comment AUDIT and I will tell you which week to start on based on your biggest leak.`,
    cta: 'Save + comment AUDIT.',
  },
  {
    day: 30, week: 4, theme: 'Convert', kind: 'reel', face: true,
    title: 'The Direct Offer — warmest ask of the month', format: 'Reel (face). Calm, certain, no hype. Film this last.', pillar: 'PROOF / OFFER',
    cover: "If you're tired of *guessing*",
    hook: 'If your marketing is leaking and you are tired of guessing at it, this one is for you. I am going to be direct.',
    script: `For a month I have shown you where founders lose money. The offer leak, the capture leak, the follow-up leak, the tracking leak, the speed leak. If you have been nodding along, recognizing your own business in these, here is the honest next step.

You do not have to keep being your own marketing department. You did not start your company to become a marketer, and every hour you spend guessing at it is an hour you are not building the thing only you can build.

So here is the direct offer. I am a fractional CMO for founders. I find the leaks, I plug them, and I run the marketing, without the cost of a full-time hire or the runaround of an agency. I sit on your side of the table and I am accountable to revenue, not activity.

If you want to start, book a free 20-minute call. Link is in my bio. On that call I will tell you the very first leak I would fix in your business, free, whether or not we ever work together.

That is it. No pressure, no pitch. If you are tired of guessing, let us turn the guessing off. Link in bio.`,
    onscreen: ["You're not a marketing dept", 'I find the leaks. I plug them. I run it.', 'Accountable to revenue, not activity', 'Free 20-min call -> link in bio'],
    caption: `A month of showing you where founders leak revenue. If you have been recognizing your own business in these, here is the direct next step.

You do not have to keep being your own marketing department. I am a fractional CMO for founders, I find the leaks, plug them, and run the marketing, without a full-time hire or an agency runaround.

Book a free 20-minute call, link in bio. I will tell you the first leak I would fix in your business, free, whether or not we work together.`,
    cta: 'Book a free 20-minute call, link in bio.',
  },

  // ───────── EXTRA CAROUSEL BANK (Days 31+) — built to be SAVED and SHARED ─────────
  // These are pure-value, save-bait carousels. They join the autoposter rotation
  // automatically (CAROUSELS = DAYS.filter kind==='carousel') and extend the
  // 6am email calendar past day 30 (loopIndex mods by DAYS.length).
  {
    day: 31, week: 5, theme: 'Save-bait frameworks', kind: 'carousel',
    title: '5 Leaks, Ranked by What They Cost You', format: 'Carousel - 8 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'FOUNDER MARKETING', h: 'The 5 marketing leaks that cost founders the most. Ranked.', b: '(Hook slide. Your face bottom-right. No body text.)' },
      { k: 'LEAK #5', h: 'No tracking.', b: 'You cannot fix what you cannot see. If you do not know your cost per lead, you are flying blind and every other fix is a guess.' },
      { k: 'LEAK #4', h: 'Slow follow-up.', b: 'Reply in 5 minutes instead of 5 hours and you can close up to 10x more of the same leads. Speed is free conversion.' },
      { k: 'LEAK #3', h: 'No capture.', b: '97% of visitors are not ready today. With no email or DM capture, you pay for that attention once and lose it forever.' },
      { k: 'LEAK #2', h: 'No follow-up system.', b: 'Most sales close on the 5th to 12th touch. One automated nurture sequence recovers the buyers your inbox was dropping.' },
      { k: 'LEAK #1', h: 'No clear offer.', b: 'A confused buyer never buys. If a stranger cannot tell what you sell in one sentence, it caps every dollar downstream.' },
      { k: 'THE ORDER', h: 'Fix them top down: offer first, then capture, then follow-up.', b: 'Save this and check your business against it tonight.' },
      { k: 'CTA', h: 'Want the full 9-point version?', b: `Comment AUDIT and I will send it. Or grab it at ${AUDIT_LINK}` },
    ],
    caption: `The 5 leaks that quietly drain the most revenue from founder businesses, ranked. Save it, fix them top down, then comment AUDIT for the full 9-point version.`,
    cta: 'Save this + comment AUDIT.',
  },
  {
    day: 32, week: 5, theme: 'Save-bait frameworks', kind: 'carousel',
    title: 'The One-Sentence Offer Test', format: 'Carousel - 7 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'CLARITY', h: 'If a stranger cannot pass this test in one sentence, your offer is leaking money.', b: '(Hook slide. Your face bottom-right. No body text.)' },
      { k: 'THE TEST', h: 'I help [who] get [result] without [pain], in [timeframe].', b: 'Fill that in for your business right now. If you cannot, that is leak number one.' },
      { k: 'BAD', h: '"We deliver innovative solutions that empower your business."', b: 'Nobody knows what that means. Jargon is where buyers quietly leave.' },
      { k: 'GOOD', h: '"I help home-service founders book more jobs without ad spend, in 30 days."', b: 'Same product. Same traffic. A stranger now knows instantly if it is for them.' },
      { k: 'WHERE IT GOES', h: 'Homepage hero. IG bio. Email signature. Sales call open.', b: 'One sentence, everywhere, in plain language. Consistency compounds trust.' },
      { k: 'WHY IT WINS', h: 'Clarity is the cheapest growth lever you own.', b: 'It costs nothing and almost nobody pulls it. Save this and rewrite your line today.' },
      { k: 'CTA', h: 'Want me to check the other 8 points?', b: `Comment AUDIT and I will send the full leak audit. Or grab it at ${AUDIT_LINK}` },
    ],
    caption: `The one-sentence test that exposes the offer leak in 10 seconds: I help [who] get [result] without [pain], in [timeframe]. Save it, rewrite your line, then comment AUDIT for the full 9-point check.`,
    cta: 'Save this + comment AUDIT.',
  },
  {
    day: 33, week: 5, theme: 'Contrarian truths', kind: 'carousel',
    title: 'Likes But No Customers', format: 'Carousel - 7 slides', pillar: 'TEARDOWN',
    slides: [
      { k: 'HARD TRUTH', h: 'Your content gets likes but no customers. Here is why.', b: '(Hook slide. Your face bottom-right. No body text.)' },
      { k: 'REASON 1', h: 'You are entertaining the wrong room.', b: 'Likes from peers are not buyers. Make content your ideal customer would save, not content other marketers applaud.' },
      { k: 'REASON 2', h: 'No next step.', b: 'A great post with no CTA is a dead end. Every piece should point somewhere: a comment, a DM, a link, a save.' },
      { k: 'REASON 3', h: 'You talk features, they buy outcomes.', b: 'Stop describing what you do. Show the result they get and the pain they avoid.' },
      { k: 'REASON 4', h: 'No capture behind the content.', b: 'Attention with no way to follow up is rented, not owned. Send them somewhere that captures an email or a DM.' },
      { k: 'THE FIX', h: 'Content for buyers + one clear next step + a capture point.', b: 'That is the difference between a following and a pipeline. Save this.' },
      { k: 'CTA', h: 'Want to find every gap in your funnel?', b: `Comment AUDIT and I will send the 9-point leak audit. Or grab it at ${AUDIT_LINK}` },
    ],
    caption: `Likes are not a business. If your content gets engagement but no customers, it is usually one of these 4 gaps. Save it, then comment AUDIT and I will show you the rest of the leaks.`,
    cta: 'Save this + comment AUDIT.',
  },
  {
    day: 34, week: 5, theme: 'Tactical playbooks', kind: 'carousel',
    title: 'The Follow-Up That Closes the 97%', format: 'Carousel - 8 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'CAPTURE -> CLOSE', h: 'The follow-up sequence that closes the 97% who were not ready today.', b: '(Hook slide. Your face bottom-right. No body text.)' },
      { k: 'THE PROBLEM', h: 'Most founders follow up once, then quit.', b: 'But most sales happen on the 5th to 12th touch. The money is in the messages you never send.' },
      { k: 'TOUCH 1', h: 'Deliver instantly.', b: 'The second they raise a hand, send the thing. Speed builds trust before anything else can.' },
      { k: 'TOUCH 2-3', h: 'Teach, do not pitch.', b: 'Two short emails that solve one real problem. You earn the right to sell by being useful first.' },
      { k: 'TOUCH 4-5', h: 'Show proof.', b: 'A result someone else got. Proof beats promises and quietly handles the objection in their head.' },
      { k: 'TOUCH 6-7', h: 'Make the direct ask.', b: 'Clear offer, clear next step, a reason to act now. You already gave value, now invite the yes.' },
      { k: 'AUTOMATE IT', h: 'Build it once. It closes while you sleep.', b: 'This is the single highest-ROI thing most founders are missing. Save this.' },
      { k: 'CTA', h: 'Not sure where your funnel leaks?', b: `Comment AUDIT and I will send the 9-point check. Or grab it at ${AUDIT_LINK}` },
    ],
    caption: `Follow up once and you lose the 97% who were not ready today. Here is the 7-touch sequence that closes them, on autopilot. Save it, build it once, then comment AUDIT for the full leak check.`,
    cta: 'Save this + comment AUDIT.',
  },
  {
    day: 35, week: 5, theme: 'Save-bait frameworks', kind: 'carousel',
    title: 'Steal My Founder Marketing Stack', format: 'Carousel - 9 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'STEAL THIS', h: 'The 7-part marketing stack I set up for every founder I work with.', b: '(Hook slide. Your face bottom-right. No body text.)' },
      { k: 'LAYER 1', h: 'A one-sentence offer.', b: 'The whole thing is capped by this. Get it clear before you spend a dollar on traffic.' },
      { k: 'LAYER 2', h: 'A page that captures.', b: 'One clear promise, one form, one reason to leave a contact. No clutter, no menu maze.' },
      { k: 'LAYER 3', h: 'A lead magnet worth the email.', b: 'Trade real value for the address. A checklist, a teardown, a tool they will actually use.' },
      { k: 'LAYER 4', h: 'An automated nurture.', b: 'The 5 to 12 touches that close the patient buyers. Build once, runs forever.' },
      { k: 'LAYER 5', h: 'One traffic source, done well.', b: 'Pick one channel and get good before you add a second. Spread thin is how founders burn cash.' },
      { k: 'LAYER 6', h: 'Tracking you actually read.', b: 'Cost per lead, reply speed, close rate. Three numbers beat a dashboard nobody opens.' },
      { k: 'LAYER 7', h: 'A fast feedback loop.', b: 'Review weekly, fix the worst leak, repeat. The system compounds while competitors guess.' },
      { k: 'CTA', h: 'Want me to map this onto your business?', b: `Comment AUDIT for the 9-point version. Or grab it at ${AUDIT_LINK}` },
    ],
    caption: `The exact 7-layer marketing stack I build for every founder. Save it and build it in order, top to bottom. Then comment AUDIT and I will show you which layer you are leaking from.`,
    cta: 'Save this + comment AUDIT.',
  },
  {
    day: 36, week: 6, theme: 'Contrarian truths', kind: 'carousel',
    title: 'Stop Boosting Posts', format: 'Carousel - 7 slides', pillar: 'TEARDOWN',
    slides: [
      { k: 'STOP', h: 'Stop boosting posts. You are donating money to the algorithm.', b: '(Hook slide. Your face bottom-right. No body text.)' },
      { k: 'WHY', h: 'Boost = reach for reach. No goal, no capture, no follow-up.', b: 'You pay for eyeballs that bounce. It feels like marketing and produces almost nothing.' },
      { k: 'INSTEAD 1', h: 'Send traffic to a page that captures.', b: 'Pay for attention only when there is somewhere for it to land and a way to keep it.' },
      { k: 'INSTEAD 2', h: 'Run one offer-driven campaign, not a boost.', b: 'A real objective, a real audience, a real next step. That is the difference between spend and waste.' },
      { k: 'INSTEAD 3', h: 'Put the budget behind your best organic post.', b: 'Let the audience tell you what works first, then amplify the proven winner.' },
      { k: 'THE RULE', h: 'Never pay for attention you cannot capture.', b: 'Tape that to your monitor. Save this so you remember it next time you reach for boost.' },
      { k: 'CTA', h: 'Want to know where your ad money leaks?', b: `Comment AUDIT for the 9-point check. Or grab it at ${AUDIT_LINK}` },
    ],
    caption: `Boosting posts is the most common way founders waste ad budget. Here is what to do with that money instead. Save it, and comment AUDIT if you want me to find every leak in your funnel.`,
    cta: 'Save this + comment AUDIT.',
  },
  {
    day: 37, week: 6, theme: 'Tactical playbooks', kind: 'carousel',
    title: 'Why Your Ads Are Not Working', format: 'Carousel - 8 slides', pillar: 'TEARDOWN',
    slides: [
      { k: 'DIAGNOSIS', h: 'Your ads are not working. It is almost never the ad.', b: '(Hook slide. Your face bottom-right. No body text.)' },
      { k: 'CHECK 1', h: 'The offer.', b: 'A weak offer with a great ad still loses. Fix what you are selling before you fix the creative.' },
      { k: 'CHECK 2', h: 'The landing page.', b: 'A good click that hits a confusing page is a wasted click. The page has to keep the promise the ad made.' },
      { k: 'CHECK 3', h: 'The follow-up.', b: 'If leads land and then hit silence, your ad spend leaks out the back. Speed and sequence save it.' },
      { k: 'CHECK 4', h: 'The audience.', b: 'Right message, wrong room, no sale. Make sure you are paying to reach actual buyers.' },
      { k: 'CHECK 5', h: 'The tracking.', b: 'If you cannot see cost per lead and close rate, you cannot tell a winner from a loser. Fix this first.' },
      { k: 'THE TRUTH', h: 'Ads amplify your funnel. They do not fix it.', b: 'A broken funnel just loses money faster with ads on top. Save this before your next campaign.' },
      { k: 'CTA', h: 'Want the full funnel teardown?', b: `Comment AUDIT for the 9-point audit. Or grab it at ${AUDIT_LINK}` },
    ],
    caption: `Before you blame the ad, check these 5. Ads amplify a funnel, they do not fix one. Save this, run the checks, then comment AUDIT and I will tear down the whole thing with you.`,
    cta: 'Save this + comment AUDIT.',
  },
  {
    day: 38, week: 6, theme: 'Meta / creator tactics', kind: 'carousel',
    title: 'Hooks That Stop the Scroll', format: 'Carousel - 8 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'ATTENTION', h: 'The first line decides everything. Steal these 6 hook patterns.', b: '(Hook slide. Your face bottom-right. No body text.)' },
      { k: 'HOOK 1', h: 'The callout.', b: '"Founders doing their own marketing: read this." Name the exact person and they stop scrolling.' },
      { k: 'HOOK 2', h: 'The contrarian.', b: '"Stop hiring agencies." A clear, confident opposite of what they expect earns the next 3 seconds.' },
      { k: 'HOOK 3', h: 'The number.', b: '"5 leaks costing you the most." A specific count promises a payoff and is easy to save.' },
      { k: 'HOOK 4', h: 'The result.', b: '"I added one sentence and conversions went up." Lead with the outcome, then show the how.' },
      { k: 'HOOK 5', h: 'The mistake.', b: '"You are losing the 97% who were not ready." Name the silent leak they did not know they had.' },
      { k: 'HOOK 6', h: 'The teardown.', b: '"Your homepage is leaking customers. Watch." Promise to show, not just tell.' },
      { k: 'CTA', h: 'Want my full content + funnel system?', b: `Comment AUDIT for the leak audit. Or grab it at ${AUDIT_LINK}` },
    ],
    caption: `6 hook patterns that stop the scroll, with examples. Save this and use one on your next post. Comment AUDIT if you want the marketing system behind the content.`,
    cta: 'Save this + comment AUDIT.',
  },
  {
    day: 39, week: 6, theme: 'Save-bait frameworks', kind: 'carousel',
    title: "The Founder's Weekly Marketing Checklist", format: 'Carousel - 8 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'SAVE THIS', h: 'The 6 marketing things to check every week. 20 minutes, every Friday.', b: '(Hook slide. Your face bottom-right. No body text.)' },
      { k: 'CHECK 1', h: 'Did every lead get a reply in under an hour?', b: 'Speed is the cheapest conversion you have. Slow replies leak deals silently.' },
      { k: 'CHECK 2', h: 'Is the capture form still working?', b: 'Test it yourself. A broken form is a week of wasted traffic you never see.' },
      { k: 'CHECK 3', h: 'What was the cost per lead?', b: 'One number. If you do not know it, you cannot tell what is working from what is bleeding.' },
      { k: 'CHECK 4', h: 'Did the nurture sequence send?', b: 'Confirm the automated follow-up actually fired. Silence is where patient buyers go cold.' },
      { k: 'CHECK 5', h: 'Which post drove real action?', b: 'Not likes. Comments, DMs, clicks, saves. Do more of what moved people, not what was popular.' },
      { k: 'CHECK 6', h: 'What is the single worst leak right now?', b: 'Pick one. Fix it next week. One leak a week compounds into a system by quarter end.' },
      { k: 'CTA', h: 'Want the full 9-point audit to start from?', b: `Comment AUDIT and I will send it. Or grab it at ${AUDIT_LINK}` },
    ],
    caption: `20 minutes every Friday keeps your marketing from quietly leaking all week. Save this checklist and run it. Comment AUDIT for the full 9-point version to start from.`,
    cta: 'Save this + comment AUDIT.',
  },
  {
    day: 40, week: 6, theme: 'Tactical playbooks', kind: 'carousel',
    title: 'Your First $1,000 in Ad Spend', format: 'Carousel - 8 slides', pillar: 'FRAMEWORK',
    slides: [
      { k: 'SPEND SMART', h: 'What I would do with your first $1,000 in ad budget.', b: '(Hook slide. Your face bottom-right. No body text.)' },
      { k: 'STEP 0', h: 'Do not spend it yet.', b: 'Fix the offer and the capture page first. Ads into a broken funnel just lose money faster.' },
      { k: '$0 - $100', h: 'Test the offer organically.', b: 'Post it. See if anyone replies or saves. Free signal before you pay for reach.' },
      { k: '$100 - $400', h: 'Boost the proven winner.', b: 'Put budget behind the one post that already got real action, sending to a capture page.' },
      { k: '$400 - $800', h: 'Run one real campaign.', b: 'One audience, one offer, one clear next step. Read cost per lead daily and cut the losers.' },
      { k: '$800 - $1,000', h: 'Double down on what converted.', b: 'Take what worked and feed it. Ignore vanity metrics. Follow the leads that became conversations.' },
      { k: 'THE POINT', h: 'Small, measured, funnel-first. Then scale the winner.', b: 'This is how you turn $1,000 into a system instead of a lesson. Save this.' },
      { k: 'CTA', h: 'Want your funnel checked before you spend?', b: `Comment AUDIT for the 9-point audit. Or grab it at ${AUDIT_LINK}` },
    ],
    caption: `Before you spend your first $1,000 on ads, do this. Funnel first, organic signal second, then scale only the proven winner. Save it, and comment AUDIT to get your funnel checked before you spend a dollar.`,
    cta: 'Save this + comment AUDIT.',
  },
];

