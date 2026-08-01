import { useCallback, useEffect, useState } from 'react';
import type { Message } from '../types';
import { chatService } from '../lib/services';

export const WELCOME_TEXT =
  "Hello! I'm your digital food diary assistant. Tell me what you ate today (e.g., \"I had 2 bananas and 3 eggs\") and I'll analyze and log the nutrients for you.";

export function createWelcomeMessage(): Message {
  return {
    id: 'welcome',
    sender: 'bot',
    text: WELCOME_TEXT,
    timestamp: new Date(),
  };
}

function loadDay(date: string): Message[] {
  const stored = chatService.getMessages(date);
  return stored.length > 0 ? stored : [createWelcomeMessage()];
}

/**
 * The chat transcript for a given day, persisted through the chat service.
 *
 * Replaces three lazy localStorage reads and one write effect that were inlined
 * in Dashboard.
 *
 * The transcript and the day it belongs to are held in a single state object,
 * and swapped together during render when the day rolls over. Keeping them in
 * separate pieces of state would leave a window where the previous day's
 * messages could be written under the new day's key.
 */
export function useChatMessages(date: string) {
  const [state, setState] = useState<{ date: string; messages: Message[] }>(() => ({
    date,
    messages: loadDay(date),
  }));

  if (state.date !== date) {
    setState({ date, messages: loadDay(date) });
  }

  const setMessages = useCallback<React.Dispatch<React.SetStateAction<Message[]>>>((update) => {
    setState((prev) => ({
      ...prev,
      messages: typeof update === 'function' ? update(prev.messages) : update,
    }));
  }, []);

  useEffect(() => {
    if (state.date !== date) return;
    chatService.saveMessages(state.date, state.messages);
  }, [state, date]);

  useEffect(() => {
    chatService.pruneChats(date);
  }, [date]);

  return { messages: state.messages, setMessages };
}
