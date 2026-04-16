# Performance & Accessibility Reference

## Performance

### Target: 60 FPS

Animations should run at 60 frames per second (16.67ms per frame) for smooth motion.

### GPU-Accelerated Properties

Only these properties are hardware-accelerated and won't cause layout recalculation:

| Property | Notes |
|----------|-------|
| `transform` | translate, scale, rotate |
| `opacity` | Fade effects |

### Properties to Avoid Animating

These trigger layout recalculation and are expensive:

- `width`, `height`
- `top`, `left`, `right`, `bottom`
- `margin`, `padding`
- `border-width`
- `font-size`

**Instead**: Use `transform: scale()` instead of width/height, `transform: translate()` instead of top/left.

### will-change

Hints to the browser that an element will animate:

```css
.will-animate {
  will-change: transform, opacity;
}
```

**Caution**: Use sparingly. Apply only to elements that actually animate, and remove after animation completes if possible. Overuse can hurt performance.

### Hardware Acceleration Hack

Force GPU layer creation (use sparingly):

```css
.force-gpu {
  transform: translateZ(0);
  /* or */
  backface-visibility: hidden;
}
```

### Monitoring Performance

1. **Chrome DevTools**: Performance tab → Record during animation
2. **Rendering tab**: Enable "FPS meter" and "Paint flashing"
3. **Layers panel**: Check layer composition

### Common Performance Issues

| Issue | Solution |
|-------|----------|
| Janky scrolling | Use `transform` instead of `top/left` |
| Slow animations | Reduce number of animated elements |
| Memory spikes | Avoid creating new objects during animation |
| Layout thrashing | Batch DOM reads/writes |

## Accessibility

### prefers-reduced-motion

Users can indicate they prefer reduced motion in their system settings. Always respect this preference.

#### CSS Implementation

```css
/* Full animation by default */
.element {
  transition: transform 300ms ease-out;
}

/* Reduced or no motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
  .element {
    transition: none;
    /* or minimal transition */
    transition: opacity 200ms ease-out;
  }
}
```

#### React/Framer Motion Implementation

```tsx
import { useReducedMotion } from "framer-motion"

function AnimatedComponent() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.3 }}
    />
  )
}
```

#### Global Configuration with MotionConfig

```tsx
import { MotionConfig, useReducedMotion } from "framer-motion"

function App() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <MotionConfig reducedMotion={shouldReduceMotion ? "always" : "never"}>
      {/* All motion components inside respect this setting */}
      <YourApp />
    </MotionConfig>
  )
}
```

### MotionConfig Options

| Value | Effect |
|-------|--------|
| `"never"` | Normal animations (default) |
| `"always"` | Skip all animations |
| `"user"` | Respect system `prefers-reduced-motion` setting |

### Accessible Animation Guidelines

1. **Provide alternatives**: Ensure content is accessible without animation
2. **Avoid flashing**: No content flashing more than 3 times per second
3. **Don't block interaction**: Animations shouldn't prevent users from interacting
4. **Keep it brief**: Long animations can be frustrating
5. **Purposeful motion**: Only animate when it adds value
6. **Pause controls**: For continuous animations, provide pause/stop

### Focus Management with Animations

```tsx
// Ensure focus moves appropriately with animated elements
function Modal({ isOpen }) {
  const modalRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      // Wait for enter animation before focusing
      const timer = setTimeout(() => {
        modalRef.current?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={modalRef}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          Modal content
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

### Testing Reduced Motion

1. **macOS**: System Preferences → Accessibility → Display → Reduce motion
2. **Windows**: Settings → Ease of Access → Display → Show animations
3. **iOS**: Settings → Accessibility → Motion → Reduce Motion
4. **Chrome DevTools**: Rendering tab → Emulate CSS media feature `prefers-reduced-motion`
