# Wikidata Q-Entity Guide: Mark Gabrielli

**Goal:** Create a verified Wikidata entity for Mark Gabrielli Jr., link it into the markcmo.com schema markup, and trigger a Google Knowledge Panel.

**Estimated time:** 25 to 35 minutes to create the entry. Google Knowledge Panel typically appears within 2 to 8 weeks after the Wikidata entry is indexed.

---

## Before You Start: Notability Check

Wikidata has a notability requirement. Your entry will survive long-term if you have at least 2 to 3 of these:

- [ ] Press coverage (articles naming you, not self-published)
- [ ] Clutch.co verified profile with reviews
- [ ] LinkedIn profile (public, 500+ connections)
- [ ] Podcast appearances or guest articles
- [ ] A Wikipedia article about you (not required, but the strongest signal)
- [ ] Speaking engagements at named events

Mark currently has the Clutch profile and LinkedIn. Supplement with any press mentions you can cite as references in the entry. Entries without references get flagged for deletion faster.

---

## Step 1: Create a Wikidata Account

1. Go to https://www.wikidata.org
2. Click **Create account** (top right)
3. Use an account name that is not obviously a brand (e.g., `MarkGabrielliJr` is fine)
4. Verify your email
5. Log in

> **Why it matters:** Anonymous edits can be reverted more easily. A named, verified account with edit history is treated as more credible by Wikidata moderators.

---

## Step 2: Create the New Item

1. In the Wikidata top menu, go to: **Contribute > Create a new item**
   Direct URL: https://www.wikidata.org/wiki/Special:NewItem
2. Set:
   - **Language:** English
   - **Label:** `Mark Gabrielli`
   - **Description:** `American fractional CMO, fractional COO, and executive advisor`
   - **Also known as (aliases):** `Mark Gabrielli Jr.`, `Mark Gabrielli Jr`
3. Click **Create**

You will land on the new item page. The URL will be `https://www.wikidata.org/wiki/Q[number]`. Save that Q-number immediately. You will need it.

---

## Step 3: Add Statements (Properties and Values)

For each statement below: click **+ add statement**, type the property name in the search box, select it, then enter the value.

Always click the **published** pencil icon on each statement to add a reference URL after adding the value.

---

### 3A. Core Identity Properties

| Property | Search for | Value to enter | Notes |
|---|---|---|---|
| P31 | `instance of` | `human` (Q5) | Required. Every person entry needs this. |
| P21 | `sex or gender` | `male` (Q6581097) | |
| P27 | `country of citizenship` | `United States of America` (Q30) | |
| P569 | `date of birth` | Your birth date | Set precision to **year** only if you prefer not to publish the full date. Use the calendar icon in Wikidata's date field. |

---

### 3B. Occupation Properties

Add all three occupations via P106:

| Property | Search for | Value | Notes |
|---|---|---|---|
| P106 | `occupation` | `chief marketing officer` (Q1072339) | Add first |
| P106 | `occupation` | `chief operating officer` (Q623279) | Add second (same property, multiple values allowed) |
| P106 | `occupation` | `management consultant` (Q27827744) | Add third |

For each occupation entry, add a **qualifier** to clarify the fractional/advisory nature:
- After adding the value, click the gray **add qualifier** link below it
- Property: `P3831` (object has role)
- Value: type `independent contractor` or `consultant` and select the closest match

---

### 3C. Location Properties

| Property | Search for | Value | Notes |
|---|---|---|---|
| P551 | `residence` | `Cape Canaveral` (Q966657) | Current residence |
| P131 | `located in the administrative territorial entity` | `Florida` (Q812) | State |
| P17 | `country` | `United States of America` (Q30) | |

---

### 3D. Employer / Affiliation

| Property | Search for | Value | Notes |
|---|---|---|---|
| P108 | `employer` | `WETYR` or create new item | See Step 4 for creating the WETYR Corp item |
| P856 | `official website` | `https://markcmo.com` | Add qualifier P407 (language of work or name) = English |

After adding the official website, add a qualifier:
- P407 (language) = English (Q1860)

---

### 3E. External Identifiers

These go in the **Identifiers** section (Wikidata separates identifiers from regular statements):

| Property | Search for | Value | Format |
|---|---|---|---|
| P6634 | `LinkedIn personal profile ID` | `markgabriellijr` | Just the profile slug, not the full URL |
| P2087 | `Crunchbase person ID` | Your Crunchbase slug if you have one | Example: `mark-gabrielli` |

> **Clutch.co:** Wikidata does not have a dedicated property for Clutch profiles yet. Add it as a reference URL on your P856 (official website) statement, or use P973 (described at URL) with value `https://clutch.co/profile/mark-gabrielli-chief-marketing-officer`.

