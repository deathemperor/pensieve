/**
 * Toast Stacking Animation
 *
 * Animated toast notifications that stack vertically with smooth transitions.
 * Uses CSS custom properties (--index) for dynamic positioning.
 *
 * Key techniques:
 * - CSS custom properties for dynamic values
 * - data-* attributes to trigger CSS transitions
 * - useEffect to trigger mount animation
 * - calc() for computing stack positions
 */
"use client";

import { useEffect, useState } from "react";

// toast-animation.css
const styles = `
.toast {
  position: absolute;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px 13px;
  width: 100%;
  font-size: 13px;
  border-radius: 8px;
  background: white;
  box-shadow: 0px 0px 0px 1px rgba(0, 0, 0, 0.08),
    0px 1px 2px -1px rgba(0, 0, 0, 0.08),
    0px 2px 4px 0px rgba(0, 0, 0, 0.04);

  /* Animation - starts hidden below */
  transition-property: transform, opacity;
  transition-duration: 350ms;
  transition-timing-function: ease;
  transform: translateY(100%);
  opacity: 0;
}

/* Animate to stacked position when mounted */
.toast[data-mounted="true"] {
  transform: translateY(calc(var(--index) * (100% + var(--gap)) * -1));
  opacity: 1;
}

.toaster {
  position: absolute;
  left: 50%;
  bottom: 80px;
  display: flex;
  flex-direction: column;
  gap: var(--gap);
  width: 356px;
  transform: translateX(-50%);
  --gap: 16px;
}
`;

export default function Toaster() {
  const [toasts, setToasts] = useState(0);

  return (
    <div className="toast-wrapper">
      <div className="toaster">
        {Array.from({ length: toasts }).map((_, i) => (
          <Toast key={i} index={toasts - (i + 1)} />
        ))}
      </div>
      <button onClick={() => setToasts(toasts + 1)}>
        Add toast
      </button>
    </div>
  );
}

function Toast({ index }: { index: number }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className="toast"
      style={{ "--index": index } as React.CSSProperties}
      data-mounted={mounted}
    >
      <span className="title">Event Created</span>
      <span className="description">Monday, January 3rd at 6:00pm</span>
    </div>
  );
}
