import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled = false }) => {
  const [inputText, setInputText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height to fit content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [inputText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || disabled) return;
    
    onSendMessage(inputText.trim());
    setInputText('');
    
    // Focus back on textarea after sending
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter, unless Shift is pressed (then insert new line)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-slate-950 border-t border-slate-900 flex gap-2 items-end max-w-2xl mx-auto w-full"
    >
      <div className="relative flex-1 flex items-center bg-slate-900 border border-slate-800 rounded-2xl focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all duration-200">
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="I ate 2 bananas and 3 eggs..."
          rows={1}
          disabled={disabled}
          className="w-full pl-4 pr-12 py-3 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-40 min-h-[44px] leading-relaxed self-center align-middle"
        />
        
        <button
          type="submit"
          disabled={!inputText.trim() || disabled}
          className={`absolute right-2.5 bottom-2 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
            inputText.trim() && !disabled
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10 hover:bg-emerald-600 scale-100 hover:scale-105 active:scale-95'
              : 'text-slate-600 cursor-not-allowed bg-transparent scale-90'
          }`}
        >
          <SendHorizontal className="w-4.5 h-4.5" />
        </button>
      </div>
    </form>
  );
};
