/**
 * Teaching layer on top of the animation artifacts — what each recording
 * teaches, which techniques appear, who it's for. Keyed by animation slug
 * (matches the ec_animations.slug column).
 */

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface AnimationLesson {
  difficulty: Difficulty;
  /** Short, noun-phrase summary of what the animation is (1 line). */
  subtitle: string;
  /** Estimated time to watch the build through at 1× play speed. */
  duration: string;
  /** Concept slugs — small set, matches /hogwarts/quidditch/techniques/[slug]. */
  techniques: TechniqueSlug[];
  /** 3–5 specific skills a viewer walks away with. */
  learnings: string[];
  /** Concepts the viewer should already know — can be empty for beginners. */
  prerequisites: string[];
  /** Optional "why this matters" — one sentence. */
  whyItMatters?: string;
}

export type TechniqueSlug =
  | "css-keyframes"
  | "offset-path"
  | "mix-blend-mode"
  | "svg-path"
  | "svg-filters"
  | "stroke-dasharray"
  | "css-3d-transform"
  | "prefers-reduced-motion"
  | "staggered-animation"
  | "radial-gradient"
  | "css-steps"
  | "sprite-sheet"
  | "image-rendering-pixelated";

export interface Technique {
  slug: TechniqueSlug;
  name: string;
  blurb: string;
  mdnUrl?: string;
}

export const TECHNIQUES: Record<TechniqueSlug, Technique> = {
  "css-keyframes": {
    slug: "css-keyframes",
    name: "CSS @keyframes",
    blurb: "Declarative time-based animation syntax. Defines named motion curves you attach to elements.",
    mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/CSS/@keyframes",
  },
  "offset-path": {
    slug: "offset-path",
    name: "offset-path + offset-rotate",
    blurb: "Make any element follow an SVG path. Combined with offset-rotate:auto, the element rotates to match the heading along the curve.",
    mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/CSS/offset-path",
  },
  "mix-blend-mode": {
    slug: "mix-blend-mode",
    name: "mix-blend-mode",
    blurb: "Control how an element's colors blend with what's behind. 'screen' brightens — perfect for glowing trails on dark backgrounds.",
    mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode",
  },
  "svg-path": {
    slug: "svg-path",
    name: "SVG <path>",
    blurb: "The workhorse of vector graphics. Bezier + cubic curves via M/C/S/T commands let you describe any shape or flight line.",
    mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths",
  },
  "svg-filters": {
    slug: "svg-filters",
    name: "SVG <filter>",
    blurb: "Declarative image processing built into SVG. feGaussianBlur, feDisplacementMap, feTurbulence compose into glow + roughness effects.",
    mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/SVG/Element/filter",
  },
  "stroke-dasharray": {
    slug: "stroke-dasharray",
    name: "stroke-dasharray draw-in",
    blurb: "Animate stroke-dashoffset from path-length to 0 to 'draw' an SVG stroke on the fly. A foundational technique for hand-drawn reveals.",
    mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/stroke-dasharray",
  },
  "css-3d-transform": {
    slug: "css-3d-transform",
    name: "CSS 3D transforms",
    blurb: "rotateY, perspective, preserve-3d turn 2D elements into unfolding planes. Essential for the parchment-unfold effect.",
    mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_transforms",
  },
  "prefers-reduced-motion": {
    slug: "prefers-reduced-motion",
    name: "prefers-reduced-motion",
    blurb: "User preference that lets people with vestibular sensitivity opt out of motion. Every recording here demonstrates the fallback.",
    mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion",
  },
  "staggered-animation": {
    slug: "staggered-animation",
    name: "Staggered animation-delay",
    blurb: "Negative animation-delay phase-shifts identical animations along the same timeline. A dozen trail dots, zero extra keyframes.",
  },
  "radial-gradient": {
    slug: "radial-gradient",
    name: "radial-gradient",
    blurb: "Gradient that radiates from a point. Used for the snitch body highlight, the parchment vignette, and the stage atmosphere.",
    mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/radial-gradient",
  },
  "css-steps": {
    slug: "css-steps",
    name: "steps() timing function",
    blurb: "Snaps an animation to discrete frames instead of interpolating smoothly. The core trick behind sprite-sheet animation — each step jumps one frame.",
    mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/steps",
  },
  "sprite-sheet": {
    slug: "sprite-sheet",
    name: "Sprite sheet animation",
    blurb: "Pack N frames into one image, then animate background-position across them. 1970s arcade technique, still the lightest way to do pixel-art motion on the web.",
  },
  "image-rendering-pixelated": {
    slug: "image-rendering-pixelated",
    name: "image-rendering: pixelated",
    blurb: "Tells the browser to use nearest-neighbor scaling instead of bilinear smoothing. Mandatory for pixel-art — without it, upscaled sprites turn to mush.",
    mdnUrl: "https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering",
  },
};

