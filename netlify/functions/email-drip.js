// netlify/functions/email-drip.js
// Netlify scheduled function, runs every hour, fires drip emails at scheduled times
// Add to netlify.toml:
//   [functions.email-drip]
//     schedule = "0 * * * *"

const WEBINAR_CONFIG = {
  riversideLink: "https://riverside.fm/studio/REPLACE_WITH_REAL_LINK",
  title: "The Revenue Leak Audit: Fix What's Killing Growth",
  playbookUrl: "https://markcmo.com/webinar-playbook-delivery.html",
  displayDate: "April 1, 2026 at 2:00 PM ET",
};

// ─── ASSET LINKS (90-day nurture) ──────────────────────────────────────────────
const ASSETS = {
  LEAK: "https://markcmo.com/leak-audit",
  REPORT: "https://markcmo.com/leak-audit-report",
  SYSTEM: "https://markcmo.com/system",
  BOOK: "https://markcmo.com/book.html",
};

exports.handler = async () => {
  console.log("[email-drip] Running drip check:", new Date().toISOString());

  try {
    const { queue, binData } = await getDripQueue();
    const now = new Date();
    const toSend = queue.filter(item => !item.sent && new Date(item.sendAt) <= now);

    console.log(`[email-drip] Found ${toSend.length} emails to send`);

    for (const item of toSend) {
      try {
        await sendDripEmail(item);
        item.sent = true;
        item.sentAt = now.toISOString();
        console.log(`[email-drip] Sent ${item.emailType} to ${item.email}`);
      } catch (err) {
        console.error(`[email-drip] Failed to send ${item.emailType} to ${item.email}:`, err.message);
        item.error = err.message;
      }
    }

    // Save updated queue
    await saveDripQueue({ ...binData, queue });

    return { statusCode: 200, body: JSON.stringify({ sent: toSend.length }) };
  } catch (err) {
    console.error("[email-drip] Fatal error:", err);
    return { statusCode: 500, body: err.message };
  }
};

// ─── QUEUE MANAGEMENT ────────────────────────────────────────────────────────

