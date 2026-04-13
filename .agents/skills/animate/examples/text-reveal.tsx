/**
 * Text Reveal Animation
 *
 * Staggered letter-by-letter text reveal animation using CSS keyframes.
 * Each letter animates in sequence with a delay based on its index.
 *
 * Key techniques:
 * - Split text into individual spans
 * - CSS custom property (--index) for stagger delay
 * - @keyframes for the reveal animation
 * - animation-fill-mode: backwards to hide before animation
 * - cubic-bezier for smooth easing
 */
"use client";

import { useState } from "react";

// text-reveal.css
const styles = `
.h1 {
  font-size: 4rem;
  font-weight: bold;
  overflow: hidden;
}

.h1 span {
  display: inline-block;
  animation: reveal 1.3s cubic-bezier(0.19, 1, 0.22, 1);
  animation-fill-mode: backwards;
  animation-delay: calc(var(--index) * 0.03s);
}

@keyframes reveal {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
`;

const WORD = "Animations";

export default function TextReveal() {
  const [reset, setReset] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      {/* Key change forces re-render and replays animation */}
      <div key={reset}>
        <h1 className="h1">
          {WORD.split("").map((char, index) => (
            <span
              key={index}
              style={{ "--index": index } as React.CSSProperties}
            >
              {char}
            </span>
          ))}
        </h1>
      </div>
      <button onClick={() => setReset(reset + 1)}>
        Replay animation
      </button>
    </div>
  );
}
