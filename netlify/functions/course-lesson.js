// course-lesson.js - AI-powered lesson & quiz generator via Claude
// CFO and CMO are served from hardcoded static data (instant, no API cost).
// All other courses use AI generation with JSONBin caching.

// ─── STATIC DATA - CFO & CMO (50 lessons each, instant serve) ────────────────
const CFO_DATA = require('./cfo-static-data.js');
const CMO_DATA = require('./cmo-static-data.js');
const COO_DATA = require('./coo-static-data.js');
const CEO_DATA = require('./ceo-static-data.js');
const STATIC_COURSES = { cfo: CFO_DATA, cmo: CMO_DATA, coo: COO_DATA, ceo: CEO_DATA };

// ─── FULL CURRICULUM ──────────────────────────────────────────────────────────
const CURRICULUM = {
  cmo: {
    title: 'Chief Marketing Officer Mastery',
    context: 'A rigorous executive education program for fractional CMOs, marketing leaders, and consultants who want to operate at the C-suite level, own revenue, and build $50M+ practices.',
    modules: [
      { id:'m1', title:'The CMO Mandate & Strategic Framework', lessons:[
        {id:'l1',title:'The Evolving CMO Role: From Marketer to Business Architect',keywords:['CMO mandate','revenue ownership','C-suite authority','marketing-to-revenue linkage','stakeholder alignment']},
        {id:'l2',title:'Revenue Ownership: How CMOs Build & Defend the Revenue Engine',keywords:['demand generation','pipeline ownership','marketing-sourced revenue','attribution','revenue accountability']},
        {id:'l3',title:'Stakeholder Mastery: CEO, CFO, CRO, and Board Dynamics',keywords:['executive alignment','cross-functional leadership','budget defense','marketing narrative','ROI communication']},
        {id:'l4',title:'The CMO Operating Model: Cadences, Dashboards & Decision Frameworks',keywords:['operating cadence','CMO scorecard','weekly rhythms','decision velocity','operational structure']},
        {id:'l5',title:'Fractional CMO Economics: Positioning, Pricing & Value Architecture',keywords:['fractional pricing','engagement structure','CMO compensation','value-based pricing','scope management']},
      ]},
      { id:'m2', title:'Brand Architecture & Market Positioning', lessons:[
        {id:'l1',title:'Brand Architecture Systems: House of Brands vs Branded House',keywords:['brand portfolio','architecture strategy','sub-brand design','brand hierarchy','M&A branding']},
        {id:'l2',title:'Strategic Positioning: Owning a Category vs Competing for One',keywords:['positioning strategy','category design','differentiation','brand promise','competitive moats']},
        {id:'l3',title:'Brand Equity: Measuring, Protecting & Monetizing Intangible Assets',keywords:['brand equity valuation','NPS correlation','brand premium','brand health metrics','share of mind']},
        {id:'l4',title:'Rebranding Without Losing Equity: Strategy & Execution',keywords:['rebrand strategy','equity transfer','change management','brand migration','stakeholder risk']},
        {id:'l5',title:'Performance vs Brand: The False Dichotomy & How to Win Both',keywords:['brand vs performance','long-term brand building','Binet & Field','mental availability','marketing investment mix']},
      ]},
      { id:'m3', title:'Revenue Attribution & Analytics', lessons:[
        {id:'l1',title:'Multi-Touch Attribution: MTA, MMM, and the Incrementality Debate',keywords:['attribution modeling','multi-touch','media mix modeling','incrementality testing','last-click fallacy']},
        {id:'l2',title:'Marketing Mix Modeling at Scale: What CMOs Actually Need to Know',keywords:['MMM methodology','cross-channel allocation','econometric modeling','data requirements','executive communication']},
        {id:'l3',title:'CMO Dashboard Architecture: What to Show the Board',keywords:['executive dashboard','KPI selection','north star metrics','board reporting','marketing scorecard']},
        {id:'l4',title:'Predictive Revenue Forecasting: Marketing-Led Models',keywords:['revenue forecasting','pipeline modeling','cohort analysis','marketing signals','forecast accuracy']},
        {id:'l5',title:'Data Infrastructure for CMOs: What to Own, What to Delegate',keywords:['CDP','data warehouse','MarTech data','first-party data strategy','privacy-safe analytics']},
      ]},
      { id:'m4', title:'Demand Generation Architecture', lessons:[
        {id:'l1',title:'Demand Generation vs Lead Generation: The Strategic Difference',keywords:['dark funnel','demand creation','MQL vs pipeline','brand-led demand','buyer intent signals']},
        {id:'l2',title:'ABM at Scale: From Target Account Lists to Revenue',keywords:['account-based marketing','tier 1-2-3 segmentation','ABM orchestration','sales-marketing alignment','account selection']},
        {id:'l3',title:'Pipeline Architecture: Building the Revenue Machine That Never Stops',keywords:['pipeline management','conversion rates','pipeline velocity','funnel optimization','forecast health']},
        {id:'l4',title:'Lead Scoring 3.0: Behavioral, Firmographic & Predictive Models',keywords:['lead scoring','predictive scoring','behavioral signals','firmographic fit','MQL definition']},
        {id:'l5',title:'The Demand Gen Tech Stack: Build vs Buy vs Rent',keywords:['MAP selection','6sense','Demandbase','tech evaluation','integration architecture']},
      ]},
      { id:'m5', title:'Content Strategy & Thought Leadership', lessons:[
        {id:'l1',title:'Content Architecture: The System That Scales Without You',keywords:['content pillar model','content operations','editorial calendar','repurposing system','content ROI']},
        {id:'l2',title:'Thought Leadership That Generates Revenue: Beyond Vanity Metrics',keywords:['executive thought leadership','B2B thought leadership','POV development','media strategy','credibility building']},
        {id:'l3',title:'SEO as a Strategic Asset: The CMO Playbook',keywords:['SEO strategy','organic growth','topical authority','content-SEO integration','competitive SEO analysis']},
        {id:'l4',title:'Content Distribution: The 80/20 Most CMOs Get Backwards',keywords:['content distribution','syndication','amplification strategy','owned vs earned vs paid','content promotion']},
        {id:'l5',title:'Content ROI: Attributing Revenue to Content in a Complex World',keywords:['content attribution','assisted conversions','influence modeling','content performance','revenue impact']},
      ]},
      { id:'m6', title:'Marketing Technology & AI', lessons:[
        {id:'l1',title:'MarTech Stack Architecture: Designing for Revenue, Not Features',keywords:['MarTech audit','stack rationalization','vendor consolidation','integration architecture','total cost of ownership']},
        {id:'l2',title:'CRM Strategy for CMOs: Owning the Customer Data Asset',keywords:['CRM governance','data hygiene','Salesforce strategy','HubSpot vs Salesforce','CRM adoption']},
        {id:'l3',title:'Marketing Automation at Scale: Workflows That Actually Convert',keywords:['MAP strategy','automation architecture','nurture programs','lifecycle marketing','behavioral triggers']},
        {id:'l4',title:'AI in Marketing: Where to Deploy, Where to Avoid',keywords:['AI marketing use cases','generative AI','predictive AI','AI risk in marketing','AI governance']},
        {id:'l5',title:'Data Privacy & Zero-Party Data Strategy Post-Cookie',keywords:['cookie deprecation','first-party data','zero-party data','consent management','privacy-first marketing']},
      ]},
      { id:'m7', title:'Product Marketing & GTM Strategy', lessons:[
        {id:'l1',title:'Product-Market Fit: The CMO\'s Diagnostic Toolkit',keywords:['PMF signals','Sean Ellis test','retention curves','NPS cohort analysis','customer interviews']},
        {id:'l2',title:'Go-to-Market Strategy Architecture: 7 Decisions Before Launch',keywords:['GTM design','ICP definition','channel selection','messaging architecture','launch readiness']},
        {id:'l3',title:'Launch Architecture: The Difference Between Ripple and Wave',keywords:['product launch strategy','launch phases','pre-launch momentum','launch KPIs','post-launch optimization']},
        {id:'l4',title:'Pricing Strategy as a Marketing Lever',keywords:['pricing psychology','value-based pricing','pricing research','price positioning','tiered pricing']},
        {id:'l5',title:'Channel Strategy: Direct vs Indirect vs Platform',keywords:['channel selection','partner channel','marketplace strategy','direct sales','channel economics']},
      ]},
      { id:'m8', title:'B2B Marketing Mastery', lessons:[
        {id:'l1',title:'B2B Buying Committees: Marketing to 6-10 Stakeholders Simultaneously',keywords:['buying committee','champion enablement','multi-threaded selling','consensus purchasing','economic buyer']},
        {id:'l2',title:'B2B Content Strategy: Creating Content That Moves Deals Forward',keywords:['sales enablement','B2B content audit','mid-funnel content','deal acceleration','content for objections']},
        {id:'l3',title:'Sales-Marketing Alignment: Building the Revenue Partnership',keywords:['SLA between sales and marketing','lead handoff','marketing attribution','joint planning','revenue council']},
        {id:'l4',title:'Account-Based Experience (ABX): The Next Evolution of ABM',keywords:['ABX design','personalization at scale','digital body language','account health scoring','cross-channel ABX']},
        {id:'l5',title:'Partner & Channel Marketing: Amplifying Revenue Without Adding Headcount',keywords:['channel marketing','partner enablement','co-marketing','MDF programs','partner attribution']},
      ]},
      { id:'m9', title:'Growth & International Expansion', lessons:[
        {id:'l1',title:'Growth Marketing: Loops, Flywheels & Compounding Systems',keywords:['growth loops','viral coefficients','referral programs','PLG motion','growth accounting']},
        {id:'l2',title:'Category Creation: How to Design a Market You Can Dominate',keywords:['category design','point of view','category evangelism','language lock-in','market design']},
        {id:'l3',title:'International Market Entry: Marketing Localization at Scale',keywords:['market entry strategy','localization vs adaptation','global brand standards','local marketing autonomy','international GTM']},
        {id:'l4',title:'Marketing During Uncertainty: Recession, Disruption & Downturn',keywords:['recession marketing','budget cuts','brand protection','performance marketing shift','downturn strategy']},
        {id:'l5',title:'Retention as Growth: Customer Marketing Architecture',keywords:['customer marketing','expansion revenue','churn prevention','NPS to revenue','advocacy programs']},
      ]},
      { id:'m10', title:'CMO Leadership & Executive Presence', lessons:[
        {id:'l1',title:'Building High-Performance Marketing Teams: Hiring, Structure & Culture',keywords:['marketing org design','hiring for outcomes','team structure','marketing culture','performance management']},
        {id:'l2',title:'Managing Up: Communicating with CEOs, CFOs & Boards',keywords:['executive communication','board presentation','budget defense','marketing narrative','ROI storytelling']},
        {id:'l3',title:'Navigating CMO Politics: Allies, Adversaries & Coalition Building',keywords:['executive politics','coalition building','CMO survival','organizational influence','stakeholder mapping']},
        {id:'l4',title:'Budget Architecture: Negotiating, Defending & Reallocating',keywords:['marketing budget model','zero-based budgeting','budget negotiation','ROI modeling','budget defense']},
        {id:'l5',title:'The CMO 90-Day Framework: Diagnosing, Prioritizing & Winning Early',keywords:['CMO onboarding','first 90 days','quick wins','diagnostic framework','CMO transition']},
      ]},
    ]
  },

  coo: {
    title: 'Chief Operating Officer Mastery',
    context: 'A comprehensive executive program for fractional COOs and operations leaders who want to architect, scale, and optimize the systems that drive business performance from $1M to $50M+.',
    modules: [
      { id:'m1', title:'The COO Role & Operational Leadership', lessons:[
        {id:'l1',title:'The COO Mandate: From Executor to Strategic Architect',keywords:['COO role','strategic operations','execution leadership','CEO partnership','COO typology']},
        {id:'l2',title:'The CEO-COO Partnership: Designing the Most Important Working Relationship',keywords:['CEO-COO dynamic','role clarity','decision rights','communication protocols','friction management']},
        {id:'l3',title:'Operational Philosophy: Designing Your Leadership Framework',keywords:['operational philosophy','management principles','leadership style','decision-making framework','operating beliefs']},
        {id:'l4',title:'The COO 90-Day Playbook: Diagnosing & Fixing the Business Fast',keywords:['operational audit','first 90 days','quick wins','organizational diagnosis','COO onboarding']},
        {id:'l5',title:'COO Compensation & Equity: Structuring Your Deal',keywords:['COO compensation','equity negotiation','vesting schedules','fractional COO pricing','performance bonuses']},
      ]},
      { id:'m2', title:'Strategy to Execution Excellence', lessons:[
        {id:'l1',title:'OKR Architecture: From Company Goals to Daily Actions',keywords:['OKR design','objective setting','key result construction','OKR cadence','OKR failure modes']},
        {id:'l2',title:'Business Model Analysis & Redesign',keywords:['business model canvas','unit economics','revenue model','margin architecture','business model innovation']},
        {id:'l3',title:'Strategic Execution: Closing the Strategy-Execution Gap',keywords:['execution discipline','strategic priorities','initiative management','execution accountability','strategy cascade']},
        {id:'l4',title:'Prioritization Frameworks for Operators',keywords:['prioritization methods','ICE scoring','RICE framework','portfolio management','resource allocation']},
        {id:'l5',title:'The Operating Cadence: Weekly, Monthly, Quarterly Rhythms',keywords:['operating cadence','meeting architecture','QBR design','weekly leadership meeting','management rhythms']},
      ]},
      { id:'m3', title:'Process Excellence & Operational Design', lessons:[
        {id:'l1',title:'Process Mapping at Scale: Value Stream Analysis',keywords:['process mapping','value stream mapping','swimlane diagrams','process documentation','workflow design']},
        {id:'l2',title:'Lean Operations: Eliminating Waste in Service & Knowledge Work',keywords:['lean methodology','waste identification','continuous improvement','kaizen','lean for services']},
        {id:'l3',title:'Six Sigma for Executives: What Operators Must Know',keywords:['six sigma concepts','DMAIC','statistical process control','quality management','defect reduction']},
        {id:'l4',title:'Bottleneck Theory & Constraint Management',keywords:['theory of constraints','bottleneck identification','throughput optimization','capacity planning','constraint elevation']},
        {id:'l5',title:'Process Automation: Where to Start, What to Avoid',keywords:['process automation','RPA','workflow automation','automation ROI','automation governance']},
      ]},
      { id:'m4', title:'Technology & Digital Operations', lessons:[
        {id:'l1',title:'Digital Transformation: The COO Playbook',keywords:['digital transformation','change management','technology adoption','digital maturity','transformation roadmap']},
        {id:'l2',title:'ERP & Core Systems Strategy: Selection, Implementation & Governance',keywords:['ERP selection','NetSuite','SAP','system implementation','data governance']},
        {id:'l3',title:'Data Architecture for Operators: Building the Intelligence Layer',keywords:['data warehouse','BI strategy','operational analytics','data governance','KPI infrastructure']},
        {id:'l4',title:'Cybersecurity Operations: The COO\'s Risk Responsibility',keywords:['cybersecurity framework','risk assessment','incident response','vendor security','security governance']},
        {id:'l5',title:'AI in Operations: Deployment, Risk & Governance',keywords:['AI operations','AI risk management','AI governance','automation ethics','AI ROI assessment']},
      ]},
      { id:'m5', title:'Financial Operations & P&L Management', lessons:[
        {id:'l1',title:'P&L Ownership: The COO\'s Financial Mastery',keywords:['P&L management','margin optimization','cost structure','revenue recognition','financial drivers']},
        {id:'l2',title:'Unit Economics: The Operational Drivers of CAC and LTV',keywords:['unit economics','CAC','LTV','payback period','cohort economics','margin per unit']},
        {id:'l3',title:'Cash Flow Management: The COO\'s Cash Discipline',keywords:['cash flow','working capital','cash conversion cycle','liquidity management','cash forecasting']},
        {id:'l4',title:'Financial Controls & Compliance Architecture',keywords:['internal controls','SOX compliance','audit readiness','fraud prevention','financial governance']},
        {id:'l5',title:'Capital Allocation: Deciding Where to Invest for Maximum Return',keywords:['capital allocation','investment framework','ROI analysis','opportunity cost','hurdle rates']},
      ]},
      { id:'m6', title:'Supply Chain & Vendor Management', lessons:[
        {id:'l1',title:'Supply Chain Design: Resilience vs Efficiency',keywords:['supply chain design','resilience','just-in-time','buffer inventory','supply chain risk']},
        {id:'l2',title:'Strategic Vendor Selection & Relationship Management',keywords:['vendor selection','vendor scorecard','vendor risk','sole-source risk','vendor negotiation']},
        {id:'l3',title:'Contract Negotiation for Operators',keywords:['contract negotiation','SLA design','terms optimization','contract governance','vendor contracts']},
        {id:'l4',title:'Logistics & Fulfillment Optimization',keywords:['logistics strategy','3PL management','fulfillment optimization','last-mile delivery','returns management']},
        {id:'l5',title:'Supply Chain Risk Management & Diversification',keywords:['supply chain risk','diversification strategy','scenario planning','risk mitigation','business continuity']},
      ]},
      { id:'m7', title:'Human Capital Operations', lessons:[
        {id:'l1',title:'Organizational Design: Structure for Performance',keywords:['org design principles','spans and layers','functional vs divisional','matrix organizations','org restructuring']},
        {id:'l2',title:'Talent Acquisition Systems at Scale',keywords:['recruiting systems','candidate pipeline','interview process','employer brand','hiring velocity']},
        {id:'l3',title:'Performance Management Architecture',keywords:['performance review design','goal-setting systems','feedback culture','PIP process','high performer retention']},
        {id:'l4',title:'Culture Operations: Building Culture That Scales',keywords:['culture by design','values operationalization','culture measurement','remote culture','culture in scaling']},
        {id:'l5',title:'Compensation Architecture: Designing Pay for Performance',keywords:['compensation strategy','equity distribution','sales comp design','pay for performance','compensation benchmarking']},
      ]},
      { id:'m8', title:'Customer Operations & Experience', lessons:[
        {id:'l1',title:'Customer Experience Design: Journey Mapping for Operations',keywords:['CX design','journey mapping','touchpoint optimization','moments of truth','experience metrics']},
        {id:'l2',title:'Customer Success Operations: From Support to Revenue',keywords:['customer success','CSM structure','health scores','QBR design','expansion revenue ops']},
        {id:'l3',title:'Support Operations: Designing the Tier-0 to Tier-3 Model',keywords:['support tiers','self-service design','ticket deflection','support metrics','support technology']},
        {id:'l4',title:'Voice of Customer (VOC) Programs That Drive Decisions',keywords:['VOC program design','NPS operations','CSAT','CES','customer insight systems']},
        {id:'l5',title:'CX Metrics: What Operators Actually Need to Measure',keywords:['CX metrics','CSAT vs NPS','effort score','retention correlation','CX ROI']},
      ]},
      { id:'m9', title:'Growth Operations & Scaling Systems', lessons:[
        {id:'l1',title:'Scaling Systems: What Works at $1M vs $10M vs $50M',keywords:['scaling operations','operational leverage','systems vs people','growth inflection points','operational complexity']},
        {id:'l2',title:'M&A Operations: Integration Playbook',keywords:['M&A integration','PMI','synergy realization','cultural integration','deal execution']},
        {id:'l3',title:'International Operations: Global Expansion Playbook',keywords:['international operations','entity structure','global compliance','international hiring','cross-border operations']},
        {id:'l4',title:'Operating Architecture for $50M+ Scale',keywords:['enterprise operations','shared services','operational maturity','COE design','operational efficiency']},
        {id:'l5',title:'Building the Operating System: From Chaos to Machine',keywords:['operating system design','management infrastructure','decision architecture','org capability building','operational excellence']},
      ]},
      { id:'m10', title:'Risk, Compliance & COO Leadership', lessons:[
        {id:'l1',title:'Enterprise Risk Management: The COO\'s Risk Framework',keywords:['ERM framework','risk matrix','risk appetite','risk registers','operational risk']},
        {id:'l2',title:'Regulatory Compliance Operations',keywords:['compliance program','regulatory landscape','compliance risk','audit management','compliance culture']},
        {id:'l3',title:'Business Continuity & Disaster Recovery',keywords:['BCP','disaster recovery','operational resilience','crisis response','recovery time objectives']},
        {id:'l4',title:'Crisis Management: Operational Response Architecture',keywords:['crisis management','incident command','crisis communication','recovery operations','post-crisis learning']},
        {id:'l5',title:'COO Legacy: Leading Beyond Operations',keywords:['COO legacy','executive impact','strategic contribution','building successors','COO to CEO']},
      ]},
    ]
  },

  digital: {
    title: 'Digital Marketing Mastery',
    context: 'A comprehensive digital marketing program covering all channels, strategies, and analytics needed to dominate digital marketing in 2026 and beyond.',
    modules: [
      { id:'m1', title:'Digital Marketing Strategy & Architecture', lessons:[
        {id:'l1',title:'The Integrated Digital Marketing Framework',keywords:['digital strategy','channel integration','POEM model','digital marketing funnel','omnichannel']},
        {id:'l2',title:'Audience Research & Persona Architecture',keywords:['audience research','buyer personas','jobs to be done','psychographics','ICP development']},
        {id:'l3',title:'Competitive Digital Intelligence',keywords:['competitive analysis','SEMrush','SimilarWeb','share of search','digital competitive audit']},
        {id:'l4',title:'Digital Marketing Measurement: Building Your KPI Architecture',keywords:['digital KPIs','GA4','conversion tracking','attribution setup','analytics architecture']},
      ]},
      { id:'m2', title:'Search Engine Optimization (SEO)', lessons:[
        {id:'l1',title:'Technical SEO: The Foundation That Compounds',keywords:['technical SEO','Core Web Vitals','crawlability','indexation','schema markup']},
        {id:'l2',title:'Topical Authority: The New SEO Moat',keywords:['topical authority','content clusters','semantic SEO','entity optimization','E-E-A-T']},
        {id:'l3',title:'Link Acquisition at Scale: White-Hat Systems',keywords:['link building','digital PR','authority building','link prospecting','relationship-based SEO']},
        {id:'l4',title:'Local & International SEO Strategy',keywords:['local SEO','international SEO','hreflang','Google Business Profile','multi-location SEO']},
      ]},
      { id:'m3', title:'Paid Search & PPC Mastery', lessons:[
        {id:'l1',title:'Google Ads Architecture: Campaign Structure That Scales',keywords:['Google Ads structure','ad account architecture','campaign types','quality score','bidding strategy']},
        {id:'l2',title:'Microsoft Ads & Search Network Diversification',keywords:['Microsoft Ads','Bing Ads','search network strategy','audience intelligence','B2B search']},
        {id:'l3',title:'Search Audience Strategy: RLSA, Customer Match & Lookalikes',keywords:['RLSA','customer match','lookalike audiences','audience layering','first-party data in paid search']},
        {id:'l4',title:'PPC Analytics & Optimization at Scale',keywords:['PPC optimization','Quality Score improvement','A/B testing ads','automated bidding','PPC reporting']},
      ]},
      { id:'m4', title:'Social Media Marketing', lessons:[
        {id:'l1',title:'Social Strategy Architecture: Organic vs Paid Integration',keywords:['social strategy','organic social','paid social','social media funnel','platform selection']},
        {id:'l2',title:'LinkedIn Marketing for B2B: Lead Generation at Scale',keywords:['LinkedIn ads','LinkedIn organic','thought leadership','LinkedIn lead gen forms','B2B social']},
        {id:'l3',title:'Meta Advertising: The Complete Playbook',keywords:['Facebook ads','Instagram ads','Meta pixel','custom audiences','creative strategy Meta']},
        {id:'l4',title:'TikTok, YouTube & Short-Form Video Strategy',keywords:['TikTok marketing','YouTube strategy','short-form video','video SEO','content creation at scale']},
      ]},
      { id:'m5', title:'Email Marketing & Marketing Automation', lessons:[
        {id:'l1',title:'Email Marketing Architecture: List, Segmentation & Deliverability',keywords:['email list building','segmentation strategy','email deliverability','sender reputation','email hygiene']},
        {id:'l2',title:'Lifecycle Email Sequences That Convert',keywords:['welcome sequence','nurture email','behavioral triggers','email personalization','lifecycle marketing']},
        {id:'l3',title:'Marketing Automation Workflows at Scale',keywords:['marketing automation','workflow design','lead scoring','MAP selection','automation testing']},
        {id:'l4',title:'Email Analytics: Opens, Clicks & Revenue Attribution',keywords:['email metrics','revenue attribution','email A/B testing','deliverability metrics','email ROI']},
      ]},
      { id:'m6', title:'Content Marketing & SEO Content', lessons:[
        {id:'l1',title:'Content Strategy for Organic Growth: The Topical Authority Model',keywords:['content strategy','topical authority','content calendar','content types','content planning']},
        {id:'l2',title:'Content Creation at Scale: AI-Augmented Workflows',keywords:['AI content creation','content scaling','editorial workflow','quality control','content operations']},
        {id:'l3',title:'Video Marketing: Strategy, Production & Distribution',keywords:['video marketing','video SEO','YouTube strategy','video content','video ROI']},
        {id:'l4',title:'Podcast Marketing & Audio Strategy',keywords:['podcast strategy','podcast marketing','audio SEO','podcast ROI','distribution strategy']},
      ]},
      { id:'m7', title:'Conversion Rate Optimization (CRO)', lessons:[
        {id:'l1',title:'CRO Architecture: Building a Testing Culture',keywords:['CRO methodology','A/B testing','experimentation culture','testing velocity','statistical significance']},
        {id:'l2',title:'Landing Page Optimization: Principles That Compound',keywords:['landing page design','conversion principles','heatmaps','user testing','page speed']},
        {id:'l3',title:'Funnel Optimization: From Click to Customer',keywords:['funnel analysis','drop-off points','funnel optimization','checkout optimization','micro-conversions']},
        {id:'l4',title:'Personalization at Scale: Dynamic Experiences That Convert',keywords:['web personalization','dynamic content','behavioral targeting','personalization tools','segmentation']},
      ]},
      { id:'m8', title:'Digital Analytics & Data Strategy', lessons:[
        {id:'l1',title:'GA4 Mastery: Advanced Configuration & Analysis',keywords:['GA4 setup','custom events','funnel reports','audience segments','GA4 explorations']},
        {id:'l2',title:'Data Studio & Dashboard Architecture',keywords:['Looker Studio','dashboard design','data visualization','reporting automation','executive dashboards']},
        {id:'l3',title:'Customer Journey Analytics: Cross-Channel Attribution',keywords:['customer journey','cross-channel analytics','attribution models','data-driven attribution','journey mapping']},
        {id:'l4',title:'Privacy-First Analytics: Cookieless Measurement',keywords:['first-party data','server-side tagging','privacy sandbox','consent management','cookieless analytics']},
      ]},
      { id:'m9', title:'E-commerce & DTC Marketing', lessons:[
        {id:'l1',title:'E-commerce Marketing Architecture: Acquisition to Retention',keywords:['ecommerce marketing','DTC strategy','retention marketing','ROAS','ecommerce funnel']},
        {id:'l2',title:'Google Shopping & Performance Max',keywords:['Google Shopping','Performance Max','product feed optimization','smart campaigns','shopping attribution']},
        {id:'l3',title:'Marketplace Marketing: Amazon, eBay & Platform Strategy',keywords:['Amazon marketing','marketplace SEO','Amazon PPC','marketplace strategy','platform diversification']},
        {id:'l4',title:'Retention Marketing: Email, SMS & Loyalty',keywords:['retention marketing','email retention','SMS marketing','loyalty programs','churn prevention']},
      ]},
      { id:'m10', title:'Advanced Digital Strategy & Leadership', lessons:[
        {id:'l1',title:'AI & Automation in Digital Marketing: The 2026 Landscape',keywords:['AI marketing tools','automation strategy','AI content','predictive marketing','marketing AI governance']},
        {id:'l2',title:'Digital Marketing Team Architecture & Agency Management',keywords:['marketing team structure','agency management','in-house vs agency','freelancer management','team building']},
        {id:'l3',title:'Digital Marketing Budget Architecture & ROI Defense',keywords:['marketing budget','channel allocation','ROI defense','budget modeling','performance reporting']},
        {id:'l4',title:'Future-Proofing Your Digital Strategy',keywords:['emerging platforms','Web3 marketing','AR/VR marketing','future of search','AI disruption']},
      ]},
    ]
  },

  linkedin: {
    title: 'LinkedIn Growth Machine',
    context: 'Master LinkedIn from algorithm to revenue. Build authority, generate leads, and close clients using the world\'s most powerful B2B platform.',
    modules: [
      { id:'m1', title:'LinkedIn Algorithm & Platform Mastery', lessons:[
        {id:'l1',title:'How the LinkedIn Algorithm Actually Works in 2026',keywords:['LinkedIn algorithm','dwell time','early engagement','distribution signals','reach optimization']},
        {id:'l2',title:'LinkedIn Profile Architecture: Your Personal Sales Page',keywords:['LinkedIn profile optimization','headline strategy','about section','featured section','social proof']},
        {id:'l3',title:'LinkedIn Analytics: Reading the Signals That Matter',keywords:['LinkedIn analytics','post analytics','profile views','search appearances','audience insights']},
        {id:'l4',title:'LinkedIn Network Strategy: Who to Connect With & Why',keywords:['connection strategy','network building','ICP connections','network value','LinkedIn network architecture']},
      ]},
      { id:'m2', title:'Content Strategy for Authority', lessons:[
        {id:'l1',title:'The Content Pillars System: Never Run Out of Ideas',keywords:['content pillars','content ideation','editorial calendar','evergreen content','LinkedIn content strategy']},
        {id:'l2',title:'LinkedIn Content Formats: Which Performs & When',keywords:['LinkedIn post formats','carousels','newsletters','articles','video vs text']},
        {id:'l3',title:'Hook Writing for LinkedIn: Stopping the Scroll',keywords:['LinkedIn hooks','first line','attention-grabbing','scroll-stopping','hook formulas']},
        {id:'l4',title:'The Engagement Architecture: Comments, Reposts & DMs',keywords:['engagement strategy','comment strategy','community building','engagement pods','authentic engagement']},
      ]},
      { id:'m3', title:'Thought Leadership & Personal Brand', lessons:[
        {id:'l1',title:'Positioning Your Thought Leadership: Finding Your Unique Angle',keywords:['thought leadership positioning','contrarian POV','niche authority','expertise differentiation','category ownership']},
        {id:'l2',title:'The POV Framework: Building Beliefs That Attract Clients',keywords:['point of view','belief system','content ideology','audience alignment','POV development']},
        {id:'l3',title:'Building Credibility Through Social Proof & Case Studies',keywords:['social proof','case study content','results-based content','testimonials','credibility signals']},
        {id:'l4',title:'LinkedIn Newsletter: Building a Captive Audience',keywords:['LinkedIn newsletter','newsletter strategy','subscriber growth','newsletter monetization','newsletter content']},
      ]},
      { id:'m4', title:'Lead Generation Systems', lessons:[
        {id:'l1',title:'Inbound Lead Generation: Content That Attracts & Converts',keywords:['inbound LinkedIn','content-led leads','CTA strategy','lead magnets','DM conversion']},
        {id:'l2',title:'Outbound Prospecting: LinkedIn Outreach That Gets Replies',keywords:['LinkedIn outreach','connection request strategy','outreach sequences','personalization at scale','DM templates']},
        {id:'l3',title:'Sales Navigator: Advanced Prospecting Architecture',keywords:['Sales Navigator','advanced search','lead lists','InMail strategy','account targeting']},
        {id:'l4',title:'The DM-to-Discovery Call System',keywords:['DM to call conversion','discovery call booking','LinkedIn sales process','pipeline from LinkedIn','call to action']},
      ]},
      { id:'m5', title:'LinkedIn Ads & Paid Strategy', lessons:[
        {id:'l1',title:'LinkedIn Ads Architecture: Objectives, Targeting & Budgets',keywords:['LinkedIn ads','campaign manager','targeting options','audience targeting','LinkedIn CPM']},
        {id:'l2',title:'Sponsored Content That Converts: Ad Creative Strategy',keywords:['sponsored content','ad creative','thought leader ads','document ads','video ads LinkedIn']},
        {id:'l3',title:'LinkedIn Lead Gen Forms: The Highest-Converting B2B Format',keywords:['lead gen forms','form optimization','follow-up sequences','form conversion rates','lead quality']},
        {id:'l4',title:'LinkedIn Retargeting & Account-Based Advertising',keywords:['LinkedIn retargeting','website retargeting','account-based ads','matched audiences','LinkedIn ABM']},
      ]},
      { id:'m6', title:'LinkedIn Automation & Scale', lessons:[
        {id:'l1',title:'Ethical LinkedIn Automation: Tools, Limits & Best Practices',keywords:['LinkedIn automation','automation tools','platform limits','automation risks','sustainable automation']},
        {id:'l2',title:'Content Repurposing Systems: One Idea, 10 Posts',keywords:['content repurposing','content calendar','batch creation','repurposing workflow','content machine']},
        {id:'l3',title:'Team LinkedIn Strategy: Amplifying Through Employee Advocacy',keywords:['employee advocacy','team LinkedIn','social selling','advocacy programs','amplification strategy']},
        {id:'l4',title:'LinkedIn for Company Pages: When It Works & When It Doesn\'t',keywords:['company page strategy','company page content','company page vs personal','sponsored content','follower growth']},
      ]},
      { id:'m7', title:'Monetization & Revenue', lessons:[
        {id:'l1',title:'LinkedIn-to-Revenue: Building the Pipeline Machine',keywords:['LinkedIn revenue','pipeline from LinkedIn','consulting leads','client acquisition','ROI from LinkedIn']},
        {id:'l2',title:'Pricing & Packaging for LinkedIn-Sourced Clients',keywords:['consulting pricing','proposal strategy','value communication','closing inbound leads','pricing conversations']},
        {id:'l3',title:'LinkedIn for Events, Webinars & Product Launches',keywords:['LinkedIn events','webinar promotion','product launch','event registration','community activation']},
        {id:'l4',title:'Building a LinkedIn Coaching or Course Business',keywords:['LinkedIn monetization','course business','community building','membership business','digital products']},
      ]},
      { id:'m8', title:'Advanced LinkedIn Strategy', lessons:[
        {id:'l1',title:'LinkedIn Creator Mode & Creator Tools',keywords:['LinkedIn creator','creator mode','audio events','LinkedIn live','creator analytics']},
        {id:'l2',title:'Competitive Intelligence via LinkedIn',keywords:['LinkedIn competitive intel','competitor research','industry monitoring','talent intelligence','market research']},
        {id:'l3',title:'LinkedIn for Executive Search & Career Strategy',keywords:['executive LinkedIn','career positioning','recruiter optimization','executive brand','career pivots']},
        {id:'l4',title:'The 2026 LinkedIn Playbook: What\'s Working Now',keywords:['LinkedIn trends 2026','platform changes','emerging formats','algorithm shifts','future of LinkedIn']},
      ]},
    ]
  },

  instagram: {
    title: 'Instagram for Business',
    context: 'Build a revenue-generating Instagram presence using strategic content, algorithm mastery, and conversion architecture.',
    modules: [
      { id:'m1', title:'Platform Strategy & Algorithm Mastery', lessons:[
        {id:'l1',title:'Instagram Algorithm 2026: How Reach Actually Works',keywords:['Instagram algorithm','reach','interest signals','engagement signals','distribution system']},
        {id:'l2',title:'Account Architecture: Profile, Niche & Positioning',keywords:['Instagram profile optimization','bio strategy','niche selection','brand positioning','account strategy']},
        {id:'l3',title:'Instagram Analytics: The Metrics That Actually Drive Growth',keywords:['Instagram insights','reach vs impressions','follower demographics','content performance','growth analytics']},
        {id:'l4',title:'Audience Research & Competitive Analysis',keywords:['Instagram audience research','competitor analysis','hashtag research','audience insights','market positioning']},
      ]},
      { id:'m2', title:'Visual Branding & Aesthetic', lessons:[
        {id:'l1',title:'Brand Aesthetic Architecture: Building a Recognizable Visual Identity',keywords:['brand aesthetic','color palette','visual consistency','grid strategy','brand recognition']},
        {id:'l2',title:'Graphic Design for Non-Designers: Canva & Tools at Scale',keywords:['Canva for business','template systems','brand kit','design at scale','visual content creation']},
        {id:'l3',title:'Photography & Videography Fundamentals for Business',keywords:['product photography','lifestyle photography','lighting basics','smartphone photography','visual storytelling']},
        {id:'l4',title:'Carousel Design: The Highest-Engagement Format',keywords:['carousel posts','carousel design','slide-based content','data visualization','educational carousels']},
      ]},
      { id:'m3', title:'Reels Strategy & Video Content', lessons:[
        {id:'l1',title:'Reels Algorithm & Viral Architecture',keywords:['Reels algorithm','viral potential','watch time','Reels distribution','Reels optimization']},
        {id:'l2',title:'Scripting & Hooking: The First 3 Seconds That Win',keywords:['video hook','script writing','attention retention','pattern interrupt','Reels structure']},
        {id:'l3',title:'Batch Creation Systems: Producing 30 Reels in a Day',keywords:['content batching','production workflow','content calendar','Reels production','efficiency systems']},
        {id:'l4',title:'Trending Audio, Effects & Format Strategy',keywords:['trending audio','Reels trends','effects strategy','trend hijacking','authentic vs trending']},
      ]},
      { id:'m4', title:'Stories, Lives & Community Building', lessons:[
        {id:'l1',title:'Instagram Stories as a Revenue Channel',keywords:['Stories strategy','swipe-up links','Stories for sales','interactive stickers','Stories funnel']},
        {id:'l2',title:'Instagram Live: Building Real-Time Connection & Revenue',keywords:['Instagram Live','live strategy','live shopping','live audience building','live content planning']},
        {id:'l3',title:'Community Building: From Followers to a Tribe',keywords:['community building','brand community','DM strategy','community management','brand advocates']},
        {id:'l4',title:'Collaborations, Partnerships & Creator Collabs',keywords:['Instagram collabs','brand partnerships','creator economy','influencer strategy','collaboration outreach']},
      ]},
      { id:'m5', title:'Hashtag & Discovery Strategy', lessons:[
        {id:'l1',title:'Hashtag Strategy in 2026: Still Relevant or Obsolete?',keywords:['hashtag strategy','hashtag research','reach through hashtags','hashtag types','hashtag testing']},
        {id:'l2',title:'Instagram SEO: Keyword Optimization for Discovery',keywords:['Instagram SEO','keyword in captions','profile SEO','explore page optimization','Instagram search']},
        {id:'l3',title:'The Explore Page: Getting Featured & Staying Featured',keywords:['Explore page','Explore page algorithm','content virality','Explore optimization','account signals']},
        {id:'l4',title:'Cross-Platform Amplification: Instagram to Other Channels',keywords:['cross-platform','content repurposing','Instagram to Pinterest','TikTok to Instagram','multi-platform strategy']},
      ]},
      { id:'m6', title:'Instagram Ads & Paid Strategy', lessons:[
        {id:'l1',title:'Instagram Ads Architecture: Objectives, Placements & Audiences',keywords:['Instagram ads','ad objectives','placement strategy','audience targeting','ROAS optimization']},
        {id:'l2',title:'Creative Strategy for Instagram Ads: What Stops the Scroll',keywords:['Instagram ad creative','UGC ads','video ads','carousel ads','creative testing']},
        {id:'l3',title:'Instagram Retargeting & Customer Lookalikes',keywords:['Instagram retargeting','custom audiences','lookalike audiences','website visitors','engagement retargeting']},
        {id:'l4',title:'Influencer Marketing: Strategy, Negotiation & ROI',keywords:['influencer marketing','influencer selection','brief creation','influencer negotiation','influencer ROI']},
      ]},
      { id:'m7', title:'Instagram Shopping & E-commerce', lessons:[
        {id:'l1',title:'Instagram Shopping Setup & Product Catalogue Architecture',keywords:['Instagram Shopping','product catalog','shopping tags','checkout on Instagram','shopping setup']},
        {id:'l2',title:'Shoppable Content Strategy: Integrating Sales Into Content',keywords:['shoppable posts','product tags','shopping stories','shop tab optimization','social commerce']},
        {id:'l3',title:'Instagram DM Commerce: From DM to Checkout',keywords:['DM selling','conversational commerce','DM automation','Manychat','DM funnel']},
        {id:'l4',title:'Drop Culture & Limited Edition Launches on Instagram',keywords:['product launches','drop strategy','FOMO marketing','limited edition','launch strategy']},
      ]},
      { id:'m8', title:'Growth Strategy & Revenue Architecture', lessons:[
        {id:'l1',title:'Follower Growth Systems: Organic Strategies That Compound',keywords:['follower growth','organic growth systems','growth hacking Instagram','growth loops','sustainable growth']},
        {id:'l2',title:'Monetization Architecture: 7 Revenue Streams from Instagram',keywords:['Instagram monetization','creator fund','brand deals','affiliate marketing','product sales','Instagram income']},
        {id:'l3',title:'Building a Personal Brand That Generates $100K+ From Instagram',keywords:['personal brand revenue','coach on Instagram','course creator','Instagram business','personal brand monetization']},
        {id:'l4',title:'Instagram for B2B: Unconventional but Powerful',keywords:['Instagram B2B','B2B content strategy','LinkedIn vs Instagram','executive Instagram','B2B social proof']},
      ]},
    ]
  },

  revenue: {
    title: 'Revenue Architecture & GTM',
    context: 'Design and build the complete revenue machine - from market entry to scale - using proven frameworks for demand generation, pricing, sales architecture, and growth operations.',
    modules: [
      { id:'m1', title:'Revenue Architecture Fundamentals', lessons:[
        {id:'l1',title:'The Revenue Architecture Framework: Building Revenue Systems, Not Teams',keywords:['revenue architecture','revenue model design','recurring revenue','revenue infrastructure','revenue scalability']},
        {id:'l2',title:'Ideal Customer Profile (ICP) Engineering',keywords:['ICP definition','customer segmentation','firmographic ICP','behavioral ICP','ICP prioritization']},
        {id:'l3',title:'Revenue Model Selection: Transactional, Recurring & Hybrid',keywords:['revenue models','subscription business','transaction economics','hybrid models','revenue model comparison']},
        {id:'l4',title:'Total Addressable Market: Sizing & Segmentation',keywords:['TAM analysis','SAM','SOM','market sizing','bottom-up market sizing']},
        {id:'l5',title:'Revenue Forecasting: Bottom-Up, Top-Down & Hybrid Models',keywords:['revenue forecasting','pipeline forecasting','cohort forecasting','sales forecast','revenue model accuracy']},
      ]},
      { id:'m2', title:'Go-To-Market Strategy', lessons:[
        {id:'l1',title:'GTM Motion Selection: PLG, Sales-Led, Marketing-Led, Partner-Led',keywords:['GTM motion','PLG','sales-led growth','marketing-led','partner-led growth','GTM selection']},
        {id:'l2',title:'Channel Architecture: Designing Your Revenue Delivery System',keywords:['channel strategy','channel mix','direct vs indirect','channel economics','distribution strategy']},
        {id:'l3',title:'Messaging Architecture: The Hierarchy That Converts',keywords:['messaging framework','value proposition','messaging hierarchy','positioning statement','message-market fit']},
        {id:'l4',title:'Market Entry Strategy: Beachhead to Expansion',keywords:['beachhead strategy','market entry','market sequencing','land and expand','market expansion']},
        {id:'l5',title:'GTM Execution Rhythm: The Weekly Revenue Review',keywords:['GTM cadence','revenue review','pipeline health','GTM accountability','revenue operations cadence']},
      ]},
      { id:'m3', title:'Pricing Strategy & Optimization', lessons:[
        {id:'l1',title:'Value-Based Pricing: Capturing the Economic Value You Create',keywords:['value-based pricing','willingness to pay','price-to-value ratio','economic value quantification','pricing methodology']},
        {id:'l2',title:'Pricing Research: Conjoint Analysis, Van Westendorp & PSM',keywords:['pricing research','conjoint analysis','Van Westendorp','price sensitivity','pricing testing']},
        {id:'l3',title:'Tiered Pricing Architecture: Good, Better, Best',keywords:['tiered pricing','pricing tiers','good-better-best','price anchoring','packaging strategy']},
        {id:'l4',title:'Price Increase Strategy: How to Raise Prices Without Losing Customers',keywords:['price increase','pricing power','customer value communication','pricing negotiation','price change management']},
        {id:'l5',title:'Usage-Based & Outcome-Based Pricing Models',keywords:['usage-based pricing','outcome-based pricing','consumption model','flexible pricing','pricing innovation']},
      ]},
      { id:'m4', title:'Sales Architecture & Pipeline', lessons:[
        {id:'l1',title:'Sales Process Design: From Lead to Close',keywords:['sales process','sales stages','sales methodology','MEDDIC','discovery to close']},
        {id:'l2',title:'Sales Enablement Architecture: Content, Training & Tools',keywords:['sales enablement','sales content','battlecards','objection handling','sales training systems']},
        {id:'l3',title:'Pipeline Management: Velocity, Coverage & Health',keywords:['pipeline management','pipeline velocity','pipeline coverage ratio','pipeline health','deal qualification']},
        {id:'l4',title:'Quota Architecture & Sales Compensation Design',keywords:['quota setting','sales compensation','commission plans','quota attainment','sales incentives']},
        {id:'l5',title:'Sales Operations & CRM Architecture',keywords:['sales operations','CRM configuration','sales data hygiene','forecast accuracy','sales reporting']},
      ]},
      { id:'m5', title:'Demand Generation & Revenue Marketing', lessons:[
        {id:'l1',title:'Demand Generation Architecture: Building the Pipeline Engine',keywords:['demand gen strategy','pipeline generation','marketing-sourced pipeline','demand gen channels','demand gen budget']},
        {id:'l2',title:'Content-Led Demand: The Long Game That Compounds',keywords:['content-led demand','organic demand','thought leadership demand','SEO-driven pipeline','content attribution']},
        {id:'l3',title:'Outbound Architecture: Cold Outreach at Scale',keywords:['outbound strategy','cold email','cold calling','outbound sequences','outbound personalization']},
        {id:'l4',title:'Event & Community-Led Revenue',keywords:['event strategy','community-led growth','webinar revenue','event ROI','brand community revenue']},
        {id:'l5',title:'Partnership-Led Revenue: Building Your Ecosystem',keywords:['partnerships','partner revenue','co-selling','technology partnerships','ecosystem revenue']},
      ]},
      { id:'m6', title:'Customer Revenue Expansion', lessons:[
        {id:'l1',title:'Net Revenue Retention: The Most Important SaaS Metric',keywords:['NRR','net revenue retention','expansion revenue','GRR','revenue retention architecture']},
        {id:'l2',title:'Upsell & Cross-Sell Architecture',keywords:['upsell strategy','cross-sell motion','expansion playbook','CSM-led expansion','product-led expansion']},
        {id:'l3',title:'Customer Success as Revenue: The New GTM',keywords:['customer success revenue','CSM quota','expansion-driven CS','CS compensation','CS-led growth']},
        {id:'l4',title:'Churn Prevention: Building the Early Warning System',keywords:['churn prediction','churn prevention','at-risk accounts','health score systems','churn reduction']},
        {id:'l5',title:'Advocacy & Referral Architecture: Revenue From Your Customers',keywords:['customer advocacy','referral programs','NPS to referral','case study program','community advocacy']},
      ]},
      { id:'m7', title:'Revenue Operations (RevOps)', lessons:[
        {id:'l1',title:'RevOps Architecture: Aligning Sales, Marketing & CS',keywords:['RevOps structure','revenue alignment','single truth','go-to-market alignment','RevOps team design']},
        {id:'l2',title:'Revenue Technology Stack: The System of Record',keywords:['revenue tech stack','CRM as system of record','data integration','tech consolidation','revenue infrastructure']},
        {id:'l3',title:'Revenue Intelligence: Using Data to Drive Decisions',keywords:['revenue intelligence','Gong','Chorus','conversation intelligence','win-loss analysis']},
        {id:'l4',title:'Territory & Segmentation Design',keywords:['territory design','account segmentation','territory planning','account coverage','segmentation model']},
        {id:'l5',title:'Revenue Planning: Annual, Quarterly & Monthly Cycles',keywords:['revenue planning','annual planning','capacity planning','revenue model','headcount planning']},
      ]},
      { id:'m8', title:'SaaS & Subscription Revenue', lessons:[
        {id:'l1',title:'SaaS Metrics Mastery: ARR, MRR, CAC, LTV & the Rule of 40',keywords:['SaaS metrics','ARR','MRR','CAC','LTV','Rule of 40']},
        {id:'l2',title:'Freemium & Free Trial Architecture: Converting to Paid',keywords:['freemium model','free trial','PQL','activation rate','free-to-paid conversion']},
        {id:'l3',title:'Annual vs Monthly Contracts: Revenue Architecture Implications',keywords:['annual contracts','monthly subscriptions','contract mix','cash flow implications','churn rate impact']},
        {id:'l4',title:'SaaS Pricing Evolution: From Cost-Plus to Value-Based',keywords:['SaaS pricing models','per-seat pricing','usage pricing','outcome pricing','pricing evolution']},
        {id:'l5',title:'SaaS Go-to-Market at Different Stages: Seed to Series C',keywords:['stage-appropriate GTM','early stage sales','growth stage marketing','enterprise GTM','stage transitions']},
      ]},
      { id:'m9', title:'B2B Revenue Complexity', lessons:[
        {id:'l1',title:'Enterprise Revenue: Complex Sales at 18-Month Sales Cycles',keywords:['enterprise sales','long sales cycles','multi-stakeholder','procurement','enterprise GTM']},
        {id:'l2',title:'SMB & Mid-Market Revenue: Volume, Velocity & Digital Efficiency',keywords:['SMB sales','velocity sales','digital-first sales','inside sales','SMB GTM']},
        {id:'l3',title:'Channel & Partner Revenue: Building Indirect Growth',keywords:['channel sales','reseller programs','SI partnerships','marketplace revenue','channel management']},
        {id:'l4',title:'International Revenue Expansion: GTM for New Markets',keywords:['international expansion','global GTM','market localization','regional revenue','global sales']},
        {id:'l5',title:'Revenue in Recession: Defending, Attacking & Emerging Stronger',keywords:['recession revenue strategy','downturn GTM','pricing in recession','customer retention in recession','offensive recession strategy']},
      ]},
      { id:'m10', title:'Revenue Leadership & Scale', lessons:[
        {id:'l1',title:'Building & Leading a Revenue Team: CRO, CMO, VP Sales Dynamics',keywords:['revenue leadership','CRO role','revenue team design','leadership alignment','revenue culture']},
        {id:'l2',title:'Revenue Culture: Building an Organization Obsessed With Growth',keywords:['revenue culture','growth mindset','commercial culture','incentive design','growth accountability']},
        {id:'l3',title:'Investor & Board Communication: Telling the Revenue Story',keywords:['investor relations','board reporting','revenue narrative','growth story','investor expectations']},
        {id:'l4',title:'The $50M Revenue Playbook: What Changes at Each Stage',keywords:['$10M to $50M','stage-specific revenue','growth inflection','scaling revenue','revenue architecture at scale']},
        {id:'l5',title:'Revenue Due Diligence: What Buyers Look For',keywords:['revenue due diligence','M&A revenue','recurring revenue quality','NRR in M&A','revenue risk assessment']},
      ]},
    ]
  },

  category: {
    title: 'Category Design & Market Leadership',
    context: 'Learn to design, own, and evangelize a market category - the strategy behind the world\'s most valuable companies from Salesforce to HubSpot to Drift.',
    modules: [
      { id:'m1', title:'Category Design Fundamentals', lessons:[
        {id:'l1',title:'Category Kings: Why 76% of Value Goes to the Category Leader',keywords:['category king','category design theory','Play Bigger framework','winner-take-most','market value concentration']},
        {id:'l2',title:'Category vs Market: The Critical Distinction',keywords:['category vs market','category creation','market competition','category definition','positioning evolution']},
        {id:'l3',title:'Is Your Company Ready for Category Design?',keywords:['category design readiness','product-market fit','category timing','market conditions','category design prerequisites']},
        {id:'l4',title:'Case Studies: Salesforce, HubSpot, Drift & The Challengers',keywords:['Salesforce category','HubSpot category','Drift category design','case study analysis','category creation examples']},
      ]},
      { id:'m2', title:'Category Research & Discovery', lessons:[
        {id:'l1',title:'Market Sensing: Finding the Problem Before the Solution',keywords:['market research','pain mapping','problem discovery','customer problem interviews','unmet need identification']},
        {id:'l2',title:'The Category Problem: Defining What You Will Solve',keywords:['problem framing','category problem definition','status quo disruption','pain articulation','problem hierarchy']},
        {id:'l3',title:'Competitive Landscape Analysis for Category Designers',keywords:['competitive mapping','category landscape','positioning gaps','white space identification','competitive alternatives']},
        {id:'l4',title:'Customer Discovery at Category Scale',keywords:['category customer research','champion identification','early adopter strategy','design partners','customer discovery process']},
      ]},
      { id:'m3', title:'Point of View Architecture', lessons:[
        {id:'l1',title:'Building Your Category Point of View: The Book of Beliefs',keywords:['POV development','book of beliefs','category narrative','thought leadership foundation','POV architecture']},
        {id:'l2',title:'The Category Name: Why It Matters More Than Your Brand',keywords:['category naming','category language','naming strategy','language lock-in','naming research']},
        {id:'l3',title:'The Lightning Strike Moment: Creating Your Category Event',keywords:['lightning strike','category event','POV launch','category activation','market moment']},
        {id:'l4',title:'Category Language: Owning the Vocabulary of Your Market',keywords:['category vocabulary','language ownership','lexicon development','terminology strategy','semantic moats']},
      ]},
      { id:'m4', title:'Category Evangelism & Conditioning', lessons:[
        {id:'l1',title:'Category Conditioning: Educating the Market Before Selling to It',keywords:['category conditioning','market education','POV distribution','thought leadership strategy','category content']},
        {id:'l2',title:'Building the Category Ecosystem: Analysts, Media & Influencers',keywords:['analyst relations','media strategy','category influencers','ecosystem building','third-party validation']},
        {id:'l3',title:'Category Communities: Building the Movement Around Your Market',keywords:['category community','market community','user communities','community-led category','community architecture']},
        {id:'l4',title:'Scaling Category Evangelism: From Founder-Led to Team-Led',keywords:['category evangelism scale','team content','employee advocacy','category champions','evangelism systems']},
      ]},
      { id:'m5', title:'The Category Design Playbook', lessons:[
        {id:'l1',title:'The Flywheel: How Category Momentum Compounds',keywords:['category flywheel','momentum building','network effects','category compounding','virtuous cycles']},
        {id:'l2',title:'Category Metrics: Measuring Your Progress to Category King',keywords:['category metrics','share of search','mindshare measurement','category benchmarks','category health KPIs']},
        {id:'l3',title:'Competitors Entering Your Category: Defend & Accelerate',keywords:['category defense','competitor response','category war','maintaining category leadership','competitive acceleration']},
        {id:'l4',title:'Category Design for Startups vs Enterprises',keywords:['startup category design','enterprise category design','category design by stage','resource considerations','stage-appropriate strategy']},
      ]},
      { id:'m6', title:'Product as Category Proof', lessons:[
        {id:'l1',title:'Product Design for Category Kings: Features That Prove Your POV',keywords:['product-category alignment','feature strategy','product as proof','product roadmap for category','MVP for category']},
        {id:'l2',title:'Customer Success as Category Proof',keywords:['customer success stories','category case studies','ROI proof points','customer as category evangelists','proof architecture']},
        {id:'l3',title:'Data & Research as Category Moat',keywords:['proprietary research','category reports','data moats','annual research','original data strategy']},
        {id:'l4',title:'Category Design & Product-Market Fit: Chicken or Egg?',keywords:['PMF and category','sequential strategy','category before product','product before category','iterative approach']},
      ]},
      { id:'m7', title:'Category GTM & Sales Enablement', lessons:[
        {id:'l1',title:'Selling a Category vs Selling a Product: The Rep Mindset Shift',keywords:['category-based selling','teaching the problem','challenger sale','insight selling','rep enablement for category']},
        {id:'l2',title:'Category Sales Process: From Conditioning to Closing',keywords:['category sales process','POV-first selling','category qualification','closing in new categories','sales methodology']},
        {id:'l3',title:'Marketing the Category: Demand Generation for Market Creators',keywords:['category demand gen','market creation marketing','educational content','category-first campaigns','demand creation']},
        {id:'l4',title:'Pricing Your Category King Position',keywords:['category king pricing','premium pricing','pricing strategy in new categories','pricing confidence','price as signal']},
      ]},
      { id:'m8', title:'Category Leadership & Longevity', lessons:[
        {id:'l1',title:'Category Lifecycle: Emergence, Growth, Maturity & Disruption',keywords:['category lifecycle','category evolution','disruption risk','category pivots','category renewal']},
        {id:'l2',title:'Defending Against Category Disruption',keywords:['disruption defense','category incumbent','new category threats','continuous innovation','disruption response']},
        {id:'l3',title:'The Category Design C-Suite: Organizing for Category Leadership',keywords:['category team structure','CCO role','category function','cross-functional category','leadership alignment']},
        {id:'l4',title:'Category Design Legacy: Building a Company Worth $1B+',keywords:['unicorn building','category king valuation','IPO readiness','M&A from category','long-term category value']},
      ]},
    ]
  },

  aimarketing: {
    title: 'AI-Powered Marketing',
    context: 'Master AI tools, strategies, and governance for marketing leadership. Deploy AI to dramatically amplify marketing output, quality, and performance.',
    modules: [
      { id:'m1', title:'AI Marketing Foundations', lessons:[
        {id:'l1',title:'The AI Marketing Landscape: Tools, Capabilities & Limitations',keywords:['AI marketing overview','generative AI','predictive AI','AI tools landscape','AI capabilities']},
        {id:'l2',title:'AI Strategy for Marketing Leaders: Build vs Buy vs Integrate',keywords:['AI marketing strategy','custom AI','AI vendor selection','AI integration','AI roadmap']},
        {id:'l3',title:'AI Governance & Risk Management in Marketing',keywords:['AI governance','AI bias','brand safety','AI compliance','responsible AI marketing']},
        {id:'l4',title:'Measuring AI Marketing ROI: Metrics & Attribution',keywords:['AI ROI','marketing efficiency','time savings','AI performance metrics','AI attribution']},
      ]},
      { id:'m2', title:'AI-Powered Content Creation', lessons:[
        {id:'l1',title:'Prompt Engineering for Marketing: The Master Skills',keywords:['prompt engineering','Claude','ChatGPT for marketing','prompt frameworks','AI writing strategy']},
        {id:'l2',title:'AI Content Workflows: From Brief to Published at Scale',keywords:['AI content workflow','editorial process','human-AI collaboration','content quality control','AI editorial system']},
        {id:'l3',title:'AI for Brand Voice: Training AI on Your Style',keywords:['brand voice AI','style guide for AI','fine-tuning','brand consistency','AI voice guidelines']},
        {id:'l4',title:'Multimodal AI: Text, Image, Video & Audio',keywords:['multimodal AI','Midjourney','Dall-E','AI video','AI audio','synthetic media strategy']},
      ]},
      { id:'m3', title:'AI for SEO & Organic Growth', lessons:[
        {id:'l1',title:'AI-Powered SEO: How Search Is Changing',keywords:['AI SEO','SGE impact','AIO','AI search impact','future of SEO']},
        {id:'l2',title:'AI Content Clusters at Scale: 100 Articles in 30 Days',keywords:['content scale with AI','programmatic SEO','AI content production','content velocity','SEO content factory']},
        {id:'l3',title:'AI for Keyword Research & Content Strategy',keywords:['AI keyword research','intent analysis','topic clustering','competitive gap AI','semantic keyword analysis']},
        {id:'l4',title:'Technical SEO with AI: Audits, Fixes & Monitoring',keywords:['AI technical SEO','automated SEO audit','SEO monitoring','AI crawl analysis','technical SEO automation']},
      ]},
      { id:'m4', title:'AI in Paid Media & Advertising', lessons:[
        {id:'l1',title:'AI-Powered Ad Creative: Generating, Testing & Scaling',keywords:['AI ad creative','creative testing AI','AI ad generation','dynamic creative optimization','AI ad performance']},
        {id:'l2',title:'Automated Bidding & AI Campaign Management',keywords:['automated bidding','Smart Bidding','Performance Max','AI campaign management','algorithmic advertising']},
        {id:'l3',title:'Audience Intelligence with AI: Predictive Targeting',keywords:['predictive audiences','AI audience building','customer intelligence','lookalike AI','predictive targeting']},
        {id:'l4',title:'AI for Ad Copywriting at Scale',keywords:['AI ad copy','responsive search ads','ad copy generation','A/B testing AI','copy optimization']},
      ]},
      { id:'m5', title:'Personalization & Customer Experience', lessons:[
        {id:'l1',title:'AI-Driven Personalization: Website, Email & Beyond',keywords:['AI personalization','dynamic content','recommendation engines','behavioral personalization','real-time personalization']},
        {id:'l2',title:'Predictive Lead Scoring & Marketing Automation AI',keywords:['AI lead scoring','predictive scoring','MAP AI','automation AI','behavioral scoring']},
        {id:'l3',title:'AI Chatbots & Conversational Marketing',keywords:['marketing chatbots','conversational AI','chat-to-conversion','AI customer service','chatbot strategy']},
        {id:'l4',title:'Customer Journey AI: Predicting & Optimizing Paths to Purchase',keywords:['journey AI','path optimization','next best action','predictive journey','AI journey mapping']},
      ]},
      { id:'m6', title:'AI Analytics & Insights', lessons:[
        {id:'l1',title:'AI-Powered Analytics: From Dashboards to Decisions',keywords:['AI analytics','automated insights','anomaly detection','AI reporting','intelligent alerts']},
        {id:'l2',title:'Predictive Marketing Analytics: What Will Happen Before It Does',keywords:['predictive analytics','churn prediction','campaign prediction','AI forecasting','predictive models']},
        {id:'l3',title:'Natural Language Querying: Talking to Your Data',keywords:['NLQ analytics','conversational BI','AI data analysis','ChatGPT for data','self-service analytics']},
        {id:'l4',title:'AI Competitive Intelligence: Monitoring Your Market in Real-Time',keywords:['AI competitive intel','market monitoring','competitor tracking AI','real-time insights','AI surveillance']},
      ]},
      { id:'m7', title:'AI for Email & Demand Gen', lessons:[
        {id:'l1',title:'AI Email Marketing: Subject Lines, Content & Send-Time Optimization',keywords:['AI email optimization','subject line AI','send time optimization','email personalization AI','email automation']},
        {id:'l2',title:'AI for Demand Generation: Automating the Pipeline Machine',keywords:['AI demand gen','automated outreach','AI-powered SDR','pipeline automation','AI prospecting']},
        {id:'l3',title:'ABM with AI: Hyper-Personalization at Scale',keywords:['AI ABM','account personalization','AI account targeting','account intelligence','AI-driven ABM']},
        {id:'l4',title:'AI for Events & Webinars: From Planning to Follow-Up',keywords:['AI event marketing','webinar AI','event personalization','post-event AI','AI event ROI']},
      ]},
      { id:'m8', title:'AI Marketing Leadership', lessons:[
        {id:'l1',title:'Building an AI-Augmented Marketing Team',keywords:['AI team structure','AI marketing roles','human-AI collaboration','change management','AI upskilling']},
        {id:'l2',title:'AI Marketing Budget: Where to Invest for Maximum ROI',keywords:['AI marketing budget','tool selection','AI ROI framework','AI cost model','investment prioritization']},
        {id:'l3',title:'The AI Ethics Handbook for CMOs',keywords:['marketing AI ethics','bias in AI marketing','transparency','AI disclosure','ethical AI use']},
        {id:'l4',title:'Future-Proofing Your Marketing Function with AI',keywords:['future of marketing','AI disruption','marketing evolution','skill development','AI marketing 2027']},
      ]},
    ]
  },

  b2bdemand: {
    title: 'B2B Demand Generation',
    context: 'Build the B2B demand generation machine that fills your pipeline consistently. Master every channel from ABM to content to events to outbound.',
    modules: [
      { id:'m1', title:'B2B Demand Generation Strategy', lessons:[
        {id:'l1',title:'Demand Creation vs Demand Capture: The $10B Insight Most B2B Marketers Miss',keywords:['demand creation','demand capture','dark funnel','market education','intent-based marketing']},
        {id:'l2',title:'B2B Buyer Journey: How Long-Cycle Enterprise Buying Really Works',keywords:['B2B buyer journey','research phase','consensus selling','buyer enablement','buying committee']},
        {id:'l3',title:'ICP Engineering: The Foundation of All Demand Generation',keywords:['ICP definition','firmographic ICP','technographic','behavioral ICP','ICP prioritization']},
        {id:'l4',title:'Channel Mix Design: Where Your Pipeline Will Actually Come From',keywords:['demand gen channels','channel attribution','channel selection','pipeline source analysis','channel investment']},
      ]},
      { id:'m2', title:'Account-Based Marketing at Scale', lessons:[
        {id:'l1',title:'ABM Strategy: Tier 1, 2, 3 Segmentation & Resource Allocation',keywords:['ABM tiers','account selection','ABM resource allocation','tiered ABM approach','account prioritization']},
        {id:'l2',title:'ABM Technology Stack: Platforms, Tools & Integration',keywords:['6sense','Demandbase','Terminus','ABM platforms','intent data','ABM technology']},
        {id:'l3',title:'ABM Content Strategy: Account-Specific Messaging at Scale',keywords:['ABM content','account personalization','personalization at scale','vertical content','account-specific messaging']},
        {id:'l4',title:'ABM Measurement: Influence, Pipeline & Revenue Attribution',keywords:['ABM attribution','pipeline influence','ABM ROI','account penetration metrics','ABM KPIs']},
      ]},
      { id:'m3', title:'Content-Led Demand Generation', lessons:[
        {id:'l1',title:'Content for Demand: Moving Beyond Lead Gen to Market Education',keywords:['content demand gen','educational content','thought leadership demand','ungated content','content for pipeline']},
        {id:'l2',title:'The Research & Data Report: B2B\'s Highest ROI Content Type',keywords:['B2B research reports','state of industry','data-driven content','original research','research distribution']},
        {id:'l3',title:'Podcast & Video Strategy for B2B Demand Creation',keywords:['B2B podcast','video demand gen','buyer education media','executive content','media strategy B2B']},
        {id:'l4',title:'SEO for B2B: Organic Demand at Scale',keywords:['B2B SEO','organic demand','bottom-funnel SEO','comparison content','B2B content SEO']},
      ]},
      { id:'m4', title:'Outbound Demand Generation', lessons:[
        {id:'l1',title:'Cold Email Architecture: The System That Books Meetings',keywords:['cold email strategy','email sequences','personalization at scale','deliverability','cold email frameworks']},
        {id:'l2',title:'Cold Calling 2026: Scripts, Systems & Sequences',keywords:['cold calling strategy','call scripts','SDR cadence','phone outreach','call objection handling']},
        {id:'l3',title:'LinkedIn Outbound: Social Selling at Scale',keywords:['LinkedIn outbound','social selling','Sales Navigator outreach','LinkedIn sequences','connection strategy']},
        {id:'l4',title:'Multi-Channel Outbound Orchestration: Email + Phone + Social',keywords:['multi-channel outbound','outbound sequence design','touch frequency','outbound automation','SDR productivity']},
      ]},
      { id:'m5', title:'Events, Webinars & Community', lessons:[
        {id:'l1',title:'Executive Roundtables & Dinner Events: The Highest ROI B2B Format',keywords:['executive roundtables','dinner events','executive demand gen','C-suite events','CXO marketing']},
        {id:'l2',title:'Webinar Strategy That Fills Pipeline',keywords:['webinar demand gen','webinar registration','webinar follow-up','webinar pipeline attribution','virtual events']},
        {id:'l3',title:'Conference & Tradeshows: Maximizing ROI from In-Person Events',keywords:['conference strategy','tradeshow ROI','booth strategy','speaking strategy','conference pipeline']},
        {id:'l4',title:'Community-Led Growth: Building the Market Around Your Brand',keywords:['community-led growth','brand community','demand from community','community strategy','community metrics']},
      ]},
      { id:'m6', title:'Paid Demand Generation', lessons:[
        {id:'l1',title:'LinkedIn Ads for Pipeline Generation',keywords:['LinkedIn demand gen ads','thought leader ads','sponsored content pipeline','LinkedIn pipeline attribution','B2B LinkedIn ads']},
        {id:'l2',title:'Google Ads for B2B: Bottom-Funnel & Category Demand',keywords:['Google Ads B2B','B2B paid search','competitor campaigns','review site advertising','branded demand capture']},
        {id:'l3',title:'Programmatic & Intent-Based Advertising',keywords:['programmatic B2B','intent-based targeting','content syndication','banner advertising B2B','retargeting B2B']},
        {id:'l4',title:'Paid Social Beyond LinkedIn: Twitter, Reddit & Niche Platforms',keywords:['Twitter ads B2B','Reddit advertising','niche platform ads','B2B social advertising','platform diversification']},
      ]},
      { id:'m7', title:'Pipeline Architecture & Operations', lessons:[
        {id:'l1',title:'Pipeline Architecture: Stages, Velocity & Health Metrics',keywords:['pipeline stages','pipeline velocity','pipeline coverage','pipeline health','pipeline management']},
        {id:'l2',title:'Marketing-Sales Pipeline Handoff: The SLA That Drives Revenue',keywords:['marketing-sales SLA','MQL definition','lead handoff','pipeline accountability','sales-marketing alignment']},
        {id:'l3',title:'Marketing Qualified Accounts (MQA): The ABM Evolution',keywords:['MQA vs MQL','account qualification','intent-based qualification','MQA definition','account-based pipeline']},
        {id:'l4',title:'Demand Gen Reporting: The Weekly Pipeline Review',keywords:['demand gen reporting','pipeline dashboard','marketing attribution','revenue reporting','weekly review structure']},
      ]},
      { id:'m8', title:'Advanced B2B Demand Strategy', lessons:[
        {id:'l1',title:'Product-Led Growth (PLG) Demand Generation',keywords:['PLG demand','product-led marketing','freemium demand','trial-to-paid','PLG community']},
        {id:'l2',title:'Partner-Led Demand: Channel & Technology Partnerships',keywords:['partner demand gen','channel marketing','ISV partnerships','co-marketing','ecosystem demand']},
        {id:'l3',title:'International B2B Demand Generation',keywords:['international demand gen','global campaigns','regional marketing','localized demand gen','market entry demand']},
        {id:'l4',title:'Demand Generation Leadership: Building the Team & Budget',keywords:['demand gen team','demand gen budget','hiring demand gen','demand gen leadership','CMO to demand gen']},
      ]},
    ]
  },

  leadership: {
    title: 'Executive Leadership for Consultants',
    context: 'Master the leadership skills that separate great consultants from exceptional ones. Build executive presence, command rooms, and create organizational change.',
    modules: [
      { id:'m1', title:'Executive Presence & Leadership Identity', lessons:[
        {id:'l1',title:'Executive Presence: What It Is, Why It Matters & How to Build It',keywords:['executive presence','gravitas','communication style','leadership brand','presence development']},
        {id:'l2',title:'Personal Leadership Brand: Defining Your Unique Authority',keywords:['personal brand','leadership identity','brand attributes','leadership differentiation','brand consistency']},
        {id:'l3',title:'First Impression Architecture: Owning the Room from Minute One',keywords:['first impressions','room entry','introduction strategy','body language','opening statement']},
        {id:'l4',title:'Confidence Under Pressure: Leading When the Stakes Are High',keywords:['confidence under pressure','high-stakes leadership','composure','resilience','performance under stress']},
      ]},
      { id:'m2', title:'Strategic Communication', lessons:[
        {id:'l1',title:'Executive Communication: The Pyramid Principle & Structured Clarity',keywords:['pyramid principle','executive communication','structured thinking','minto method','communication clarity']},
        {id:'l2',title:'Storytelling That Moves People to Action',keywords:['leadership storytelling','narrative structure','persuasion through story','business storytelling','story frameworks']},
        {id:'l3',title:'Board & CEO Presentations: The Architecture of Influence',keywords:['board presentation','CEO communication','executive decks','persuasive presentations','C-suite communication']},
        {id:'l4',title:'Difficult Conversations: Confronting, Redirecting & Resolving',keywords:['difficult conversations','feedback delivery','conflict resolution','direct communication','crucial conversations']},
      ]},
      { id:'m3', title:'Decision Making & Strategic Thinking', lessons:[
        {id:'l1',title:'Executive Decision Making: Frameworks for High-Stakes Choices',keywords:['decision frameworks','cognitive biases','decision architecture','risk assessment','decision quality']},
        {id:'l2',title:'First Principles Thinking: Solving the Real Problem',keywords:['first principles','problem decomposition','mental models','reframing problems','root cause analysis']},
        {id:'l3',title:'Strategic Thinking: Seeing the System, Not Just the Parts',keywords:['systems thinking','strategic pattern recognition','long-term thinking','scenario planning','strategic intuition']},
        {id:'l4',title:'Decision Velocity: Making Good Decisions Fast',keywords:['decision speed','decision fatigue','type 1 vs type 2','reversible vs irreversible','fast decisions']},
      ]},
      { id:'m4', title:'Leadership in Consulting', lessons:[
        {id:'l1',title:'Consultant Credibility: Building Trust in 90 Days',keywords:['consultant credibility','trust building','stakeholder trust','credibility signals','quick wins']},
        {id:'l2',title:'Managing Without Authority: Influencing in Client Organizations',keywords:['influence without authority','organizational influence','stakeholder management','coalition building','change leadership']},
        {id:'l3',title:'Navigating Client Politics: Allies, Adversaries & Neutrals',keywords:['organizational politics','stakeholder mapping','political navigation','sponsor management','client dynamics']},
        {id:'l4',title:'Leading Change as an Outsider: The Change Management Playbook',keywords:['change management','Kotter model','ADKAR','change leadership','organizational resistance']},
      ]},
      { id:'m5', title:'Building High-Performance Teams', lessons:[
        {id:'l1',title:'Team Architecture: Designing for Performance, Not Org Chart',keywords:['team design','high performance teams','team composition','roles and responsibilities','team accountability']},
        {id:'l2',title:'Hiring for Outcome: The A-Player Identification Framework',keywords:['A-player hiring','talent identification','interview design','hiring criteria','performance hiring']},
        {id:'l3',title:'Coaching & Developing Your Team: The Leader as Coach',keywords:['leader as coach','development conversations','GROW model','coaching vs managing','talent development']},
        {id:'l4',title:'Performance Management Without Performance Reviews',keywords:['continuous feedback','performance management evolution','OKR-based performance','real-time feedback','performance culture']},
      ]},
      { id:'m6', title:'Organizational Leadership', lessons:[
        {id:'l1',title:'Culture Architecture: Building Culture by Design, Not Default',keywords:['culture design','values operationalization','cultural norms','culture in scaling','behavior-based culture']},
        {id:'l2',title:'Alignment Architecture: Getting Everyone Rowing the Same Direction',keywords:['organizational alignment','strategic alignment','communication cascade','alignment meetings','direction clarity']},
        {id:'l3',title:'Managing Complexity: Leadership in Matrixed Environments',keywords:['matrix organizations','complex leadership','cross-functional leadership','ambiguity management','dual reporting']},
        {id:'l4',title:'Crisis Leadership: Maintaining Composure & Direction Under Fire',keywords:['crisis leadership','leadership in adversity','team morale in crisis','transparent communication','recovery leadership']},
      ]},
      { id:'m7', title:'Executive Influence & Politics', lessons:[
        {id:'l1',title:'Political Capital: Building, Spending & Replenishing It',keywords:['political capital','organizational currency','influence investment','relationship banking','political navigation']},
        {id:'l2',title:'Negotiation for Leaders: Getting What You Need Without Demanding It',keywords:['executive negotiation','principled negotiation','value creation','BATNA','negotiation strategy']},
        {id:'l3',title:'Giving & Receiving Feedback at the Executive Level',keywords:['executive feedback','upward feedback','feedback frameworks','feedback culture','leadership feedback']},
        {id:'l4',title:'Building Your Executive Network: Strategic Relationship Architecture',keywords:['executive network','relationship building','mentorship','board relationships','network strategy']},
      ]},
      { id:'m8', title:'Leadership Legacy & Growth', lessons:[
        {id:'l1',title:'Leadership Philosophy: Defining Your Principles',keywords:['leadership philosophy','management principles','leadership values','leadership framework','principles-based leadership']},
        {id:'l2',title:'Succession & Development: Building Leaders Who Replace You',keywords:['succession planning','leadership development','talent pipeline','developing leaders','delegation mastery']},
        {id:'l3',title:'Executive Health & Sustainable Performance',keywords:['executive wellness','cognitive performance','energy management','burnout prevention','sustainable leadership']},
        {id:'l4',title:'The Legacy Leader: Building an Impact That Outlasts You',keywords:['leadership legacy','lasting impact','organizational transformation','leadership memoir','enduring contribution']},
      ]},
    ]
  },

  cfo: {
    title: 'Chief Financial Officer Mastery',
    context: 'A rigorous executive finance program for fractional CFOs, finance leaders, and strategic advisors who want to operate at the CFO level, command $150-300K+ engagements, and drive enterprise value creation.',
    modules: [
      { id:'m1', title:'The CFO Mandate & Strategic Finance Leadership', lessons:[
        {id:'l1',title:'The Modern CFO: From Scorekeeper to Value Architect',keywords:['CFO mandate','strategic finance','value creation','CFO evolution','finance transformation']},
        {id:'l2',title:'The CFO Operating Model: Rhythms, Rituals & Decision Frameworks',keywords:['CFO cadence','finance operating model','close calendar','business review','finance rituals']},
        {id:'l3',title:'Fractional CFO Economics: Positioning, Pricing & Engagement Design',keywords:['fractional CFO pricing','engagement structure','CFO retainer','fractional vs full-time','scope design']},
        {id:'l4',title:'CFO as Business Partner: Translating Finance into Strategy',keywords:['finance business partner','FP&A partnership','CFO-CEO relationship','financial storytelling','strategy finance']},
        {id:'l5',title:'The First 90 Days as Fractional CFO: Diagnosis, Priorities & Quick Wins',keywords:['CFO onboarding','financial assessment','quick wins','CFO roadmap','diagnostic framework']},
      ]},
      { id:'m2', title:'Accounting Systems & Financial Architecture', lessons:[
        {id:'l1',title:'Chart of Accounts Architecture: Design That Scales to $100M',keywords:['chart of accounts','accounting architecture','financial taxonomy','GL design','segment reporting']},
        {id:'l2',title:'Month-End Close Optimization: Speed Without Sacrificing Accuracy',keywords:['fast close','month-end optimization','reconciliation automation','close checklist','reporting velocity']},
        {id:'l3',title:'Revenue Recognition: ASC 606, SaaS & Multi-Element Arrangements',keywords:['ASC 606','revenue recognition','deferred revenue','SaaS revenue','multi-deliverable arrangements']},
        {id:'l4',title:'ERP Selection & Implementation: What the CFO Must Control',keywords:['ERP selection','NetSuite','QuickBooks','financial system migration','ERP implementation risk']},
        {id:'l5',title:'Audit Readiness & Internal Controls Design',keywords:['audit preparation','internal controls','COSO framework','SOX readiness','control testing']},
      ]},
      { id:'m3', title:'Cash Flow Management & Working Capital', lessons:[
        {id:'l1',title:'Cash Flow Forecasting: The 13-Week Model Every CFO Must Master',keywords:['13-week cash flow','rolling cash forecast','liquidity planning','cash runway','cash flow modeling']},
        {id:'l2',title:'Working Capital Optimization: The Hidden $1M in Every Balance Sheet',keywords:['working capital','DSO reduction','DPO extension','inventory turns','cash conversion cycle']},
        {id:'l3',title:'Banking Relationships & Credit Facility Management',keywords:['bank covenants','revolving credit','DSCR','banking relationships','credit structure']},
        {id:'l4',title:'Collections Strategy & AR Management at Scale',keywords:['accounts receivable','collections strategy','aging analysis','payment terms','AR automation']},
        {id:'l5',title:'Cash Crisis Management: Navigating Distress & Extending Runway',keywords:['cash crisis','runway extension','distressed finance','emergency cash management','payables management']},
      ]},
      { id:'m4', title:'Financial Modeling & Forecasting', lessons:[
        {id:'l1',title:'The Three-Statement Model: Architecture That CEOs and Boards Trust',keywords:['three-statement model','P&L forecast','balance sheet model','cash flow statement','integrated financial model']},
        {id:'l2',title:'SaaS Metrics & Unit Economics Modeling',keywords:['ARR model','MRR bridge','LTV CAC ratio','churn modeling','SaaS financial model']},
        {id:'l3',title:'Scenario Planning & Sensitivity Analysis for Executive Decision-Making',keywords:['scenario analysis','sensitivity tables','stress testing','bear base bull','Monte Carlo']},
        {id:'l4',title:'Budget Architecture: Zero-Based vs Driver-Based vs Rolling Forecast',keywords:['budgeting methodology','zero-based budgeting','driver-based budget','rolling forecast','budget governance']},
        {id:'l5',title:'Board-Ready Financial Presentations: The Package That Gets Decisions Made',keywords:['board financial package','management reporting','KPI dashboard','board presentation','financial narrative']},
      ]},
      { id:'m5', title:'Capital Structure & Fundraising', lessons:[
        {id:'l1',title:'Capital Structure Fundamentals: Debt, Equity & Hybrid Instruments',keywords:['capital structure','WACC','leverage optimization','equity vs debt','hybrid instruments']},
        {id:'l2',title:'Venture & Growth Equity: The CFO Playbook for Fundraising Rounds',keywords:['VC funding','Series A B C','term sheet','liquidation preferences','cap table management']},
        {id:'l3',title:'Debt Financing: Lines of Credit, Term Loans & Structured Finance',keywords:['debt financing','covenant negotiation','term loan','mezzanine debt','asset-based lending']},
        {id:'l4',title:'The Data Room: Building a Fundraising Package Investors Trust',keywords:['data room','investor due diligence','fundraising materials','financial model for investors','cap table']},
        {id:'l5',title:'Valuation Fundamentals: DCF, Comps & the Art of the Multiple',keywords:['company valuation','DCF analysis','comparable companies','EV/EBITDA','valuation negotiation']},
      ]},
      { id:'m6', title:'Investor Relations & Board Reporting', lessons:[
        {id:'l1',title:'Board Meeting Architecture: The Package That Commands Confidence',keywords:['board materials','board reporting','investor update','board deck structure','board dynamics']},
        {id:'l2',title:'Investor Relations Strategy: Transparency Without Oversharing',keywords:['investor relations','LP communications','information rights','investor narrative','expectation management']},
        {id:'l3',title:'Covenant Management & Lender Communications',keywords:['financial covenants','lender reporting','covenant compliance','waiver negotiation','lender relationships']},
        {id:'l4',title:'Managing Activist Investors & Difficult Shareholder Dynamics',keywords:['activist investors','shareholder rights','defensive strategy','proxy advisors','governance response']},
        {id:'l5',title:'Going Public Readiness: IPO, SPAC & Direct Listing Finance Requirements',keywords:['IPO readiness','SEC reporting','SOX compliance','public company CFO','S-1 preparation']},
      ]},
      { id:'m7', title:'Risk Management & Internal Controls', lessons:[
        {id:'l1',title:'Enterprise Risk Framework: Identifying, Quantifying & Prioritizing',keywords:['ERM framework','risk register','risk quantification','probability impact matrix','CFO risk role']},
        {id:'l2',title:'Fraud Prevention & Forensic Accounting Awareness',keywords:['fraud prevention','internal controls','forensic accounting','separation of duties','fraud triangle']},
        {id:'l3',title:'Insurance Architecture: What the CFO Must Own',keywords:['D&O insurance','business insurance','insurance audit','risk transfer','insurance benchmarking']},
        {id:'l4',title:'Tax Strategy & Planning: The CFO Framework for Minimizing Liability',keywords:['tax strategy','effective tax rate','R&D tax credits','state tax nexus','transfer pricing']},
        {id:'l5',title:'Cybersecurity Financial Risk: Quantifying & Communicating to the Board',keywords:['cyber risk quantification','FAIR model','cyber insurance','board cyber reporting','financial impact modeling']},
      ]},
      { id:'m8', title:'M&A, Due Diligence & Integration Finance', lessons:[
        {id:'l1',title:'M&A Strategy: Financial Buyer vs Strategic Buyer Perspectives',keywords:['M&A strategy','buy-side vs sell-side','acquisition thesis','strategic rationale','synergy modeling']},
        {id:'l2',title:'Quality of Earnings: The CFO Due Diligence Playbook',keywords:['quality of earnings','QoE report','normalized EBITDA','due diligence','financial due diligence']},
        {id:'l3',title:'Deal Structuring: Earn-Outs, Roll-Overs & Escrows',keywords:['deal structure','earnout design','working capital adjustment','escrow','representations and warranties']},
        {id:'l4',title:'100-Day Integration Finance Playbook',keywords:['M&A integration','finance integration','systems consolidation','Day 1 readiness','synergy tracking']},
        {id:'l5',title:'Sell-Side Preparation: Maximizing Your Company Valuation Multiple',keywords:['sell-side readiness','EBITDA normalization','management presentation','LOI negotiation','exit preparation']},
      ]},
      { id:'m9', title:'Strategic Finance & Value Creation', lessons:[
        {id:'l1',title:'Unit Economics at Scale: The Numbers Behind $100M Businesses',keywords:['unit economics','contribution margin','CAC payback','LTV modeling','cohort economics']},
        {id:'l2',title:'Make vs Buy vs Partner: Financial Decision Architecture',keywords:['make vs buy analysis','outsourcing economics','build vs buy','ROI modeling','decision trees']},
        {id:'l3',title:'Cost Transformation: Cutting Costs Without Killing Growth',keywords:['cost optimization','zero-based budgeting','headcount rationalization','vendor renegotiation','cost structure redesign']},
        {id:'l4',title:'Pricing Strategy for CFOs: The Revenue-Margin Optimization Tradeoff',keywords:['pricing economics','price elasticity','margin optimization','pricing model analysis','revenue maximization']},
        {id:'l5',title:'ESG Finance: Reporting, Risk & Emerging Compliance Requirements',keywords:['ESG reporting','sustainability finance','TCFD','ESG metrics','green finance']},
      ]},
      { id:'m10', title:'CFO Leadership & Executive Presence', lessons:[
        {id:'l1',title:'Building & Leading a High-Performance Finance Team',keywords:['finance team design','CFO hiring','finance culture','team structure','finance performance management']},
        {id:'l2',title:'CEO-CFO Partnership: The Most Important Relationship in the Company',keywords:['CEO-CFO dynamic','CFO communication','executive partnership','disagreement management','strategic alignment']},
        {id:'l3',title:'Communicating Finance to Non-Finance Executives',keywords:['financial storytelling','simplifying finance','business acumen','cross-functional communication','financial literacy']},
        {id:'l4',title:'CFO Career Architecture: From Operator to Strategic Advisor',keywords:['CFO career path','fractional CFO brand','board roles','advisory positions','CFO positioning']},
        {id:'l5',title:'The Ethical CFO: Pressure, Integrity & the Lines You Cannot Cross',keywords:['financial ethics','CFO integrity','earnings manipulation','whistleblower','ethical leadership']},
      ]},
    ]
  },

  ae: {
    title: 'Account Executive Excellence',
    context: 'A high-performance sales training program for Account Executives who want to consistently hit 150%+ of quota, master enterprise deals, and build careers earning $200K-500K+.',
    modules: [
      { id:'m1', title:'The Elite AE Mindset & Professional Architecture', lessons:[
        {id:'l1',title:'The $500K AE: What Separates the Top 1% from Everyone Else',keywords:['elite AE mindset','quota attainment','sales performance','top performer habits','AE psychology']},
        {id:'l2',title:'Territory Planning: Running Your Book Like a Business',keywords:['territory management','account segmentation','whitespace analysis','territory plan','account prioritization']},
        {id:'l3',title:'Time Architecture: The AE Weekly Operating System',keywords:['sales time management','activity prioritization','selling time','AE efficiency','time blocking']},
        {id:'l4',title:'Personal Brand as an AE: Why Buyers Google You Before Responding',keywords:['AE personal brand','LinkedIn for sales','social selling','digital presence','buyer research']},
      ]},
      { id:'m2', title:'Prospecting & Pipeline Generation', lessons:[
        {id:'l1',title:'Outbound Architecture: The System That Fills Pipeline Consistently',keywords:['outbound sales','cold outreach','prospecting system','pipeline generation','multi-channel outbound']},
        {id:'l2',title:'Cold Email That Gets Replies: Science, Personalization & Sequencing',keywords:['cold email','email personalization','subject lines','reply rates','cold email sequences']},
        {id:'l3',title:'Cold Calling in the Modern Era: Framework, Psychology & Cadence',keywords:['cold calling','call framework','objection handling on calls','voicemail strategy','call-to-meeting conversion']},
        {id:'l4',title:'LinkedIn Prospecting & Social Selling at Scale',keywords:['LinkedIn prospecting','social selling','InMail strategy','connection strategy','social pipeline']},
      ]},
      { id:'m3', title:'Discovery Mastery & Qualification', lessons:[
        {id:'l1',title:'Discovery That Closes Deals: The Questions Nobody Else Asks',keywords:['discovery framework','MEDDIC','SPIN selling','pain discovery','business impact questions']},
        {id:'l2',title:'MEDDPICC in Practice: Qualifying Deals That Actually Close',keywords:['MEDDPICC','qualification framework','economic buyer','decision criteria','paper process']},
        {id:'l3',title:'Multithreading: Accessing Every Stakeholder in the Buying Committee',keywords:['multithreading','buying committee','champion development','executive access','stakeholder mapping']},
        {id:'l4',title:'Disqualification: The Skill That Protects Your Quarter',keywords:['deal disqualification','pipeline hygiene','opportunity scoring','bad deal exit','qualification rigor']},
      ]},
      { id:'m4', title:'Solution Selling & Demonstrations', lessons:[
        {id:'l1',title:'Demo Architecture: From Feature Tour to Business Case',keywords:['demo strategy','value-based demo','discovery-led demo','demo customization','demo-to-close ratio']},
        {id:'l2',title:'Objection Handling: The 7 Most Common + How to Destroy Each',keywords:['objection handling','price objection','status quo objection','competitor objection','objection reframe']},
        {id:'l3',title:'ROI & Business Case Construction: Speaking the Language of the CFO',keywords:['ROI calculation','business case','financial justification','value quantification','TCO analysis']},
        {id:'l4',title:'POC & Trial Management: Turning Technical Evaluation Into a Decision',keywords:['proof of concept','trial management','success criteria','POC governance','evaluation to close']},
      ]},
      { id:'m5', title:'Proposal, Negotiation & Deal Architecture', lessons:[
        {id:'l1',title:'Proposal Design: The Document That Sells When You Are Not in the Room',keywords:['proposal writing','executive summary','solution proposal','proposal structure','visual proposals']},
        {id:'l2',title:'Negotiation Fundamentals: BATNA, Anchoring & the Concession Framework',keywords:['sales negotiation','BATNA','anchoring','concession strategy','negotiation psychology']},
        {id:'l3',title:'Pricing Strategy for AEs: Discount Architecture That Protects Margin',keywords:['discount management','pricing strategy','deal economics','discounting framework','value defense']},
        {id:'l4',title:'Legal & Contract Negotiation: What Every AE Must Know',keywords:['contract negotiation','MSA review','redlines','procurement process','legal risk in sales']},
      ]},
      { id:'m6', title:'Closing Strategies & Deal Velocity', lessons:[
        {id:'l1',title:'The Mutual Action Plan: The Tool That Cuts Sales Cycles in Half',keywords:['mutual action plan','close plan','project plan','deal acceleration','sales cycle compression']},
        {id:'l2',title:'Creating Urgency Without Being Pushy: The Legitimate Urgency Framework',keywords:['sales urgency','compelling event','urgency creation','deal velocity','timeline acceleration']},
        {id:'l3',title:'Closing Techniques for Complex Enterprise Deals',keywords:['enterprise closing','complex sale close','executive close','champion closing','deal commit']},
        {id:'l4',title:'Win-Loss Analysis: The System That Makes You Improve Every Quarter',keywords:['win loss analysis','deal debrief','competitive intelligence','improvement system','loss reasons']},
      ]},
      { id:'m7', title:'Account Management & Expansion Revenue', lessons:[
        {id:'l1',title:'Customer Success Handoff: Setting Up Expansion From Day One',keywords:['CS handoff','account transition','expansion setup','customer success partnership','handoff protocol']},
        {id:'l2',title:'Expansion Selling: Land and Expand Architecture',keywords:['expansion revenue','upsell strategy','cross-sell framework','account growth','NRR improvement']},
        {id:'l3',title:'Executive Relationship Management: Keeping Your C-Suite Sponsor',keywords:['executive relationships','EBR strategy','executive sponsorship','C-suite engagement','stakeholder retention']},
        {id:'l4',title:'Renewal Management & Churn Prevention',keywords:['renewal strategy','churn prevention','at-risk accounts','renewal forecast','retention selling']},
      ]},
      { id:'m8', title:'Sales Technology & Performance Analytics', lessons:[
        {id:'l1',title:'CRM Mastery: Using Salesforce to Sell More, Not Report More',keywords:['Salesforce for AEs','CRM hygiene','pipeline visibility','activity tracking','CRM efficiency']},
        {id:'l2',title:'Sales Intelligence Tools: Turning Intent Data Into Meetings',keywords:['sales intelligence','ZoomInfo','6sense for AEs','intent data','account intelligence']},
        {id:'l3',title:'Pipeline Reviews That Actually Improve Your Number',keywords:['pipeline review','forecast accuracy','deal coaching','pipeline meetings','commit vs upside']},
        {id:'l4',title:'AE Performance Analytics: Knowing Your Numbers Better Than Your Manager',keywords:['sales metrics','AE KPIs','conversion rates','velocity metrics','quota attainment analysis']},
      ]},
    ]
  },

  growth: {
    title: 'Growth Manager Mastery',
    context: 'A data-driven growth program for Growth Managers, Head of Growth, and operators who want to build scalable growth systems, run elite experiments, and drive companies from $1M to $100M ARR.',
    modules: [
      { id:'m1', title:'Growth Foundations & The Growth Operating System', lessons:[
        {id:'l1',title:'The Growth Model: Loops, Flywheels & the Physics of Compounding',keywords:['growth loops','flywheel effect','compounding growth','viral loops','growth model design']},
        {id:'l2',title:'North Star Metric Architecture: The One Number That Drives Everything',keywords:['north star metric','NSM selection','leading indicators','metric hierarchy','growth accounting']},
        {id:'l3',title:'Growth Experimentation System: From Hypothesis to Statistical Significance',keywords:['A/B testing','hypothesis framework','statistical significance','experiment velocity','growth cadence']},
        {id:'l4',title:'The Growth Team: Structure, Hiring & Cross-Functional Operating Model',keywords:['growth team design','cross-functional growth','growth hiring','squad model','growth PM vs marketer']},
      ]},
      { id:'m2', title:'Acquisition Channel Strategy', lessons:[
        {id:'l1',title:'Channel Portfolio Design: Finding Your Unfair Acquisition Advantage',keywords:['channel selection','CAC by channel','acquisition mix','channel concentration risk','growth channel testing']},
        {id:'l2',title:'Paid Acquisition at Scale: Performance Marketing Without Burning Cash',keywords:['paid acquisition','CAC optimization','ROAS','paid channel scaling','performance marketing']},
        {id:'l3',title:'SEO-Led Growth: The Compounding Acquisition Engine',keywords:['SEO growth strategy','programmatic SEO','content-led growth','organic acquisition','SEO compounding']},
        {id:'l4',title:'Product-Led Growth: Building Acquisition Into the Product Itself',keywords:['product-led growth','freemium model','viral product design','PLG metrics','in-product acquisition']},
      ]},
      { id:'m3', title:'Activation & Onboarding Optimization', lessons:[
        {id:'l1',title:'Activation Architecture: Defining and Optimizing Your Aha Moment',keywords:['activation rate','aha moment','time-to-value','activation funnel','onboarding design']},
        {id:'l2',title:'Onboarding Experience Design: The 7-Day Sequence That Retains Users',keywords:['onboarding optimization','user onboarding','activation email sequence','in-app guidance','setup completion']},
        {id:'l3',title:'User Research for Growth: Qualitative Signals That Drive Quantitative Wins',keywords:['user research','session recordings','user interviews','growth insights','behavioral analytics']},
        {id:'l4',title:'Segmentation for Activation: Not Everyone Needs the Same Onboarding',keywords:['user segmentation','personalized onboarding','ICP segmentation','activation by segment','cohort onboarding']},
      ]},
      { id:'m4', title:'Retention & Churn Reduction', lessons:[
        {id:'l1',title:'Retention Modeling: Cohort Analysis, Curves & the Retention Plateau',keywords:['retention curves','cohort analysis','D1 D7 D30 retention','retention plateau','churn modeling']},
        {id:'l2',title:'Churn Prediction & Intervention: Saving Accounts Before They Leave',keywords:['churn prediction','health scoring','at-risk intervention','churn signals','predictive retention']},
        {id:'l3',title:'Engagement Loops: Building the Habit That Makes Your Product Sticky',keywords:['engagement loops','habit formation','daily active users','engagement triggers','Hook model']},
        {id:'l4',title:'Win-Back Campaigns: Re-Engaging Lapsed Users That Actually Works',keywords:['win-back campaigns','re-engagement','lapsed user','reactivation strategy','sunset policy']},
      ]},
      { id:'m5', title:'Revenue Expansion & Monetization', lessons:[
        {id:'l1',title:'Monetization Model Design: Choosing the Right Pricing Architecture',keywords:['monetization strategy','pricing model','freemium vs paid','usage-based pricing','subscription economics']},
        {id:'l2',title:'Expansion Revenue: The Growth Engine Inside Your Existing Base',keywords:['expansion revenue','upsell growth','NRR','seat expansion','feature upsell']},
        {id:'l3',title:'Price Elasticity & Willingness-to-Pay Research',keywords:['price elasticity','conjoint analysis','Van Westendorp','willingness to pay','pricing research']},
        {id:'l4',title:'Packaging & Tiering: The Architecture That Maximizes Revenue Per User',keywords:['product packaging','tier design','feature gating','upgrade triggers','package optimization']},
      ]},
      { id:'m6', title:'Viral Growth & Referral Systems', lessons:[
        {id:'l1',title:'Viral Coefficients: Engineering Word-of-Mouth Into the Product',keywords:['viral coefficient','K-factor','viral loops','sharing mechanics','product virality']},
        {id:'l2',title:'Referral Program Design: Dropbox-Level Programs on Any Budget',keywords:['referral programs','two-sided incentives','referral mechanics','viral referral','referral loop design']},
        {id:'l3',title:'Community-Led Growth: Turning Users Into Your Best Acquisition Channel',keywords:['community-led growth','user community','community flywheel','community as moat','CLG metrics']},
        {id:'l4',title:'Network Effects: Building Products That Get Stronger With Scale',keywords:['network effects','direct network effects','indirect network effects','marketplace dynamics','defensibility']},
      ]},
      { id:'m7', title:'Growth Analytics & Experimentation Framework', lessons:[
        {id:'l1',title:'Analytics Stack for Growth: Mixpanel, Amplitude & the Modern Data Warehouse',keywords:['growth analytics','Mixpanel','Amplitude','product analytics','event tracking']},
        {id:'l2',title:'Statistical Rigor: How to Run Growth Tests You Can Actually Trust',keywords:['statistical significance','p-values','minimum detectable effect','sample size','A/B testing rigor']},
        {id:'l3',title:'Multi-Variate Testing & Feature Flags at Scale',keywords:['multivariate testing','feature flags','LaunchDarkly','sequential testing','experiment governance']},
        {id:'l4',title:'Attribution for Growth Teams: Understanding What Is Actually Working',keywords:['growth attribution','channel attribution','incrementality','attribution models','marketing mix for growth']},
      ]},
      { id:'m8', title:'Scaling Growth & Growth Leadership', lessons:[
        {id:'l1',title:'International Growth: Localizing for New Markets Without Starting Over',keywords:['international growth','localization','market expansion','growth localization','global GTM']},
        {id:'l2',title:'Growth at Series B+: When Scrappy Tactics Become Systematic Engines',keywords:['scaling growth','growth operations','growth process maturity','enterprise growth','growth at scale']},
        {id:'l3',title:'Growth Leadership: Influence Without Authority Across Product, Eng & Marketing',keywords:['growth leadership','cross-functional influence','growth prioritization','stakeholder management','growth culture']},
        {id:'l4',title:'The Growth Manager Career Path: IC to VP of Growth',keywords:['growth career','VP of Growth','growth manager promotion','growth skills','growth portfolio']},
      ]},
    ]
  },

  vpsales: {
    title: 'VP of Sales Mastery',
    context: 'An elite sales leadership program for VPs of Sales, Sales Directors, and founders who want to build world-class revenue organizations, consistently exceed quota, and earn $200K-500K+.',
    modules: [
      { id:'m1', title:'The VP of Sales Operating System', lessons:[
        {id:'l1',title:'How Revenue Leaders Think: The VP of Sales Mental Model',keywords:['VP of Sales mindset','revenue leadership','sales executive skills','VP vs Director','sales organization design']},
        {id:'l2',title:'Revenue Architecture: Designing the Sales Machine for Predictable Growth',keywords:['revenue architecture','predictable revenue','sales motion design','go-to-market architecture','revenue engine']},
        {id:'l3',title:'The First 90 Days as VP of Sales: Diagnosis, Priorities & Credibility',keywords:['VP of Sales onboarding','first 90 days','sales assessment','quick wins','team diagnosis']},
        {id:'l4',title:'Fractional VP of Sales: Building a $200K+ Advisory Practice',keywords:['fractional VP of Sales','sales advisory','engagement design','fractional sales leadership','consulting pricing']},
        {id:'l5',title:'Stakeholder Management: CEO, Board & Cross-Functional Revenue Alignment',keywords:['CEO relationship','board sales reporting','cross-functional alignment','revenue leadership presence','stakeholder communication']},
      ]},
      { id:'m2', title:'Building the Sales Team', lessons:[
        {id:'l1',title:'Sales Hiring Architecture: The Profile That Predicts Top Performance',keywords:['sales hiring','ideal AE profile','sales assessment','structured interviews','predictive hiring']},
        {id:'l2',title:'Ramp Architecture: Getting New Reps to Quota in 90 Days',keywords:['sales ramp','onboarding acceleration','quota ramp','rep productivity','ramp time reduction']},
        {id:'l3',title:'Sales Culture: Building the Competitive Collaborative Environment That Wins',keywords:['sales culture','performance culture','collaborative competition','team culture design','sales psychology']},
        {id:'l4',title:'Managing Performance: Coaching vs Cutting - The Framework',keywords:['performance management','PIP process','sales coaching','rep development','performance decisions']},
        {id:'l5',title:'Sales Organization Design: SDRs, AEs, SMs & the Hierarchy That Scales',keywords:['sales org design','manager to rep ratio','SDR AE ratio','sales hierarchy','reporting structure']},
      ]},
      { id:'m3', title:'Sales Process Design & Methodology', lessons:[
        {id:'l1',title:'Sales Process Architecture: Stages, Gates & the Conversion Waterfall',keywords:['sales process design','opportunity stages','exit criteria','sales methodology','process governance']},
        {id:'l2',title:'Implementing a Sales Methodology: MEDDPICC & Challenger at Scale',keywords:['MEDDPICC implementation','Challenger sale','methodology adoption','sales training ROI','rep behavior change']},
        {id:'l3',title:'The Sales Playbook: Scaling Your Best Rep Behavior Across the Team',keywords:['sales playbook','playbook design','best practice capture','scaling sales knowledge','rep enablement']},
        {id:'l4',title:'Discovery & Qualification Standards That Protect Forecast Accuracy',keywords:['qualification standards','discovery quality','forecast discipline','MEDDIC enforcement','pipeline standards']},
        {id:'l5',title:'Deal Review Architecture: The Cadence That Surfaces Risk Early',keywords:['deal reviews','pipeline inspection','forecast calls','deal coaching','risk identification']},
      ]},
      { id:'m4', title:'Pipeline Management & Revenue Forecasting', lessons:[
        {id:'l1',title:'Pipeline Generation: The VP of Sales Responsibility for Top-of-Funnel',keywords:['pipeline generation','VP pipeline ownership','top-of-funnel strategy','sourcing mix','pipeline coverage']},
        {id:'l2',title:'Pipeline Coverage & Velocity: The Two Metrics That Predict Your Quarter',keywords:['pipeline coverage','deal velocity','pipeline analysis','sales velocity equation','pipeline health']},
        {id:'l3',title:'Revenue Forecasting Methodology: Bottom-Up vs Top-Down vs AI',keywords:['sales forecasting','forecast methodology','bottom-up forecast','AI forecasting','forecast accuracy']},
        {id:'l4',title:'The Weekly Revenue Review: The Cadence That Controls the Quarter',keywords:['weekly revenue review','sales cadence','forecast meeting','pipeline meeting','revenue rhythm']},
        {id:'l5',title:'CRM Data Quality: The Foundation of a Forecast You Can Stand Behind',keywords:['CRM data quality','Salesforce hygiene','forecast reliability','data governance','pipeline accuracy']},
      ]},
      { id:'m5', title:'Sales Compensation & Incentive Design', lessons:[
        {id:'l1',title:'Comp Plan Architecture: OTE, Accelerators & the Quota-Coverage Balance',keywords:['sales compensation','OTE design','accelerators','quota setting','comp plan structure']},
        {id:'l2',title:'Quota Design: Setting Numbers Aggressive Enough to Matter Without Demoralizing',keywords:['quota setting','quota methodology','attainment distribution','quota fairness','ramp quota']},
        {id:'l3',title:'SPIFFs, Contests & Behavioral Incentives That Actually Move the Needle',keywords:['SPIFF design','sales contests','incentive programs','behavioral incentives','short-term motivation']},
        {id:'l4',title:'Comp Plan Governance: Disputes, Changes & Transparency',keywords:['comp plan disputes','compensation governance','plan changes','transparency','comp communication']},
        {id:'l5',title:'Equity for Sales Leaders: Understanding Your Package & Negotiating Effectively',keywords:['sales leader equity','stock options','RSUs','VP of Sales compensation','equity negotiation']},
      ]},
      { id:'m6', title:'Sales Enablement & Continuous Training', lessons:[
        {id:'l1',title:'Sales Enablement Architecture: Content, Coaching & Competency Development',keywords:['sales enablement','enablement strategy','sales content','coaching framework','competency model']},
        {id:'l2',title:'Call Recording & Coaching: Gong, Chorus & the Analysis That Improves Reps',keywords:['call coaching','Gong','Chorus','conversation intelligence','coaching at scale']},
        {id:'l3',title:'Sales Kickoff Design: The Annual Event That Actually Changes Behavior',keywords:['sales kickoff','SKO design','sales training event','behavior change','SKO ROI']},
        {id:'l4',title:'Continuous Learning Architecture: Weekly Skill Development That Compounds',keywords:['continuous sales training','weekly coaching','skill development','sales learning system','knowledge retention']},
        {id:'l5',title:'Competitive Intelligence: Keeping the Team Battle-Ready Every Quarter',keywords:['competitive intelligence','battlecards','competitive training','win rate improvement','competitive positioning']},
      ]},
      { id:'m7', title:'Territory, Segmentation & Account Strategy', lessons:[
        {id:'l1',title:'Market Segmentation: Defining the ICP That Maximizes Win Rates',keywords:['ICP definition','market segmentation','firmographic targeting','TAM SAM SOM','ICP refinement']},
        {id:'l2',title:'Territory Design: Carving Markets for Maximum Productivity & Fairness',keywords:['territory design','account assignment','territory equity','geographic vs vertical','territory planning']},
        {id:'l3',title:'Named Account Strategy: Enterprise vs Commercial vs SMB Motion',keywords:['named accounts','enterprise sales motion','commercial mid-market','SMB motion','segment strategy']},
        {id:'l4',title:'Partner & Channel Sales: Building Revenue Without Adding Headcount',keywords:['channel sales','partner program','indirect sales','reseller management','partner revenue']},
        {id:'l5',title:'International Sales Expansion: When and How to Cross Borders',keywords:['international sales','EMEA expansion','APAC sales','country manager hire','international GTM']},
      ]},
      { id:'m8', title:'Revenue Operations & Sales Analytics', lessons:[
        {id:'l1',title:'Revenue Operations Architecture: Aligning Sales, Marketing & Customer Success',keywords:['RevOps','revenue operations','GTM alignment','RevOps structure','unified funnel']},
        {id:'l2',title:'Sales Dashboard Design: The Metrics That Lead, Not Lag',keywords:['sales dashboard','leading indicators','lagging metrics','sales KPIs','executive reporting']},
        {id:'l3',title:'Salesforce Architecture for VPs: What to Own, What to Delegate',keywords:['Salesforce strategy','CRM governance','admin vs strategy','Salesforce ROI','VP Salesforce ownership']},
        {id:'l4',title:'Win Rate Analysis: The Diagnostic That Reveals Systemic Issues',keywords:['win rate analysis','conversion analysis','competitive win rate','stage conversion','diagnostic metrics']},
        {id:'l5',title:'Annual Planning: Headcount, Quota, Territory & Budget',keywords:['sales annual planning','headcount model','capacity planning','fiscal year plan','sales budget']},
      ]},
      { id:'m9', title:'Enterprise & Strategic Selling', lessons:[
        {id:'l1',title:'Enterprise Sales Motions: The Differences That Change Everything',keywords:['enterprise sales','complex deals','multi-year contracts','enterprise buying process','RFP management']},
        {id:'l2',title:'Executive Selling: Teaching Your Team to Access and Influence the C-Suite',keywords:['executive selling','C-suite access','VP-to-VP relationships','executive presence in sales','senior stakeholder']},
        {id:'l3',title:'Proof of Concept Management: Winning the Technical Evaluation',keywords:['POC management','technical evaluation','success criteria','evaluation governance','POC-to-close conversion']},
        {id:'l4',title:'Strategic Account Management: Protecting and Growing Your Largest Accounts',keywords:['strategic account management','SAM program','executive business review','account growth plans','key account strategy']},
        {id:'l5',title:'Legal & Procurement: Navigating the Final Stage Without Losing Margin',keywords:['procurement negotiation','legal review','contract redlines','procurement strategy','final stage negotiation']},
      ]},
      { id:'m10', title:'VP of Sales Leadership & Executive Career', lessons:[
        {id:'l1',title:'Building Your Leadership Brand: Becoming the VP Who Attracts Top Talent',keywords:['sales leadership brand','talent attraction','VP reputation','leadership presence','recruiting differentiation']},
        {id:'l2',title:'Navigating Board & Investor Pressure: The Sales Leader in the Spotlight',keywords:['board sales reporting','investor relations for sales','sales pressure management','board dynamics','growth narrative']},
        {id:'l3',title:'Sales Leadership in Crisis: Managing Missed Quarters & Market Shifts',keywords:['sales crisis management','missed quarter recovery','team morale','market disruption response','turnaround leadership']},
        {id:'l4',title:'The Chief Revenue Officer Path: From VP of Sales to CRO',keywords:['CRO career path','VP to CRO transition','CRO skills','revenue leadership career','CRO positioning']},
        {id:'l5',title:'Legacy Leadership: Building Revenue Organizations That Win Without You',keywords:['leadership legacy','organizational resilience','succession planning','culture building','VP of Sales legacy']},
      ]},
    ]
  },

  ceo: {
    title: 'CEO Mastery: Building & Leading a $50M Company',
    context: 'A comprehensive operating system for founders and CEOs who want to build companies that scale from $1M to $50M+. Covers strategy, capital, team, culture, and the CEO leadership model required at each growth stage.',
    modules: [
      { id:'m1', title:'The CEO Role & Executive Identity', lessons:[
        {id:'l1',title:'The CEO Mandate: Architect of Strategy, Culture & Capital',keywords:['CEO mandate','executive identity','founder evolution','strategic leadership','CEO role clarity']},
        {id:'l2',title:'The CEO Operating System: How Elite CEOs Structure Their Work',keywords:['CEO operating system','time architecture','priority management','decision velocity','executive rhythm']},
        {id:'l3',title:'The Founder-to-CEO Transition: Letting Go to Scale Up',keywords:['founder CEO transition','delegation','letting go','scaling leadership','executive maturity']},
        {id:'l4',title:'CEO Identity Under Pressure: Resilience, Doubt & the Long Game',keywords:['CEO resilience','leadership under pressure','impostor syndrome','founder psychology','long-term mindset']},
        {id:'l5',title:'The CEO Brand: Your Authority Inside and Outside the Company',keywords:['CEO personal brand','executive presence','internal authority','external thought leadership','leadership credibility']},
      ]},
      { id:'m2', title:'Strategy & Competitive Positioning', lessons:[
        {id:'l1',title:'Strategic Clarity, Turning Vision Into a Governing Framework',keywords:['strategic clarity','vision to strategy','governing framework','strategic priorities','what we are not doing']},
        {id:'l2',title:'Competitive Positioning, Owning a Defensible Market Position',keywords:['competitive positioning','market differentiation','defensible moat','competitive strategy','market leadership']},
        {id:'l3',title:'The Annual Strategic Planning Process',keywords:['strategic planning','annual planning','OKR design','resource allocation','strategic prioritization']},
        {id:'l4',title:'Category Design, Creating the Market You Want to Win',keywords:['category design','market creation','thought leadership','category conditioning','market leadership']},
        {id:'l5',title:'Competitive Intelligence, How CEOs Monitor & Respond to the Market',keywords:['competitive intelligence','market monitoring','competitive response','strategic adaptation','market signals']},
      ]},
      { id:'m3', title:'Financial Leadership & Capital Allocation', lessons:[
        {id:'l1',title:'The CEO\'s Financial Fluency, Reading the Business Through Numbers',keywords:['financial fluency','CEO finance','reading financials','business metrics','financial literacy']},
        {id:'l2',title:'Capital Allocation, The Highest-Leverage CEO Decision',keywords:['capital allocation','investment prioritization','resource allocation','ROI thinking','capital strategy']},
        {id:'l3',title:'Fundraising Architecture, Timing, Investors & Terms',keywords:['fundraising strategy','investor selection','term sheets','round timing','capital structure']},
        {id:'l4',title:'Unit Economics, The Foundation of Every Growth Decision',keywords:['unit economics','LTV CAC','payback period','cohort analysis','financial model']},
        {id:'l5',title:'Financial Governance, Controls, Reporting & Board Confidence',keywords:['financial governance','internal controls','board reporting','financial transparency','CFO partnership']},
      ]},
      { id:'m4', title:'Building & Leading the Executive Team', lessons:[
        {id:'l1',title:'Hiring Your C-Suite, The Decisions That Determine Your Ceiling',keywords:['C-suite hiring','executive assessment','wrong-stage executive','executive selection','leadership team building']},
        {id:'l2',title:'Leading Executives, Managing People Who Are Experts in Their Domain',keywords:['leading executives','mission-bounded autonomy','executive management','functional leadership','expert management']},
        {id:'l3',title:'Managing Underperformance and Making the Hard Firing Decisions',keywords:['executive underperformance','firing decisions','performance management','leadership accountability','hard people decisions']},
        {id:'l4',title:'Compensation Architecture for the Leadership Team',keywords:['executive compensation','equity design','incentive structures','compensation strategy','leadership pay']},
        {id:'l5',title:'Executive Team Operating Rhythm',keywords:['executive team rhythm','leadership cadence','operating meetings','team alignment','leadership operating system']},
      ]},
      { id:'m5', title:'Revenue Architecture & Commercial Leadership', lessons:[
        {id:'l1',title:'Owning the Revenue Number, The CEO\'s Commercial Accountability',keywords:['CEO revenue ownership','commercial accountability','revenue leadership','GTM oversight','pipeline ownership']},
        {id:'l2',title:'Go-to-Market Strategy from the CEO Seat',keywords:['GTM strategy','ICP definition','channel strategy','market segmentation','commercial architecture']},
        {id:'l3',title:'Building and Scaling a Sales Organization',keywords:['sales organization','sales process','sales hiring','quota design','revenue operations']},
        {id:'l4',title:'Customer Success as a Revenue and Retention Strategy',keywords:['customer success','NRR strategy','churn reduction','expansion revenue','retention architecture']},
        {id:'l5',title:'Revenue Model Design, Pricing, Packaging, and Mix',keywords:['revenue model','pricing strategy','packaging design','value-based pricing','revenue mix']},
      ]},
      { id:'m6', title:'Operational Excellence & Scaling Systems', lessons:[
        {id:'l1',title:'Building Systems That Scale, The CEO\'s Role in Operations',keywords:['scaling systems','operational architecture','CEO operations role','systems thinking','operational leverage']},
        {id:'l2',title:'The Operating Cadence, Metrics, Meetings, and Accountability Rhythms',keywords:['operating cadence','OKRs','accountability rhythm','metrics architecture','operating meetings']},
        {id:'l3',title:'Process Without Bureaucracy, Discipline at Scale',keywords:['process design','avoiding bureaucracy','operational discipline','scalable process','growth operations']},
        {id:'l4',title:'Technology Leverage, How CEOs Think About Tech Investment',keywords:['technology investment','build vs buy','tech leverage','operational technology','digital infrastructure']},
        {id:'l5',title:'Quality, Delivery, and Systems That Protect Customer Trust',keywords:['quality systems','delivery excellence','customer trust','SLA design','operational quality']},
      ]},
      { id:'m7', title:'Board Management & Investor Relations', lessons:[
        {id:'l1',title:'Understanding Your Board, Power Dynamics and Stakeholder Maps',keywords:['board dynamics','stakeholder mapping','board power','investor interests','board relationships']},
        {id:'l2',title:'Running the Board Meeting, Preparation, Presentation, and Pre-Selling',keywords:['board meeting preparation','pre-read','board presentation','board management','governance best practices']},
        {id:'l3',title:'Investor Relations for Growth-Stage CEOs',keywords:['investor relations','investor updates','fundraising narrative','investor communication','capital relationships']},
        {id:'l4',title:'Governance, Legal Accountability, and CEO Risk Management',keywords:['corporate governance','legal accountability','CEO legal exposure','fiduciary duty','risk management']},
        {id:'l5',title:'Managing Board Conflict and Navigating Disagreement',keywords:['board conflict','board disagreement','investor pressure','governance disputes','strategic alignment']},
      ]},
      { id:'m8', title:'Culture, Talent & Organizational Design', lessons:[
        {id:'l1',title:'Culture as Strategy, How CEOs Shape the Invisible Architecture',keywords:['culture strategy','cultural architecture','values operationalization','culture design','CEO cultural role']},
        {id:'l2',title:'Talent Architecture, Building a Team That Wins at Scale',keywords:['talent architecture','hiring excellence','talent density','team building','talent strategy']},
        {id:'l3',title:'Organizational Design, Structure, Reporting Lines, and Decision Rights',keywords:['organizational design','org structure','reporting lines','decision rights','RACI']},
        {id:'l4',title:'Managing High Performers, Keeping Your Best People',keywords:['high performer management','retention strategy','top talent','performance culture','star player retention']},
        {id:'l5',title:'Scaling Culture, Maintaining What Matters as the Company Grows',keywords:['scaling culture','culture at scale','cultural consistency','manager development','cultural transmission']},
      ]},
      { id:'m9', title:'M&A, Partnerships & Strategic Growth', lessons:[
        {id:'l1',title:'Strategic Partnerships, How CEOs Create Asymmetric Growth Leverage',keywords:['strategic partnerships','partnership strategy','channel partnerships','integration partnerships','partnership value']},
        {id:'l2',title:'M&A for Growth-Stage CEOs, Acquisitions as Strategic Acceleration',keywords:['M&A strategy','acquisition thesis','integration planning','due diligence','buy-side M&A']},
        {id:'l3',title:'International Expansion, When, How, and How Not to Go Global',keywords:['international expansion','global growth','market entry','localization','international GTM']},
        {id:'l4',title:'Building a Strategic Roadmap, Translating Vision Into Executable Plans',keywords:['strategic roadmap','vision execution','planning architecture','strategic priorities','OKR design']},
        {id:'l5',title:'Competitive Strategy, How CEOs Think About Winning Long-Term',keywords:['competitive strategy','long-term positioning','market leadership','competitive moats','strategic advantage']},
      ]},
      { id:'m10', title:'CEO Decision-Making & Personal Leadership', lessons:[
        {id:'l1',title:'CEO Decision-Making, Frameworks for High-Stakes Choices',keywords:['decision frameworks','pre-mortem analysis','reversibility test','decision quality','high-stakes decisions']},
        {id:'l2',title:'Managing Your Energy, The CEO\'s Most Scarce Resource',keywords:['CEO energy management','peak performance','attention allocation','physical disciplines','calendar architecture']},
        {id:'l3',title:'CEO Communication, Leading Through Narrative, Clarity, and Presence',keywords:['CEO communication','all-hands design','leadership narrative','strategic clarity','internal communication']},
        {id:'l4',title:'CEO Wellbeing, Sustaining Performance Over the Long Arc',keywords:['CEO wellbeing','peer CEO group','executive coach','sustainable performance','impostor syndrome']},
        {id:'l5',title:'The CEO at $50M, Completing the Journey and Beginning the Next',keywords:['CEO at 50M','builder to leader transition','next stage growth','CEO development','company building mastery']},
      ]},
    ]
  }};

