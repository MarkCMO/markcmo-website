// course-exam.js - AI-powered final exam generator & grader
// Generates a fresh 50-question exam every time. Completely different for retakers.

const https = require('https');

function callAnthropic(messages, systemPrompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: systemPrompt,
      messages
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('Parse error')); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const COURSE_CONTEXTS = {
  // ── TOP 5 FLAGSHIP ──────────────────────────────────────────────────────────
  cfo: { title: 'Fractional CFO Mastery', topics: ['CFO Mandate & Strategic Finance','Accounting Systems & Financial Architecture','Cash Flow Management & Working Capital','Financial Modeling & Forecasting','Capital Structure & Fundraising','Investor Relations & Board Reporting','Risk Management & Internal Controls','M&A Due Diligence & Integration','Strategic Finance & Value Creation','CFO Leadership & Executive Presence'] },
  cmo: { title: 'Fractional CMO Mastery', topics: ['CMO Role & Strategy','Brand Architecture & Positioning','Revenue Attribution & Analytics','Demand Generation Architecture','Content Strategy & Thought Leadership','Marketing Technology & AI','Product Marketing & GTM','B2B Marketing','Growth & International Marketing','CMO Leadership'] },
  coo: { title: 'Fractional COO Mastery', topics: ['COO Role & Operational Leadership','Strategy to Execution Excellence','Process Excellence & Operational Design','Technology & Digital Operations','Financial Operations & P&L Management','Supply Chain & Vendor Management','Human Capital Operations','Customer Operations & Experience','Growth Operations & Scaling Systems','Risk, Compliance & COO Leadership'] },
  ceo: { title: 'CEO Mastery: Building & Leading a $50M Company', topics: ['The CEO Role & Executive Identity','Strategy & Competitive Positioning','Financial Leadership & Capital Allocation','Building & Leading the Executive Team','Revenue Architecture & Commercial Leadership','Operational Excellence & Scaling Systems','Board Management & Investor Relations','Culture, Talent & Organizational Design','M&A, Partnerships & Strategic Growth','CEO Decision-Making & Personal Leadership'] },
  ae: { title: 'Account Executive Excellence', topics: ['Elite AE Mindset & Territory Planning','Prospecting & Pipeline Generation','Discovery Mastery & Qualification','Solution Selling & Demonstrations','Proposal Negotiation & Deal Architecture','Closing Strategies & Deal Velocity','Account Management & Expansion Revenue','Sales Technology & Performance Analytics'] },
  growth: { title: 'Growth Manager Mastery', topics: ['Growth Foundations & Operating System','Acquisition Channel Strategy','Activation & Onboarding Optimization','Retention & Churn Reduction','Revenue Expansion & Monetization','Viral Growth & Referral Systems','Growth Analytics & Experimentation','Scaling Growth & Growth Leadership'] },
  vpsales: { title: 'VP of Sales Mastery', topics: ['VP of Sales Operating System','Building the Sales Team','Sales Process Design & Methodology','Pipeline Management & Revenue Forecasting','Sales Compensation & Incentive Design','Sales Enablement & Continuous Training','Territory Segmentation & Account Strategy','Revenue Operations & Sales Analytics','Enterprise & Strategic Selling','VP of Sales Leadership & Career'] },
  // ── EXTENDED LIBRARY ────────────────────────────────────────────────────────
  coo: { title: 'Fractional COO Mastery', topics: ['COO Role & Operational Leadership','Strategy to Execution','Process Excellence','Technology & Digital Operations','Financial Operations & P&L','Supply Chain & Vendor Management','Human Capital Operations','Customer Operations','Growth Operations & Scaling','Risk & Compliance'] },
  digital: { title: 'Digital Marketing Mastery', topics: ['Digital Marketing Strategy','SEO','Paid Search & PPC','Social Media Marketing','Email Marketing & Automation','Content Marketing','Conversion Rate Optimization','Digital Analytics','E-commerce Marketing','Advanced Digital Strategy'] },
  linkedin: { title: 'LinkedIn Growth Machine', topics: ['LinkedIn Algorithm & Platform','Content Strategy for Authority','Thought Leadership & Personal Brand','Lead Generation Systems','LinkedIn Ads & Paid Strategy','LinkedIn Automation & Scale','Monetization & Revenue','Advanced LinkedIn Strategy'] },
  instagram: { title: 'Instagram for Business', topics: ['Platform Strategy & Algorithm','Visual Branding & Aesthetic','Reels Strategy & Video','Stories, Lives & Community','Hashtag & Discovery Strategy','Instagram Ads & Paid Strategy','Instagram Shopping & E-commerce','Growth Strategy & Revenue'] },
  revenue: { title: 'Revenue Architecture & GTM', topics: ['Revenue Architecture Fundamentals','Go-To-Market Strategy','Pricing Strategy & Optimization','Sales Architecture & Pipeline','Demand Generation & Revenue Marketing','Customer Revenue Expansion','Revenue Operations (RevOps)','SaaS & Subscription Revenue','B2B Revenue Complexity','Revenue Leadership & Scale'] },
  category: { title: 'Category Design & Market Leadership', topics: ['Category Design Fundamentals','Category Research & Discovery','Point of View Architecture','Category Evangelism & Conditioning','Category Design Playbook','Product as Category Proof','Category GTM & Sales Enablement','Category Leadership & Longevity'] },
  aimarketing: { title: 'AI-Powered Marketing', topics: ['AI Marketing Foundations','AI-Powered Content Creation','AI for SEO & Organic Growth','AI in Paid Media & Advertising','Personalization & Customer Experience','AI Analytics & Insights','AI for Email & Demand Gen','AI Marketing Leadership'] },
  b2bdemand: { title: 'B2B Demand Generation', topics: ['B2B Demand Generation Strategy','Account-Based Marketing','Content-Led Demand Generation','Outbound Demand Generation','Events, Webinars & Community','Paid Demand Generation','Pipeline Architecture & Operations','Advanced B2B Demand Strategy'] },
  leadership: { title: 'Executive Leadership for Consultants', topics: ['Executive Presence & Leadership Identity','Strategic Communication','Decision Making & Strategic Thinking','Leadership in Consulting','Building High-Performance Teams','Organizational Leadership','Executive Influence & Politics','Leadership Legacy & Growth'] },
};