async function getDripQueue() {
  const { JSONBIN_API_KEY, JSONBIN_DRIP_BIN_ID } = process.env;
  const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_DRIP_BIN_ID}/latest`, {
    headers: { "X-Master-Key": JSONBIN_API_KEY }
  });
  const data = await res.json();
  return { queue: data.record?.queue || [], binData: data.record || {} };
}

async function saveDripQueue(data) {
  const { JSONBIN_API_KEY, JSONBIN_DRIP_BIN_ID } = process.env;
  await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_DRIP_BIN_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Master-Key": JSONBIN_API_KEY },
    body: JSON.stringify(data)
  });
}

// ─── EMAIL DISPATCHER ────────────────────────────────────────────────────────

async function sendDripEmail(item) {
  const templates = {
    reminder_2day: {
      subject: "📊 2 days away, the revenue leak most CMOs never find",
      html: reminder2DayHTML(item)
    },
    reminder_1day: {
      subject: "⏰ Tomorrow: Your Revenue Leak Audit Webinar + prep checklist",
      html: reminder1DayHTML(item)
    },
    reminder_2hr: {
      subject: "🔴 Starting in 2 hours, here's your Riverside link",
      html: reminder2HrHTML(item)
    },
    playbook: {
      subject: "🎁 Your Revenue Leak Playbook is ready (+ replay coming soon)",
      html: playbookHTML(item)
    },
    case_study: {
      subject: "How one CMO found $800K in pipeline in 48 hours",
      html: caseStudyHTML(item)
    },
    followup_check: {
      subject: "Did you run the audit yet? (quick check-in)",
      html: followupHTML(item)
    },
    last_chance: {
      subject: "Last chance: The CMO Revenue Audit offer expires Friday",
      html: lastChanceHTML(item)
    },
    la_value: {
      subject: "Which of the 9 leaks hit hardest?",
      html: laValueHTML(item)
    },
    la_story: {
      subject: "I added one sentence to a founder's site. Conversions jumped.",
      html: laStoryHTML(item)
    },
    la_proof: {
      subject: "What a fractional CMO actually does (in plain English)",
      html: laProofHTML(item)
    },
    la_offer: {
      subject: "Want me to find the first leak I'd fix in your business?",
      html: laOfferHTML(item)
    }
  };

  // 90-day nurture sequence takes priority; fall back to legacy templates.
  const seq = SEQUENCE.find(s => s.key === item.emailType);
  const template = seq
    ? { subject: tok(seq.subject, item), html: seqRender(seq, item) }
    : templates[item.emailType];
  if (!template) throw new Error(`Unknown email type: ${item.emailType}`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.WEBINAR_RESEND_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Mark Gabrielli <mark@markcmo.com>",
      reply_to: "mark@markcmo.com",
      to: item.email,
      subject: template.subject,
      html: template.html
    })
  });

  if (!res.ok) throw new Error(await res.text());
}

// ─── 90-DAY NURTURE SEQUENCE ────────────────────────────────────────────────────
// Fires after the day 0/2/4/6/8 leak-audit emails. Rotates business questions,
// system teaches, method teaches, weekly check-ins, stories, proof, and soft
// offers across ~90 days. Reply-to is Mark, so every reply lands in his inbox.
// Keys MUST match the schedule in leak-audit-signup.js queueNurtureSequence().

function tok(s, item) {
  return String(s).replace(/\{name\}/g, item.firstName || "there");
}

// Renders a sequence entry: lead line, paragraphs, optional CTA button, signoff.
function seqRender(seq, item) {
  const name = item.firstName || "there";
  const paras = (seq.body || []).map(p =>
    `<p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">${tok(p, item)}</p>`
  ).join("");
  const lead = seq.lead
    ? `<p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${tok(seq.lead, item)}</p>`
    : "";
  const btn = seq.btn ? goldBtn(seq.btn.href, seq.btn.text) : "";
  const ask = seq.ask
    ? `<p style="font-size:15px;color:#aaa;line-height:1.7;margin:20px 0 0;">${tok(seq.ask, item)}</p>`
    : "";
  return emailWrap(`${lead}${paras}${btn}${ask}
    <p style="font-size:14px;color:#666;margin:24px 0 0;">Mark</p>`);
}