To add P973:
- Click `+ add statement`
- Search for `described at URL`
- Value: `https://clutch.co/profile/mark-gabrielli-chief-marketing-officer`

---

### 3F. Add an Image (Optional but Powerful)

If you have a professional headshot:

1. Upload it first to Wikimedia Commons: https://commons.wikimedia.org/wiki/Special:UploadWizard
   - License: CC BY 4.0 (you retain copyright, just allow reuse with credit)
   - Category: Add `People from Cape Canaveral, Florida` and `American marketing executives`
2. After upload, copy the filename (e.g., `Mark_Gabrielli_CMO.jpg`)
3. Back in your Wikidata item, add:
   - P18 (image) = the Commons filename

> The image you add here is what Google pulls into the Knowledge Panel photo. Use a clean, professional headshot on a neutral background.

---

## Step 4: Create the WETYR Corp / MarkCMO Company Item

If WETYR Corp does not already have a Wikidata entry, create one:

1. Go to https://www.wikidata.org/wiki/Special:NewItem
2. Set:
   - **Label:** `WETYR Corp`
   - **Description:** `American marketing and operations advisory firm`
   - **Alias:** `MarkCMO`
3. Click **Create**, save the Q-number
4. Add statements:

| Property | Value |
|---|---|
| P31 (instance of) | `business` (Q4830453) |
| P17 (country) | `United States of America` (Q30) |
| P159 (headquarters location) | `Cape Canaveral` (Q966657) |
| P856 (official website) | `https://markcmo.com` |
| P571 (inception) | Year company was founded |

5. Go back to your person item, and set P108 (employer) to link to this new WETYR Corp Q-item.

---

## Step 5: Add References to Every Statement

Wikidata without references is fragile. For each statement you added:

1. Click the gray **0 references** link under the statement
2. Click **add reference**
3. Use P854 (reference URL) with one of these:
   - `https://markcmo.com` for general identity claims
   - `https://www.linkedin.com/in/markgabriellijr` for occupation/employer
   - `https://clutch.co/profile/mark-gabrielli-chief-marketing-officer` for professional role
   - Any press article URL that mentions your name

> **Minimum viable references:** At least P31 (human), P106 (occupations), and P856 (website) should each have one reference URL. That gives the entry enough credibility to resist deletion.

---

## Step 6: Wire the Wikidata QID Into markcmo.com Schema

After your item is created, your URL will look like: `https://www.wikidata.org/wiki/Q123456789`

Your QID is the number: `Q123456789`

### Update the existing LocalBusiness sameAs in index.html

The file `index.html` already has a `LocalBusiness` schema block with a `sameAs` array (search for `"sameAs"` in the file). It currently contains your LinkedIn, Clutch, X, Medium, and TikTok URLs. Simply add your Wikidata URI as the **first entry** in that array:

```json
"sameAs": [
  "https://www.wikidata.org/wiki/Q[YOUR_QID_HERE]",
  "https://www.linkedin.com/in/markgabriellijr",
  "https://www.linkedin.com/in/marklgabrielli/",
  "https://clutch.co/profile/mark-gabrielli-chief-marketing-officer",
  "https://x.com/markgcmo",
  "https://medium.com/@mark_louis_gabrielli_jr",
  "https://www.tiktok.com/@mark.gabrielli.cmo"
]
```

Replace `Q[YOUR_QID_HERE]` with your actual Q-number (e.g., `Q130000001`).

Putting Wikidata first is intentional. Google's entity resolution algorithm weights the first sameAs entry most heavily.

### Add a Person schema block (new, does not exist yet)

`index.html` does not currently have a standalone `Person` schema for you. Add this block anywhere in the `<head>` section alongside the other `<script type="application/ld+json">` tags:

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": "https://markcmo.com/#mark-gabrielli",
  "name": "Mark Gabrielli",
  "alternateName": "Mark Gabrielli Jr.",
  "url": "https://markcmo.com",
  "jobTitle": "Fractional CMO",
  "sameAs": [
    "https://www.wikidata.org/wiki/Q[YOUR_QID_HERE]",
    "https://www.linkedin.com/in/markgabriellijr",
    "https://clutch.co/profile/mark-gabrielli-chief-marketing-officer"
  ],
  "worksFor": {
    "@type": "Organization",
    "name": "WETYR Corp",
    "url": "https://markcmo.com"
  },
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Cape Canaveral",
    "addressRegion": "FL",
    "addressCountry": "US"
  }
}
```

Replace `Q[YOUR_QID_HERE]` with your actual Q-number.

### Update the WETYR Corp / MarkCMO Organization schema (optional)

If you create a WETYR Corp Wikidata item (Step 4), add its QID to any Organization schema block:

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "WETYR Corp",
  "alternateName": "MarkCMO",
  "url": "https://markcmo.com",
  "sameAs": [
    "https://www.wikidata.org/wiki/Q[WETYR_QID_HERE]",
    "https://www.linkedin.com/company/wetyr"
  ]
}
```