function calcGPA(score) {
  if (score >= 93) return { gpa: 4.0, letter: 'A', designation: 'Summa Cum Laude' };
  if (score >= 90) return { gpa: 3.7, letter: 'A−', designation: 'Magna Cum Laude' };
  if (score >= 87) return { gpa: 3.3, letter: 'B+', designation: 'Cum Laude' };
  if (score >= 83) return { gpa: 3.0, letter: 'B', designation: 'Pass with Distinction' };
  if (score >= 80) return { gpa: 2.7, letter: 'B−', designation: 'Pass with Merit' };
  if (score >= 77) return { gpa: 2.3, letter: 'C+', designation: 'Pass' };
  if (score >= 73) return { gpa: 2.0, letter: 'C', designation: 'Pass (Minimum)' };
  if (score >= 70) return { gpa: 1.7, letter: 'C−', designation: 'No Diploma - Retake Required' };
  return { gpa: 0.0, letter: 'F', designation: 'Fail - Retake Required' };
}

exports.handler = async function(event) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const p = event.queryStringParameters || {};
  const action = p.action || 'generate'; // 'generate' or 'grade'

  // ── GRADE ACTION ──────────────────────────────────────────────────────────
  if (action === 'grade' && event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { answers, questions, quizScores, moduleScores } = body; // answers: [0,2,1,...], questions: [{correct, ...}]
      
      let examCorrect = 0;
      const review = questions.map((q, i) => {
        const isCorrect = answers[i] === q.correct;
        if (isCorrect) examCorrect++;
        return { question: q.question.slice(0, 80) + '...', correct: isCorrect, yourAnswer: q.options[answers[i]], rightAnswer: q.options[q.correct], explanation: q.explanation };
      });
      
      const examScore = Math.round((examCorrect / questions.length) * 100);
      
      // GPA formula: 40% quiz average + 60% final exam
      const quizArr = (quizScores || []).map(Number).filter(n => !isNaN(n));
      const quizAvg = quizArr.length ? Math.round(quizArr.reduce((a,b)=>a+b,0) / quizArr.length) : examScore;
      const combinedScore = Math.round(quizAvg * 0.4 + examScore * 0.6);
      const gpaData = calcGPA(combinedScore);
      const passed = combinedScore >= 73 && examScore >= 60; // must pass both components
      
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: true,
          examScore,
          examCorrect,
          totalQuestions: questions.length,
          quizAvg,
          combinedScore,
          passed,
          ...gpaData,
          review: passed ? review : review.slice(0, 10),
          diplomaEligible: passed
        })
      };
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── GENERATE ACTION ───────────────────────────────────────────────────────
  const courseId = p.course;
  const ctx = COURSE_CONTEXTS[courseId];
  if (!ctx) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Course not found' }) };

  // ── STATIC EXAM DATA (CFO & CMO - instant, no AI call) ───────────────────
  const STATIC_EXAMS = {};
  try { STATIC_EXAMS.cfo = require('./cfo-exam-data'); } catch(e) {}
  try { STATIC_EXAMS.cmo = require('./cmo-exam-data'); } catch(e) {}
  try { STATIC_EXAMS.coo = require('./coo-exam-data'); } catch(e) {}
  try { STATIC_EXAMS.ceo = require('./ceo-exam-data'); } catch(e) {}

  if (STATIC_EXAMS[courseId]) {
    const questions = STATIC_EXAMS[courseId];
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, static: true, course: courseId, courseTitle: ctx.title, totalQuestions: questions.length, exam: questions })
    };
  }

  const seed = p.sid || Date.now().toString(36);
  const seedNum = parseInt(seed.replace(/[^0-9]/g,'').slice(0,4) || '1337');

  const approachVariants = [
    'Focus questions on scenario-based application: give realistic business situations and ask what the best course of action is.',
    'Focus questions on framework mastery: test whether students can apply specific frameworks correctly to novel situations.',
    'Focus questions on data interpretation: present metrics and ask students to diagnose problems or recommend actions.',
    'Focus questions on strategic trade-offs: present two viable approaches and test understanding of when each is appropriate.',
    'Mix of: case study analysis questions, definition-under-pressure, common mistakes identification, and best practices.',
  ];
  const approach = approachVariants[seedNum % approachVariants.length];

  const systemPrompt = `You are the chief examiner for "${ctx.title}" at an elite business school. You are generating the FINAL COMPREHENSIVE EXAM - 50 questions spanning all 10 modules of this course.

This exam is HARD. First-time pass rate is below 50%. Students paid $497-$1,497 to take this exam. It must be genuinely challenging.

Exam approach for this session: ${approach}

RULES:
1. Generate exactly 50 questions - 5 per module (topics: ${ctx.topics.join(', ')}).
2. No trivial questions. Every question should make students think.
3. All 4 options should be plausible - no obviously wrong answers.
4. Questions test APPLICATION and JUDGMENT, not memorization.
5. Session seed ${seed} - vary question angles, examples, and scenarios from standard versions.
6. Return ONLY valid JSON, no markdown.

JSON structure:
{
  "exam": [
    {
      "module": "module name",
      "question": "question text",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": 0,
      "explanation": "detailed explanation teaching the concept"
    }
  ]
}`;

  try {
    const result = await callAnthropic([{ role: 'user', content: `Generate the complete 50-question final exam for "${ctx.title}". Session: ${seed}` }], systemPrompt);
    
    if (result.error) return { statusCode: 500, headers, body: JSON.stringify({ error: result.error.message }) };
    
    const text = result.content?.[0]?.text || '';
    const clean = text.replace(/^```json\n?/,'').replace(/\n?```$/,'').trim();
    const examData = JSON.parse(clean);
    
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, course: courseId, courseTitle: ctx.title, totalQuestions: examData.exam.length, exam: examData.exam })
    };
  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
