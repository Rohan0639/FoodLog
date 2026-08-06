import React from 'react';
import { motion } from 'framer-motion';
import type { Message, FoodItem, FoodEntry } from '../types';
import { Flame, Apple } from 'lucide-react';
import { ReviewConfirmTable } from './ReviewConfirmTable';
import { bubbleIn, spring, stagger, listItem } from '../ui/motion';
import { CountUp } from '../ui/primitives';

interface ChatMessageProps {
  message: Message;
  activeFoods?: FoodEntry[];
  setActiveFoods?: React.Dispatch<React.SetStateAction<FoodEntry[]>>;
  onConfirm?: () => void;
  onDiscard?: () => void;
  isActionDisabled?: boolean;
}

const MACROS: { key: keyof FoodItem; label: string; color: string }[] = [
  { key: 'protein', label: 'P', color: '#FFFFFF' },
  { key: 'carbs', label: 'C', color: '#DCDCE0' },
  { key: 'fats', label: 'F', color: '#B8B8C0' },
  { key: 'sugar', label: 'S', color: '#9A9AA3' },
  { key: 'fiber', label: 'Fib', color: '#7E7E88' },
];

/**
 * Memoised: a transcript can hold hundreds of bubbles, and every one of them
 * would otherwise re-render each time the typing indicator toggles or a review
 * quantity changes. Only the message being reviewed takes the non-undefined
 * `activeFoods`, so the rest bail out of rendering entirely.
 */
const ChatMessageBase: React.FC<ChatMessageProps> = ({
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
    <motion.div
      variants={bubbleIn(isUser)}
      initial="hidden"
      animate="show"
      exit="exit"
      layout
      className={`flex w-full gap-2 sm:gap-2.5 py-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      style={{ paddingInline: 'clamp(6px, 2.5vw, 14px)' }}
    >
      {/* ── Avatar ── */}
      <motion.div
        whileHover={{ scale: 1.1, rotate: isUser ? 8 : -8 }}
        transition={spring}
        className={`rounded-2xl flex items-center justify-center shrink-0 self-end mb-1 ${
          isUser ? 'grad-tile shadow-soft' : 'grad-accent shadow-glow'
        }`}
        style={{
          width: 'var(--avatar-sm)',
          height: 'var(--avatar-sm)',
          aspectRatio: '1',
          minWidth: 'var(--avatar-sm)',
        }}
      >
        <span className="text-base leading-none" role="img" aria-label={isUser ? 'you' : 'assistant'}>
          {isUser ? '🙂' : '🥑'}
        </span>
      </motion.div>

      {/* ── Bubble ── */}
      <div
        className={`flex flex-col gap-1 min-w-0 ${isUser ? 'items-end' : 'items-start'}`}
        style={{ maxWidth: 'min(88%, 500px)' }}
      >
        <motion.div
          layout
          className={`px-4 py-3 leading-relaxed break-words w-full font-semibold shadow-soft ${
            isUser
              ? 'grad-accent rounded-3xl rounded-br-lg'
              : 'bg-surface-card text-fg-strong rounded-3xl rounded-bl-lg'
          }`}
          style={{ fontSize: 'var(--fs-sm)' }}
        >
          {/* An attached nutrition label, shown as part of the message */}
          {message.attachmentUrl && (
            <img
              src={message.attachmentUrl}
              alt="Attached nutrition label"
              className="w-full max-w-[180px] rounded-2xl mb-2 border border-black/10"
            />
          )}

          {message.isTyping ? (
            <div className="flex items-center gap-1.5 py-1 px-0.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-2 h-2 rounded-full bg-accent-soft"
                  animate={{ y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                />
              ))}
            </div>
          ) : (
            <div>{message.text}</div>
          )}
        </motion.div>

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

        {/* Logged receipt */}
        {!message.isTyping && message.parsedFoods && message.parsedFoods.length > 0 && (
          <motion.div
            variants={stagger(0.05)}
            initial="hidden"
            animate="show"
            className="w-full mt-1.5 rounded-3xl bg-surface-card p-3.5 space-y-3 shadow-soft border-2 border-white/10"
          >
            <motion.div
              variants={listItem}
              className="flex items-center justify-between pb-2.5 border-b-2 border-surface-inset"
            >
              <span className="font-extrabold text-fg-muted flex items-center gap-1.5 text-xs">
                <Apple className="w-3.5 h-3.5 text-accent" />
                Logged
              </span>
              <span className="chip grad-accent px-3 py-1.5 text-xs shadow-glow">
                <Flame className="w-3.5 h-3.5" />
                <CountUp
                  value={message.parsedFoods.reduce((acc, curr) => acc + curr.calories, 0)}
                  suffix=" kcal"
                />
              </span>
            </motion.div>

            <div className="space-y-2.5">
              {message.parsedFoods.map((food: FoodItem) => (
                <motion.div key={food.id} variants={listItem} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-extrabold text-fg-strong capitalize truncate text-xs">
                      <span className="text-fg-dim num">{food.quantity}× </span>
                      {food.name}
                    </span>
                    <span className="font-extrabold text-accent shrink-0 num text-xs">
                      {food.calories} kcal
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {MACROS.map((macro) => (
                      <span
                        key={macro.label}
                        className="chip px-2 py-0.5 text-[10px]"
                        style={{ backgroundColor: `${macro.color}1A`, color: macro.color }}
                      >
                        {macro.label} {Number(food[macro.key] ?? 0)}g
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Timestamp */}
        <span className="text-fg-dim px-1.5 font-bold num text-[10px]">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </motion.div>
  );
};

export const ChatMessage = React.memo(ChatMessageBase);
