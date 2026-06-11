import React from 'react';
import type { Message, FoodEntry } from '../types';
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
  onSendMessage: (text: string) => void;
  onConfirmLog: () => void;
  onDiscard: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
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
}: FoodLoggerProps) {
  const handleSelectSuggestion = (text: string) => {
    onSendMessage(text);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative min-h-0 min-w-0">
      {/* Chat Thread */}
      <div
        className="flex-1 overflow-y-auto space-y-2 max-w-2xl mx-auto w-full min-h-0"
        style={{ padding: 'clamp(8px, 2vw, 16px)' }}
      >
        {messages.length === 1 && logs.length === 0 ? (
          <EmptyState onSelectSuggestion={handleSelectSuggestion} />
        ) : (
          <div className="flex flex-col gap-1">
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
                message={{
                  id: 'typing',
                  sender: 'bot',
                  text: '',
                  timestamp: new Date(),
                  isTyping: true,
                }}
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Input Area */}
      <ChatInput onSendMessage={onSendMessage} disabled={isBotTyping || !!activeReviewMessageId} />
    </div>
  );
}
