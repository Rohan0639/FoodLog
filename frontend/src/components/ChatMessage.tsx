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

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`flex w-full gap-2 sm:gap-3 py-2.5 sm:py-3 animate-slide-up ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
      style={{ paddingInline: 'clamp(8px, 3vw, 16px)' }}
    >
      {/* ── Avatar ── */}
      <div
        className="rounded-xl flex items-center justify-center shrink-0 shadow-sm border bg-zinc-900 border-zinc-800 text-white"
        style={{
          width: 'var(--avatar-sm)',
          height: 'var(--avatar-sm)',
          aspectRatio: '1',
          minWidth: 'var(--avatar-sm)',
        }}
      >
        {isUser
          ? <User style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
          : <Bot  style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
        }
      </div>

      {/* ── Bubble Container ── */}
      <div
        className={`flex flex-col gap-1 min-w-0 ${isUser ? 'items-end' : 'items-start'}`}
        style={{ maxWidth: 'min(92%, 480px)' }}
      >
        {/* Actual Bubble */}
        <div
          className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl leading-relaxed shadow-sm break-words w-full ${
            isUser
              ? 'bg-white text-black font-semibold rounded-tr-none'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-none'
          }`}
          style={{ fontSize: 'var(--fs-base)' }}
        >
          {message.isTyping ? (
            <div className="flex items-center gap-1.5 py-1 px-0.5">
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-typing" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-typing" style={{ animationDelay: '200ms' }} />
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-typing" style={{ animationDelay: '400ms' }} />
            </div>
          ) : (
            <div>{message.text}</div>
          )}
        </div>

        {/* Review & Confirm Table */}
        {!message.isTyping &&
          message.pendingFoods &&
          activeFoods &&
          setActiveFoods &&
          onConfirm &&
          onDiscard && (
            <ReviewConfirmTable
              foods={activeFoods}
              setFoods={setActiveFoods}
              onConfirm={onConfirm}
              onDiscard={onDiscard}
              disabled={isActionDisabled}
            />
          )}

        {/* Parsed Food Receipt */}
        {!message.isTyping &&
          message.parsedFoods &&
          message.parsedFoods.length > 0 && (
            <div className="w-full mt-2 rounded-xl bg-zinc-950 border border-zinc-800 p-2.5 sm:p-3.5 space-y-3 shadow-inner animate-fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <span
                  className="font-bold text-zinc-300 tracking-wide uppercase flex items-center gap-1.5"
                  style={{ fontSize: 'var(--fs-xs)' }}
                >
                  <Apple style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-white" />
                  Parsed Food Logs
                </span>
                <span
                  className="font-bold bg-white text-black px-2 py-0.5 rounded-full border border-zinc-200 flex items-center gap-1"
                  style={{ fontSize: 'var(--fs-xs)' }}
                >
                  <Flame style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-black fill-black/10" />
                  {message.parsedFoods.reduce((acc, curr) => acc + curr.calories, 0)} kcal
                </span>
              </div>

              <div className="space-y-2.5">
                {message.parsedFoods.map((food: FoodItem) => (
                  <div key={food.id} className="flex flex-col text-zinc-300" style={{ fontSize: 'var(--fs-xs)' }}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold flex items-center gap-1 truncate max-w-[75%] text-zinc-200">
                        <ChevronRight style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-zinc-500 shrink-0" />
                        <span className="text-zinc-400 font-semibold">{food.quantity}x</span> {food.name}
                      </span>
                      <span className="font-bold text-white shrink-0">{food.calories} kcal</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-zinc-400 pl-4 font-medium" style={{ fontSize: 'var(--fs-xs)' }}>
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
        <span
          className="text-zinc-500 mt-1 px-1 font-mono uppercase"
          style={{ fontSize: 'var(--fs-xs)' }}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
};
