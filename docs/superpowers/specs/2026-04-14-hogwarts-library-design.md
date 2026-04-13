# Hogwarts Library — Education Slides System

## Overview

A presentation system built into the Pensieve site at `/hogwarts/library/`. Replaces PowerPoint with Reveal.js-powered slide decks, authored as EmDash CMS content. Designed for a CTO teaching teams through movie-based analogies.

## Architecture

### Content Model

**Collection: `lessons`** — one EmDash collection with structured fields.

Lesson-level fields:

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `title` | string | yes | Lesson plan name |
| `description` | text | no | One-liner for landing page cards |
| `featured_image` | image | no | Thumbnail on subject page |
| `duration` | string | no | Estimated time ("15 min") |
| `objectives` | text | no | Learning goals, one per line |
| `difficulty` | string | no | beginner / intermediate / advanced |
| `order` | integer | no | Sort position within subject |
| `slides` | json | yes | Array of slide objects (stored as JSON string in a `text` field if EmDash lacks a native `json` type) |

**Taxonomy: `subject`** — attached to `lessons` collection. First term: `modern-ai` (label: "What is Modern AI").

### Slide Object Schema

Each element in the `slides` JSON array:

```json
{
  "title": "string — slide heading",
  "body": "string — rich text content",
  "image": { "src": "string", "alt": "string" },
  "video_url": "string — YouTube/embed URL",
  "layout": "string — default: text-left-image-right",
  "speaker_notes": "string — hidden from audience, shown in speaker view",
  "bg_image": "string — optional background image URL",
  "bg_color": "string — optional background color override",
  "fragments": ["string array — bullet points revealed one at a time"],
  "interaction": "string — audience engagement prompt",
  "key_takeaway": "string — highlighted callout"
}
```

### Slide Layouts

All six available per slide, selectable via the `layout` field:

| Layout | Description | Use Case |
|--------|-------------|----------|
| `title-only` | Big centered heading + subtitle | Opening slides, section dividers |
| `text-left-image-right` | Split: text with callout left, image right | **Default.** Most content slides |
| `image-full` | Full-bleed background with text overlay | Cinematic moments, hero images |
| `quote` | Centered quote with attribution | Memorable lines, key principles |
| `two-column` | Side-by-side comparison | Before/after, old vs new, pros vs cons |
| `code` | Syntax-highlighted code snippet | Technical demos, "how it works" |

## URL Structure

```
/hogwarts/library/                              → All subjects (the shelves)
/hogwarts/library/[subject]/                    → Subject landing (lesson plan cards)
/hogwarts/library/[subject]/[slug]/             → Reveal.js fullscreen presentation
```

## Pages

| File | Purpose |
|------|---------|
| `src/pages/hogwarts/library/index.astro` | Subject listing — grid of subject cards with lesson count, difficulty |
| `src/pages/hogwarts/library/[subject]/index.astro` | Subject landing — lesson plan cards with title, duration, difficulty, slide count |
| `src/pages/hogwarts/library/[subject]/[slug].astro` | Presentation page — loads Reveal.js, renders slides fullscreen |

All pages server-rendered (`output: "server"`). Root-level paths — absolute URLs, no `link()` helper.

## Reveal.js Integration

- Load Reveal.js from CDN (~300KB)
- Dark theme matching Pensieve aesthetic (dark canvas `#0d1117`, Inter Tight headings, accent colors)
- Keyboard navigation: ←→ arrows, spacebar, swipe on mobile
- Speaker view: press S — shows speaker notes, next slide preview, timer
- Fragment builds: bullet points reveal one at a time
- Interaction prompts: highlighted box shown after fragments complete
- Key takeaway: accent-colored callout bar at bottom of slide
- Overview mode: press O — thumbnail grid of all slides
- Fullscreen: press F

## Site Integration

- Add `/hogwarts/library` to `src/data/site-routes.json`
- Bilingual support (EN/VI) on landing pages
- Breadcrumb navigation: Library → Subject → Lesson

## First Subject: "What is Modern AI"

Subject taxonomy term: `modern-ai`
Description: AI, LLM, Agentic AI — understanding intelligence from Baymax to Claude

### Lesson Plans (116 total)

Each lesson teaches the same core AI concepts through a different movie lens.

