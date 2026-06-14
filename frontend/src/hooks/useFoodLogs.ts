import { useState, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { foodLogService } from '../services/foodLogService';
import { analyzeFood } from '../services/geminiService';
import { apiLogger } from '../middleware/apiLogger';
import type { FoodEntry, OfflineAction } from '../types';
import { getLocalIsoDate, parseLocalDateString, getCurrentIsoString } from '../utils/dateUtils';

const getTodayDate = (): string => getLocalIsoDate();

// ─── Shared DB row → FoodEntry mapper ─────────────────────────────────────────

const mapRow = (item: any): FoodEntry => ({
  id: item.id,
  name: item.name,
  quantity: item.quantity,
  unit: item.unit,
  calories: item.calories,
  protein: item.protein,
  carbs: item.carbs,
  fats: item.fats,
  createdAt: item.created_at,
});

// ─── Hook interface ────────────────────────────────────────────────────────────

interface UseFoodLogsCallbacks {
  /** Called after the midnight DB reset so Dashboard can append the chat message. */
  onMidnightReset?: () => void;
}

export interface UseFoodLogsReturn {
  logs: FoodEntry[];
  setLogs: React.Dispatch<React.SetStateAction<FoodEntry[]>>;
  isOnline: boolean | null;
  todayDateStr: string;
  handleDeleteFoodEntry: (id: string) => Promise<void>;
  handleUpdateFoodEntry: (updatedEntry: FoodEntry) => Promise<void>;
  /** DB-only clear (no chat message). Dashboard wraps this to also push the bot message. */
  clearTodayLogs: () => Promise<void>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFoodLogs(
  user: User,
  callbacks?: UseFoodLogsCallbacks,
): UseFoodLogsReturn {
  const [logs, setLogs] = useState<FoodEntry[]>([]);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [todayDateStr, setTodayDateStr] = useState<string>(getTodayDate());

  // Keep callbacks in a ref so effects don't need to re-subscribe when they change
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  // ── Load logs from Supabase on mount ──────────────────────────────────────
  useEffect(() => {
    const checkConnectionAndLoadLogs = async () => {
      try {
        const todayStr = getTodayDate();
        const data = await foodLogService.fetchTodayLogs(todayStr);
        const mappedData = data.map(mapRow);
        setIsOnline(true);
        setLogs(mappedData);
        localStorage.setItem(`food_logs_local_${user.id}`, JSON.stringify(mappedData));
      } catch (err) {
        apiLogger.warn('Unable to fetch logs from Supabase. Falling back to local cache.', err);
        setIsOnline(false);
        const cached = localStorage.getItem(`food_logs_local_${user.id}`);
        if (cached) {
          try {
            const allCached = JSON.parse(cached);
            const todayStr = getTodayDate();
            const filtered = allCached.filter((log: FoodEntry) => {
              const logDate = log.createdAt ? parseLocalDateString(log.createdAt) : '';
              return logDate === todayStr;
            });
            setLogs(filtered);
          } catch (e) {
            apiLogger.error('Failed to parse cached logs', e);
          }
        }
      }
    };

    checkConnectionAndLoadLogs();
  }, [user.id]);

  // ── Daily Reset at Midnight ───────────────────────────────────────────────
  useEffect(() => {
    let timeoutId: any;

    const handleMidnightReset = async () => {
      // Notify Dashboard first so the bot message appears before logs clear
      callbacksRef.current?.onMidnightReset?.();

      const todayStr = getTodayDate();
      setTodayDateStr(todayStr);

      if (isOnline) {
        try {
          const data = await foodLogService.fetchTodayLogs(todayStr);
          const mappedData = data.map(mapRow);
          setLogs(mappedData);
          localStorage.setItem(`food_logs_local_${user.id}`, JSON.stringify(mappedData));
          return;
        } catch (err) {
          apiLogger.warn('[Timer] Failed to fetch new logs from Supabase after midnight:', err);
        }
      }

      setLogs([]);
    };

    const setupMidnightTimer = () => {
      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0, 0,
      );
      const msToMidnight = midnight.getTime() - now.getTime();

      timeoutId = setTimeout(() => {
        handleMidnightReset();
        setupMidnightTimer();
      }, msToMidnight);
    };

    setupMidnightTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOnline, user.id]);

  // ── Synchronize offline actions when network is available ─────────────────
  const syncOfflineActions = async () => {
    if (!navigator.onLine) return;
    const actionsJson = localStorage.getItem(`offline_pending_actions_${user.id}`);
    if (!actionsJson) return;

    let actions: OfflineAction[];
    try {
      actions = JSON.parse(actionsJson);
    } catch (e) {
      apiLogger.error('Failed to parse offline actions', e);
      return;
    }

    if (actions.length === 0) return;

    apiLogger.info(`[Sync] Starting sync of ${actions.length} offline actions...`);
    const remainingActions: OfflineAction[] = [...actions];

    for (const action of actions) {
      try {
        if (action.type === 'ADD') {
          const parseData = await analyzeFood(action.text!);
          if (parseData.status === 'invalid') {
            setLogs((prev) => prev.filter((item) => item.id !== action.tempId));
            remainingActions.shift();
            continue;
          }
          const items = parseData.items || [];
          const entriesToSave = items.map((item) => {
            const rawQty = parseFloat(item.quantity) || 1;
            const rawUnit = item.quantity.replace(/^\d+(?:\.\d+)?\s*/, '') || 'piece';
            const timestamp = action.timestamp || new Date().toISOString();
            return {
              id: crypto.randomUUID(),
              name: item.name || 'Unknown',
              quantity: rawQty,
              unit: rawUnit,
              calories: item.calories || 0,
              protein: item.protein || 0,
              carbs: item.carbs || 0,
              fats: item.fat || 0,
              created_at: timestamp,
              date: parseLocalDateString(timestamp),
              user_id: user.id, // Attach current user.id
            };
          });

          try {
            await foodLogService.insertFoodLogs(entriesToSave);
            const localEntries = entriesToSave.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              calories: item.calories,
              protein: item.protein,
              carbs: item.carbs,
              fats: item.fats,
              createdAt: item.created_at,
            }));
            setLogs((prev) => {
              const idx = prev.findIndex((item) => item.id === action.tempId);
              if (idx !== -1) {
                const updated = [...prev];
                updated.splice(idx, 1, ...localEntries);
                return updated;
              }
              return [...localEntries, ...prev];
            });
            remainingActions.shift();
          } catch (insertErr) {
            apiLogger.error('Failed to sync offline ADD action:', insertErr);
            break;
          }
        } else if (action.type === 'EDIT' && action.entry) {
          try {
            await foodLogService.updateFoodLog(action.id!, action.entry);
            remainingActions.shift();
          } catch (editErr) {
            apiLogger.error('Failed to sync offline EDIT action:', editErr);
            break;
          }
        } else if (action.type === 'DELETE') {
          try {
            await foodLogService.deleteFoodLog(action.id!);
            remainingActions.shift();
          } catch (delErr) {
            apiLogger.error('Failed to sync offline DELETE action:', delErr);
            break;
          }
        }
      } catch (err) {
        apiLogger.error('Failed to sync action:', action, err);
        break;
      }
    }

    localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(remainingActions));

    if (remainingActions.length === 0) {
      apiLogger.info('[Sync] All offline actions synced successfully.');
      try {
        const todayStr = getTodayDate();
        const data = await foodLogService.fetchTodayLogs(todayStr);
        const mappedData = data.map(mapRow);
        setLogs(mappedData);
        localStorage.setItem(`food_logs_local_${user.id}`, JSON.stringify(mappedData));
      } catch (err) {
        apiLogger.error('Failed to refresh logs after sync', err);
      }
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineActions();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setTimeout(syncOfflineActions, 0);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user.id]);

  // ── CRUD handlers ─────────────────────────────────────────────────────────

  const handleDeleteFoodEntry = async (id: string) => {
    setLogs((prev) => prev.filter((item) => item.id !== id));

    if (id.startsWith('temp-')) {
      try {
        const existingActions: OfflineAction[] = JSON.parse(
          localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]',
        );
        const updatedActions = existingActions.filter((act: any) => act.tempId !== id);
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(updatedActions));
      } catch (e) {
        apiLogger.error('Failed to update offline actions queue', e);
      }
      return;
    }

    if (!navigator.onLine) {
      try {
        const existingActions: OfflineAction[] = JSON.parse(
          localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]',
        );
        existingActions.push({ type: 'DELETE', id, timestamp: getCurrentIsoString() });
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(existingActions));
      } catch (e) {
        apiLogger.error('Failed to queue offline delete', e);
      }
      return;
    }

    try {
      await foodLogService.deleteFoodLog(id);
    } catch (error) {
      apiLogger.warn('Delete request failed, queuing offline delete action...', error);
      try {
        const existingActions: OfflineAction[] = JSON.parse(
          localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]',
        );
        existingActions.push({ type: 'DELETE', id, timestamp: getCurrentIsoString() });
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(existingActions));
      } catch (e) {
        apiLogger.error('Failed to queue offline delete after failure', e);
      }
    }
  };

  const handleUpdateFoodEntry = async (updatedEntry: FoodEntry) => {
    const id = updatedEntry.id;

    setLogs((prev) => prev.map((item) => (item.id === id ? updatedEntry : item)));

    if (id.startsWith('temp-')) {
      try {
        const existingActions: OfflineAction[] = JSON.parse(
          localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]',
        );
        const updatedActions = existingActions.map((act: any) =>
          act.tempId === id ? { ...act, text: updatedEntry.name } : act,
        );
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(updatedActions));
      } catch (e) {
        apiLogger.error('Failed to update pending actions queue', e);
      }
      return;
    }

    if (!navigator.onLine) {
      setLogs((prev) =>
        prev.map((item) =>
          item.id === id ? { ...updatedEntry, isOfflineUpdated: true } : item,
        ),
      );
      try {
        const existingActions: OfflineAction[] = JSON.parse(
          localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]',
        );
        const existingEditIdx = existingActions.findIndex(
          (act: any) => act.type === 'EDIT' && act.id === id,
        );
        if (existingEditIdx !== -1) {
          existingActions[existingEditIdx].entry = updatedEntry;
        } else {
          existingActions.push({ type: 'EDIT', id, entry: updatedEntry, timestamp: getCurrentIsoString() });
        }
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(existingActions));
      } catch (e) {
        apiLogger.error('Failed to queue offline edit', e);
      }
      return;
    }

    try {
      await foodLogService.updateFoodLog(id, updatedEntry);
    } catch (err) {
      apiLogger.warn('Update failed, fallback to local offline edit...', err);
      setLogs((prev) =>
        prev.map((item) =>
          item.id === id ? { ...updatedEntry, isOfflineUpdated: true } : item,
        ),
      );
      try {
        const existingActions: OfflineAction[] = JSON.parse(
          localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]',
        );
        const existingEditIdx = existingActions.findIndex(
          (act: any) => act.type === 'EDIT' && act.id === id,
        );
        if (existingEditIdx !== -1) {
          existingActions[existingEditIdx].entry = updatedEntry;
        } else {
          existingActions.push({ type: 'EDIT', id, entry: updatedEntry, timestamp: getCurrentIsoString() });
        }
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(existingActions));
      } catch (e) {
        apiLogger.error('Failed to queue offline edit after failure', e);
      }
    }
  };

  /**
   * Clears today's DB rows + local cache.
   * Intentionally does NOT add a chat message — Dashboard wraps this
   * with handleClearAll to append the bot reply.
   */
  const clearTodayLogs = async () => {
    const todayStr = getTodayDate();
    setLogs([]);

    if (isOnline) {
      try {
        await foodLogService.deleteTodayLogs(todayStr);
      } catch (err) {
        apiLogger.error('Failed to clear daily entries:', err);
      }
    }
    localStorage.setItem(`food_logs_local_${user.id}`, JSON.stringify([]));
  };

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    logs,
    setLogs,
    isOnline,
    todayDateStr,
    handleDeleteFoodEntry,
    handleUpdateFoodEntry,
    clearTodayLogs,
  };
}
