/**
 * Chat transcript persistence, keyed by local day.
 *
 * Replaces the per-day `chat_messages_<uid>_<date>` localStorage keys the
 * Dashboard used to read and write inline. Timestamps are stored as ISO strings
 * and revived as `Date` objects on read, which is what the UI expects.
 */

import { readDb, updateDb } from '../storage/localDb';
import type { StoredMessage } from '../storage/schema';
import type { Message } from '../../types';
import { getSettings } from './settingsService';

function toStored(message: Message): StoredMessage {
  return {
    ...message,
    timestamp:
      message.timestamp instanceof Date
        ? message.timestamp.toISOString()
        : new Date(message.timestamp).toISOString(),
  };
}

function fromStored(message: StoredMessage): Message {
  return { ...message, timestamp: new Date(message.timestamp) };
}

/** The transcript for a day, or an empty array. */
export function getMessages(date: string): Message[] {
  const stored = readDb().chat[date];
  if (!Array.isArray(stored) || stored.length === 0) return [];
  return stored.map(fromStored);
}

/** Replaces the transcript for a day. */
export function saveMessages(date: string, messages: Message[]): void {
  updateDb((db) => ({ ...db, chat: { ...db.chat, [date]: messages.map(toStored) } }));
}

/**
 * The pending review table, recovered after a reload.
 *
 * A confirm/discard is only committed when the user acts on it, so a message
 * still carrying `pendingFoods` is an unfinished review that must come back
 * exactly as it was left.
 */
export function getPendingReview(date: string): { messageId: string; foods: NonNullable<Message['pendingFoods']> } | null {
  const messages = getMessages(date);
  const pending = messages.find((msg) => msg.pendingFoods && msg.pendingFoods.length > 0);
  if (!pending || !pending.pendingFoods) return null;
  return { messageId: pending.id, foods: pending.pendingFoods };
}

/**
 * Drops transcripts older than the retention window, keeping `date` itself.
 * Chat history is conversational scrollback, not logged data — the food entries
 * it produced live in `logs` and are never touched here.
 */
export function pruneChats(date: string): void {
  const retentionDays = Math.max(1, getSettings().chatRetentionDays);
  updateDb((db) => {
    const keep = Object.keys(db.chat)
      .filter((key) => key <= date)
      .sort()
      .slice(-retentionDays);
    const keepSet = new Set([...keep, date]);

    const next: typeof db.chat = {};
    for (const [key, value] of Object.entries(db.chat)) {
      // Future-dated transcripts are kept: a device with a skewed clock must
      // not lose the conversation it just wrote.
      if (keepSet.has(key) || key > date) next[key] = value;
    }
    return { ...db, chat: next };
  });
}
