import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Lightbulb, ArrowRight } from 'lucide-react';
import { cardIn, spring, stagger } from '../ui/motion';

interface EmptyStateProps {
  onSelectSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  { text: 'I ate 2 bananas and 3 eggs', category: 'Breakfast', icon: '🍳', tint: 'bg-white/10' },
  { text: 'Logged a black coffee and chocolate chip cookie', category: 'Snack', icon: '🍪', tint: 'bg-white/10' },
  { text: 'I had 150g chicken breast and sweet potato for lunch', category: 'Lunch', icon: '🥗', tint: 'bg-white/10' },
  { text: '1 cup of blueberries and an avocado', category: 'Healthy snack', icon: '🥑', tint: 'bg-white/10' },
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectSuggestion }) => {
  return (
    <motion.div
      variants={stagger(0.07, 0.05)}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center justify-center text-center h-full w-full mx-auto"
      style={{ padding: 'clamp(16px, 4vw, 40px)', maxWidth: '520px' }}
    >
      {/* Mascot */}
      <motion.div variants={cardIn} className="relative mb-5">
        <motion.div
          animate={{ y: [0, -9, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          className="rounded-4xl grad-accent flex items-center justify-center shadow-glow-lg text-4xl"
          style={{ width: 'clamp(76px, 18vw, 96px)', height: 'clamp(76px, 18vw, 96px)' }}
        >
          <span role="img" aria-label="salad">🥗</span>
        </motion.div>

        <motion.div
          animate={{ scale: [1, 1.18, 1], rotate: [0, 14, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-2 -right-2 bg-surface-card rounded-full flex items-center justify-center shadow-soft-md w-9 h-9"
        >
          <Sparkles className="w-4 h-4 text-accent fill-white/30" />
        </motion.div>
      </motion.div>

      <motion.h2
        variants={cardIn}
        className="font-extrabold text-fg-strong mb-2"
        style={{ fontSize: 'var(--fs-xl)' }}
      >
        What did you eat <span className="text-grad-accent">today?</span>
      </motion.h2>

      <motion.p
        variants={cardIn}
        className="text-fg-muted font-semibold mb-7 leading-relaxed"
        style={{ fontSize: 'var(--fs-sm)', maxWidth: 'min(340px, 84vw)' }}
      >
        Describe your meal in plain words — I'll work out the calories and macros for you.
      </motion.p>

      {/* Suggestions */}
      <motion.div variants={cardIn} className="w-full space-y-2.5">
        <div
          className="flex items-center gap-1.5 font-extrabold text-fg-dim mb-2 px-1"
          style={{ fontSize: 'var(--fs-xs)' }}
        >
          <Lightbulb className="w-3.5 h-3.5 text-accent shrink-0" />
          <span>Tap one to try it</span>
        </div>

        {SUGGESTIONS.map((suggestion, index) => (
          <motion.button
            key={index}
            variants={cardIn}
            whileHover={{ scale: 1.02, y: -3 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            onClick={() => onSelectSuggestion(suggestion.text)}
            className="w-full text-left rounded-3xl bg-surface-card border-2 border-white/[0.06]
                       hover:border-white/25 shadow-soft hover:shadow-float
                       transition-colors duration-200 group flex items-center gap-3 p-3 touch-manipulation"
          >
            <span
              className={`${suggestion.tint} rounded-2xl flex items-center justify-center shrink-0 text-xl w-11 h-11`}
              role="img"
              aria-hidden
            >
              {suggestion.icon}
            </span>

            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-fg-dim mb-0.5" style={{ fontSize: '11px' }}>
                {suggestion.category}
              </p>
              <p
                className="font-bold text-fg-strong truncate"
                style={{ fontSize: 'var(--fs-sm)' }}
              >
                {suggestion.text}
              </p>
            </div>

            <motion.span
              className="shrink-0 w-7 h-7 rounded-full bg-surface-inset text-fg-dim
                         group-hover:bg-accent group-hover:text-surface-base
                         flex items-center justify-center transition-colors duration-200"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.span>
          </motion.button>
        ))}
      </motion.div>

      <motion.div
        variants={cardIn}
        className="mt-6 flex items-center gap-2 text-fg-muted bg-surface-card/70 px-4 py-2 rounded-full shadow-soft font-bold"
        style={{ fontSize: 'var(--fs-xs)' }}
      >
        <span role="img" aria-hidden>💡</span>
        <span>Combine foods with “and” or “+”</span>
      </motion.div>
    </motion.div>
  );
};
