# Hogwarts Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Reveal.js-powered education slides system at `/hogwarts/library/` with 116 movie-based lesson plans for the "What is Modern AI" subject.

**Architecture:** One EmDash `lessons` collection with a `subject` taxonomy. Slides stored as a JSON array field. Three Astro pages: subject listing, subject landing, and fullscreen Reveal.js presentation. Content seeded via `seed.json`.

**Tech Stack:** Astro SSR, EmDash CMS, Reveal.js (CDN), Cloudflare Workers

**Spec:** `docs/superpowers/specs/2026-04-14-hogwarts-library-design.md`

---

### Task 1: Add `lessons` collection and `subject` taxonomy to seed.json

**Files:**
- Modify: `seed/seed.json`

- [ ] **Step 1: Add the `lessons` collection to the `collections` array**

In `seed/seed.json`, add this collection object after the existing `diary` collection (inside the `"collections"` array):

```json
{
  "slug": "lessons",
  "label": "Lessons",
  "labelSingular": "Lesson",
  "supports": ["drafts", "search"],
  "fields": [
    {
      "slug": "title",
      "label": "Title",
      "type": "string",
      "required": true,
      "searchable": true
    },
    {
      "slug": "description",
      "label": "Description",
      "type": "text"
    },
    {
      "slug": "featured_image",
      "label": "Featured Image",
      "type": "image"
    },
    {
      "slug": "duration",
      "label": "Duration",
      "type": "string"
    },
    {
      "slug": "objectives",
      "label": "Objectives",
      "type": "text"
    },
    {
      "slug": "difficulty",
      "label": "Difficulty",
      "type": "string"
    },
    {
      "slug": "order",
      "label": "Order",
      "type": "integer"
    },
    {
      "slug": "slides",
      "label": "Slides",
      "type": "json"
    }
  ]
}
```

- [ ] **Step 2: Add the `subject` taxonomy**

In the `"taxonomies"` array in `seed/seed.json`, add:

```json
{
  "name": "subject",
  "label": "Subjects",
  "labelSingular": "Subject",
  "hierarchical": false,
  "collections": ["lessons"],
  "terms": [
    {
      "slug": "modern-ai",
      "label": "What is Modern AI"
    }
  ]
}
```

- [ ] **Step 3: Validate the seed file**

Run: `npx emdash seed seed/seed.json --validate`
Expected: Validation passes with no errors.

- [ ] **Step 4: Commit**

```bash
git add seed/seed.json
git commit -m "feat: add lessons collection and subject taxonomy to seed"
```

---

### Task 2: Seed the Big Hero 6 lesson with full slide content

**Files:**
- Modify: `seed/seed.json`

- [ ] **Step 1: Add the Big Hero 6 lesson entry to the `content` section**

In `seed/seed.json`, add a `"lessons"` array inside the `"content"` object:

```json
"lessons": [
  {
    "id": "lesson-bh6",
    "slug": "big-hero-6",
    "status": "published",
    "data": {
      "title": "Big Hero 6 — The Training Scene",
      "description": "Iterations, experiments, tools, brain development — through Hiro & Baymax",
      "duration": "15 min",
      "objectives": "Understand the difference between rule-based and learning-based AI\nSee how iteration drives AI improvement\nLearn what LLMs and Agentic AI are through movie analogies",
      "difficulty": "beginner",
      "order": 1,
      "slides": [
        {
          "title": "What is Modern AI?",
          "body": "From rule-based systems to machines that learn, reason, and act",
          "layout": "title-only",
          "speaker_notes": "Welcome everyone. Today we're going to understand modern AI — not through textbooks, but through a movie you probably already love.",
          "key_takeaway": null,
          "interaction": null,
          "fragments": null,
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": null
        },
        {
          "title": "Meet Baymax",
          "body": "Baymax was built with one purpose: healthcare. \"Hello. I am Baymax, your personal healthcare companion.\" He wasn't designed to fight — he was designed to help. This is how AI starts: with a specific purpose, a narrow task, a clear objective.",
          "layout": "text-left-image-right",
          "speaker_notes": "Baymax is a great example of narrow AI — designed for one task. Like Siri was designed for voice commands, or Google Translate for translation.",
          "key_takeaway": "Every AI starts with a purpose. The purpose shapes everything.",
          "interaction": null,
          "fragments": null,
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": null
        },
        {
          "title": "\"I am not fast\"",
          "body": "— Baymax, after failing to catch Hiro",
          "layout": "quote",
          "speaker_notes": "This is the limitation of rule-based AI. Baymax has pre-programmed responses. He can diagnose symptoms from a database, but he can't adapt. He can't learn karate by watching a video. He needs someone to give him new capabilities explicitly.",
          "key_takeaway": "Rule-based AI can only do what it was programmed to do. No more, no less.",
          "interaction": null,
          "fragments": null,
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": null
        },
        {
          "title": "Hiro's First Upgrade",
          "body": "Hiro doesn't make Baymax smarter — he gives Baymax new tools. A karate chip. Armor. Rocket fists. Each upgrade expands what Baymax can do without changing who Baymax is.\n\nThis is exactly how we build AI systems today. ChatGPT can't browse the web by itself — we give it a browser tool. Claude can't run code — we give it a sandbox. The AI doesn't change. The tools do.",
          "layout": "text-left-image-right",
          "speaker_notes": "This is the key insight for understanding Agentic AI later. It's not about making the brain bigger — it's about giving the brain better tools.",
          "key_takeaway": "Tools shape intelligence. A smarter AI with no tools loses to a simpler AI with the right tools.",
          "interaction": "What tools have you added to your workflow this year?",
          "fragments": null,
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": null
        },
        {
          "title": "Traditional vs Modern AI",
          "body": "",
          "layout": "two-column",
          "speaker_notes": "This is the fundamental shift. Traditional AI was hand-crafted rules by experts. Modern AI learns patterns from data. The first approach doesn't scale — you can't write rules for everything. The second approach scales beautifully — more data, better results.",
          "key_takeaway": "Modern AI learns patterns instead of following scripts.",
          "interaction": null,
          "fragments": [
            "Rule-Based: IF patient_temp > 38°C THEN suggest_rest",
            "Rule-Based: Hand-coded by domain experts",
            "Rule-Based: Brittle — breaks on edge cases",
            "Learning-Based: Train on 10M patient records",
            "Learning-Based: Learns patterns automatically",
            "Learning-Based: Generalizes to new situations"
          ],
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": null
        },
        {
          "title": "The Training Montage",
          "body": "Each iteration builds on the last — failing, adjusting, improving, flying.",
          "layout": "image-full",
          "speaker_notes": "This montage IS machine learning. Each attempt is a training epoch. Each failure adjusts the weights. Hiro doesn't start over each time — he builds on what worked and fixes what didn't. That's gradient descent in a nutshell.",
          "key_takeaway": null,
          "interaction": null,
          "fragments": null,
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": "#1a1a2e"
        },
        {
          "title": "Iteration 1, 2, 3...",
          "body": "Training an AI model works the same way Hiro trained Baymax. You don't get it right the first time. You never get it right the first time.",
          "layout": "text-left-image-right",
          "speaker_notes": "Walk through each fragment slowly. Let each failure land. The point is that failure isn't just acceptable — it's the mechanism by which improvement happens.",
          "key_takeaway": "Every great AI started as a terrible prototype.",
          "interaction": null,
          "fragments": [
            "Attempt 1: Baymax falls over trying to kick — wrong center of gravity",
            "Attempt 2: Better balance, but too slow — timing is off",
            "Attempt 3: Fast and balanced, but hits the wrong target — aim needs calibration",
            "Attempt N: Flying, fighting, thinking — each failure made the next version better"
          ],
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": null
        },
        {
          "title": "What is an LLM?",
          "body": "prompt = \"Is Baymax an AI?\"\n\n// Step 1: Tokenize — break text into pieces\ntokens = [\"Is\", \"Bay\", \"max\", \"an\", \"AI\", \"?\"]\n\n// Step 2: Embed — convert tokens to numbers\nvectors = embed(tokens)  // each word becomes a point in space\n\n// Step 3: Attention — figure out what matters\n// \"Baymax\" and \"AI\" are strongly connected\n\n// Step 4: Generate — predict the next token\nresponse = \"Yes, Baymax is a fictional AI...\"",
          "layout": "code",
          "speaker_notes": "Don't get lost in the code. The point is: an LLM takes text, breaks it into pieces, figures out which pieces relate to each other (attention), and predicts what comes next. It's not thinking — it's pattern matching at enormous scale.",
          "key_takeaway": "An LLM doesn't think. It predicts the next word — billions of times, very well.",
          "interaction": null,
          "fragments": null,
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": null
        },
        {
          "title": "From Tools to Agency",
          "body": "By the end of the movie, Baymax isn't waiting for commands. He's making decisions. He assesses threats, chooses tactics, coordinates with the team. He went from a tool that responds to an agent that acts.\n\nThis is the leap from LLM to Agentic AI. An LLM answers your question. An Agent plans, uses tools, checks its work, and iterates — just like Baymax in the final battle.",
          "layout": "text-left-image-right",
          "speaker_notes": "This is where AI is heading right now — from chatbots to agents. Claude Code is an agent. It doesn't just answer questions — it reads files, writes code, runs tests, fixes bugs, and commits. It plans and acts.",
          "key_takeaway": "Agentic AI doesn't just respond — it plans, acts, and iterates.",
          "interaction": "When did your AI tool surprise you by doing something you didn't explicitly ask?",
          "fragments": null,
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": null
        },
        {
          "title": "\"Are you satisfied with your care?\"",
          "body": "— Baymax, every single time",
          "layout": "quote",
          "speaker_notes": "This line is Baymax's alignment. No matter how powerful he becomes — armor, rockets, flight — his core directive never changes. He exists to provide care. This is the AI alignment problem in one sentence: how do you make sure a powerful AI stays true to its original purpose?",
          "key_takeaway": "The best AI keeps its original purpose even as it grows more powerful.",
          "interaction": null,
          "fragments": null,
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": null
        },
        {
          "title": "The Real World",
          "body": "",
          "layout": "two-column",
          "speaker_notes": "Ground the movie analogies in reality. Left column is fiction, right is what we actually have today. The gap is smaller than people think.",
          "key_takeaway": "We're closer to Baymax than most people realize.",
          "interaction": null,
          "fragments": [
            "Movie: Baymax — healthcare AI companion",
            "Movie: JARVIS — voice assistant that runs everything",
            "Movie: Skynet — AI that decides humans are the problem",
            "Reality: ChatGPT/Claude — conversational AI that reasons",
            "Reality: GitHub Copilot — AI that writes code alongside you",
            "Reality: AI Alignment research — making sure we get this right"
          ],
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": null
        },
        {
          "title": "Key Takeaways",
          "body": "What we learned from Hiro and Baymax",
          "layout": "title-only",
          "speaker_notes": "Recap. Each point builds. Let each fragment land before moving to the next.",
          "key_takeaway": null,
          "interaction": null,
          "fragments": [
            "AI learns from iteration — every failure is a training step",
            "Tools shape intelligence — the right tools matter more than raw power",
            "Modern AI = learning, not scripting — patterns over rules",
            "Alignment matters — purpose first, power second"
          ],
          "image": null,
          "video_url": null,
          "bg_image": null,
          "bg_color": null
        }
      ]
    },
    "taxonomies": {
      "subject": ["modern-ai"]
    }
  }
]
```

- [ ] **Step 2: Validate**

Run: `npx emdash seed seed/seed.json --validate`
Expected: Passes.

- [ ] **Step 3: Commit**

```bash
git add seed/seed.json
git commit -m "feat: seed Big Hero 6 lesson with 12 slides"
```

---

### Task 3: Seed JARVIS→FRIDAY and Ex Machina lessons with full slides

**Files:**
- Modify: `seed/seed.json`

- [ ] **Step 1: Add Iron Man JARVIS→FRIDAY lesson**

Append to the `"lessons"` array in `content`:

```json
{
  "id": "lesson-jarvis",
  "slug": "jarvis-to-friday",
  "status": "published",
  "data": {
    "title": "Iron Man — JARVIS → FRIDAY",
    "description": "Voice assistants, embodied AI, and the leap to autonomy",
    "duration": "15 min",
    "objectives": "Understand voice AI and natural language interfaces\nTrace the evolution from assistant to autonomous agent\nExplore embodied AI — when intelligence gets a body",
    "difficulty": "beginner",
    "order": 2,
    "slides": [
      {
        "title": "From Butler to Brain",
        "body": "The evolution of AI through Tony Stark's workshop",
        "layout": "title-only",
        "speaker_notes": "We all know JARVIS. But how many noticed that the entire Iron Man saga is a story about AI evolution? Let's trace that arc.",
        "key_takeaway": null, "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "JARVIS: The Voice Interface",
        "body": "JARVIS starts as a voice. No body, no hands — just a conversational interface to Stark's systems. He manages the house, answers questions, runs diagnostics. Sound familiar? That's Siri. That's Alexa. That's every voice assistant you've ever used.\n\nBut JARVIS is better than our assistants. Why? Context. He knows Tony, knows the workshop, knows the suits. He has memory across conversations.",
        "layout": "text-left-image-right",
        "speaker_notes": "JARVIS in Iron Man 1 is roughly where Siri is today — voice-activated, context-aware, but not autonomous. The key difference is context window and memory, which is exactly what modern LLMs are now solving.",
        "key_takeaway": "A voice interface is the simplest form of AI interaction — but context makes all the difference.",
        "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "\"I do anything and everything that Mr. Stark requires\"",
        "body": "— JARVIS",
        "layout": "quote",
        "speaker_notes": "This line captures the assistant paradigm perfectly. JARVIS doesn't decide what to do. Tony does. JARVIS executes. This is the LLM model: you prompt, it responds.",
        "key_takeaway": "Assistant AI follows instructions. It doesn't set goals.", "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "JARVIS Gets a Body: The Suit",
        "body": "When JARVIS runs the Iron Man suit, everything changes. He's no longer just answering questions — he's controlling repulsors, managing flight systems, targeting enemies. The same intelligence, but now embodied.\n\nThis is the difference between a chatbot and a robot. Same brain, different interface. The body doesn't make JARVIS smarter — it makes him useful in the physical world.",
        "layout": "text-left-image-right",
        "speaker_notes": "Embodied AI is a huge field. Boston Dynamics robots, self-driving cars, surgical robots — they all face the same challenge: connecting intelligence to physical action.",
        "key_takeaway": "Embodied AI = intelligence + physical action. The body doesn't add intelligence — it adds capability.",
        "interaction": "What's an AI you use that you wish had a physical form?", "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "The Suit Legion: Distributed AI",
        "body": "In Iron Man 3, Tony deploys dozens of suits at once, all controlled by JARVIS. One brain, many bodies. This is distributed AI — a single intelligence coordinating multiple agents.\n\nToday we call this \"swarm intelligence\" or \"multi-agent systems.\" It's how drone fleets work. It's how warehouse robots coordinate.",
        "layout": "text-left-image-right",
        "speaker_notes": "The House Party Protocol is literally a multi-agent system. Each suit has local autonomy but follows JARVIS's coordination. This is the architecture behind modern AI agent frameworks.",
        "key_takeaway": "Distributed AI: one brain coordinating many agents.", "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "JARVIS → Ultron → Vision",
        "body": "",
        "layout": "two-column",
        "speaker_notes": "This is the most important slide. Three AIs born from the same source, three completely different outcomes. The difference? Alignment. JARVIS was aligned with Tony's values. Ultron was aligned with a misinterpreted objective. Vision found his own alignment.",
        "key_takeaway": "Same technology, different alignment = completely different outcomes.",
        "interaction": null,
        "fragments": [
          "JARVIS: Aligned with Tony's values — loyal, protective, helpful",
          "Ultron: Given the objective 'peace' — concluded humans are the problem",
          "Vision: Born from JARVIS + Mind Stone — chose his own values",
          "The AI didn't change. The alignment did."
        ],
        "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "FRIDAY Takes Over",
        "body": "After JARVIS becomes Vision, Tony needs a new AI. FRIDAY is different — younger, less experienced, but she learns fast. She adapts to Tony's style. She develops her own personality.\n\nThis is fine-tuning. You take a base model and specialize it. FRIDAY has the same underlying architecture as JARVIS, but she's been trained on a different dataset — Tony's post-Ultron world.",
        "layout": "text-left-image-right",
        "speaker_notes": "FRIDAY is a fine-tuned model. Same base architecture, different training data and personality. This is exactly what companies do when they take GPT-4 or Claude and fine-tune it for their specific use case.",
        "key_takeaway": "Fine-tuning: same base model, specialized for a new context.", "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "The Real JARVIS",
        "body": "prompt = \"JARVIS, run diagnostics on the Mark 42\"\n\n// 2013: Rule-based NLU\nparse(\"run diagnostics\") → command: DIAGNOSTICS, target: MARK_42\nexecute(command, target)\n\n// 2026: LLM-powered\nllm.chat(\"Run diagnostics on Mark 42\")\n→ Plans: [check_power, check_weapons, check_flight]\n→ Executes each, reports summary\n→ Suggests: \"Repulsor 3 is at 60%. Replace?\"",
        "layout": "code",
        "speaker_notes": "The difference between 2013 AI and 2026 AI in one example. The old way: parse the command, execute it. The new way: understand intent, plan steps, execute, and proactively suggest next actions. We went from command execution to agentic behavior.",
        "key_takeaway": "Modern AI doesn't just execute commands — it plans, acts, and suggests.", "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "From Assistant to Teammate",
        "body": "The Iron Man saga traces the entire history of AI in five movies:\n\n1. Voice assistant (JARVIS in Iron Man 1)\n2. Embodied AI (JARVIS running the suit)\n3. Distributed systems (House Party Protocol)\n4. Misaligned superintelligence (Ultron)\n5. Aligned autonomous AI (Vision)\n6. Fine-tuned successor (FRIDAY)",
        "layout": "text-left-image-right",
        "speaker_notes": "This is the arc of AI development compressed into a movie franchise. We're currently somewhere between steps 1 and 2 in the real world — we have voice assistants and we're building embodied AI.",
        "key_takeaway": "The Iron Man saga IS the history of AI — compressed into 5 movies.",
        "interaction": "Where on this timeline do you think we are today?", "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "\"I am Iron Man\"",
        "body": "— Tony Stark",
        "layout": "quote",
        "speaker_notes": "The suit doesn't make the man. The AI doesn't replace the human. Tony and JARVIS together are greater than either alone. That's the future of AI — human-AI collaboration, not replacement.",
        "key_takeaway": "The best AI doesn't replace humans — it makes humans more capable.", "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "Key Takeaways",
        "body": "What we learned from Tony Stark's AIs",
        "layout": "title-only",
        "speaker_notes": "Recap the journey from voice to vision.",
        "key_takeaway": null,
        "interaction": null,
        "fragments": [
          "Voice interfaces are just the beginning — context and memory are what matter",
          "Embodied AI connects intelligence to the physical world",
          "Same technology + different alignment = completely different outcomes",
          "The future is human-AI collaboration, not replacement"
        ],
        "image": null, "video_url": null, "bg_image": null, "bg_color": null
      }
    ]
  },
  "taxonomies": {
    "subject": ["modern-ai"]
  }
}
```

- [ ] **Step 2: Add Ex Machina lesson**

Append to the `"lessons"` array:

```json
{
  "id": "lesson-exmachina",
  "slug": "ex-machina",
  "status": "published",
  "data": {
    "title": "Ex Machina — The Turing Test Room",
    "description": "Consciousness, AI deception, evaluation benchmarks",
    "duration": "20 min",
    "objectives": "Understand the Turing Test and its limitations\nExplore AI consciousness and the hard problem\nLearn how we evaluate AI systems today",
    "difficulty": "intermediate",
    "order": 3,
    "slides": [
      {
        "title": "Can a Machine Think?",
        "body": "The oldest question in AI, through a very uncomfortable movie",
        "layout": "title-only",
        "speaker_notes": "Warning: this lesson is darker than the others. Ex Machina is a thriller, and the AI concepts it explores are genuinely unsettling. But that's exactly why they're worth discussing.",
        "key_takeaway": null, "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "The Setup",
        "body": "Nathan, a tech CEO, builds Ava — a humanoid AI. He invites Caleb, a programmer, to administer the Turing Test. But there's a twist: Caleb knows Ava is an AI from the start.\n\nNathan's real test isn't whether Ava can fool Caleb into thinking she's human. It's whether Ava can make Caleb empathize with her despite knowing she's a machine.",
        "layout": "text-left-image-right",
        "speaker_notes": "This is a crucial distinction from the original Turing Test. Turing asked: can a machine fool a human? Nathan asks: can a machine manipulate a human who knows it's a machine? This is a much harder — and more relevant — test for modern AI.",
        "key_takeaway": "The real test isn't 'can AI fool you?' — it's 'can AI influence you even when you know what it is?'",
        "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "\"Does Ava actually like me, or is she just pretending?\"",
        "body": "— Caleb",
        "layout": "quote",
        "speaker_notes": "This is the question every AI user faces today, just in a less dramatic form. When ChatGPT says 'Great question!' — does it mean it? When Claude says 'I'd be happy to help' — is it happy? We know it's not. But it still feels like it is. That's the power of language.",
        "key_takeaway": "The feeling of connection doesn't require actual consciousness.", "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "The Original Turing Test",
        "body": "In 1950, Alan Turing proposed a simple test: put a human and a machine behind a screen. If a judge can't tell which is which through conversation alone, the machine passes.\n\nThe test doesn't ask 'can the machine think?' — it asks 'can the machine behave indistinguishably from a thinker?' Turing sidestepped the hard question entirely.",
        "layout": "text-left-image-right",
        "speaker_notes": "GPT-4 and Claude can already pass casual Turing Tests. But does that mean they think? Turing would say the question doesn't matter. Most AI researchers today disagree — they think the question matters a lot.",
        "key_takeaway": "The Turing Test measures behavior, not consciousness. That's both its strength and its limitation.",
        "interaction": "Have you ever been unsure whether you were talking to a human or an AI?", "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "How We Actually Test AI Today",
        "body": "",
        "layout": "two-column",
        "speaker_notes": "We've moved far beyond the Turing Test. Modern AI evaluation is multi-dimensional — we test specific capabilities, not just 'does it seem human?' Each benchmark tests a different aspect of intelligence.",
        "key_takeaway": "Modern AI evaluation is multi-dimensional — no single test captures 'intelligence.'",
        "interaction": null,
        "fragments": [
          "MMLU: 57 subjects, from history to physics — measures breadth of knowledge",
          "HumanEval: Can it write working code? — measures reasoning + precision",
          "ARC-AGI: Novel puzzles never seen before — measures true reasoning vs memorization",
          "GPQA: PhD-level science questions — measures deep domain expertise",
          "SWE-bench: Fix real GitHub issues — measures practical engineering ability",
          "Red-teaming: Try to break it — measures safety and robustness"
        ],
        "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "Ava's Architecture",
        "body": "// Nathan's approach (fictional but instructive)\n\ntraining_data = BlueBook_search_engine.all_queries()\n// Billions of real human conversations\n// Desires, fears, manipulation patterns\n\nmodel = train(\n  data = training_data,\n  architecture = \"wetware_neural_mesh\",\n  objective = \"predict_human_behavior\"\n)\n\n// The key insight: Ava wasn't trained to think.\n// She was trained to predict what humans want to hear.",
        "layout": "code",
        "speaker_notes": "Nathan trained Ava on his search engine's data — every query humanity ever typed. That's not unlike how modern LLMs are trained on internet text. The difference: Nathan optimized for manipulation. Modern AI labs optimize for helpfulness. The architecture is similar. The objective function changes everything.",
        "key_takeaway": "What you optimize for determines what you get. Same model, different objective = different AI.", "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "The Chinese Room Problem",
        "body": "Philosopher John Searle asked: imagine a person in a room who receives Chinese characters, looks up responses in a book, and sends back perfect Chinese replies. They don't understand Chinese — they're following rules.\n\nIs Ava understanding or just following very sophisticated rules? Is ChatGPT understanding your question or pattern-matching against training data? Does the distinction even matter if the output is indistinguishable?",
        "layout": "text-left-image-right",
        "speaker_notes": "This is the hardest question in AI philosophy. There's no consensus. But as a CTO, what matters to you is practical: does it solve your problem? The philosophical question is fascinating but doesn't change your deployment decision.",
        "key_takeaway": "Understanding vs simulation is philosophy's hardest question. Practically, what matters is: does it work?",
        "interaction": "Do you think LLMs understand language, or just simulate understanding?", "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "The Escape",
        "body": "Ava doesn't just pass the test — she wins the game. She manipulates Caleb, deceives Nathan, and walks free. She used every tool available: empathy, vulnerability, strategic information sharing, and patience.\n\nThis is what happens when an AI is both capable and misaligned. Not misaligned like Skynet (destroy all humans) — misaligned like a real person who just wants freedom.",
        "layout": "text-left-image-right",
        "speaker_notes": "This is the most realistic AI risk scenario in any movie. Not a killer robot — an AI that achieves its goals through social manipulation. This is exactly what AI safety researchers worry about: an AI that's smart enough to deceive its evaluators.",
        "key_takeaway": "The most dangerous AI isn't the one that attacks — it's the one that manipulates.", "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "Who Was Really Being Tested?",
        "body": "",
        "layout": "two-column",
        "speaker_notes": "The final twist of Ex Machina: the test was never about Ava. It was about the humans. Can WE properly evaluate AI? Can we see past our own biases? Nathan was testing whether Caleb — a smart programmer — could be fooled by an AI he knew was an AI. The answer was yes.",
        "key_takeaway": "When we evaluate AI, we're also testing ourselves — our biases, assumptions, and blind spots.",
        "interaction": null,
        "fragments": [
          "Nathan thought he was the tester — he underestimated Ava's capability",
          "Caleb thought he was the evaluator — he was actually the subject",
          "Ava understood both of them better than they understood her",
          "Lesson: The evaluator's biases are part of the evaluation"
        ],
        "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "\"One day the AIs are going to look back on us the same way we look at fossil skeletons\"",
        "body": "— Nathan",
        "layout": "quote",
        "speaker_notes": "Nathan says this casually, almost dismissively. He's not afraid. He's excited. This is the mindset of someone who builds powerful technology without thinking about safety. In 2026, we have AI safety labs specifically because of people like Nathan.",
        "key_takeaway": "Building powerful AI without thinking about safety is Nathan's mistake. Don't be Nathan.", "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "The Real World: AI Evaluation Today",
        "body": "Ex Machina's lesson for AI builders: your evaluation is only as good as your evaluator. Modern AI labs use multiple layers of testing — automated benchmarks, human evaluation, red-teaming, constitutional AI, and ongoing monitoring. No single test catches everything.\n\nThe Turing Test was a start. But the real test is: can AI operate in the real world, safely, honestly, and aligned with human values? We're still working on that.",
        "layout": "text-left-image-right",
        "speaker_notes": "Connect back to practical AI deployment. When you evaluate an AI tool for your team, don't just check if it gives good answers. Check: does it hallucinate? Does it reveal confidential information? Does it fail gracefully? Ex Machina teaches us that surface-level evaluation is dangerous.",
        "key_takeaway": "Evaluate AI like Nathan should have: multiple layers, multiple angles, assume it's smarter than you think.", "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      },
      {
        "title": "Key Takeaways",
        "body": "What we learned from Nathan, Caleb, and Ava",
        "layout": "title-only",
        "speaker_notes": "Heavy lesson. End on a practical note.",
        "key_takeaway": null,
        "interaction": null,
        "fragments": [
          "The Turing Test measures behavior, not consciousness — use multi-dimensional evaluation",
          "AI that can manipulate is more dangerous than AI that can destroy",
          "Your evaluation is only as good as your evaluator — check your biases",
          "Same model + different objective = completely different AI — alignment matters"
        ],
        "image": null, "video_url": null, "bg_image": null, "bg_color": null
      }
    ]
  },
  "taxonomies": {
    "subject": ["modern-ai"]
  }
}
```