---

## Step 7: Request a Google Knowledge Panel

Google creates Knowledge Panels automatically once it has enough entity signals. The Wikidata entry is the most important trigger. Here is the full sequence:

### Automatic signals (set these up in order):

1. **Wikidata entry live** (what you just did)
2. **sameAs schema on markcmo.com** pointing to Wikidata QID (Step 6 above)
3. **Google Search Console:** Verify ownership of https://markcmo.com if not already done
   - Go to https://search.google.com/search-console
   - Add property, verify via DNS or HTML tag
4. **Request indexing** of your updated index.html in Search Console after adding the sameAs:
   - URL Inspection tool > enter your URL > Request Indexing

### Manual claim (once a panel appears):

1. Google your name: `Mark Gabrielli CMO`
2. If a Knowledge Panel appears, look for **"Claim this knowledge panel"** at the bottom
3. Click it, follow Google's identity verification flow (you will need to prove ownership of at least one listed social or website)
4. Once claimed, you can suggest edits: photo, title, links, description

### Proactive entity request (if panel does not appear in 4 weeks):

1. Go to https://support.google.com/websearch/troubleshooter/9685456
2. Select **"Report incorrect information in Knowledge Panel"** (even for missing panels, this form reaches the right team)
3. Or submit via the Google Business Profile knowledge panel feedback form

> **Realistic timeline:** 2 to 8 weeks after the Wikidata entry is indexed. Wikidata is typically indexed by Google within 3 to 7 days of creation. The panel may first appear for the query `Mark Gabrielli markcmo` before ranking for just `Mark Gabrielli`.

---

## Step 8: Reinforce the Entity Across the Web

These additional steps compound the Wikidata signal and accelerate panel generation:

| Platform | Action | Why it helps |
|---|---|---|
| Google Business Profile | Create/claim profile at https://business.google.com | Directly feeds the Knowledge Panel |
| Wikipedia | Request an article (needs a neutral third party to write it, or use the Articles for Creation process) | Strongest possible Wikidata link |
| Crunchbase | Create or claim your person profile at https://www.crunchbase.com | P2087 identifier creates a cross-reference |
| ISNI | Apply at https://isni.org (International Standard Name Identifier) | Authority file used by libraries and LLMs |
| VIAF | Often auto-created from ISNI. Check https://viaf.org and search your name | Cross-links to Wikipedia, WorldCat, national libraries |
| About.me | Create profile at https://about.me/markgabriellijr | Inexpensive signal but LLMs crawl it |

---

## Completed Checklist

- [ ] Wikidata account created
- [ ] Person Q-item created with label, description, aliases
- [ ] P31 (human), P21 (male), P27 (US citizen) added
- [ ] P106 (occupation) added: CMO, COO, management consultant
- [ ] P551 (Cape Canaveral), P131 (Florida) added
- [ ] P108 (employer = WETYR Corp) linked
- [ ] P856 (official website = markcmo.com) added with language qualifier
- [ ] P6634 (LinkedIn ID = markgabriellijr) added
- [ ] P2087 (Crunchbase ID) added if applicable
- [ ] P973 (described at URL = Clutch profile) added
- [ ] P18 (image) uploaded to Commons and linked
- [ ] References added to at least 3 core statements
- [ ] WETYR Corp Q-item created and linked
- [ ] Wikidata QID copied and saved
- [ ] index.html sameAs schema updated with Wikidata QID
- [ ] Google Search Console ownership verified
- [ ] URL re-indexed after schema update
- [ ] Google Knowledge Panel claimed (once it appears)

---

## Your Q-item Reference (fill in after creation)

| Field | Value |
|---|---|
| Person QID | `Q__________` |
| Person Wikidata URL | `https://www.wikidata.org/wiki/Q__________` |
| WETYR Corp QID | `Q__________` |
| Date created | |
| Date Knowledge Panel appeared | |

---

## Troubleshooting

**My entry was deleted:** The most common reason is no references. Re-create it and add reference URLs to every statement before saving. A P856 + P6634 + at least one press URL is the minimum safe set.

**My entry was merged with another person:** Search Wikidata for `Mark Gabrielli` before creating to check for duplicates. If a stub already exists, edit it rather than creating a new one.

**Google is not showing the panel:** Check your sameAs schema is valid using https://validator.schema.org. Confirm the Wikidata URL in sameAs is the correct Q-number. Check Google Search Console for any crawl errors on index.html.

**LinkedIn property not saving:** The value for P6634 is just the profile slug, not the full URL. Enter `markgabriellijr` without `https://www.linkedin.com/in/`.
