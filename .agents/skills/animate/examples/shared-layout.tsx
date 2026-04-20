/**
 * Shared Layout Animation
 *
 * Demonstrates Framer Motion's layoutId for seamless transitions
 * between two different elements/positions.
 *
 * Key techniques:
 * - layoutId creates a shared identity between elements
 * - Motion automatically animates position and size changes
 * - style={{ borderRadius }} prevents border radius distortion during animation
 */
"use client";

import { motion } from "framer-motion";
import { useState } from "react";

// styles.css
const styles = `
.wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;
}

.element {
  width: 100px;
  height: 100px;
  background: #3b82f6;
}

.second-element {
  width: 200px;
  height: 200px;
  background: #3b82f6;
}
`;

export default function SharedLayoutExample() {
  const [showSecond, setShowSecond] = useState(false);

  return (
    <div className="wrapper">
      <button onClick={() => setShowSecond((s) => !s)}>
        Animate
      </button>

      {/* Same layoutId = smooth transition between the two */}
      {showSecond ? (
        <motion.div
          layoutId="rectangle"
          className="second-element"
          style={{ borderRadius: 12 }}
        />
      ) : (
        <motion.div
          layoutId="rectangle"
          className="element"
          style={{ borderRadius: 12 }}
        />
      )}
    </div>
  );
}