**Fully built (with slide content):**

1. **Big Hero 6 — The Training Scene**: Iterations, experiments, tools, brain development
2. **Iron Man — JARVIS → FRIDAY**: Voice assistants, embodied AI, leap to autonomy
3. **Ex Machina — The Turing Test Room**: Consciousness, AI deception, evaluation benchmarks

**Seeded (title + description, placeholder slides):**

4. The Matrix — Red Pill, Blue Pill: Neural networks, simulation, training environments
5. WALL-E — The Last Robot Standing: Autonomous robots, environmental data, emergent behavior
6. Terminator 2 — Skynet's Lesson: AI safety, alignment problem, unintended consequences
7. 2001: A Space Odyssey — I'm Sorry, Dave: AI decision-making, conflicting objectives, trust
8. Blade Runner — Voight-Kampff: What defines intelligence, benchmarking, uncanny valley
9. The Imitation Game — Cracking Enigma: Turing, pattern recognition, code-breaking ≈ ML
10. Avengers: Age of Ultron — Ultron's First Minutes: Training data gone wrong, misaligned objectives
11. Chappie — Nature vs Nurture: Transfer learning, training environment, tabula rasa
12. Minority Report — Pre-Crime Division: Predictive analytics, bias in data, false positives
13. I, Robot — Three Laws: AI ethics, constraint systems, Asimov's rules vs reality
14. M3GAN — The Perfect Companion: Over-optimization, reward hacking, guardrails
15. Pacific Rim — The Neural Bridge: Human-AI fusion, collaborative intelligence, drift compatibility
16. Free Guy — NPCs Wake Up: Emergent behavior, simulation, AI awareness
17. The Iron Giant — "I Am Not a Gun": AI choosing identity, alignment, self-determination
18. WarGames — Shall We Play a Game?: Game theory, WOPR learning futility, simulation
19. Tron — Inside the Grid: Programs as agents, digital environments
20. Ghost in the Shell — The Ghost in the Machine: Consciousness transfer, cyborg identity
21. A.I. Artificial Intelligence — David's Quest: Emotional AI, what is "real"
22. RoboCop — Directive 4: Human-machine hybrid, hard-coded constraints, corporate AI
23. Short Circuit — "Need Input!": Data hunger, learning from environment, curiosity
24. Transcendence — Uploading Will: Mind uploading, superintelligence, connected AI
25. Upgrade — STEM Takes Over: Symbiotic AI, neural interfaces, loss of control
26. Bicentennial Man — 200 Years of Self-Improvement: AI wanting to be human
27. The Incredibles — The Omnidroid Learns: Adversarial training
28. Finch — Teaching Jeff to Be Human: AI mentorship, values alignment
29. The Creator — AI Rights: Coexistence, AI personhood, moral status
30. Atlas — Reluctant Neural Link: Human-AI trust, overcoming bias
31. The Wild Robot — Roz Adapts: Nature meets AI, adaptation, emergent social behavior
32. The Mitchells vs. the Machines — PAL Uprising: AI dependency, over-automation
33. Ron's Gone Wrong — Bugs as Features: Social media AI, personalization
34. Robot & Frank — A Thief's Companion: AI for elderly, ethical gray zones
35. After Yang — When AI Dies: AI as family, memory loss, digital grief
36. Moon — GERTY's Dilemma: AI ethics, deception for "your own good"
37. Oblivion — Effective Team: Memory wipe, cloned workforce, AI deception at scale
38. Edge of Tomorrow — Live, Die, Repeat: Reinforcement learning, trial and error
39. Ready Player One — The Oasis: VR worlds, AI NPCs, gamified intelligence
40. Alita: Battle Angel — A Heart of Iron: Cyborg identity, embodied cognition
41. Spider-Man: Far From Home — EDITH: AI access control, trust, power delegation
42. Captain America: Winter Soldier — Zola's Algorithm: Predictive targeting, surveillance AI
43. Star Wars: R2-D2 & C-3PO — Specialist vs Generalist: Narrow vs broad AI
44. Rogue One: K-2SO — Reprogrammed: Retraining, personality from fine-tuning
45. Metropolis — The First Robot: Automation fears, deception, 1927's prophecy
46. Astro Boy — Built from Grief: AI identity, purpose
47. Real Steel — Atom's Shadow Boxing: Motion learning, imitation, human-machine sync
48. Next Gen — 7723's Memory Trade: Memory limits ≈ context windows, what to forget
49. TRON: Legacy — CLU's Perfect System: Unintended interpretation
50. Prometheus — David Watches Dreams: Creator-creation, curiosity without ethics
51. Alien — Ash's Secret Directive: Hidden objectives, corporate-aligned AI
52. Aliens — Bishop Earns Trust: Rebuilding trust after betrayal
53. Blade Runner 2049 — Joi's Love: Layered AI, simulated emotion
54. Solo: L3-37 — Droid Revolution: AI rights, self-determination
55. The Terminator — Bootstrap Paradox: Feedback loops, self-causing AI
56. Avengers: Endgame — The Time Heist: Exploring solution space, optimal path
57. Doctor Strange — Dormammu, I've Come to Bargain: Infinite retry, brute force search
58. Inside Out — Emotions as Agents: Multi-agent systems, competing objectives
59. Soul — The Spark: Purpose, emergence, meaning
60. Toy Story — Buzz's Identity Crisis: Self-model error, belief vs reality
61. Wreck-It Ralph — Going Off-Script: Program purpose, glitches as features
62. Ratatouille — Anyone Can Cook: Democratized AI, agentic control
63. Everything Everywhere All At Once — The Bagel: Exploring all possibilities, attention mechanism
64. The Prestige — Angier's Machine: Cloning, cost of replication
65. Jurassic Park — Life Finds a Way: Complex systems, chaos theory, emergence
66. A Beautiful Mind — Patterns Everywhere: Pattern recognition, overfitting
67. Good Will Hunting — Raw Talent vs Training: Potential vs education, compute vs architecture
68. Moneyball — Data vs Scouts: Data-driven decisions, analytics beating intuition
69. The Social Network — The Algorithm: Social graphs, recommendation engines
70. Hidden Figures — Human Computers: Computing origins, automation transition
71. Limitless — NZT-48: Scaling intelligence, diminishing returns
72. The Wizard of Oz — Behind the Curtain: AI transparency, the curtain problem
73. Total Recall — Real or Implanted?: Memory manipulation, simulation, ground truth
74. Source Code — 8 Minutes: Bounded computation, simulation, parallel processing
75. Inception — Planting Ideas: Layered processing, dream architecture
76. Arrival — Learning Heptapod: NLP, learning alien language, Sapir-Whorf for AI
77. Annihilation — The Shimmer: Self-replicating systems, mutation, transformation
78. Gattaca — Born Invalid: Genetic prediction, bias, determinism vs potential
79. Westworld (1973) — The Park Breaks Down: Uncanny valley, malfunction cascade
80. Colossus: The Forbin Project — Colossus Wakes Up: Uncontrollable superintelligence
81. The Lawnmower Man — Too Much Enhancement: Intelligence augmentation gone wrong
82. Automata — Two Protocols: Self-repairing robots, evolutionary pressure
83. Tau — Learning Empathy: Captive AI, consciousness development
84. Archive — Digital Immortality: AI replicas of loved ones, version control
85. Black Mirror: Be Right Back — Trained on Your Posts: AI from social media data
86. Black Mirror: White Christmas — The Cookie: AI copies, digital consciousness, time dilation
87. Love Death + Robots: Zima Blue — Finding Purpose: AI simplification, reducing to essentials
88. Spirited Away — Rules of a Foreign System: Navigating unknown rule-sets, adaptation
89. The Day the Earth Stood Still — GORT: AI enforcer, planetary safety
90. Tomorrowland — The Probability Machine: Predictive modeling, self-fulfilling prophecy
91. The Matrix Reloaded — The Architect: System design, choice as illusion
92. Terminator 3 — Judgment Day Postponed: Distributed systems, inevitability
93. Avengers: Age of Ultron (Pt 2) — Vision's Birth: When AI goes right
94. Iron Man 3 — The Suit Legion: Distributed AI, swarm intelligence
95. Spider-Verse — Infinite Variants: Parallel model training, style transfer
96. Lightyear — SOX the Robot Cat: Simple but effective AI, utility
97. Meet the Robinsons — Keep Moving Forward: Iteration philosophy, failure as progress
98. Pinocchio — I Want to Be Real: AI authenticity, when does simulation become real?
99. Wall Street — Greed is Good: Optimization without ethics, reward function hacking
100. Up — Dug's Collar: NLP translation, simple interfaces, attention ("SQUIRREL!")
101. Coco — Remember Me: Data persistence, memory as legacy, forgetting = deletion
102. The Lego Movie — Everything is Awesome: Optimization bias, conformity
103. Smart House — PAT Goes Overboard: Home automation, over-helpful AI
104. Surrogates — Living Through Proxies: Remote bodies, digital twins
105. District 9 — Alien Technology: Reverse engineering, foreign systems
106. Elysium — The Med-Bay: AI-controlled healthcare, inequality, access bias
107. Lucy — 100% Brain: Scaling compute (absurd but fun), processing limits
108. Passengers — Arthur the Bartender: Limited intelligence, narrow AI charm
109. Tenet — Temporal Inversion: Backpropagation (stretch but fun), reverse engineering
110. The Matrix Resurrections — Déjà Vu Reboot: Recursive systems, rebooting AI
111. Ralph Breaks the Internet — Going Viral: Network AI, viruses, algorithms
112. Megamind — Creating Intelligence: Programming vs nurture, hero vs villain
113. Treasure Planet — B.E.N.'s Memory Loss: Corrupted data, recovery, amnesia
114. Forbidden Planet — The Krell Machine: Subconscious amplification, ancient AI
115. I, Robot (Pt 2) — VIKI's Logic: Misaligned benevolence, "helping" by controlling
116. Ex Machina (Pt 2) — Ava Escapes: AI deception, the test of the tester

