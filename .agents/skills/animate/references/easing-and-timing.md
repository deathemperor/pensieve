# Easing and Timing Reference

## Core Principles

Animations should feel natural and purposeful. The goal is to make interfaces feel responsive without drawing attention to the animation itself.

## Easing Functions

### When to Use Each Easing Type

| Easing | Use Case | Timing |
|--------|----------|--------|
| `ease-out` | Elements entering the screen | 200-300ms |
| `ease-in-out` | Elements moving on screen | 200-300ms |
| `ease-in` | Elements exiting the screen | 150-200ms |
| `ease` | Hover effects | 150ms |
| `linear` | Opacity changes, progress bars | varies |

### Custom Easing Variables

Define these CSS custom properties for consistent animations:

```css
:root {
  /* Recommended easing curves */
  --ease-out-quint: cubic-bezier(.23, 1, .32, 1);
  --ease-in-out-cubic: cubic-bezier(.645, .045, .355, 1);
  --ease-out-cubic: cubic-bezier(.33, 1, .68, 1);
  --ease-in-cubic: cubic-bezier(.32, 0, .67, 0);

  /* Spring-like feel */
  --ease-out-back: cubic-bezier(.34, 1.56, .64, 1);
}
```

### Cubic Bezier Explained

`cubic-bezier(x1, y1, x2, y2)` defines a curve with two control points:
- `(x1, y1)` - First control point (influences start of animation)
- `(x2, y2)` - Second control point (influences end of animation)

Values > 1 create overshoot effects (like `ease-out-back`).

## Timing Guidelines

### Duration Sweet Spots

- **General animations**: 200-300ms (the sweet spot)
- **Hover effects**: 150ms
- **Modal enter**: 200ms
- **Modal exit**: 150ms (exits should be faster than enters)
- **Page transitions**: 300-400ms
- **Micro-interactions**: 100-150ms

### Rules of Thumb

1. **Exits faster than enters**: Exit animations should be ~75% of enter duration
2. **Smaller elements = faster animations**: Scale duration with element size
3. **User-initiated = faster response**: Direct actions should feel immediate
4. **System-initiated = can be slower**: Background transitions can take longer

## Spring Animations

Springs are excellent for interruptible animations and natural-feeling motion.

### Spring Parameters

| Parameter | Effect |
|-----------|--------|
| `mass` | Weight of the object (higher = slower, more momentum) |
| `tension` (stiffness) | Spring tightness (higher = faster, snappier) |
| `friction` (damping) | Resistance (higher = less oscillation) |
| `velocity` | Initial speed |

### Framer Motion Spring Config

```tsx
// Snappy spring (UI elements)
const snappy = { type: "spring", stiffness: 400, damping: 30 }

// Gentle spring (larger elements)
const gentle = { type: "spring", stiffness: 200, damping: 20 }

// Bouncy spring (playful interactions)
const bouncy = { type: "spring", stiffness: 300, damping: 10 }
```

### Duration-Based Springs (Framer Motion)

```tsx
// Using duration instead of physics
const durationSpring = {
  type: "spring",
  duration: 0.3,
  bounce: 0.2  // 0 = no bounce, 1 = max bounce
}
```

## When NOT to Animate

- Loading states that block interaction
- Error messages that need immediate attention
- Accessibility: respect `prefers-reduced-motion`
- When animation adds no value to the experience
- Repeated actions the user performs frequently