export const LESSONS: Record<string, AnimationLesson> = {
  placeholder: {
    difficulty: "beginner",
    subtitle: "A spinning gold snitch — scaffolding proof, not a real lesson.",
    duration: "< 1 min",
    techniques: ["css-keyframes", "prefers-reduced-motion"],
    learnings: [
      "How @keyframes + animation-* properties compose into a single motion",
      "Why @media (prefers-reduced-motion: reduce) is the bare-minimum a11y stance",
    ],
    prerequisites: [],
    whyItMatters: "Every animation here respects reduced motion. This is the baseline.",
  },
  "snitch-trail": {
    difficulty: "intermediate",
    subtitle: "SVG path-following with a 10-orb shimmering trail and flapping wings.",
    duration: "~2 min",
    techniques: ["offset-path", "svg-path", "mix-blend-mode", "staggered-animation", "radial-gradient", "svg-filters", "prefers-reduced-motion"],
    learnings: [
      "How offset-path: path(…) makes any element follow an arbitrary SVG curve",
      "Why offset-rotate: auto is the difference between 'sliding' and 'flying' along a path",
      "How negative animation-delay + mix-blend-mode: screen produces a bright gold-on-dark shimmer from a handful of circles",
      "How to compose feGaussianBlur into a glow filter you can reuse across elements",
    ],
    prerequisites: ["Basic CSS keyframes", "Reading an SVG <path> d-attribute"],
    whyItMatters: "offset-path is the cleanest way to do path-following animation on the web. Once you see it, you stop reaching for JS tween libraries for this class of problem.",
  },
  "cat-walk": {
    difficulty: "beginner",
    subtitle: "A pixel-art cat walks across the ground — six-frame sprite sheet, pure CSS steps().",
    duration: "~2 min",
    techniques: ["sprite-sheet", "css-steps", "image-rendering-pixelated", "css-keyframes", "prefers-reduced-motion"],
    learnings: [
      "How steps(N) snaps background-position to discrete frames instead of tweening between them",
      "The background-size trick: set it to the TOTAL sheet width, not one frame, so the animation advances by frame width per step",
      "Why image-rendering: pixelated is mandatory when scaling pixel art — bilinear smoothing kills the look",
      "Composing TWO animations on the same element (the frame-step cycle + the cross-screen translate)",
      "How to vendor a CC0 sprite asset responsibly (license file, provenance note, attribution as courtesy)",
    ],
    prerequisites: ["Basic CSS animation", "Understanding of background-image / background-position"],
    whyItMatters: "This is the oldest trick in animation — flipbook frames advanced at fixed intervals — ported to the browser in 8 lines of CSS. Every pixel-art website, itch.io game, and retro UI uses this pattern.",
  },
  "marauders-map": {
    difficulty: "advanced",
    subtitle: "Three-panel parchment unfolds in 3D, corridor ink strokes draw in, 10 footprints trail across the castle.",
    duration: "~3 min",
    techniques: ["css-3d-transform", "stroke-dasharray", "svg-filters", "svg-path", "staggered-animation", "css-keyframes", "prefers-reduced-motion"],
    learnings: [
      "How rotateY + transform-origin + opacity compose into a credible 'unfolding' motion without a physics engine",
      "The stroke-dasharray / stroke-dashoffset trick for hand-drawing SVG strokes in sequence",
      "How to sequence many elements with only one @keyframes + staggered animation-delay",
      "Using feTurbulence + feDisplacementMap to give digital strokes an aged, hand-drawn roughness",
    ],
    prerequisites: ["Intermediate CSS", "Familiarity with SVG path + filter basics"],
    whyItMatters: "This is the pattern behind most 'interactive illustration' work on the web. Master this and you can build map animations, diagram reveals, and step-by-step visual explainers.",
  },
};

export function listByDifficulty(
  lessons: Record<string, AnimationLesson>,
): Array<{ slug: string; lesson: AnimationLesson }> {
  const order: Record<Difficulty, number> = { beginner: 0, intermediate: 1, advanced: 2 };
  return Object.entries(lessons)
    .sort((a, b) => order[a[1].difficulty] - order[b[1].difficulty])
    .map(([slug, lesson]) => ({ slug, lesson }));
}

export function animationsByTechnique(
  lessons: Record<string, AnimationLesson>,
  technique: TechniqueSlug,
): string[] {
  return Object.entries(lessons)
    .filter(([, l]) => l.techniques.includes(technique))
    .map(([slug]) => slug);
}