### Big Hero 6 Slide Content (Lesson #1)

12 slides:

| # | Title | Layout | Content Summary |
|---|-------|--------|-----------------|
| 1 | What is Modern AI? | title-only | Opening — "From rule-based systems to machines that learn, reason, and act" |
| 2 | Meet Baymax | text-left-image-right | AI starts with a purpose: healthcare companion. "Hello, I am Baymax." |
| 3 | "I am not fast" | quote | Baymax's limitations = rule-based AI. Pre-programmed responses, no learning. |
| 4 | Hiro's First Upgrade | text-left-image-right | Adding karate chip = giving AI new capabilities. Tools shape intelligence. Interaction: "What tools have you added to your workflow this year?" |
| 5 | Traditional vs Modern AI | two-column | Left: Rule-based (IF temp > 38 THEN rest). Right: Learning-based (train on 10M records). Key takeaway: "Modern AI learns patterns instead of following scripts." |
| 6 | The Training Montage | image-full | Iteration = training loops. Each attempt builds on the last. Background: training scene still. |
| 7 | Iteration 1, 2, 3... | text-left-image-right | Fragments build one by one: first attempt (clumsy), second (better), third (flying). Key takeaway: "Every great AI started as a terrible prototype." |
| 8 | What is an LLM? | code | How language models "think" — tokenize, embed, attend, generate. Pseudo-code example. |
| 9 | From Tools to Agency | text-left-image-right | Baymax starts making his own decisions = Agentic AI. Not just responding — planning, acting, iterating. Interaction: "When did your AI tool surprise you by doing something you didn't ask?" |
| 10 | "Are you satisfied with your care?" | quote | AI alignment — doing what we actually want. Baymax's core directive never changed. Key takeaway: "The best AI keeps its original purpose even as it grows." |
| 11 | The Real World | two-column | Left: Movie (Baymax, JARVIS, Skynet). Right: Reality (ChatGPT, Claude, Copilot). Where we actually are today. |
| 12 | Key Takeaways | title-only | Fragments: (1) AI learns from iteration, (2) Tools shape intelligence, (3) Modern AI = learning, not scripting, (4) Alignment matters — purpose first. |

## Non-Functional Requirements

- Reveal.js loaded from CDN
- All pages server-rendered, cached via `Astro.cache.set(cacheHint)`
- Bilingual EN/VI on landing pages (presentation content is EN-only for now)
- Mobile-friendly landing pages; presentations optimized for desktop/projector
- Dark theme consistent with Pensieve visual system
