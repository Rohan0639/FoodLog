import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled = false }) => {
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height to fit content — capped at 30dvh
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxH = Math.min(window.innerHeight * 0.30, 180);
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxH)}px`;
    }
  }, [inputText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || disabled) return;
    onSendMessage(inputText.trim());
    setInputText('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-black border-t border-zinc-900 flex gap-2 items-end w-full"
      style={{
        padding: 'clamp(8px, 2.5vw, 16px)',
        maxWidth: '100%',  /* never wider than viewport */
      }}
    >
      {/* Center-constrain input area, matching chat column width */}
      <div
        className="flex gap-2 items-end w-full mx-auto"
        style={{ maxWidth: '672px' }} /* matches max-w-2xl */
      >
        <div className="relative flex-1 flex items-center bg-zinc-950 border border-zinc-800 rounded-2xl focus-within:border-white focus-within:ring-2 focus-within:ring-white/10 transition-all duration-200 min-w-0">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="I ate 2 bananas and 3 eggs..."
            rows={1}
            disabled={disabled}
            className="w-full bg-transparent text-white placeholder-zinc-500 focus:outline-none resize-none leading-relaxed self-center"
            style={{
              paddingTop: 'clamp(10px, 2.5vw, 14px)',
              paddingBottom: 'clamp(10px, 2.5vw, 14px)',
              paddingLeft: 'clamp(12px, 3vw, 16px)',
              paddingRight: 'clamp(40px, 10vw, 52px)',
              fontSize: 'var(--fs-sm)',
              /* min-height uses dvh units so mobile keyboards don't break it */
              minHeight: 'clamp(40px, 8vw, 52px)',
            }}
          />

          <button
            type="submit"
            disabled={!inputText.trim() || disabled}
            className={`absolute right-2 bottom-2 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 ${
              inputText.trim() && !disabled
                ? 'bg-white text-black shadow hover:bg-zinc-200 scale-100 hover:scale-105 active:scale-95'
                : 'text-zinc-600 cursor-not-allowed bg-transparent scale-90'
            }`}
            style={{
              width: 'var(--avatar-sm)',
              height: 'var(--avatar-sm)',
              aspectRatio: '1',
            }}
          >
            <SendHorizontal style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
          </button>
        </div>
      </div>
    </form>
  );
};
