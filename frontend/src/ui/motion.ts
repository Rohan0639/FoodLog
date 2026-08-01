import type { Transition, Variants } from 'framer-motion';

/**
 * One animation vocabulary for the whole app.
 *
 * Every component imports from here rather than inventing its own timings, so
 * the interface moves as a single system. All of these animate `transform` and
 * `opacity` only — both GPU-compositable, which is what keeps interactions at
 * 60fps on a mid-range phone.
 */

// ── Transitions ────────────────────────────────────────────────────────────
export const spring: Transition = { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 };
export const springSoft: Transition = { type: 'spring', stiffness: 220, damping: 26 };
export const springBouncy: Transition = { type: 'spring', stiffness: 500, damping: 18, mass: 0.7 };
export const ease: Transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] };
export const easeFast: Transition = { duration: 0.18, ease: [0.22, 1, 0.36, 1] };

// ── Interaction presets — applied to every tappable surface ────────────────
export const tapScale = { scale: 0.95 };
export const hoverLift = { y: -3, transition: easeFast };
export const pressable = { whileHover: hoverLift, whileTap: tapScale };

// ── Entrances ──────────────────────────────────────────────────────────────
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: ease },
  exit: { opacity: 0, transition: easeFast },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: ease },
  exit: { opacity: 0, y: -8, transition: easeFast },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: springBouncy },
  exit: { opacity: 0, scale: 0.94, transition: easeFast },
};

/** Cards rising into place. */
export const cardIn: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
  exit: { opacity: 0, y: -10, scale: 0.98, transition: easeFast },
};

/** Parent that deals its children out one after another. */
export const stagger = (staggerChildren = 0.06, delayChildren = 0.02): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren, delayChildren } },
  exit: {},
});

/** Screen-level transition for the mobile tab switch. */
export const pageIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16 } },
};

/** Chat bubbles: the sender's side decides which way they lean in from. */
export const bubbleIn = (isUser: boolean): Variants => ({
  hidden: { opacity: 0, y: 14, scale: 0.94, x: isUser ? 12 : -12 },
  show: { opacity: 1, y: 0, scale: 1, x: 0, transition: spring },
  exit: { opacity: 0, scale: 0.96, transition: easeFast },
});

/** Modal/sheet backdrop + panel. */
export const backdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
};

export const modalPanel: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 24 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.95, y: 16, transition: easeFast },
};

/** Bottom sheet on small screens. */
export const sheetPanel: Variants = {
  hidden: { y: '100%' },
  show: { y: 0, transition: { type: 'spring', stiffness: 300, damping: 32 } },
  exit: { y: '100%', transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } },
};

/** Expand/collapse without a hard-coded height. */
export const collapse: Variants = {
  hidden: { height: 0, opacity: 0 },
  show: { height: 'auto', opacity: 1, transition: { height: springSoft, opacity: { duration: 0.2, delay: 0.05 } } },
  exit: { height: 0, opacity: 0, transition: { height: easeFast, opacity: { duration: 0.12 } } },
};

/** Calendar month slide — direction is +1 forward, -1 back. */
export const monthSlide = {
  enter: (dir: number) => ({ x: dir > 0 ? 44 : -44, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: ease },
  exit: (dir: number) => ({ x: dir > 0 ? -44 : 44, opacity: 0, transition: easeFast }),
};

/** List rows that add and remove. */
export const listItem: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
  exit: { opacity: 0, x: -24, scale: 0.95, transition: easeFast },
};
