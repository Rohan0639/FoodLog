import React from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Message, FoodEntry } from '../types';
import type { PreparedImage } from '../utils/imageScan';
import { EmptyState } from './EmptyState';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

interface FoodLoggerProps {
  messages: Message[];
  logs: FoodEntry[];
  activeReviewMessageId: string | null;
  activeFoods: FoodEntry[];
  setActiveFoods: React.Dispatch<React.SetStateAction<FoodEntry[]>>;
  isBotTyping: boolean;
  onSendMessage: (text: string, image?: PreparedImage) => void;
  onConfirmLog: () => void;
  onDiscard: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  /** Enables attaching a nutrition label to a message. */
  allowAttachments?: boolean;
}

export default function FoodLogger({
  messages,
  logs,
  activeReviewMessageId,
  activeFoods,
  setActiveFoods,
  isBotTyping,
  onSendMessage,
  onConfirmLog,
  onDiscard,
  messagesEndRef,
  allowAttachments,
}: FoodLoggerProps) {
  const handleSelectSuggestion = (text: string) => {
    onSendMessage(text);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative min-h-0 min-w-0">
      {/* Chat thread */}
      <div
        className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full min-h-0"
        style={{ padding: 'clamp(6px, 2vw, 14px)' }}
      >
        {messages.length === 1 && logs.length === 0 ? (
          <EmptyState onSelectSuggestion={handleSelectSuggestion} />
        ) : (
          <div className="flex flex-col">
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  activeFoods={message.id === activeReviewMessageId ? activeFoods : undefined}
                  setActiveFoods={message.id === activeReviewMessageId ? setActiveFoods : undefined}
                  onConfirm={message.id === activeReviewMessageId ? onConfirmLog : undefined}
                  onDiscard={message.id === activeReviewMessageId ? onDiscard : undefined}
                  isActionDisabled={isBotTyping}
                />
              ))}

              {/* Bot typing simulation */}
              {isBotTyping && (
                <ChatMessage
                  key="typing"
                  message={{
                    id: 'typing',
                    sender: 'bot',
                    text: '',
                    timestamp: new Date(),
                    isTyping: true,
                  }}
                />
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating input */}
      <ChatInput
        onSendMessage={onSendMessage}
        disabled={isBotTyping || !!activeReviewMessageId}
        allowAttachments={allowAttachments}
      />
    </div>
  );
}