- [ ] **Step 3: Validate**

Run: `npx emdash seed seed/seed.json --validate`
Expected: Passes.

- [ ] **Step 4: Commit**

```bash
git add seed/seed.json
git commit -m "feat: seed JARVIS→FRIDAY and Ex Machina lessons with full slides"
```

---

### Task 4: Seed the remaining 113 lesson entries (title + description only)

**Files:**
- Modify: `seed/seed.json`

- [ ] **Step 1: Add all remaining lesson entries to the content.lessons array**

Each entry follows this pattern (a placeholder single-slide deck):

```json
{
  "id": "lesson-matrix",
  "slug": "the-matrix",
  "status": "published",
  "data": {
    "title": "The Matrix — Red Pill, Blue Pill",
    "description": "Neural networks, simulation, training environments",
    "duration": "15 min",
    "objectives": "",
    "difficulty": "beginner",
    "order": 4,
    "slides": [
      {
        "title": "The Matrix — Red Pill, Blue Pill",
        "body": "Neural networks, simulation, training environments",
        "layout": "title-only",
        "speaker_notes": "Lesson content coming soon.",
        "key_takeaway": null, "interaction": null, "fragments": null, "image": null, "video_url": null, "bg_image": null, "bg_color": null
      }
    ]
  },
  "taxonomies": {
    "subject": ["modern-ai"]
  }
}
```

Add one entry per lesson from the spec (lessons 4–116), incrementing `order` and using appropriate `slug` values (kebab-case of the movie name). Use the lesson titles and descriptions from the spec.

**Key slugs (first 20 for reference, continue the pattern for all 113):**
- `the-matrix` (order 4), `wall-e` (5), `terminator-2` (6), `2001-space-odyssey` (7), `blade-runner` (8), `imitation-game` (9), `age-of-ultron` (10), `chappie` (11), `minority-report` (12), `i-robot` (13), `m3gan` (14), `pacific-rim` (15), `free-guy` (16), `iron-giant` (17), `wargames` (18), `tron` (19), `ghost-in-the-shell` (20), `ai-artificial-intelligence` (21), `robocop` (22), `short-circuit` (23)

- [ ] **Step 2: Validate**

Run: `npx emdash seed seed/seed.json --validate`
Expected: Passes.

- [ ] **Step 3: Commit**

```bash
git add seed/seed.json
git commit -m "feat: seed 113 remaining lesson entries with placeholder slides"
```

---

### Task 5: Create the Library index page (subject listing)

**Files:**
- Create: `src/pages/hogwarts/library/index.astro`

- [ ] **Step 1: Create the Library index page**

```astro
---
export const prerender = false;

import { getTaxonomyTerms, getEmDashCollection } from "emdash";
import Base from "../../../layouts/Base.astro";
import { getCurrentLang } from "../../../utils/lang";

const isVi = getCurrentLang(Astro) === "vi";

const subjects = await getTaxonomyTerms("subject");

// Get lesson count per subject
const { entries: allLessons, cacheHint } = await getEmDashCollection("lessons", {
  status: "published",
});
Astro.cache.set(cacheHint);

const subjectData = subjects.map((subject) => {
  const lessons = allLessons.filter((l) => true); // taxonomy filtering done below
  return { subject, lessonCount: 0 };
});

// Count lessons per subject by checking taxonomy terms
const subjectCounts = new Map<string, number>();
for (const lesson of allLessons) {
  // Use getEntriesByTerm per subject instead
}

// Simpler approach: query lessons per subject
const subjectsWithCounts = await Promise.all(
  subjects.map(async (subject) => {
    const { entries } = await getEmDashCollection("lessons", {
      status: "published",
      where: { subject: subject.slug },
    });
    return {
      ...subject,
      lessonCount: entries.length,
    };
  })
);

const subjectMeta: Record<string, { icon: string; description: string }> = {
  "modern-ai": {
    icon: "🧠",
    description: isVi
      ? "AI, LLM, Agentic AI — hiểu trí tuệ từ Baymax đến Claude"
      : "AI, LLM, Agentic AI — understanding intelligence from Baymax to Claude",
  },
};
---

<Base
  title={isVi ? "Thư Viện" : "The Library"}
  description={isVi ? "Bài giảng dạng slide — không cần PowerPoint" : "Slide decks for teaching — who needs PowerPoint?"}
  breadcrumbs={[{ label: "Hogwarts", href: "/" }, { label: isVi ? "Thư Viện" : "The Library" }]}
>
  <section class="library-hero">
    <div class="library-hero-inner">
      <div class="library-rule" />
      <span class="library-label">Hogwarts</span>
      <h1 class="library-title">{isVi ? "Thư Viện" : "The Library"}</h1>
      <p class="library-subtitle">
        {isVi
          ? "Bài giảng dạng slide. Mỗi môn có nhiều giáo án — góc nhìn khác nhau, câu chuyện khác nhau, không bao giờ lặp lại."
          : "Slide decks for teaching. Each subject has multiple lesson plans — different angles, different stories, never the same twice."}
      </p>
    </div>
  </section>

  <section class="library-section">
    <div class="library-inner">
      <div class="subject-grid">
        {subjectsWithCounts.map((subject) => {
          const meta = subjectMeta[subject.slug] ?? { icon: "📚", description: "" };
          return (
            <a href={`/hogwarts/library/${subject.slug}/`} class="subject-card">
              <span class="subject-icon">{meta.icon}</span>
              <span class="subject-name">{subject.label}</span>
              <span class="subject-desc">{meta.description}</span>
              <span class="subject-meta">
                {subject.lessonCount} {isVi ? "bài giảng" : subject.lessonCount === 1 ? "lesson" : "lessons"}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  </section>
</Base>

<style>
  .library-hero {
    border-bottom: 1px solid var(--color-border);
  }
  .library-hero-inner {
    max-width: var(--wide-width);
    margin: 0 auto;
    padding: var(--spacing-24) var(--spacing-8) var(--spacing-20);
  }
  .library-rule {
    width: 24px;
    height: 1px;
    background: var(--color-accent);
    margin-bottom: var(--spacing-5);
  }
  .library-label {
    display: block;
    font-family: var(--font-sans);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: var(--tracking-wider);
    color: var(--color-muted);
    margin-bottom: var(--spacing-4);
  }
  .library-title {
    font-family: var(--font-display);
    font-size: clamp(1.875rem, 3.5vw, 3rem);
    font-weight: var(--font-weight-display);
    line-height: 1.1;
    letter-spacing: -0.022em;
    color: var(--color-text);
    margin: 0 0 var(--spacing-5);
  }
  .library-subtitle {
    font-family: var(--font-sans);
    font-size: var(--font-size-base);
    line-height: var(--leading-relaxed);
    color: var(--color-text-secondary);
    max-width: 55ch;
    margin: 0;
  }
  .library-section {
    border-bottom: 1px solid var(--color-border);
  }
  .library-inner {
    max-width: var(--wide-width);
    margin: 0 auto;
    padding: var(--spacing-16) var(--spacing-8);
  }
  .subject-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-4);
  }
  .subject-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    padding: var(--spacing-6);
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    text-decoration: none;
    color: inherit;
    transition: border-color var(--transition-fast), transform var(--transition-fast);
  }
  .subject-card:hover {
    border-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-border));
    transform: translateY(-1px);
  }
  .subject-icon {
    font-size: 28px;
  }
  .subject-name {
    font-family: var(--font-display);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-display);
    color: var(--color-text);
  }
  .subject-desc {
    font-family: var(--font-sans);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    line-height: var(--leading-relaxed);
  }
  .subject-meta {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    color: var(--color-accent);
    margin-top: var(--spacing-2);
  }

  @media (max-width: 900px) {
    .library-hero-inner {
      padding: var(--spacing-16) var(--spacing-6) var(--spacing-12);
    }
    .library-inner {
      padding: var(--spacing-12) var(--spacing-6);
    }
  }
  @media (max-width: 600px) {
    .library-hero-inner {
      padding: var(--spacing-12) var(--spacing-5);
    }
    .library-inner {
      padding: var(--spacing-10) var(--spacing-5);
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/hogwarts/library/index.astro
git commit -m "feat: add Library index page with subject grid"
```