// ─── JSONBIN CACHE HELPERS ───────────────────────────────────────────────────
// ─── CALL ANTHROPIC ───────────────────────────────────────────────────────────
// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
// ─── TOKEN VALIDATOR ──────────────────────────────────────────────────────────
const https = require('https');
function jsonbinGet(binId, apiKey) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.jsonbin.io',
      path: `/v3/b/${binId}`,
      method: 'GET',
      headers: { 'X-Master-Key': apiKey, 'Content-Type': 'application/json' }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const p = event.queryStringParameters || {};
  const courseId = p.course;
  const moduleId = p.module;
  const lessonId = p.lesson;
  const token    = p.token;  // required for auth

  // ── HARD TOKEN GATE, no token = no content ────────────────────────────────
  if (!token || token.length < 8) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Access token required', code: 'NO_TOKEN' }) };
  }

  // Validate token against enrollment records
  const { JSONBIN_API_KEY, JSONBIN_ENROLLMENTS_BIN_ID } = process.env;
  if (JSONBIN_API_KEY && JSONBIN_ENROLLMENTS_BIN_ID) {
    try {
      const data = await jsonbinGet(JSONBIN_ENROLLMENTS_BIN_ID, JSONBIN_API_KEY);
      // Structure: data.record = { enrollments: [...] }
      const record = data.record || data || {};
      const enrollments = Array.isArray(record) ? record : (record.enrollments || []);
      const enrollment = enrollments.find(e => e.accessToken === token);

      if (!enrollment) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid access token', code: 'INVALID_TOKEN' }) };
      }
      if (enrollment.courseId !== courseId) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Token not valid for this course', code: 'WRONG_COURSE' }) };
      }
      // Token valid for this course, continue to serve content
    } catch(err) {
      console.error('Token validation error in course-lesson:', err.message);
      // Fail CLOSED, if we can't validate, deny access
      return { statusCode: 503, headers, body: JSON.stringify({ error: 'Auth service temporarily unavailable', code: 'AUTH_ERROR' }) };
    }
  }
  // ── END TOKEN GATE ─────────────────────────────────────────────────────────

  // Validate course
  const course = CURRICULUM[courseId];
  if (!course) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Course not found' }) };

  const mod = course.modules.find(m => m.id === moduleId);
  if (!mod) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Module not found' }) };

  const lesson = mod.lessons.find(l => l.id === lessonId);
  if (!lesson) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Lesson not found' }) };

  // Serve from static data only
  const staticData = STATIC_COURSES[courseId];
  if (!staticData) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Course content not yet available' }) };
  }

  const lessonData = staticData[moduleId] && staticData[moduleId][lessonId];
  if (!lessonData) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Lesson content not found' }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      course: courseId,
      module: moduleId,
      lesson: lessonId,
      courseTitle: course.title,
      moduleTitle: mod.title,
      totalModules: course.modules.length,
      totalLessons: mod.lessons.length,
      data: lessonData
    })
  };
};

// ─── EXPORT CURRICULUM for other functions ────────────────────────────────────
exports.CURRICULUM = CURRICULUM;
