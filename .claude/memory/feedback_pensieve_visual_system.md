---
name: Pensieve visual system — Linear-influenced
description: Locked-in design language for pensieve.huuloc.com — single dark canvas, one accent per category, Inter Tight headings
type: feedback
originSessionId: 05f762e5-cde9-4725-9a83-729b7ab4f95f
---
After two rounds of "looks bad" feedback, Loc gave **Linear's blog** as the only color/aesthetic reference. The agreed visual system as of 2026-04-11:

**Canvas (one palette site-wide, no per-page background changes):**
- Dark mode (primary): bg `#08090a`, surface `#101113`, text `#f7f8f8`, secondary `#8a8f98`, muted `#62676c`, borders `rgba(255,255,255,0.06)`
- Light mode mirror: bg `#fafbfc`, surface `#f4f5f8`, text `#08090a`, secondary `#3d4452`, borders `rgba(8,9,10,0.08)`
- **No warm creams. No parchment. No swapping backgrounds per category.** Linear's blog has one canvas; pensieve does too.

**Typography (one stack for everything):**
- Display (headings): **Inter Tight**, weights 500–800
- Body: **Inter**, weights 400–700
- Mono (meta, dates, code): **JetBrains Mono**
- **Never swap fonts per category.** Linear doesn't, neither does pensieve.

**Per-category accent colors (the ONLY thing that varies per category):**
| Category | Accent | Hex |
|---|---|---|
| philosophy | warm amber gold | `#c8a464` |
| science | sea teal | `#5cb8ad` |
| personal-stories | warm terracotta | `#d08770` |
| generative-ai | Linear purple | `#7c83de` |
| startups | electric steel blue | `#5b8def` |
| nature | sage moss | `#88a577` |
| misc | shares lab-notebook (`#5cb8ad`) |

The accent is used for: category labels, hero rule, hover states, the dot/border on a post card, the "view all" link on hover. **Backgrounds and fonts never change per accent.**

**Layout primitives:**
- Hero: dark canvas + faint radial accent glow at top corner + accent rule + accent label + Inter Tight title in primary text
- Pills: thin outlined chips with a dot in the accent + label in primary text + count in muted mono. Hover lifts the border to the accent and adds an 8% accent fill.
- Group sections: dark canvas, accent-colored category header in Inter Tight, posts as left-bordered rows (2px accent border at 30% opacity, full opacity on hover)
- Cards: no rounded "card" boundaries with inner padding — posts are clean rows separated by spacing, not boxes

**Why:** Loc explicitly rejected the previous "different worlds per category" multi-palette approach. The blog should feel calm, confident, and intentional like Linear's blog — not like a Trello board of color swatches. Theming lives in *one accent and one rule per category*, not in dramatic background swaps.

**How to apply:** if a future change tries to introduce themed backgrounds, multi-font swapping, or warm cream/parchment surfaces, push back — that contradicts this locked decision. If new categories are added, give them ONE accent in the same saturation/lightness range as the six above and add to `categoryThemeMap`.