const SEQUENCE = [
  // ── Day 11 — business question ──
  { key: "d90_biz1", subject: "{name}, quick question about your business",
    lead: "{name}, what are you actually selling right now?",
    body: [
      "Not the long version. The one-sentence version a stranger could repeat back: who you help, what result, and why you beat the alternative.",
      "Most founders I talk to can't say it cleanly, and that one gap quietly caps every marketing dollar they spend. A confused buyer never buys.",
      "So I'm curious where you're at. Hit reply with your one sentence and I'll tell you, honestly, whether it lands or where it leaks." ],
    ask: "Genuinely, just reply. I read every one." },

  // ── Day 14 — system teach + asset ──
  { key: "d90_sys1", subject: "The 5-part system I run for every business",
    lead: "{name}, here's the skeleton.",
    body: [
      "Every business I've built or fixed runs on the same five parts: Clarity, Capture, Follow-Up, Proof, and Consistency. Miss one and the whole thing leaks.",
      "Clarity is the offer. Capture is how you keep visitors who aren't ready yet. Follow-Up is what happens before they go cold. Proof is what makes the decision easy. Consistency is the part that keeps running on your busiest week.",
      "I laid the whole thing out on one page so you can see where yours is strong and where it's quietly bleeding." ],
    btn: { href: ASSETS.SYSTEM, text: "See The 5-Part System →" },
    ask: "Read it and reply with the part you think is weakest in your business. I'll tell you the first fix." },

  // ── Day 18 — method teach ──
  { key: "d90_method1", subject: "Why I fix the offer before anything else",
    lead: "{name}, order matters.",
    body: [
      "When someone hands me a leaking business, I don't touch ads or channels first. I fix the offer and the tracking, in that order.",
      "Here's why: if the offer is fuzzy, more traffic just means more confused people leaving. And if you can't see where your last 10 customers came from, you're optimizing blind.",
      "Get those two right and everything downstream, capture, follow-up, proof, starts converting on the traffic you already have. No new spend required." ],
    ask: "Reply and tell me: can you name where your last 5 customers actually came from? If not, that's leak #2 and we should talk." },

  // ── Day 22 — weekly check-in ──
  { key: "d90_checkin1", subject: "Anything break this week?",
    lead: "{name}, checking in.",
    body: [
      "Quick one. How did this week go in the business?",
      "If something marketing-related broke, stalled, or just frustrated you, this is exactly the kind of thing I help founders untangle.",
      "Tell me the one thing that annoyed you most this week. No agenda, I just like knowing what founders are actually wrestling with, and I'll usually send back a thought." ],
    ask: "Hit reply. One sentence is fine." },

  // ── Day 26 — system teach 2 + asset ──
  { key: "d90_sys2", subject: "The leak that costs the most (it's not ads)",
    lead: "{name}, the expensive one.",
    body: [
      "Most founders think their problem is traffic. It almost never is. The most expensive leak is Follow-Up: leads come in, sit in an inbox, and go cold.",
      "You already paid to get that lead. Letting it rot is the most expensive thing in your whole funnel, and it's also the easiest to fix.",
      "A simple capture-then-follow-up sequence, exactly like the one you're reading now, recovers more revenue than any ad tweak I've ever made." ],
    btn: { href: ASSETS.SYSTEM, text: "See Where Follow-Up Fits →" },
    ask: "Reply and tell me what happens to a lead the moment it comes into your business today. I'll tell you what's leaking." },

  // ── Day 30 — story ──
  { key: "d90_story1", subject: "One sentence moved his conversions",
    lead: "{name}, a quick story.",
    body: [
      "A founder I worked with had a solid product and steady traffic, but flat conversions. The product was fine. The traffic was fine. The offer was the leak.",
      "His homepage took a full paragraph to explain what he did. So we cut it to one sentence: \"I help [who] get [result] without [pain], in [timeframe].\"",
      "Same traffic. Same product. Conversions moved within the week, just by making it instantly clear what he sold and to whom." ],
    ask: "Try writing yours in that exact format and reply with it. I'll pressure-test it for free." },

  // ── Day 34 — method teach 3 ──
  { key: "d90_method2", subject: "Pick one channel. Win it. Then add.",
    lead: "{name}, stop spreading thin.",
    body: [
      "The Channel Leak is sneaky. You're posting on five platforms, running a bit of everything, and winning on none of them. It feels like work, but it's just noise.",
      "The fix is boring and it works: pick the one channel where your buyers actually are, go all-in until it produces predictably, then add the second.",
      "One channel that converts beats five that dribble. Every time." ],
    ask: "Reply with the channels you're spread across right now and I'll tell you which one I'd cut to and why." },

  // ── Day 38 — business question 2 ──
  { key: "d90_biz2", subject: "{name}, where's the bottleneck right now?",
    lead: "{name}, what's the constraint?",
    body: [
      "Every business has one bottleneck at a time, the single thing holding growth back. Right now, for you, is it leads, conversion, or delivery?",
      "Most founders try to fix all three at once and move none of them. The trick is naming the one constraint and pointing everything at it for 30 days.",
      "If you can name yours, you're already ahead of most. If you can't, that's usually the real problem." ],
    ask: "Reply with the one word, leads, conversion, or delivery, and I'll tell you the first move I'd make on it." },

  // ── Day 42 — proof ──
  { key: "d90_proof1", subject: "$800K that was just sitting there",
    lead: "{name}, it was already there.",
    body: [
      "A client came to me convinced they had a lead problem. Pipeline looked healthy, but deals kept stalling at the same stage. Sales blamed marketing, marketing had the leads, nobody knew the leak.",
      "We ran the audit. The problem wasn't leads at all, it was two follow-up gaps. We plugged them.",
      "$800K in dormant pipeline reactivated within 30 days. No new spend. The revenue was already there, it was just leaking out a hole nobody had named." ],
    ask: "Reply and tell me where you think your biggest leak is. I'll tell you if I'd bet on the same one." },

  // ── Day 46 — weekly check-in 2 ──
  { key: "d90_checkin2", subject: "How'd this week go?",
    lead: "{name}, real quick.",
    body: [
      "Checking in again. What was the win and what was the headache this week?",
      "If anything on the marketing side felt stuck, that's the stuff I'm good at unsticking, and sometimes a single outside question saves you a week of spinning.",
      "Tell me the headache. I'll send back a thought if I have one." ],
    ask: "Just reply." },

  // ── Day 50 — system teach 3 + asset ──
  { key: "d90_sys3", subject: "The part that keeps it all running",
    lead: "{name}, the quiet killer.",
    body: [
      "The last part of the system is the one most founders skip: Consistency. Your marketing stops the week client work gets busy, and then you're starting cold again every month.",
      "The fix isn't discipline. It's building the engine so it runs without you, capture, follow-up, and proof on autopilot, so a busy week doesn't reset your pipeline.",
      "That's the whole point of a system: it works on your worst week, not just your best one." ],
    btn: { href: ASSETS.SYSTEM, text: "Revisit The Full System →" },
    ask: "Reply and tell me, does your marketing survive your busy weeks? Be honest." },

  // ── Day 54 — method teach 4 ──
  { key: "d90_method3", subject: "Speed is a feature buyers can feel",
    lead: "{name}, how fast do you reply?",
    body: [
      "The Speed Leak is brutal because it's invisible. A lead raises their hand, then waits hours or days for a reply, and by then they've cooled or bought from whoever answered first.",
      "Responding in minutes instead of hours can double the rate at which leads turn into conversations. Same leads. Just faster.",
      "You don't need to be glued to your phone, you need a system that catches the lead and starts the conversation the moment they show up." ],
    ask: "Reply with how long it currently takes you to respond to a new lead. I'll tell you if it's costing you deals." },

  // ── Day 58 — story 2 ──
  { key: "d90_story2", subject: "She was one tweak from a flood",
    lead: "{name}, another quick one.",
    body: [
      "A founder had great proof, testimonials, results, case studies, all of it sitting on a page nobody visited until after they'd already decided.",
      "We moved the proof up front, in front of the decision instead of behind it. Nothing else changed.",
      "The Proof Leak is when prospects have to commit before they ever see why they should. Close it and the same proof you already have starts doing the selling for you." ],
    ask: "Reply and tell me where your best proof lives right now. I'll bet it's in the wrong place." },

  // ── Day 62 — business question 3 ──
  { key: "d90_biz3", subject: "{name}, what would 2x mean for you?",
    lead: "{name}, paint the picture.",
    body: [
      "If your marketing doubled what it produces over the next quarter, same hours, just plugged leaks, what changes for you? More hires? Less stress? Finally stepping out of the day-to-day?",
      "I ask because the goal shapes the fix. Doubling leads is a different job than doubling close rate, and most founders never name which one they actually want.",
      "So tell me the picture. What does the next level actually look like for you?" ],
    ask: "Reply with the honest answer. It tells me which leak matters most for you." },

  // ── Day 66 — free value + asset ──
  { key: "d90_value1", subject: "Run the 9-point audit again",
    lead: "{name}, you've changed since you started.",
    body: [
      "You ran the 9-Point Marketing Leak Audit when you first came in. A lot can shift in a couple months, what was a leak then might be fixed now, and new ones open as you grow.",
      "It takes five minutes and it's the single best snapshot of where your marketing is bleeding right now.",
      "Run it again and compare. The pattern of what's moved tells you exactly where to point your next 30 days." ],
    btn: { href: ASSETS.LEAK, text: "Re-Run The Free Audit →" },
    ask: "Reply with your new top leak and I'll tell you the first fix." },

  // ── Day 70 — weekly check-in 3 ──
  { key: "d90_checkin3", subject: "Still here, still in your corner",
    lead: "{name}, checking in.",
    body: [
      "It's been a stretch since we talked. How's the business feeling lately, momentum, or grinding?",
      "Either answer is useful to me. If you're flying, I want to know what's working. If you're grinding, I probably have a question that helps.",
      "What's the one thing you wish would just get easier right now?" ],
    ask: "Reply. One line is plenty." },

  // ── Day 74 — proof 2 ──
  { key: "d90_proof2", subject: "Weeks, not months",
    lead: "{name}, the real difference.",
    body: [
      "The thing I hear most after we fix a few leaks: \"why did this take me so long?\" The answer is almost always that they were guessing, and guessing is slow.",
      "Plugging these leaks alone usually takes months of trial and error. Plugging them with someone who's done it across a dozen businesses takes weeks, because we skip the dead ends.",
      "That's the entire value of doing it with a guide instead of solo: not magic, just compressed time." ],
    ask: "Reply and tell me which leak you've been stuck on longest. That's usually the one worth the shortcut." },

  // ── Day 78 — method teach 5 ──
  { key: "d90_method4", subject: "Warm visitors are your cheapest buyers",
    lead: "{name}, don't let them vanish.",
    body: [
      "The Retargeting Leak: someone visits, engages, gets interested, and then never sees your offer a second time. They didn't say no, they just got busy and forgot.",
      "These are the cheapest, warmest buyers you'll ever reach, because they already raised their hand once. Letting them disappear is leaving money on the table.",
      "A simple retargeting and follow-up loop puts your offer back in front of people who already showed interest. Low effort, high return." ],
    ask: "Reply: do warm visitors ever see your offer a second time right now? If not, that's an easy win we should grab." },

  // ── Day 82 — soft offer (book) ──
  { key: "d90_offer1", subject: "Want me to find your first leak with you?",
    lead: "{name}, the simplest next step.",
    body: [
      "We've covered a lot, the offer, capture, follow-up, proof, speed, channels, consistency. If you've been reading and nodding, you probably already feel where yours is leaking.",
      "Here's the easiest way to act on it: grab a free 20-minute call. Tell me what you sell and what you've tried, and I'll tell you the first leak I'd fix in your specific business. No pitch, no pressure.",
      "You walk away with a clear first move either way." ],
    btn: { href: ASSETS.BOOK, text: "Book A Free 20-Min Call →" },
    ask: "Not ready for a call? Just reply with the leak bugging you most and I'll send the one fix I'd prioritize." },

  // ── Day 86 — weekly check-in 4 ──
  { key: "d90_checkin4", subject: "What changed since we started?",
    lead: "{name}, take stock with me.",
    body: [
      "We're nearly 90 days in. Look back at where the business was when you first ran that audit, what's actually different now?",
      "Even small movement compounds. And if nothing's moved, that's worth naming too, it usually means one leak never got plugged.",
      "Tell me the one thing that's better and the one thing that's still stuck. That contrast tells us both where to go next." ],
    ask: "Reply with both. I'll tell you what I'd focus on next." },

  // ── Day 90 — recap + book ──
  { key: "d90_recap", subject: "{name}, everything in one place",
    lead: "{name}, here's the whole map.",
    body: [
      "Over the last 90 days we walked the full system, the offer, capture, follow-up, proof, speed, channels, and consistency. Here's everything in one place so you can come back to it anytime.",
      "The 9-Point Audit to find your leaks. The 5-Part System to see how it all fits. And when you want a straight answer on your specific business, a free call with me.",
      "You've got the map now. The only thing left is to plug the leak that's costing you the most, and you don't have to do it alone." ],
    btn: { href: ASSETS.BOOK, text: "Book A Free 20-Min Call →" },
    ask: "This isn't the end of me showing up, reply anytime a leak springs and I'll help you plug it. That's what I'm here for." },
];

