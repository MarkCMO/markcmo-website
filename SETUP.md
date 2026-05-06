# MarkCMO.com - Complete Deployment Guide

## ═══════════════════════════════════════════════════
## 1. NETLIFY ENVIRONMENT VARIABLES
## ═══════════════════════════════════════════════════
Set these in Netlify Dashboard → Site Settings → Environment Variables:

### REQUIRED (site breaks without these)
| Variable | Value | Purpose |
|---|---|---|
| `RESEND_API_KEY` | re_xxxx | Course welcome + form emails |
| `WEBINAR_RESEND_KEY` | re_xxxx | Webinar registration emails |
| `ANTHROPIC_API_KEY` | sk-ant-xxxx | AI lesson & exam generation |
| `JSONBIN_API_KEY` | $2a$10$... | All database operations |
| `JSONBIN_BIN_ID` | (bin ID) | Main CRM leads bin |
| `JSONBIN_DRIP_BIN_ID` | (bin ID) | Email drip sequences |
| `JSONBIN_DOCS_BIN_ID` | (bin ID) | Document templates |
| `JSONBIN_LINKS_BIN_ID` | (bin ID) | Access links |
| `JSONBIN_ENROLLMENTS_BIN_ID` | (bin ID) | Course enrollments ← CREATE NEW |
| `JSONBIN_GRADS_BIN_ID` | (bin ID) | Course graduates ← CREATE NEW |
| `ADMIN_SECRET` | (secure string) | Admin API auth |
| `NOTIFY_EMAIL` | mark@markcmo.com | Where admin notifications go |
| `TOKEN_SECRET` | (random string) | Token signing |

### How to create a new JSONBin:
1. Go to jsonbin.io → Create New Bin
2. Paste initial JSON: `{"enrollments":[]}` for enrollments, `{"graduates":[]}` for grads
3. Copy the Bin ID from the URL and add as env var

## ═══════════════════════════════════════════════════
## 2. SQUARE PAYMENT LINKS - CRITICAL SETUP
## ═══════════════════════════════════════════════════
Each course needs its own Square payment link. After payment, Square should redirect to:

| Course | Square Return URL |
|---|---|
| Fractional CMO Mastery | https://markcmo.com/courses/welcome?course=cmo |
| Fractional COO Mastery | https://markcmo.com/courses/welcome?course=coo |
| Digital Marketing Mastery | https://markcmo.com/courses/welcome?course=digital |
| LinkedIn Growth Machine | https://markcmo.com/courses/welcome?course=linkedin |
| Instagram for Business | https://markcmo.com/courses/welcome?course=instagram |
| Revenue Architecture & GTM | https://markcmo.com/courses/welcome?course=revenue |
| Category Design & Market Leadership | https://markcmo.com/courses/welcome?course=category |
| AI-Powered Marketing | https://markcmo.com/courses/welcome?course=aimarketing |
| B2B Demand Generation | https://markcmo.com/courses/welcome?course=b2bdemand |
| Executive Leadership for Consultants | https://markcmo.com/courses/welcome?course=leadership |

### How to set Square return URL:
1. In Square Dashboard → Payment Links → Edit your link
2. Under "After Payment" → set "Success URL" to the appropriate URL above
3. Repeat for all 10 courses

After payment, the student lands on /courses/welcome → enters email → gets access link by email → starts course.

## ═══════════════════════════════════════════════════
## 3. DEPLOY STEPS
## ═══════════════════════════════════════════════════
1. Extract markcmo-site.zip
2. Drag the extracted folder onto Netlify's "Deploys" tab at app.netlify.com
3. Set all environment variables above
4. Verify custom domain markcmo.com is connected
5. Test the full flow:
   - Visit /courses → click "Already paid? Access your course →" → enter email → check email for access link
   - Visit /admin → login → check Academy tab for enrollment data

## ═══════════════════════════════════════════════════
## 4. COURSE FLOW - HOW IT WORKS
## ═══════════════════════════════════════════════════
1. Student browses /courses → clicks "Enroll Now" → Square payment page
2. Student pays → Square redirects to /courses/welcome?course={id}
3. Student enters name + email on welcome page
4. System creates enrollment record (JSONBin) + adds to CRM leads bin
5. System sends welcome email via Resend with personal access link
6. Student clicks link in email → /courses/learn?course={id}&email=...&token=...
7. learn.html validates token against enrollment → grants access
8. Student progresses through AI-generated lessons + quizzes
9. After all lessons → take final 50-question AI exam
10. Pass → /courses/diploma generates diploma → student can join Graduate Wall at /graduation

## ═══════════════════════════════════════════════════
## 5. ADMIN PANEL - /admin
## ═══════════════════════════════════════════════════
Login: mark@markcmo.com / Mark3148#

Key tabs:
- **Dashboard** - Overall stats
- **Webinar** → Registrants / Email Drip / Replay / Schedule
- **CRM** → All Contacts (includes course buyers automatically)
- **Academy** → Overview / Enrollments / Graduates / Revenue (NEW)
- **Revenue** → Transactions / Invoices / Products / Reports
- **Social Growth** → 10-tab LinkedIn/Instagram AI suite
- **Email** → Campaigns / Templates / Sequences / Subscribers
- **Forms** → All legal forms with digital signatures
- **Settings** → Site config, env vars reference

## ═══════════════════════════════════════════════════
## 6. RESEND EMAIL DOMAIN VERIFICATION
## ═══════════════════════════════════════════════════
For emails to send from mark@markcmo.com:
1. Go to resend.com → Domains → Add Domain → markcmo.com
2. Add the DNS records they provide to your domain registrar
3. Verify the domain
4. Both RESEND_API_KEY and WEBINAR_RESEND_KEY should be keys from the same Resend account

## ═══════════════════════════════════════════════════
## 7. SITE PAGES REFERENCE
## ═══════════════════════════════════════════════════
| URL | Purpose |
|---|---|
| / | Homepage |
| /courses | Course catalog (10 courses) |
| /courses/welcome?course=ID | Post-payment enrollment page |
| /courses/learn?course=ID&email=...&token=... | Course player |
| /courses/exam?course=ID&token=... | Final exam |
| /courses/diploma?course=ID&gpa=...&name=... | Diploma generator |
| /graduation | Alumni wall |
| /webinar | Webinar registration |
| /admin | Back office |
| /forms/* | Legal forms (15 types) |
| /documents/* | Document viewer |
| /sign | E-signature system |
| /location/* | 110 location SEO pages |
| /blog | Blog (5 articles) |


## Lesson Cache (NEW - required for instant lesson loading)

Create a new JSONBin bin at https://jsonbin.io with content `{}` (empty object).
Set the bin ID as env var: `JSONBIN_LESSON_CACHE_BIN_ID`

**How it works:**
- First student to open any lesson: Claude generates it (~30-45 seconds), lesson saves to cache
- Every student after: lesson loads from JSONBin cache instantly (<200ms)
- All 546 lessons get cached organically as students take them
- No pre-generation needed
