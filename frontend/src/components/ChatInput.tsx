import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { spring } from '../ui/motion';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled = false }) => {
  const [inputText, setInputText] = useState('');
  const [focused, setFocused] = useState(false);
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

  const canSend = Boolean(inputText.trim()) && !disabled;

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full shrink-0"
      style={{ padding: 'clamp(8px, 2.5vw, 16px)', maxWidth: '100%' }}
    >
      <div className="w-full mx-auto" style={{ maxWidth: '672px' }}>
        <motion.div
          animate={{
            scale: focused ? 1.01 : 1,
            boxShadow: focused
              ? '0 0 0 1px rgba(255, 255, 255, 0.12), 0 10px 34px rgba(255, 255, 255, 0.07)'
              : '0 10px 34px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.4)',
          }}
          transition={spring}
          className={`relative flex items-end bg-surface-card rounded-4xl border-2 min-w-0
                      transition-colors duration-200 ${focused ? 'border-white/30' : 'border-white/[0.07]'}`}
        >
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="I ate 2 bananas and 3 eggs…"
            rows={1}
            disabled={disabled}
            aria-label="Describe what you ate"
            className="w-full bg-transparent text-fg-strong placeholder-fg-dim font-semibold
                       focus:outline-none resize-none leading-relaxed self-center disabled:opacity-60"
            style={{
              paddingTop: 'clamp(12px, 2.6vw, 16px)',
              paddingBottom: 'clamp(12px, 2.6vw, 16px)',
              paddingLeft: 'clamp(16px, 3.6vw, 22px)',
              paddingRight: 'clamp(52px, 12vw, 62px)',
              fontSize: 'var(--fs-sm)',
              minHeight: 'clamp(48px, 9vw, 58px)',
            }}
          />

          <motion.button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            animate={{
              scale: canSend ? 1 : 0.86,
              opacity: canSend ? 1 : 0.55,
            }}
            whileHover={canSend ? { scale: 1.1 } : undefined}
            whileTap={canSend ? { scale: 0.9 } : undefined}
            transition={spring}
            className={`absolute right-2 bottom-2 rounded-full flex items-center justify-center shrink-0
                        transition-colors duration-200 ${
                          canSend ? 'grad-accent shadow-glow' : 'bg-surface-raised text-fg-dim'
                        }`}
            style={{
              width: 'var(--avatar-sm)',
              height: 'var(--avatar-sm)',
              aspectRatio: '1',
            }}
          >
            <ArrowUp style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} strokeWidth={2.6} />
          </motion.button>
        </motion.div>
      </div>
    </form>
  );
};
