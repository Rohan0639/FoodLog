import React from 'react';
import type { Message, FoodItem } from '../types';
import { Bot, User, Flame, ChevronRight, Apple } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  
  // Format timestamp (e.g. 15:08)
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`flex w-full gap-3 py-3 px-4 animate-slide-up ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${
          isUser
            ? 'bg-slate-850 border-emerald-500/20 text-emerald-400'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Message Bubble Container */}
      <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Actual Message Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-[14.5px] leading-relaxed shadow-sm ${
            isUser
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-tr-none'
              : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
          }`}
        >
          {message.isTyping ? (
            /* Animated Typing Indicator */
            <div className="flex items-center gap-1.5 py-1 px-0.5">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-typing" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-typing" style={{ animationDelay: '200ms' }} />
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-typing" style={{ animationDelay: '400ms' }} />
            </div>
          ) : (
            <div>{message.text}</div>
          )}
        </div>

        {/* Parsed Food Receipt (if any) */}
        {!message.isTyping && message.parsedFoods && message.parsedFoods.length > 0 && (
          <div className="w-full mt-2 rounded-xl bg-slate-900/60 border border-slate-800/80 p-3.5 space-y-3 shadow-inner animate-fade-in">
            {/* Header info */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
              <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase flex items-center gap-1.5">
                <Apple className="w-3.5 h-3.5 text-emerald-400" />
                Parsed Food Logs
              </span>
              <span className="text-xs font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <Flame className="w-3 h-3 text-orange-400 fill-orange-400/20" />
                {message.parsedFoods.reduce((acc, curr) => acc + curr.calories, 0)} kcal
              </span>
            </div>

            {/* List of items */}
            <div className="space-y-2.5">
              {message.parsedFoods.map((food: FoodItem) => (
                <div key={food.id} className="flex flex-col text-xs text-slate-300">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium flex items-center gap-1 truncate max-w-[80%]">
                      <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="text-slate-400 font-semibold">{food.quantity}x</span> {food.name}
                    </span>
                    <span className="font-bold text-slate-200 shrink-0">{food.calories} kcal</span>
                  </div>
                  {/* Macros line */}
                  <div className="flex gap-3 text-[10px] text-slate-500 pl-4">
                    <span>Protein: <strong className="text-slate-400 font-semibold">{food.protein}g</strong></span>
                    <span>Carbs: <strong className="text-slate-400 font-semibold">{food.carbs}g</strong></span>
                    <span>Fat: <strong className="text-slate-400 font-semibold">{food.fat}g</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-slate-500 mt-1 px-1 font-mono uppercase">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
};
