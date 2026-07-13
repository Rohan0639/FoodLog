import React from 'react';
import { Apple, MessageSquarePlus, Sparkles, Flame, Plus } from 'lucide-react';

interface EmptyStateProps {
  onSelectSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  { text: 'I ate 2 bananas and 3 eggs', category: 'Breakfast', icon: '🍳' },
  { text: 'Logged a black coffee and chocolate chip cookie', category: 'Snack', icon: '🍪' },
  { text: 'I had 150g chicken breast and sweet potato for lunch', category: 'Lunch', icon: '🥗' },
  { text: '1 cup of blueberries and an avocado', category: 'Healthy Snack', icon: '🥑' },
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectSuggestion }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full w-full mx-auto animate-slide-up" style={{ padding: 'clamp(16px, 4vw, 48px)', maxWidth: '480px' }}>
      {/* Visual Icon */}
      <div className="relative mb-5 sm:mb-6">
        <div
          className="rounded-2xl bg-white flex items-center justify-center text-black shadow-white-sm"
          style={{ width: 'clamp(52px, 12vw, 64px)', height: 'clamp(52px, 12vw, 64px)', aspectRatio: '1' }}
        >
          <Apple style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)' }} className="fill-black/10" />
        </div>
        <div className="absolute -top-1.5 -right-1.5 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-700 shadow-soft" style={{ width: 'clamp(20px, 5vw, 24px)', height: 'clamp(20px, 5vw, 24px)', aspectRatio: '1' }}>
          <Sparkles style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-white" />
        </div>
      </div>

      {/* Hero Title */}
      <h2 className="font-bold tracking-tight text-white mb-2 font-sans" style={{ fontSize: 'clamp(1.2rem, 4.5vw, 1.65rem)' }}>
        What did you eat today?
      </h2>
      <p className="text-zinc-400 mb-6 sm:mb-8 leading-relaxed" style={{ fontSize: 'var(--fs-sm)', maxWidth: 'min(320px, 82vw)' }}>
        Just describe your meal in plain words — we'll figure out the calories and macros for you.
      </p>

      {/* Suggested prompts */}
      <div className="w-full space-y-2.5">
        <div
          className="flex items-center gap-2 font-semibold text-zinc-500 mb-1 px-1 justify-start"
          style={{ fontSize: 'var(--fs-xs)' }}
        >
          <MessageSquarePlus style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-zinc-500 shrink-0" />
          <span>Try one of these</span>
        </div>

        {SUGGESTIONS.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelectSuggestion(suggestion.text)}
            className="w-full text-left rounded-2xl border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:shadow-soft-md transition-all duration-200 group flex items-start shadow-soft"
            style={{ padding: 'clamp(10px, 2.5vw, 16px)', gap: 'clamp(10px, 2.5vw, 14px)' }}
          >
            <span
              className="leading-none pt-0.5 shrink-0 grayscale"
              role="img"
              aria-label="emoji"
              style={{ fontSize: 'clamp(1.1rem, 3.8vw, 1.35rem)' }}
            >
              {suggestion.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-zinc-500 mb-0.5" style={{ fontSize: 'var(--fs-xs)' }}>
                {suggestion.category}
              </p>
              <p className="font-medium text-zinc-200 group-hover:text-white transition-colors truncate" style={{ fontSize: 'var(--fs-sm)' }}>
                "{suggestion.text}"
              </p>
            </div>
            <span className="self-center text-zinc-600 group-hover:text-white transition-colors shrink-0">
              <Plus style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
            </span>
          </button>
        ))}
      </div>

      {/* Tips footer */}
      <div className="mt-6 flex items-center gap-2 text-zinc-400 bg-zinc-900 px-3.5 py-2 rounded-full border border-zinc-800 shadow-soft" style={{ fontSize: 'var(--fs-xs)' }}>
        <Flame style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-white shrink-0" />
        <span>Tip: mix multiple foods with "and" or "+"</span>
      </div>
    </div>
  );
};
