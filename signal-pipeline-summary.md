# The Signal Pipeline — How It Worked

## Architecture Overview
Five cron jobs, running in sequence Mon/Wed/Fri, with a separate daily digest running weekdays. Notion was the database backbone throughout.

---

## Stage 1 — Research Sweep (06:00 Mon/Wed/Fri)
**Job 3 | Model: Sonnet**

The agent web-searched for signals across **6 themes** defined in `RESEARCH_THEMES.md`:
1. AI Commercialisation in Financial Services
2. Human-Centric Customer Experience
3. Adoption Mechanics & Implementation Gap
4. Leadership & Governance
5. UAE/GCC Financial Services Market
6. Strategic Sovereignty & Infrastructure

**Source quality tiers:**
- Tier 1: FT, Bloomberg, Reuters, McKinsey, BCG, BIS, FSB, DFSA/CBUAE official publications
- Tier 2: American Banker, Finextra, HBR, Gartner (with attribution)
- Tier 3: Vendor research, Substack (credentialed authors only), LinkedIn (practitioners only)
- Discard: Anonymous blogs, AI-generated summaries, anything with em-dashes in the headline

**Freshness rules:** Domain-aware windows (AI landscape: 3 weeks max; regulatory: 6 months; GCC: 4 weeks). Recirculation does not equal recency - a reshared McKinsey piece from 6 months ago gets discarded.

**Output:** 5-8 signals per sweep written to Notion **Research Signals DB** with fields: Name, Link, Theme, Status=Captured, Summary, Captured date.

---

## Stage 2 — Signal Triage Filter (07:00 Mon/Wed/Fri)
**Job 5 | Model: Haiku** (fast, cheap pre-screening)

A quick pass before the expensive panel. Fetched all signals with `Extraction Status = Captured` and applied 3 tests:
1. **Evidence** - named institution or verifiable stat?
2. **Novelty** - genuinely new, not a press release?
3. **Commercial relevance** - clear so-what for a global bank exec?

Signals failing 2+ tests were immediately marked `Routing Decision = Discard` and removed from the panel queue. Only signals passing 2/3 or better survived to Stage 3.

---

## Stage 3 — Panel Debate (08:00 Mon/Wed/Fri)
**Job 6 | Model: Sonnet | Up to 5 signals per run**

The centrepiece. Five synthetic expert personas debated each signal:

- **Margaret** - Former FCA/DFSA director. Challenges unsourced claims, vendor-funded research. Rejects press releases. *"What is the source for that figure?"*
- **Ravi** - Behavioural economist, CX strategy. Challenges efficiency narratives that shift friction to customers. *"Who benefits - the bank or the customer?"*
- **Duncan** - Ex-McKinsey FS partner, NED. Commercial so-what lens. *"What does a C-suite do differently on Monday because of this?"*
- **Petra** - Former bank CTO. Institutional sceptic of hype cycles. Flags AI slop on sight. *"Is this a real deployment or a pilot that will never scale?"*
- **Yusuf** - UAE-based FS investor. GCC relevance filter. *"Does this apply in a relationship-banking culture?"*

**Voting:** 3+ APPROVE = ROUTE; fewer = DISCARD or HOLD.

**Hard rules:**
- Em-dashes in content = automatic flag from Petra
- Unquantified claims = automatic challenge from Margaret
- US/UK-centric framing without GCC relevance = challenge from Yusuf
- Unanimous REJECT = archive, no further review
- Split (2-3) = route but flag the dissenting view in the Content Hook field
- The debate must surface at least one contrarian angle, even on approved signals

**Output per signal:**
```
SIGNAL: [title]
SOURCE: [URL or publication]

MARGARET: [2-3 sentences. Vote: APPROVE / CONDITIONAL / REJECT]
RAVI: [2-3 sentences. Vote: APPROVE / CONDITIONAL / REJECT]
DUNCAN: [2-3 sentences. Vote: APPROVE / CONDITIONAL / REJECT]
PETRA: [2-3 sentences. Vote: APPROVE / CONDITIONAL / REJECT]
YUSUF: [2-3 sentences. Vote: APPROVE / CONDITIONAL / REJECT]

VERDICT: [ROUTE / HOLD / DISCARD] - [count]: [names who approved]
CONTRARIAN ANGLE: [The strongest argument against the signal's premise]
CONTENT HOOK: [One sentence. The angle Conor should take. Direct, specific, no em-dashes.]
```

ROUTE signals were written to **Content Factory DB** as new entries (Status=Idea, Format=LinkedIn Post).

---

## Stage 4 — Content Draft & Typefully Queue (09:00 Tue/Thu/Sat)
**Job 7 | Model: Sonnet**

Pulled up to 3 Content Factory items with `Status = Idea`. Fetched each source article, drafted a 150-250 word LinkedIn post per `VOICE.md` rules (no em-dashes, no hyperbole, no unverified stats). Self-reviewed against hard rules before submitting.

Queued each draft in **Typefully** (social set `285445`, LinkedIn connected). Updated Notion item to `Status = Review`. Conor then reviewed/scheduled in Typefully directly.

---

## Side Stream — Intellect Daily Digest (06:30 weekdays)
**Job 4 | Model: Haiku**

Separate from the main pipeline. Daily Notion page ("Intellect Intel - [date]") covering competitor moves (Temenos, Finastra, Oracle FLEXCUBE, Mambu, Thought Machine), core banking deals, digital banking licences, regulatory developments. Used by Conor internally at Intellect Design Arena.

---

## Status (as of 2026-03-22)
All 5 jobs (3, 4, 5, 6, 7) were killed. The Notion databases still exist with their IDs. The workspace files (`RESEARCH_THEMES.md`, `PANEL.md`, `VOICE.md`) are intact.

The architecture is fully preserved - dormant, not deleted.
