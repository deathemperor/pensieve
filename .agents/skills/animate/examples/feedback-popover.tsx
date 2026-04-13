/**
 * Feedback Popover Animation
 *
 * A button that expands into a feedback form using shared layout animation.
 * Shows loading and success states with animated transitions.
 *
 * Key techniques:
 * - layoutId on button and popover for seamless expansion
 * - Nested layoutId elements (text placeholder)
 * - AnimatePresence for popover enter/exit
 * - Form state transitions (idle -> loading -> success)
 * - useOnClickOutside for dismiss behavior
 *
 * Note: Install usehooks-ts: pnpm add usehooks-ts
 */
"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useOnClickOutside } from "usehooks-ts";

export default function FeedbackPopover() {
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState<"idle" | "loading" | "success">("idle");
  const [feedback, setFeedback] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useOnClickOutside(ref, () => setOpen(false));

  function submit() {
    setFormState("loading");
    setTimeout(() => setFormState("success"), 1500);
    setTimeout(() => setOpen(false), 3300);
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && open && formState === "idle") {
        submit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, formState]);

  return (
    <div className="feedback-wrapper">
      {/* Button with layoutId - will animate into popover */}
      <motion.button
        onClick={() => {
          setOpen(true);
          setFormState("idle");
          setFeedback("");
        }}
        className="feedback-button"
        style={{ borderRadius: 8 }}
        layoutId="background"
      >
        <motion.span layoutId="placeholder">
          Feedback
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={ref}
            className="feedback-popover"
            style={{ borderRadius: 12 }}
            layoutId="background"
          >
            {/* Placeholder text animates with the layout */}
            <motion.span
              aria-hidden
              className="placeholder"
              layoutId="placeholder"
              style={{ opacity: feedback ? 0 : 0.5 }}
            >
              Feedback
            </motion.span>

            {formState === "success" ? (
              <div className="success-wrapper">
                <h3>Feedback received!</h3>
                <p>Thanks for your feedback.</p>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <textarea
                  autoFocus
                  placeholder="Feedback"
                  onChange={(e) => setFeedback(e.target.value)}
                  value={feedback}
                  required
                />
                <button type="submit">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={formState}
                      initial={{ opacity: 0, y: -25 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 25 }}
                      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                    >
                      {formState === "loading" ? "Sending..." : "Send feedback"}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
