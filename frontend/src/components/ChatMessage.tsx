import React from 'react';
import type { Message, FoodItem, FoodEntry } from '../types';
import { Sparkles, User, Flame, ChevronRight, Apple } from 'lucide-react';
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
        className={`rounded-full flex items-center justify-center shrink-0 shadow-soft ${
          isUser
            ? 'bg-white text-black'
            : 'bg-zinc-800 border border-zinc-700 text-white'
        }`}
        style={{
          width: 'var(--avatar-sm)',
          height: 'var(--avatar-sm)',
          aspectRatio: '1',
          minWidth: 'var(--avatar-sm)',
        }}
      >
        {isUser
          ? <User style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
          : <Sparkles style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
        }
      </div>

      {/* ── Bubble Container ── */}
      <div
        className={`flex flex-col gap-1 min-w-0 ${isUser ? 'items-end' : 'items-start'}`}
        style={{ maxWidth: 'min(92%, 480px)' }}
      >
        {/* Actual Bubble */}
        <div
          className={`px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-3xl leading-relaxed break-words w-full ${
            isUser
              ? 'bg-white text-black font-medium rounded-tr-lg shadow-soft-md'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-lg shadow-soft'
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
            <div className="w-full mt-2 rounded-2xl bg-zinc-900 border border-zinc-800 p-3 sm:p-4 space-y-3 shadow-soft animate-fade-in">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
                <span
                  className="font-bold text-zinc-400 flex items-center gap-1.5"
                  style={{ fontSize: 'var(--fs-xs)' }}
                >
                  <Apple style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-white" />
                  Logged Foods
                </span>
                <span
                  className="chip font-bold bg-white text-black px-2.5 py-1 num"
                  style={{ fontSize: 'var(--fs-xs)' }}
                >
                  <Flame style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-black fill-black/10" />
                  {message.parsedFoods.reduce((acc, curr) => acc + curr.calories, 0)} kcal
                </span>
              </div>

              <div className="space-y-2.5">
                {message.parsedFoods.map((food: FoodItem) => (
                  <div key={food.id} className="flex flex-col text-zinc-400" style={{ fontSize: 'var(--fs-xs)' }}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold flex items-center gap-1 truncate max-w-[75%] text-zinc-200 capitalize">
                        <ChevronRight style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} className="text-zinc-500 shrink-0" />
                        <span className="text-zinc-500 font-semibold num">{food.quantity}x</span> {food.name}
                      </span>
                      <span className="font-bold text-white shrink-0 num">{food.calories} kcal</span>
                    </div>
                    <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-zinc-500 pl-4 font-medium num" style={{ fontSize: 'var(--fs-xs)' }}>
                      <span>Protein <strong className="text-zinc-300 font-semibold">{food.protein}g</strong></span>
                      <span>Carbs <strong className="text-zinc-300 font-semibold">{food.carbs}g</strong></span>
                      <span>Fat <strong className="text-zinc-300 font-semibold">{food.fats}g</strong></span>
                      <span>Sugar <strong className="text-zinc-300 font-semibold">{food.sugar || 0}g</strong></span>
                      <span>Fiber <strong className="text-zinc-300 font-semibold">{food.fiber || 0}g</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Timestamp */}
        <span
          className="text-zinc-600 mt-0.5 px-1.5 font-medium num"
          style={{ fontSize: 'var(--fs-xs)' }}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
};
