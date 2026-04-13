/**
 * Multi-Step Flow Animation
 *
 * Animated wizard/stepper with directional slide transitions.
 * Steps slide in from the direction of navigation.
 *
 * Key techniques:
 * - AnimatePresence mode="popLayout" for exit animations
 * - custom prop for directional variants (slide left or right)
 * - useMeasure for animating container height
 * - useReducedMotion for accessibility
 * - MotionConfig for shared transition settings
 */
"use client";

import { useMemo, useState } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import useMeasure from "react-use-measure";

// Directional slide variants
const variants = {
  initial: (direction: number) => ({
    x: `${110 * direction}%`,
    opacity: 0,
  }),
  active: {
    x: "0%",
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: `${-110 * direction}%`,
    opacity: 0,
  }),
};

// Reduced motion alternative - just fade
const reducedMotionVariants = {
  initial: { opacity: 0 },
  active: { opacity: 1 },
  exit: { opacity: 0 },
};

export default function MultiStepComponent() {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<number>(0);
  const [ref, bounds] = useMeasure();
  const reducedMotion = useReducedMotion();

  const content = useMemo(() => {
    switch (currentStep) {
      case 0:
        return (
          <>
            <h2>Step One</h2>
            <p>First step content goes here.</p>
          </>
        );
      case 1:
        return (
          <>
            <h2>Step Two</h2>
            <p>Second step with different content length.</p>
            <p>Extra paragraph to show height animation.</p>
          </>
        );
      case 2:
        return (
          <>
            <h2>Step Three</h2>
            <p>Final step - you made it!</p>
          </>
        );
    }
  }, [currentStep]);

  return (
    <MotionConfig transition={{ duration: 0.5, type: "spring", bounce: 0 }}>
      {/* Container animates height based on content */}
      <motion.div
        className="multi-step-wrapper"
        animate={reducedMotion ? {} : { height: bounds.height }}
      >
        <div className="multi-step-inner" ref={ref}>
          {/* AnimatePresence handles exit animations */}
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={currentStep}
              variants={reducedMotion ? reducedMotionVariants : variants}
              initial="initial"
              animate="active"
              exit="exit"
              custom={direction}
            >
              {content}
            </motion.div>
          </AnimatePresence>

          {/* Buttons use layout animation to stay in place */}
          <motion.div className="actions" layout={!reducedMotion}>
            <button
              disabled={currentStep === 0}
              onClick={() => {
                setCurrentStep((prev) => prev - 1);
                setDirection(-1); // Slide from left
              }}
            >
              Back
            </button>
            <button
              disabled={currentStep === 2}
              onClick={() => {
                setCurrentStep((prev) => prev + 1);
                setDirection(1); // Slide from right
              }}
            >
              Continue
            </button>
          </motion.div>
        </div>
      </motion.div>
    </MotionConfig>
  );
}