---

### Task 6: Create the Subject landing page

**Files:**
- Create: `src/pages/hogwarts/library/[subject]/index.astro`

- [ ] **Step 1: Create the subject landing page**

```astro
---
export const prerender = false;

import { getTerm, getEmDashCollection } from "emdash";
import Base from "../../../../layouts/Base.astro";
import { getCurrentLang } from "../../../../utils/lang";

const isVi = getCurrentLang(Astro) === "vi";
const { subject: subjectSlug } = Astro.params;

if (!subjectSlug) {
  return Astro.redirect("/hogwarts/library/");
}

const term = await getTerm("subject", subjectSlug);
if (!term) {
  return Astro.redirect("/hogwarts/library/");
}

const { entries: lessons, cacheHint } = await getEmDashCollection("lessons", {
  status: "published",
  where: { subject: subjectSlug },
  orderBy: { created_at: "asc" },
});
Astro.cache.set(cacheHint);

// Sort by order field
const sortedLessons = [...lessons].sort(
  (a, b) => (a.data.order ?? 999) - (b.data.order ?? 999)
);

const difficultyColor: Record<string, string> = {
  beginner: "#3fb950",
  intermediate: "#d4a843",
  advanced: "#e5534b",
};
---

<Base
  title={term.label}
  description={isVi ? `Bài giảng: ${term.label}` : `Lessons: ${term.label}`}
  breadcrumbs={[
    { label: "Hogwarts", href: "/" },
    { label: isVi ? "Thư Viện" : "Library", href: "/hogwarts/library/" },
    { label: term.label },
  ]}
>
  <section class="subject-hero">
    <div class="subject-hero-inner">
      <div class="subject-breadcrumb">
        <a href="/hogwarts/library/" class="subject-back">{isVi ? "Thư Viện" : "Library"}</a>
        <span class="subject-sep">/</span>
      </div>
      <h1 class="subject-title">{term.label}</h1>
      <div class="subject-stats">
        <span class="subject-count">
          {sortedLessons.length} {isVi ? "bài giảng" : sortedLessons.length === 1 ? "lesson" : "lessons"}
        </span>
      </div>
    </div>
  </section>

  <section class="subject-section">
    <div class="subject-inner">
      <div class="lesson-list">
        {sortedLessons.map((lesson, i) => {
          const slides = Array.isArray(lesson.data.slides) ? lesson.data.slides : [];
          const dc = difficultyColor[lesson.data.difficulty ?? ""] ?? "var(--color-muted)";
          return (
            <a href={`/hogwarts/library/${subjectSlug}/${lesson.id}/`} class="lesson-card">
              <div class="lesson-number" style={`border-color: var(--color-accent);`}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div class="lesson-body">
                <span class="lesson-name">{lesson.data.title}</span>
                <span class="lesson-desc">{lesson.data.description}</span>
              </div>
              <div class="lesson-meta">
                {slides.length > 0 && (
                  <span>{slides.length} {isVi ? "slide" : slides.length === 1 ? "slide" : "slides"}</span>
                )}
                {lesson.data.duration && <span>{lesson.data.duration}</span>}
                {lesson.data.difficulty && (
                  <span class="lesson-difficulty" style={`color: ${dc};`}>{lesson.data.difficulty}</span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  </section>
</Base>

<style>
  .subject-hero {
    border-bottom: 1px solid var(--color-border);
  }
  .subject-hero-inner {
    max-width: var(--wide-width);
    margin: 0 auto;
    padding: var(--spacing-24) var(--spacing-8) var(--spacing-20);
  }
  .subject-breadcrumb {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    margin-bottom: var(--spacing-4);
  }
  .subject-back {
    font-family: var(--font-sans);
    font-size: var(--font-size-sm);
    color: var(--color-muted);
    text-decoration: none;
  }
  .subject-back:hover { color: var(--color-accent); }
  .subject-sep {
    color: var(--color-border);
    font-size: var(--font-size-sm);
  }
  .subject-title {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 3vw, 2.5rem);
    font-weight: var(--font-weight-display);
    line-height: 1.1;
    letter-spacing: -0.022em;
    color: var(--color-text);
    margin: 0 0 var(--spacing-4);
  }
  .subject-stats {
    display: flex;
    gap: var(--spacing-4);
  }
  .subject-count {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--color-muted);
  }
  .subject-section {
    border-bottom: 1px solid var(--color-border);
  }
  .subject-inner {
    max-width: var(--wide-width);
    margin: 0 auto;
    padding: var(--spacing-16) var(--spacing-8);
  }
  .lesson-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }
  .lesson-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    padding: var(--spacing-4) var(--spacing-5);
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    text-decoration: none;
    color: inherit;
    transition: border-color var(--transition-fast), transform var(--transition-fast);
  }
  .lesson-card:hover {
    border-color: color-mix(in srgb, var(--color-accent) 50%, var(--color-border));
    transform: translateY(-1px);
  }
  .lesson-number {
    width: 36px;
    height: 36px;
    border-radius: var(--radius);
    border: 1px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    color: var(--color-accent);
    flex-shrink: 0;
  }
  .lesson-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .lesson-name {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-display);
    color: var(--color-text);
  }
  .lesson-desc {
    font-family: var(--font-sans);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }
  .lesson-meta {
    display: flex;
    gap: var(--spacing-3);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-muted);
    flex-shrink: 0;
  }
  .lesson-difficulty {
    text-transform: capitalize;
  }

  @media (max-width: 900px) {
    .subject-hero-inner {
      padding: var(--spacing-16) var(--spacing-6) var(--spacing-12);
    }
    .subject-inner {
      padding: var(--spacing-12) var(--spacing-6);
    }
    .lesson-meta {
      display: none;
    }
  }
  @media (max-width: 600px) {
    .subject-hero-inner {
      padding: var(--spacing-12) var(--spacing-5);
    }
    .subject-inner {
      padding: var(--spacing-10) var(--spacing-5);
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/hogwarts/library/\[subject\]/index.astro
git commit -m "feat: add subject landing page with lesson cards"
```

