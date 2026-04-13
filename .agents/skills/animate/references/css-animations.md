# CSS Animations Reference

## Transforms

Transforms change an element's position, size, or rotation without affecting layout. They are GPU-accelerated and performant.

### Transform Functions

```css
/* Translation (movement) */
transform: translateX(10px);
transform: translateY(-20px);
transform: translate(10px, -20px);  /* X, Y */
transform: translate3d(10px, 20px, 30px);  /* X, Y, Z */

/* Scale */
transform: scale(1.1);  /* Uniform scale */
transform: scaleX(0.5);
transform: scaleY(1.5);
transform: scale(0.5, 1.5);  /* X, Y */

/* Rotation */
transform: rotate(45deg);
transform: rotateX(45deg);  /* 3D - around X axis */
transform: rotateY(45deg);  /* 3D - around Y axis */
transform: rotateZ(45deg);  /* Same as rotate() */

/* Combining transforms */
transform: translateY(-10px) scale(1.05) rotate(5deg);
```

### Transform Origin

Controls the point around which transforms occur:

```css
transform-origin: center;  /* Default */
transform-origin: top left;
transform-origin: 50% 100%;  /* Center bottom */
transform-origin: 0 0;  /* Top left corner */
```

### 3D Transforms

```css
/* Enable 3D space on parent */
.parent {
  perspective: 1000px;  /* Distance from viewer */
  perspective-origin: center;
}

/* 3D transforms on children */
.child {
  transform: rotateY(45deg);
  transform-style: preserve-3d;  /* Maintain 3D for nested elements */
  backface-visibility: hidden;  /* Hide back of element */
}
```

## Transitions

Transitions animate property changes over time.

### Syntax

```css
/* Individual properties */
transition-property: transform, opacity;
transition-duration: 200ms;
transition-timing-function: ease-out;
transition-delay: 0ms;

/* Shorthand */
transition: transform 200ms ease-out, opacity 150ms ease-out 50ms;
/*          property  duration timing   property duration timing  delay */
```

### Common Transition Patterns

```css
/* Hover lift effect */
.card {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

/* Button press effect */
.button {
  transition: transform 100ms ease-out;
}
.button:active {
  transform: scale(0.97);
}

/* Fade in/out */
.element {
  opacity: 0;
  transition: opacity 200ms ease-out;
}
.element.visible {
  opacity: 1;
}
```

### Performance-Safe Properties

These properties are GPU-accelerated and won't cause layout recalculation:
- `transform`
- `opacity`

Avoid animating (cause layout/paint):
- `width`, `height`
- `top`, `left`, `right`, `bottom`
- `margin`, `padding`
- `border-width`

## Keyframe Animations

For complex, multi-step animations.

### Basic Syntax

```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

.element {
  animation: fadeIn 300ms ease-out forwards;
}
```

### Animation Properties

```css
animation-name: fadeIn;
animation-duration: 300ms;
animation-timing-function: ease-out;
animation-delay: 0ms;
animation-iteration-count: 1;  /* or 'infinite' */
animation-direction: normal;  /* or 'reverse', 'alternate' */
animation-fill-mode: forwards;  /* 'none', 'forwards', 'backwards', 'both' */
animation-play-state: running;  /* or 'paused' */

/* Shorthand */
animation: fadeIn 300ms ease-out 0ms 1 normal forwards;
```

### Fill Modes Explained

- `none`: No styles applied before/after animation
- `forwards`: Retains final keyframe styles after animation
- `backwards`: Applies initial keyframe styles during delay
- `both`: Applies both forwards and backwards

## Clip-Path Animations

Clip-path creates masked areas that can be animated.

### Common Shapes

```css
/* Circle */
clip-path: circle(50% at center);
clip-path: circle(0% at center);  /* Hidden */

/* Ellipse */
clip-path: ellipse(50% 30% at center);

/* Inset (rectangle) */
clip-path: inset(0);  /* Full visibility */
clip-path: inset(50%);  /* Hidden (collapsed to center) */
clip-path: inset(0 50% 0 0);  /* Right half hidden */
/* inset(top right bottom left) */

/* Polygon */
clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);  /* Rectangle */
clip-path: polygon(50% 0, 100% 100%, 0 100%);  /* Triangle */
```

### Clip-Path Animation Example (Image Comparison Slider)

```css
.before-image {
  clip-path: inset(0 50% 0 0);  /* Show left half */
  transition: clip-path 0ms;  /* Instant update */
}

/* JavaScript updates the clip-path based on slider position */
```

### Tab Indicator with Clip-Path

```tsx
// Active tab background slides using clip-path
<div className="relative">
  {tabs.map((tab, index) => (
    <button
      key={tab}
      onClick={() => setActive(index)}
      className="relative z-10 px-4 py-2"
    >
      {tab}
    </button>
  ))}
  <div
    className="absolute inset-0 bg-blue-500 rounded transition-all duration-200"
    style={{
      clipPath: `inset(0 ${100 - (activeIndex + 1) * (100 / tabs.length)}% 0 ${activeIndex * (100 / tabs.length)}% round 8px)`
    }}
  />
</div>
```
