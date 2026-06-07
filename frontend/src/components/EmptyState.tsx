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
    <div className="flex flex-col items-center justify-center text-center p-8 py-16 h-full max-w-md mx-auto animate-slide-up">
      {/* Visual Icon */}
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
          <Apple className="w-8 h-8" />
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center animate-pulse">
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </div>
      </div>

      {/* Hero Title */}
      <h2 className="text-2xl font-bold tracking-tight text-white mb-2 font-sans">
        FoodLog AI Assistant
      </h2>
      <p className="text-sm text-slate-400 mb-8 max-w-xs">
        Log your meals naturally. Type exactly what you ate, and let the AI compute your macros.
      </p>

      {/* Suggested prompts */}
      <div className="w-full space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 justify-start">
          <MessageSquarePlus className="w-3.5 h-3.5" />
          <span>Quick Log Examples</span>
        </div>
        
        {SUGGESTIONS.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelectSuggestion(suggestion.text)}
            className="w-full text-left p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:bg-slate-850 hover:border-slate-700/80 transition-all duration-200 group flex items-start gap-3.5 shadow-sm"
          >
            <span className="text-xl leading-none pt-0.5" role="img" aria-label="emoji">
              {suggestion.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-500 mb-0.5">
                {suggestion.category}
              </p>
              <p className="text-sm font-medium text-slate-200 group-hover:text-emerald-400 transition-colors truncate">
                "{suggestion.text}"
              </p>
            </div>
            <span className="self-center text-slate-600 group-hover:text-emerald-400 transition-colors pl-2">
              <Plus className="w-4 h-4" />
            </span>
          </button>
        ))}
      </div>

      {/* Tips footer */}
      <div className="mt-8 flex items-center gap-2 text-xs text-slate-500 bg-slate-900/30 px-3 py-1.5 rounded-full border border-slate-900/50">
        <Flame className="w-3.5 h-3.5 text-orange-400" />
        <span>Try mixing multiple foods with "and" or "+"</span>
      </div>
    </div>
  );
};
