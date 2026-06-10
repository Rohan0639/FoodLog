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
    <div className="flex flex-col items-center justify-center text-center p-4 py-8 sm:p-8 sm:py-16 h-full max-w-md mx-auto animate-slide-up">
      {/* Visual Icon */}
      <div className="relative mb-5 sm:mb-6">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-zinc-900 flex items-center justify-center border border-zinc-800 text-white shadow-sm">
          <Apple className="w-7 h-7 sm:w-8 sm:h-8" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center animate-pulse border border-black shadow">
          <Sparkles className="w-2.5 h-2.5 text-black" />
        </div>
      </div>

      {/* Hero Title */}
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2 font-sans">
        FoodLog Assistant
      </h2>
      <p className="text-xs sm:text-sm text-zinc-400 mb-6 sm:mb-8 max-w-xs">
        Log your meals naturally. Type exactly what you ate, and let the assistant compute your macros.
      </p>

      {/* Suggested prompts */}
      <div className="w-full space-y-3">
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-zinc-450 uppercase tracking-wider mb-1 px-1 justify-start">
          <MessageSquarePlus className="w-3.5 h-3.5 text-zinc-400" />
          <span>Quick Log Examples</span>
        </div>
        
        {SUGGESTIONS.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelectSuggestion(suggestion.text)}
            className="w-full text-left p-2.5 min-[370px]:p-3 sm:p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900 hover:border-zinc-700 transition-all duration-200 group flex items-start gap-2.5 min-[370px]:gap-3.5 shadow-sm"
          >
            <span className="text-lg sm:text-xl leading-none pt-0.5" role="img" aria-label="emoji">
              {suggestion.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 mb-0.5">
                {suggestion.category}
              </p>
              <p className="text-xs sm:text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors truncate">
                "{suggestion.text}"
              </p>
            </div>
            <span className="self-center text-zinc-500 group-hover:text-white transition-colors pl-2">
              <Plus className="w-4 h-4" />
            </span>
          </button>
        ))}
      </div>

      {/* Tips footer */}
      <div className="mt-6 sm:mt-8 flex items-center gap-2 text-[10px] sm:text-xs text-zinc-400 bg-zinc-900/40 px-3 py-1.5 rounded-full border border-zinc-800">
        <Flame className="w-3.5 h-3.5 text-white" />
        <span>Try mixing multiple foods with "and" or "+"</span>
      </div>
    </div>
  );
};
