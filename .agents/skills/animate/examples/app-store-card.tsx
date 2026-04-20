/**
 * App Store Card Expansion
 *
 * iOS App Store-style card that expands to full screen with shared
 * layout animation. Multiple elements animate together.
 *
 * Key techniques:
 * - Multiple layoutId elements that animate together
 * - whileTap for press feedback
 * - Overlay with separate AnimatePresence
 * - useOnClickOutside and Escape key for dismiss
 * - borderRadius in style prop to prevent distortion
 */
"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOnClickOutside } from "usehooks-ts";

type Card = {
  title: string;
  description: string;
  longDescription: string;
  image: string;
};

// Card in grid view
function Card({
  card,
  setActiveCard,
}: {
  card: Card;
  setActiveCard: (card: Card | null) => void;
}) {
  return (
    <motion.div
      layoutId={`card-${card.title}`}
      className="card"
      whileTap={{ scale: 0.98 }}
      onClick={() => setActiveCard(card)}
      style={{ borderRadius: 20 }}
    >
      <motion.img
        layoutId={`image-${card.title}`}
        src={card.image}
        alt=""
        style={{ borderRadius: 20 }}
        draggable={false}
      />
      <motion.div layoutId={`card-content-${card.title}`} className="card-content">
        <motion.h2 layoutId={`card-heading-${card.title}`}>
          {card.title}
        </motion.h2>
        <motion.p layoutId={`card-description-${card.title}`}>
          {card.description}
        </motion.p>
      </motion.div>

      {/* Hidden long description - will animate in when expanded */}
      <motion.div
        layoutId={`card-long-description-${card.title}`}
        style={{ position: "absolute", top: "100%", opacity: 0 }}
      >
        {card.longDescription}
      </motion.div>
    </motion.div>
  );
}

// Expanded card view
function ActiveCard({
  activeCard,
  setActiveCard,
}: {
  activeCard: Card;
  setActiveCard: (card: Card | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, () => setActiveCard(null));

  return (
    <motion.div
      ref={ref}
      layoutId={`card-${activeCard.title}`}
      className="card card-active"
      style={{ borderRadius: 0 }}
    >
      <motion.img
        layoutId={`image-${activeCard.title}`}
        src={activeCard.image}
        alt=""
        style={{ borderRadius: 0 }}
      />
      <motion.button
        className="close-button"
        onClick={() => setActiveCard(null)}
      >
        ✕
      </motion.button>
      <motion.div layoutId={`card-content-${activeCard.title}`} className="card-content">
        <motion.h2 layoutId={`card-heading-${activeCard.title}`}>
          {activeCard.title}
        </motion.h2>
        <motion.p layoutId={`card-description-${activeCard.title}`}>
          {activeCard.description}
        </motion.p>
      </motion.div>

      {/* Long description now visible */}
      <motion.div layoutId={`card-long-description-${activeCard.title}`}>
        {activeCard.longDescription}
      </motion.div>
    </motion.div>
  );
}

export default function AppStoreCards() {
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  // Dismiss on Escape
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveCard(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="cards-wrapper">
      {CARDS.map((card) => (
        <Card key={card.title} card={card} setActiveCard={setActiveCard} />
      ))}

      {/* Overlay */}
      <AnimatePresence>
        {activeCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overlay"
          />
        )}
      </AnimatePresence>

      {/* Expanded card */}
      <AnimatePresence>
        {activeCard && (
          <ActiveCard activeCard={activeCard} setActiveCard={setActiveCard} />
        )}
      </AnimatePresence>
    </div>
  );
}

const CARDS: Card[] = [
  {
    title: "Game Title",
    description: "A brief description",
    longDescription: "Full description with more details about the game...",
    image: "/game-image.webp",
  },
];
