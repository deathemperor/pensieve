# Framer Motion Reference

Framer Motion is the recommended animation library for React/Next.js applications.

## Installation

```bash
npm install framer-motion
# or
pnpm add framer-motion
```

## Basic Usage

### Motion Components

```tsx
import { motion } from "framer-motion"

// Any HTML element can become animated
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
>
  Content
</motion.div>
```

### Common Props

| Prop | Description |
|------|-------------|
| `initial` | Starting state (or `false` to disable) |
| `animate` | Target state |
| `exit` | Exit state (requires AnimatePresence) |
| `transition` | Animation configuration |
| `whileHover` | State while hovered |
| `whileTap` | State while pressed |
| `whileFocus` | State while focused |
| `whileInView` | State while in viewport |

## AnimatePresence

Required for exit animations. Wraps elements that may be removed from DOM.

```tsx
import { motion, AnimatePresence } from "framer-motion"

function Modal({ isOpen, onClose, children }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

### AnimatePresence Props

```tsx
<AnimatePresence
  mode="wait"      // 'sync' | 'wait' | 'popLayout'
  initial={false}  // Disable initial animation on mount
  onExitComplete={() => {}}  // Callback when all exits complete
>
```

- `mode="sync"` (default): Enter and exit happen simultaneously
- `mode="wait"`: Wait for exit to complete before enter
- `mode="popLayout"`: Remove exiting elements from layout flow

## Variants

Variants define animation states that can be orchestrated across parent/children.

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,  // Delay between each child
      delayChildren: 0.2,    // Initial delay before children start
    }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
}

function List({ items }) {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {items.map(item => (
        <motion.li key={item.id} variants={itemVariants}>
          {item.name}
        </motion.li>
      ))}
    </motion.ul>
  )
}
```

## Layout Animations

Animate layout changes automatically with the `layout` prop.

```tsx
// Element animates when its position/size changes
<motion.div layout>
  {isExpanded ? "Expanded content here" : "Collapsed"}
</motion.div>

// Layout types
<motion.div layout>  // Animate position and size
<motion.div layout="position">  // Only animate position
<motion.div layout="size">  // Only animate size
```

### Shared Layout Animations (layoutId)

Elements with the same `layoutId` animate between each other.

```tsx
function Tabs({ tabs, activeTab, setActiveTab }) {
  return (
    <div className="flex gap-2">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className="relative px-4 py-2"
        >
          {tab}
          {activeTab === tab && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute inset-0 bg-blue-500 rounded -z-10"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  )
}
```

### LayoutGroup

Group layout animations to prevent conflicts between independent animations.

```tsx
import { LayoutGroup } from "framer-motion"

<LayoutGroup>
  <Tabs />  {/* These layout animations */}
</LayoutGroup>
<LayoutGroup>
  <OtherTabs />  {/* Won't conflict with these */}
</LayoutGroup>
```

## Gestures

### Drag

```tsx
<motion.div
  drag              // Enable both axes
  drag="x"          // Horizontal only
  drag="y"          // Vertical only
  dragConstraints={{ left: 0, right: 300, top: 0, bottom: 200 }}
  dragElastic={0.2}     // Elasticity outside constraints (0-1)
  dragMomentum={true}   // Continue after release
  dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
  onDragStart={(event, info) => {}}
  onDrag={(event, info) => {}}
  onDragEnd={(event, info) => {}}
>
  Drag me
</motion.div>
```

### Drag Info Object

```tsx
onDrag={(event, info) => {
  info.point    // { x, y } current position
  info.delta    // { x, y } change since last frame
  info.offset   // { x, y } offset from drag start
  info.velocity // { x, y } current velocity
}}
```

## Motion Values & Hooks

### useMotionValue

Create a value that updates without re-rendering.

```tsx
import { motion, useMotionValue, useTransform } from "framer-motion"

function Component() {
  const x = useMotionValue(0)

  // Transform x position to opacity
  const opacity = useTransform(x, [-100, 0, 100], [0, 1, 0])

  // Transform x to rotation
  const rotate = useTransform(x, [-100, 100], [-10, 10])

  return (
    <motion.div
      drag="x"
      style={{ x, opacity, rotate }}
    />
  )
}
```

### useSpring

Create a spring-animated motion value.

```tsx
import { useSpring, useMotionValue } from "framer-motion"

function Component() {
  const x = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 300, damping: 30 })

  return (
    <motion.div
      onMouseMove={(e) => x.set(e.clientX)}
      style={{ x: springX }}
    />
  )
}
```

### useScroll

Track scroll progress.

```tsx
import { useScroll, useTransform, motion } from "framer-motion"

function ProgressBar() {
  const { scrollYProgress } = useScroll()

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-1 bg-blue-500 origin-left"
      style={{ scaleX: scrollYProgress }}
    />
  )
}

// Scroll within a container
const { scrollYProgress } = useScroll({
  target: containerRef,
  offset: ["start end", "end start"]  // When to start/end tracking
})
```

### useInView

Detect when element enters viewport.

```tsx
import { useInView } from "framer-motion"

function Component() {
  const ref = useRef(null)
  const isInView = useInView(ref, {
    once: true,      // Only trigger once
    margin: "-100px" // Trigger 100px before entering
  })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
    />
  )
}
```

## Transition Options

```tsx
const transition = {
  // Timing
  duration: 0.3,
  delay: 0.1,

  // Easing
  ease: "easeOut",  // or array: [0.23, 1, 0.32, 1]

  // Spring physics
  type: "spring",
  stiffness: 400,
  damping: 30,
  mass: 1,

  // Or duration-based spring
  type: "spring",
  duration: 0.3,
  bounce: 0.2,

  // Per-property transitions
  opacity: { duration: 0.2 },
  x: { type: "spring", stiffness: 300 },

  // Repeat
  repeat: Infinity,
  repeatType: "reverse",  // "loop" | "reverse" | "mirror"
  repeatDelay: 0.5,
}
```

## Multi-Step Animations (Keyframes)

```tsx
<motion.div
  animate={{
    x: [0, 100, 0],           // Move right then back
    opacity: [0, 1, 1, 0],    // Fade in, stay, fade out
    scale: [1, 1.2, 1],       // Grow then shrink
  }}
  transition={{
    duration: 2,
    times: [0, 0.5, 1],       // When each keyframe occurs (0-1)
    ease: "easeInOut",
  }}
/>
```