// ─── EMAIL WRAPPER ────────────────────────────────────────────────────────────

function emailWrap(content) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:40px 20px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td style="background:#111;border-bottom:2px solid #C9A84C;padding:24px 40px;">
    <div style="font-family:Georgia,serif;font-size:10px;letter-spacing:4px;color:#C9A84C;text-transform:uppercase;margin-bottom:6px;">MARK GABRIELLI</div>
    <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px;">MARKCMO.COM</div>
  </td></tr>
  <tr><td style="background:#111;padding:40px;">
    ${content}
    <hr style="border:none;border-top:1px solid #222;margin:32px 0;">
    <p style="font-size:12px;color:#444;margin:0;">Questions? Reply to this email.<br>
    <a href="https://markcmo.com" style="color:#C9A84C;text-decoration:none;">markcmo.com</a></p>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function goldBtn(href, text) {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:#C9A84C;color:#0a0a0a;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;padding:14px 28px;text-decoration:none;">${text}</a>
  </div>`;
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

function reminder2DayHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, it starts in 2 days.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">Most CMOs know their pipeline is leaking. Few know <em>where</em>.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">On Wednesday I'm going to show you the 7 specific places revenue disappears between marketing and closed-won, and the exact framework I use to find them in a single afternoon.</p>
    <div style="background:#0a0a0a;border-left:3px solid #C9A84C;padding:20px 24px;margin:0 0 24px;">
      <div style="font-size:13px;color:#C9A84C;font-weight:700;margin-bottom:8px;">THE REVENUE LEAK AUDIT WEBINAR</div>
      <div style="font-size:14px;color:#ccc;">${WEBINAR_CONFIG.displayDate}</div>
      <div style="font-size:13px;color:#666;margin-top:4px;">Live on Riverside.fm • 75 min + Q&A</div>
    </div>
    <p style="font-size:14px;color:#888;margin:0 0 24px;">No slides. No fluff. Just a live audit walkthrough and a framework you can use next week.</p>
    ${goldBtn("https://markcmo.com/webinar-confirmation.html", "VIEW YOUR REGISTRATION →")}
    <p style="font-size:14px;color:#666;">See you Wednesday,<br><strong style="color:#aaa;">Mark</strong></p>
  `);
}

