/**
 * Animate Height
 *
 * Smoothly animate height changes when content expands/collapses.
 * Uses react-use-measure to get the actual content height.
 *
 * Key techniques:
 * - useMeasure hook to get dynamic content dimensions
 * - Animate height property (normally discouraged, but acceptable here)
 * - Inner wrapper ref for measuring, outer wrapper for animating
 * - Works for any dynamic content changes
 *
 * Note: Install react-use-measure: pnpm add react-use-measure
 */
"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import useMeasure from "react-use-measure";

// styles.css
const styles = `
.wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;
}

.element {
  background: #f5f5f5;
  border-radius: 12px;
  overflow: hidden;
  width: 300px;
}

.inner {
  padding: 16px;
}
`;

export default function AnimateHeight() {
  const [showExtraContent, setShowExtraContent] = useState(false);
  const [ref, bounds] = useMeasure();

  return (
    <div className="wrapper">
      <button onClick={() => setShowExtraContent((b) => !b)}>
        Toggle height
      </button>

      {/* Outer div animates to measured height */}
      <motion.div
        className="element"
        animate={{ height: bounds.height }}
        transition={{ duration: 0.3 }}
      >
        {/* Inner div is measured */}
        <div className="inner" ref={ref}>
          <h1>Expandable Drawer</h1>
          <p>
            This content can grow and shrink. The animation smoothly
            transitions between heights.
          </p>
          {showExtraContent && (
            <p>
              This extra content will change the height of the drawer.
              The animation handles any content changes automatically.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
