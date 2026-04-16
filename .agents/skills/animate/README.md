# Animate Skill for Claude Code

Animation patterns and best practices for Next.js/React applications. Based on Emil Kowalski's "Animations on the Web" course.

## Installation

```bash
npx skills add https://github.com/delphi-ai/animate-skill --skill animate
```

## What's Included

- **SKILL.md** - Quick reference for easing, timing, and common patterns
- **examples/** - 8 complete working examples (hover effects, toasts, modals, etc.)
- **references/** - Detailed docs on CSS animations, Framer Motion, performance, accessibility

## Usage

Once installed, the skill triggers automatically when you ask Claude Code to implement animations, transitions, hover effects, modals, or any motion in React components.

You can also invoke it directly with `/animate`.

## Examples Included

| Example | Description |
|---------|-------------|
| `card-hover.tsx` | Slide-up description on hover |
| `toast-stacking.tsx` | Animated toast notifications |
| `text-reveal.tsx` | Staggered letter animation |
| `shared-layout.tsx` | Framer Motion layoutId morph |
| `animate-height.tsx` | Smooth height changes |
| `multi-step-flow.tsx` | Directional step wizard |
| `feedback-popover.tsx` | Button-to-popover expansion |
| `app-store-card.tsx` | iOS-style card expansion |

## Dependencies

For Framer Motion examples:
```bash
pnpm add framer-motion react-use-measure usehooks-ts
```