function reminder1DayHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, it's tomorrow. Here's how to prep.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">To get the most out of tomorrow's session, spend 10 minutes before we start:</p>
    <div style="margin:0 0 24px;">
      ${['Pull your last 90 days of pipeline data (even rough numbers)', 'Know your average deal cycle length', 'Have 1-2 stuck deals in mind to use as examples', 'Come with your biggest GTM question ready for Q&A'].map((t,i) => `
      <div style="display:flex;align-items:flex-start;margin-bottom:12px;padding:12px 16px;background:#0a0a0a;border:1px solid #1a1a1a;">
        <div style="color:#C9A84C;font-weight:900;font-size:16px;margin-right:12px;min-width:24px;">${i+1}</div>
        <div style="font-size:14px;color:#ccc;line-height:1.5;">${t}</div>
      </div>`).join('')}
    </div>
    <p style="font-size:14px;color:#aaa;margin:0 0 8px;">You'll get the Riverside link in tomorrow's 2-hour reminder email. Mark your calendar.</p>
    ${goldBtn("https://markcmo.com/webinar-confirmation.html", "YOUR REGISTRATION DETAILS →")}
    <p style="font-size:14px;color:#666;">Tomorrow,<br><strong style="color:#aaa;">Mark</strong></p>
  `);
}

function reminder2HrHTML(item) {
  return emailWrap(`
    <div style="background:#C9A84C;padding:12px 20px;margin:0 0 28px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:3px;color:#0a0a0a;text-transform:uppercase;">🔴 STARTING IN 2 HOURS</div>
    </div>
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, here's your access link.</p>
    <div style="background:#0a0a0a;border:1px solid #222;border-left:3px solid #C9A84C;padding:24px;margin:0 0 24px;text-align:center;">
      <div style="font-size:13px;color:#666;margin-bottom:8px;">JOIN THE WEBINAR HERE</div>
      <a href="${WEBINAR_CONFIG.riversideLink}" style="font-size:16px;color:#C9A84C;font-weight:700;word-break:break-all;">${WEBINAR_CONFIG.riversideLink}</a>
      <div style="font-size:13px;color:#666;margin-top:12px;">${WEBINAR_CONFIG.displayDate}</div>
    </div>
    <p style="font-size:13px;color:#888;">Open the link 5 minutes early to make sure audio/video is working. The playbook is only sent to live attendees.</p>
    ${goldBtn(WEBINAR_CONFIG.riversideLink, "JOIN NOW →")}
  `);
}

function playbookHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, your playbook is waiting.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">Thank you for attending today. As promised, here's everything you need to run your first Revenue Leak Audit.</p>
    <div style="background:#0a0a0a;border:1px solid #1a1a1a;padding:24px;margin:0 0 24px;">
      <div style="font-size:11px;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:16px;">WHAT'S INSIDE THE PLAYBOOK</div>
      ${['The 7 Revenue Leak Framework (printable)', 'GTM Audit Scorecard (Excel + PDF)', 'The 90-Day Sprint Planner', '3 real-world case study walkthroughs', 'Board presentation template', 'The Revenue Leak Calculator'].map(t => `
      <div style="display:flex;align-items:center;margin-bottom:8px;">
        <div style="color:#C9A84C;margin-right:10px;">✓</div>
        <div style="font-size:14px;color:#ccc;">${t}</div>
      </div>`).join('')}
    </div>
    ${goldBtn(WEBINAR_CONFIG.playbookUrl, "DOWNLOAD YOUR PLAYBOOK →")}
    <p style="font-size:14px;color:#888;margin:0 0 16px;">The replay will be available within 48 hours. I'll send it directly to your inbox.</p>
    <p style="font-size:14px;color:#666;">If you want to go deeper, run a full audit with my support, reply to this email with "audit" and I'll send you details on a strategy session.</p>
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}

function caseStudyHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, this took 48 hours.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">A client came to me frustrated. Their pipeline looked healthy on paper, but deals kept stalling at the same stage. Sales was blaming marketing. Marketing had the leads. Nobody knew where the leak was.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">We ran the Revenue Leak Audit in two working sessions.</p>
    <div style="background:#0a0a0a;border-left:3px solid #C9A84C;padding:20px 24px;margin:0 0 24px;">
      <div style="font-size:28px;font-weight:900;color:#C9A84C;margin-bottom:8px;">$800K</div>
      <div style="font-size:14px;color:#aaa;">in dormant pipeline reactivated within 30 days of plugging two leaks we identified in the audit.</div>
    </div>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">The playbook you downloaded has the full framework. If you want me to run it on your business, that's the CMO Audit & Sprint.</p>
    ${goldBtn("https://square.link/u/kLKYt0W3", "BOOK A CMO AUDIT →")}
    <p style="font-size:13px;color:#666;">Starts at $1,000 · Typically 2-3 working sessions · Deliverable: full audit report + 90-day sprint plan</p>
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}

function followupHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">Quick check-in, ${item.firstName}.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">It's been a week since the webinar. Did you get a chance to open the playbook?</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">If you ran any part of the audit, I'd genuinely love to hear what you found. Reply and tell me, which of the 7 leaks showed up in your business?</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">And if you haven't had time yet, the playbook download page is still live:</p>
    ${goldBtn(WEBINAR_CONFIG.playbookUrl, "ACCESS YOUR PLAYBOOK →")}
    <p style="font-size:14px;color:#aaa;">If you want help running the audit, or want to know what this would look like as a facilitated engagement, reply with "tell me more" and I'll send details.</p>
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}

function lastChanceHTML(item) {
  return emailWrap(`
    <div style="background:#C9A84C;padding:12px 20px;margin:0 0 28px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:3px;color:#0a0a0a;text-transform:uppercase;">⚠️ OFFER EXPIRES FRIDAY</div>
    </div>
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, last call.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">I've been offering webinar attendees a CMO Audit & Sprint starting at $1,000. That offer closes this Friday.</p>
    <div style="background:#0a0a0a;border:1px solid #222;padding:24px;margin:0 0 24px;">
      <div style="font-size:11px;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;margin-bottom:16px;">CMO AUDIT & SPRINT, WHAT YOU GET</div>
      ${['Full 7-lever Revenue Leak Audit of your business', 'Written audit report with leak prioritization', '90-Day Sprint Blueprint customized to your stage', 'Presentation-ready board deck', '60-minute follow-up session 30 days out'].map(t => `
      <div style="display:flex;align-items:center;margin-bottom:8px;">
        <div style="color:#C9A84C;margin-right:10px;">→</div>
        <div style="font-size:14px;color:#ccc;">${t}</div>
      </div>`).join('')}
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #1a1a1a;">
        <span style="font-size:22px;font-weight:900;color:#fff;">$1,000</span>
        <span style="font-size:14px;color:#666;margin-left:8px;text-decoration:line-through;">$1,500+</span>
        <span style="font-size:12px;color:#C9A84C;margin-left:8px;">WEBINAR ATTENDEE RATE</span>
      </div>
    </div>
    ${goldBtn("https://square.link/u/kLKYt0W3", "BOOK YOUR AUDIT, FROM $1,000 →")}
    <p style="font-size:13px;color:#666;text-align:center;">Offer expires Friday. Limited to 3 spots this month.</p>
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}