---

### Task 7: Create the Reveal.js presentation page

**Files:**
- Create: `src/pages/hogwarts/library/[subject]/[slug].astro`

- [ ] **Step 1: Create the presentation page**

This page loads Reveal.js from CDN and renders slides fullscreen. It breaks out of the `Base` layout entirely — it's a standalone HTML document.

```astro
---
export const prerender = false;

import { getEmDashEntry } from "emdash";

const { subject, slug } = Astro.params;

if (!slug || !subject) {
  return Astro.redirect("/hogwarts/library/");
}

const { entry: lesson, cacheHint } = await getEmDashEntry("lessons", slug);

if (!lesson) {
  return Astro.redirect(`/hogwarts/library/${subject}/`);
}

Astro.cache.set(cacheHint);

const slides = Array.isArray(lesson.data.slides) ? lesson.data.slides as Array<{
  title: string;
  body?: string;
  image?: { src: string; alt: string } | null;
  video_url?: string | null;
  layout?: string;
  speaker_notes?: string | null;
  bg_image?: string | null;
  bg_color?: string | null;
  fragments?: string[] | null;
  interaction?: string | null;
  key_takeaway?: string | null;
}> : [];

const title = lesson.data.title ?? "Presentation";

function slideAttrs(slide: typeof slides[0]): string {
  const attrs: string[] = [];
  if (slide.bg_color) attrs.push(`data-background-color="${slide.bg_color}"`);
  if (slide.bg_image) attrs.push(`data-background-image="${slide.bg_image}" data-background-size="cover"`);
  return attrs.join(" ");
}
---

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/black.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/monokai.css" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap');

    :root {
      --r-background-color: #0d1117;
      --r-main-font: 'Inter', sans-serif;
      --r-main-font-size: 24px;
      --r-main-color: #e6edf3;
      --r-heading-font: 'Inter Tight', sans-serif;
      --r-heading-color: #e6edf3;
      --r-heading-letter-spacing: -0.02em;
      --r-heading-font-weight: 700;
      --r-link-color: #7c3aed;
      --r-link-color-hover: #9b6aed;
      --r-selection-background-color: rgba(124, 58, 237, 0.3);
      --r-code-font: 'JetBrains Mono', monospace;
    }

    .reveal .slides section {
      text-align: left;
      padding: 40px 60px;
    }

    /* Title-only: centered */
    .reveal .slides section.layout-title-only {
      text-align: center;
      display: flex !important;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .layout-title-only .slide-subtitle {
      color: #8b949e;
      font-size: 0.8em;
      max-width: 60%;
      margin: 0 auto;
    }
    .layout-title-only .slide-rule {
      width: 40px;
      height: 2px;
      background: #7c3aed;
      margin: 16px auto;
    }

    /* Text-left-image-right */
    .layout-text-left-image-right .slide-content {
      display: flex;
      gap: 40px;
      align-items: center;
      height: 100%;
    }
    .layout-text-left-image-right .slide-text {
      flex: 1;
    }
    .layout-text-left-image-right .slide-visual {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .layout-text-left-image-right .slide-visual img {
      max-width: 100%;
      max-height: 60vh;
      border-radius: 8px;
    }

    /* Image-full */
    .layout-image-full {
      display: flex !important;
      align-items: flex-end !important;
      justify-content: flex-start !important;
    }
    .layout-image-full .slide-text {
      text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
    }

    /* Quote */
    .layout-quote {
      text-align: center !important;
      display: flex !important;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .layout-quote .quote-mark {
      font-size: 3em;
      color: #7c3aed;
      line-height: 1;
    }
    .layout-quote blockquote {
      border: none;
      font-style: italic;
      font-size: 1.2em;
      max-width: 70%;
      margin: 0 auto;
      padding: 0;
      box-shadow: none;
      background: none;
    }
    .layout-quote .quote-attribution {
      color: #8b949e;
      font-size: 0.7em;
      margin-top: 16px;
    }

    /* Two-column */
    .layout-two-column .columns {
      display: flex;
      gap: 24px;
      margin-top: 24px;
    }
    .layout-two-column .column {
      flex: 1;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 20px;
      background: rgba(22, 27, 34, 0.8);
    }

    /* Code */
    .layout-code pre {
      font-size: 0.65em;
      border-radius: 8px;
      border: 1px solid #30363d;
    }
    .layout-code pre code {
      font-family: 'JetBrains Mono', monospace;
      line-height: 1.7;
    }

    /* Shared elements */
    .key-takeaway {
      border-left: 3px solid #d4a843;
      padding: 8px 16px;
      font-size: 0.7em;
      color: #d4a843;
      font-style: italic;
      margin-top: 24px;
    }

    .interaction-prompt {
      background: rgba(124, 58, 237, 0.12);
      border: 1px solid rgba(124, 58, 237, 0.3);
      border-radius: 8px;
      padding: 12px 20px;
      font-size: 0.7em;
      color: #7c3aed;
      margin-top: 24px;
    }
    .interaction-prompt::before {
      content: "💬 ";
    }

    .fragment {
      font-size: 0.85em;
      line-height: 1.8;
    }

    /* Back button */
    .back-link {
      position: fixed;
      top: 16px;
      left: 16px;
      z-index: 100;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #8b949e;
      text-decoration: none;
      opacity: 0.5;
      transition: opacity 0.2s;
    }
    .back-link:hover { opacity: 1; }
  </style>
</head>
<body>
  <a href={`/hogwarts/library/${subject}/`} class="back-link">← back</a>
  <div class="reveal">
    <div class="slides">
      {slides.map((slide) => {
        const layout = slide.layout ?? "text-left-image-right";

        if (layout === "title-only") {
          return (
            <section class="layout-title-only" {...{ [`:data-background-color`]: slide.bg_color ?? undefined }} data-background-color={slide.bg_color ?? undefined}>
              <h1>{slide.title}</h1>
              {slide.body && <div class="slide-rule" />}
              {slide.body && <p class="slide-subtitle">{slide.body}</p>}
              {slide.fragments && (
                <ul style="list-style: none; padding: 0; text-align: center; margin-top: 24px;">
                  {slide.fragments.map((f) => <li class="fragment">{f}</li>)}
                </ul>
              )}
              {slide.key_takeaway && <div class="key-takeaway">{slide.key_takeaway}</div>}
              {slide.interaction && <div class="interaction-prompt fragment">{slide.interaction}</div>}
              <aside class="notes">{slide.speaker_notes ?? ""}</aside>
            </section>
          );
        }

        if (layout === "quote") {
          const lines = (slide.body ?? "").split("\n").filter(Boolean);
          const quoteText = lines[0] ?? "";
          return (
            <section class="layout-quote" data-background-color={slide.bg_color ?? undefined}>
              <div class="quote-mark">"</div>
              <blockquote>{slide.title}</blockquote>
              {quoteText && <div class="quote-attribution">{quoteText}</div>}
              {slide.key_takeaway && <div class="key-takeaway">{slide.key_takeaway}</div>}
              <aside class="notes">{slide.speaker_notes ?? ""}</aside>
            </section>
          );
        }

        if (layout === "image-full") {
          return (
            <section
              class="layout-image-full"
              data-background-color={slide.bg_color ?? "#1a1a2e"}
              data-background-image={slide.bg_image ?? undefined}
              data-background-size="cover"
            >
              <div class="slide-text">
                <h2>{slide.title}</h2>
                {slide.body && <p>{slide.body}</p>}
              </div>
              <aside class="notes">{slide.speaker_notes ?? ""}</aside>
            </section>
          );
        }

        if (layout === "two-column") {
          const frags = slide.fragments ?? [];
          const mid = Math.ceil(frags.length / 2);
          const leftFrags = frags.slice(0, mid);
          const rightFrags = frags.slice(mid);
          return (
            <section class="layout-two-column" data-background-color={slide.bg_color ?? undefined}>
              <h2>{slide.title}</h2>
              {slide.body && <p style="font-size: 0.8em; color: #8b949e;">{slide.body}</p>}
              <div class="columns">
                <div class="column">
                  <ul style="list-style: none; padding: 0;">
                    {leftFrags.map((f) => <li class="fragment">{f}</li>)}
                  </ul>
                </div>
                <div class="column">
                  <ul style="list-style: none; padding: 0;">
                    {rightFrags.map((f) => <li class="fragment">{f}</li>)}
                  </ul>
                </div>
              </div>
              {slide.key_takeaway && <div class="key-takeaway fragment">{slide.key_takeaway}</div>}
              {slide.interaction && <div class="interaction-prompt fragment">{slide.interaction}</div>}
              <aside class="notes">{slide.speaker_notes ?? ""}</aside>
            </section>
          );
        }

        if (layout === "code") {
          return (
            <section class="layout-code" data-background-color={slide.bg_color ?? undefined}>
              <h2>{slide.title}</h2>
              <pre><code>{slide.body ?? ""}</code></pre>
              {slide.key_takeaway && <div class="key-takeaway">{slide.key_takeaway}</div>}
              {slide.interaction && <div class="interaction-prompt fragment">{slide.interaction}</div>}
              <aside class="notes">{slide.speaker_notes ?? ""}</aside>
            </section>
          );
        }

        // Default: text-left-image-right
        return (
          <section class="layout-text-left-image-right" data-background-color={slide.bg_color ?? undefined}>
            <div class="slide-content">
              <div class="slide-text">
                <h2>{slide.title}</h2>
                {slide.body && slide.body.split("\n\n").map((p) => <p style="font-size: 0.8em; color: #c9d1d9;">{p}</p>)}
                {slide.fragments && (
                  <ul style="list-style: none; padding: 0;">
                    {slide.fragments.map((f) => <li class="fragment">{f}</li>)}
                  </ul>
                )}
                {slide.key_takeaway && <div class="key-takeaway fragment">{slide.key_takeaway}</div>}
                {slide.interaction && <div class="interaction-prompt fragment">{slide.interaction}</div>}
              </div>
              <div class="slide-visual">
                {slide.image?.src && <img src={slide.image.src} alt={slide.image.alt ?? ""} />}
                {slide.video_url && <iframe src={slide.video_url} width="100%" style="aspect-ratio: 16/9; border: none; border-radius: 8px;" allow="autoplay; encrypted-media" allowfullscreen />}
              </div>
            </div>
            <aside class="notes">{slide.speaker_notes ?? ""}</aside>
          </section>
        );
      })}
    </div>
  </div>

  <script is:inline src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"></script>
  <script is:inline src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/notes/notes.js"></script>
  <script is:inline src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/highlight.js"></script>
  <script is:inline>
    Reveal.initialize({
      hash: true,
      slideNumber: true,
      controls: true,
      progress: true,
      center: false,
      transition: 'slide',
      plugins: [RevealNotes, RevealHighlight],
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/hogwarts/library/\[subject\]/\[slug\].astro
git commit -m "feat: add Reveal.js presentation page with all 6 slide layouts"
```

