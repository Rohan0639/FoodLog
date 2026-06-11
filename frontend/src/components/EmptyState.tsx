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
          className="rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800 text-white shadow-sm"
          style={{ width: 'var(--avatar-md)', height: 'var(--avatar-md)', aspectRatio: '1' }}
        >
          <Apple style={{ width: 'var(--icon-lg)', height: 'var(--icon-lg)' }} />
        </div>
        <div className="absolute -top-1 -right-1 bg-white rounded-full flex items-center justify-center animate-pulse border border-black shadow" style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)', aspectRatio: '1' }}>
          <Sparkles style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-black" />
        </div>
      </div>

      {/* Hero Title */}
      <h2 className="font-bold tracking-tight text-white mb-2 font-sans" style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)' }}>
        FoodLog Assistant
      </h2>
      <p className="text-zinc-400 mb-6 sm:mb-8" style={{ fontSize: 'var(--fs-sm)', maxWidth: 'min(300px, 80vw)' }}>
        Log your meals naturally. Type exactly what you ate, and let the assistant compute your macros.
      </p>

      {/* Suggested prompts */}
      <div className="w-full space-y-2">
        <div
          className="flex items-center gap-2 font-semibold text-zinc-400 uppercase tracking-wider mb-1 px-1 justify-start"
          style={{ fontSize: 'var(--fs-xs)' }}
        >
          <MessageSquarePlus style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-zinc-400 shrink-0" />
          <span>Quick Log Examples</span>
        </div>

        {SUGGESTIONS.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelectSuggestion(suggestion.text)}
            className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900 hover:border-zinc-700 transition-all duration-200 group flex items-start shadow-sm"
            style={{ padding: 'clamp(8px, 2vw, 14px)', gap: 'clamp(8px, 2vw, 14px)' }}
          >
            <span
              className="leading-none pt-0.5 shrink-0"
              role="img"
              aria-label="emoji"
              style={{ fontSize: 'clamp(1rem, 3.5vw, 1.25rem)' }}
            >
              {suggestion.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-zinc-500 mb-0.5" style={{ fontSize: 'var(--fs-xs)' }}>
                {suggestion.category}
              </p>
              <p className="font-semibold text-zinc-200 group-hover:text-white transition-colors truncate" style={{ fontSize: 'var(--fs-sm)' }}>
                "{suggestion.text}"
              </p>
            </div>
            <span className="self-center text-zinc-500 group-hover:text-white transition-colors shrink-0">
              <Plus style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
            </span>
          </button>
        ))}
      </div>

      {/* Tips footer */}
      <div className="mt-5 flex items-center gap-2 text-zinc-400 bg-zinc-900/40 px-3 py-1.5 rounded-full border border-zinc-800" style={{ fontSize: 'var(--fs-xs)' }}>
        <Flame style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-white shrink-0" />
        <span>Try mixing multiple foods with "and" or "+"</span>
      </div>
    </div>
  );
};