// ─── LEAK AUDIT NURTURE SEQUENCE (Instagram funnel) ─────────────────────────────
// Day 0 delivery is sent by leak-audit-signup.js. These fire on days 2/4/6/8.

function laValueHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, did you run it?</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">A couple days ago I sent you the 9-Point Marketing Leak Audit. Most founders fail 4 to 6 of the 9 and have no idea, so if you scored a few leaks, you're in good company.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">Here's the thing worth knowing: the leaks aren't equally expensive. The <b style="color:#fff;">Offer Leak</b> caps every other marketing dollar you spend, because a confused buyer never buys. Fix that one first and everything downstream converts better.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">So I'm genuinely curious: <b style="color:#fff;">which leak hit hardest for you?</b> Hit reply and tell me the number. I read every one, and I'll usually fire back the first move I'd make.</p>
    ${goldBtn("https://markcmo.com/leak-audit-report.html", "RE-OPEN THE AUDIT →")}
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}

function laStoryHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">One sentence, ${item.firstName}.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">A founder I worked with had a real product and steady traffic, but conversions were flat. The problem wasn't the product or the traffic. It was the Offer Leak, leak #1.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">His homepage needed a full paragraph to explain what he did. Prospects landed, got confused, and left. So we rewrote the top of the page as a single sentence:</p>
    <div style="background:#0a0a0a;border-left:3px solid #C9A84C;padding:18px 22px;margin:0 0 24px;">
      <div style="font-size:15px;color:#fff;font-style:italic;line-height:1.6;">"I help [who] get [result] without [pain], in [timeframe]."</div>
    </div>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">No jargon. No paragraph. One sentence a stranger could repeat. Conversions moved within the week, on the exact same traffic he was already paying for.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">Try writing yours in that format and put it everywhere, bio, homepage, first line of every pitch. If you want me to pressure-test it, just reply with your draft.</p>
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}

function laProofHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, what I actually do.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">A lot of founders ask what a "fractional CMO" even means. In plain English: you keep building the business, and I take marketing off your plate and plug the leaks, without the cost of a full-time hire or an agency retainer.</p>
    <div style="background:#0a0a0a;border:1px solid #1a1a1a;padding:22px 24px;margin:0 0 24px;">
      ${['Find the leaks (the same 9-point audit you ran)', 'Fix the offer and the tracking first', 'Build the capture + follow-up so leads stop going cold', 'Pick one channel and make it actually work', 'Put it on a system that runs on your busiest week'].map(t => `
      <div style="display:flex;align-items:flex-start;margin-bottom:10px;">
        <div style="color:#C9A84C;margin-right:10px;">→</div>
        <div style="font-size:14px;color:#ccc;line-height:1.5;">${t}</div>
      </div>`).join('')}
    </div>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">I've done this across a dozen businesses I've built and run myself. The difference between plugging these leaks alone and plugging them with someone who's done it before is usually months versus weeks.</p>
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}

function laOfferHTML(item) {
  return emailWrap(`
    <p style="font-size:18px;font-weight:700;color:#fff;margin:0 0 16px;">${item.firstName}, want me to find your first leak?</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 20px;">If your marketing is leaking and you're tired of guessing, here's the simplest next step.</p>
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:0 0 24px;">Book a free 20-minute call. No pitch deck, no pressure. Tell me what you sell and what you've tried, and I'll tell you the first leak I'd fix in your specific business, on the call. You walk away with something useful either way.</p>
    ${goldBtn("https://markcmo.com/book.html", "BOOK A FREE 20-MIN CALL →")}
    <p style="font-size:15px;color:#aaa;line-height:1.7;margin:8px 0 24px;">Not ready for a call? Just reply with the leak that's bugging you most and I'll send you the one fix I'd prioritize. You keep it either way.</p>
    <p style="font-size:14px;color:#666;">Mark</p>
  `);
}