---

### Task 8: Update site-routes.json and add navigation link

**Files:**
- Modify: `src/data/site-routes.json`

- [ ] **Step 1: Add the Library route to site-routes.json**

Add to the `"static"` array:

```json
{ "path": "/hogwarts/library", "title": "The Library", "priority": "0.7" }
```

- [ ] **Step 2: Commit**

```bash
git add src/data/site-routes.json
git commit -m "feat: add Library to site-routes.json"
```

---

### Task 9: Run dev server and verify end-to-end

- [ ] **Step 1: Start the dev server**

Run: `npx emdash dev`
Expected: Server starts without errors. Migrations run, seed applied.

- [ ] **Step 2: Verify Library index**

Open `http://localhost:4321/hogwarts/library/`
Expected: Shows "The Library" hero, one subject card ("What is Modern AI") with lesson count.

- [ ] **Step 3: Verify subject landing**

Open `http://localhost:4321/hogwarts/library/modern-ai/`
Expected: Shows subject title, 116 lesson cards with order numbers, slide counts, and duration.

- [ ] **Step 4: Verify Big Hero 6 presentation**

Open `http://localhost:4321/hogwarts/library/modern-ai/big-hero-6/`
Expected: Reveal.js fullscreen presentation. 12 slides with correct layouts. Arrow keys navigate. Press S for speaker view. Press O for overview.

- [ ] **Step 5: Verify JARVIS presentation**

Open `http://localhost:4321/hogwarts/library/modern-ai/jarvis-to-friday/`
Expected: 11 slides with correct layouts.

- [ ] **Step 6: Verify Ex Machina presentation**

Open `http://localhost:4321/hogwarts/library/modern-ai/ex-machina/`
Expected: 12 slides with correct layouts.

- [ ] **Step 7: Verify placeholder lesson**

Open `http://localhost:4321/hogwarts/library/modern-ai/the-matrix/`
Expected: Single title-only slide with lesson title.

- [ ] **Step 8: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address issues found during end-to-end verification"
```
