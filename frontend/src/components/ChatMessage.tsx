import React from 'react';
import type { Message, FoodItem, FoodEntry } from '../types';
import { Bot, User, Flame, ChevronRight, Apple } from 'lucide-react';
import { ReviewConfirmTable } from './ReviewConfirmTable';

interface ChatMessageProps {
  message: Message;
  activeFoods?: FoodEntry[];
  setActiveFoods?: React.Dispatch<React.SetStateAction<FoodEntry[]>>;
  onConfirm?: () => void;
  onDiscard?: () => void;
  isActionDisabled?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  activeFoods,
  setActiveFoods,
  onConfirm,
  onDiscard,
  isActionDisabled = false,
}) => {
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
            ? 'bg-zinc-900 border-zinc-800 text-white'
            : 'bg-zinc-900 border-zinc-800 text-white'
        }`}
      >
        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </div>

      {/* Message Bubble Container */}
      <div className={`flex flex-col max-w-[92%] sm:max-w-[80%] md:max-w-[75%] gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Actual Message Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-[14.5px] leading-relaxed shadow-sm ${
            isUser
              ? 'bg-white text-black font-semibold rounded-tr-none'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-none'
          }`}
        >
          {message.isTyping ? (
            /* Animated Typing Indicator */
            <div className="flex items-center gap-1.5 py-1 px-0.5">
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-typing" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-typing" style={{ animationDelay: '200ms' }} />
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-typing" style={{ animationDelay: '400ms' }} />
            </div>
          ) : (
            <div>{message.text}</div>
          )}
        </div>

        {/* Interactive Review & Confirm Table */}
        {!message.isTyping && message.pendingFoods && activeFoods && setActiveFoods && onConfirm && onDiscard && (
          <ReviewConfirmTable
            foods={activeFoods}
            setFoods={setActiveFoods}
            onConfirm={onConfirm}
            onDiscard={onDiscard}
            disabled={isActionDisabled}
          />
        )}

        {/* Parsed Food Receipt (if any) */}
        {!message.isTyping && message.parsedFoods && message.parsedFoods.length > 0 && (
          <div className="w-full mt-2 rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 sm:p-3.5 space-y-3 shadow-inner animate-fade-in">
            {/* Header info */}
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-xs font-bold text-zinc-300 tracking-wide uppercase flex items-center gap-1.5">
                <Apple className="w-3.5 h-3.5 text-white" />
                Parsed Food Logs
              </span>
              <span className="text-xs font-bold bg-white text-black px-2 py-0.5 rounded-full border border-zinc-200 flex items-center gap-1">
                <Flame className="w-3 h-3 text-black fill-black/10" />
                {message.parsedFoods.reduce((acc, curr) => acc + curr.calories, 0)} kcal
              </span>
            </div>

            {/* List of items */}
            <div className="space-y-2.5">
              {message.parsedFoods.map((food: FoodItem) => (
                <div key={food.id} className="flex flex-col text-xs text-zinc-300">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold flex items-center gap-1 truncate max-w-[80%] text-zinc-200">
                      <ChevronRight className="w-3 h-3 text-zinc-500 shrink-0" />
                      <span className="text-zinc-400 font-semibold">{food.quantity}x</span> {food.name}
                    </span>
                    <span className="font-bold text-white shrink-0">{food.calories} kcal</span>
                  </div>
                  {/* Macros line */}
                  <div className="flex gap-3 text-[10px] text-zinc-400 pl-4 font-medium">
                    <span>Protein: <strong className="text-zinc-300 font-semibold">{food.protein}g</strong></span>
                    <span>Carbs: <strong className="text-zinc-300 font-semibold">{food.carbs}g</strong></span>
                    <span>Fat: <strong className="text-zinc-300 font-semibold">{food.fats}g</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-zinc-500 mt-1 px-1 font-mono uppercase">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
};
