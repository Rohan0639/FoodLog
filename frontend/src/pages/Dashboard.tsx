import { useState, useEffect, useRef } from 'react';
import type { Message, DailyGoal, OfflineAction, FoodEntry } from '../types';
import { convertUnit } from '../utils/unitConverter';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { analyzeFoodClient } from '../utils/geminiParser';
import Navbar from '../components/Navbar';
import FoodLogger from '../components/FoodLogger';
import { NutritionDashboard } from '../components/NutritionDashboard';
import type { User } from '@supabase/supabase-js';

const DEFAULT_DAILY_GOAL: DailyGoal = {
  calories: 2000,
  protein: 135,
  carbs: 230,
  fat: 70,
};

const generateMessageId = (sender: string): string => {
  return `${sender}-${crypto.randomUUID()}`;
};

const generateTempId = (): string => {
  return `temp-${crypto.randomUUID()}`;
};

const getCurrentDate = (): Date => {
  return new Date();
};

const getCurrentIsoString = (): string => {
  return new Date().toISOString();
};

const getLocalIsoDate = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDateString = (timestamp: string): string => {
  if (!timestamp || typeof timestamp !== 'string') {
    return getLocalIsoDate();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    return timestamp;
  }
  try {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return getLocalIsoDate(d);
    }
  } catch (e) {}
  return timestamp.split('T')[0] || getLocalIsoDate();
};

function getTodayDate(): string {
  return getLocalIsoDate();
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I'm your digital food diary assistant. Tell me what you ate today (e.g., \"I had 2 bananas and 3 eggs\") and I'll analyze and log the nutrients for you.",
      timestamp: new Date(),
    },
  ]);
  const [logs, setLogs] = useState<FoodEntry[]>([]);
  const [dailyGoal] = useState<DailyGoal>(DEFAULT_DAILY_GOAL);
  const [todayDateStr, setTodayDateStr] = useState<string>(getTodayDate());
  const [isOnline, setIsOnline] = useState<boolean | null>(null); // null = checking

  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isDashboardOpenMobile, setIsDashboardOpenMobile] = useState(false);

  const [activeFoods, setActiveFoods] = useState<FoodEntry[]>([]);
  const [activeReviewMessageId, setActiveReviewMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isBotTyping]);

  // Load logs from Supabase on start
  useEffect(() => {
    const checkConnectionAndLoadLogs = async () => {
      try {
        const todayStr = getTodayDate();
        // Relying on RLS: We select * and do not manually filter by user_id
        const { data, error } = await supabase
          .from('food_logs')
          .select('*')
          .eq('date', todayStr)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mappedData = (data || []).map((item: any) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fats: item.fats,
          createdAt: item.created_at
        }));

        setIsOnline(true);
        setLogs(mappedData);
        localStorage.setItem(`food_logs_local_${user.id}`, JSON.stringify(mappedData));
      } catch (err) {
        console.warn('Unable to fetch logs from Supabase. Falling back to local cache.', err);
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
            console.error('Failed to parse cached logs', e);
          }
        }
      }
    };

    checkConnectionAndLoadLogs();
  }, [user.id]);

  // Daily Reset at Midnight
  useEffect(() => {
    let timeoutId: any;

    const setupMidnightTimer = () => {
      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0, 0, 0, 0
      );
      const msToMidnight = midnight.getTime() - now.getTime();

      timeoutId = setTimeout(() => {
        handleMidnightReset();
        setupMidnightTimer();
      }, msToMidnight);
    };

    const handleMidnightReset = async () => {
      const resetMessage: Message = {
        id: `bot-midnight-reset-${Date.now()}`,
        sender: 'bot',
        text: "Midnight reached! A new logging day has started. ☀️ Your previous logs are saved in history.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, resetMessage]);

      const todayStr = getTodayDate();
      setTodayDateStr(todayStr);

      if (isOnline) {
        try {
          const { data, error } = await supabase
            .from('food_logs')
            .select('*')
            .eq('date', todayStr)
            .order('created_at', { ascending: false });

          if (!error && data) {
            const mappedData = data.map((item: any) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              calories: item.calories,
              protein: item.protein,
              carbs: item.carbs,
              fats: item.fats,
              createdAt: item.created_at
            }));
            setLogs(mappedData);
            localStorage.setItem(`food_logs_local_${user.id}`, JSON.stringify(mappedData));
            return;
          }
        } catch (err) {
          console.warn('[Timer] Failed to fetch new logs from Supabase after midnight:', err);
        }
      }

      setLogs([]);
    };

    setupMidnightTimer();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isOnline, user.id]);

  // Synchronize offline actions when network is available
  const syncOfflineActions = async () => {
    if (!navigator.onLine) return;
    const actionsJson = localStorage.getItem(`offline_pending_actions_${user.id}`);
    if (!actionsJson) return;

    let actions: OfflineAction[];
    try {
      actions = JSON.parse(actionsJson);
    } catch (e) {
      console.error('Failed to parse offline actions', e);
      return;
    }

    if (actions.length === 0) return;

    console.log(`[Sync] Starting sync of ${actions.length} offline actions...`);
    const remainingActions: OfflineAction[] = [...actions];

    for (const action of actions) {
      try {
        if (action.type === 'ADD') {
          const parseData = await analyzeFoodClient(action.text!);
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
              user_id: user.id // Attach current user.id
            };
          });

          const { error } = await supabase.from('food_logs').insert(entriesToSave);
          if (!error) {
            const localEntries = entriesToSave.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              calories: item.calories,
              protein: item.protein,
              carbs: item.carbs,
              fats: item.fats,
              createdAt: item.created_at
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
          } else {
            break;
          }
        } else if (action.type === 'EDIT' && action.entry) {
          const { error } = await supabase
            .from('food_logs')
            .update({
              name: action.entry.name,
              quantity: action.entry.quantity,
              unit: action.entry.unit,
              calories: action.entry.calories,
              protein: action.entry.protein,
              carbs: action.entry.carbs,
              fats: action.entry.fats
            })
            .eq('id', action.id);

          if (!error) {
            remainingActions.shift();
          } else {
            break;
          }
        } else if (action.type === 'DELETE') {
          const { error } = await supabase
            .from('food_logs')
            .delete()
            .eq('id', action.id);

          if (!error) {
            remainingActions.shift();
          } else {
            break;
          }
        }
      } catch (err) {
        console.error('Failed to sync action:', action, err);
        break;
      }
    }

    localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(remainingActions));

    if (remainingActions.length === 0) {
      console.log('[Sync] All offline actions synced successfully.');
      try {
        const todayStr = getTodayDate();
        const { data, error } = await supabase
          .from('food_logs')
          .select('*')
          .eq('date', todayStr)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const mappedData = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fats: item.fats,
            createdAt: item.created_at
          }));
          setLogs(mappedData);
          localStorage.setItem(`food_logs_local_${user.id}`, JSON.stringify(mappedData));
        }
      } catch (err) {
        console.error('Failed to refresh logs after sync', err);
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

  const handleSendMessage = async (text: string) => {
    const cleanText = text.toLowerCase().trim().replace(/[.,/#!$%^&*;:{}=_`~()?-]/g, "");

    if (cleanText === 'clear' || cleanText === 'reset') {
      const userMsg: Message = {
        id: generateMessageId('user'),
        sender: 'user',
        text,
        timestamp: getCurrentDate(),
      };
      setMessages((prev) => [...prev, userMsg]);
      handleClearAll();
      return;
    }

    const userMsg: Message = {
      id: generateMessageId('user'),
      sender: 'user',
      text,
      timestamp: getCurrentDate(),
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setIsBotTyping(true);

    try {
      const parseData = await analyzeFoodClient(text);
      if (parseData.status === 'invalid') {
        const botMsg: Message = {
          id: generateMessageId('bot'),
          sender: 'bot',
          text: parseData.reason || "Input is not a valid food item",
          timestamp: getCurrentDate(),
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsBotTyping(false);
        return;
      }
      const items = parseData.items || [];
      const newEntries: FoodEntry[] = items.map((item) => {
        const rawQty = parseFloat(item.quantity) || 1;
        const rawUnit = item.quantity.replace(/^\d+(?:\.\d+)?\s*/, '') || 'piece';
        return {
          id: crypto.randomUUID(),
          name: item.name || 'Unknown',
          quantity: rawQty,
          unit: rawUnit,
          baseQuantity: rawQty,
          baseUnit: rawUnit,
          calories: item.calories || 0,
          protein: item.protein || 0,
          carbs: item.carbs || 0,
          fats: item.fat || 0,
          createdAt: new Date().toISOString()
        };
      });
      const replyText = parseData.reply || `Please review the parsed food items:`;

      const botMsgId = generateMessageId('bot');
      const botMsg: Message = {
        id: botMsgId,
        sender: 'bot',
        text: replyText,
        timestamp: getCurrentDate(),
        pendingFoods: newEntries.length > 0 ? newEntries : undefined,
      };

      setMessages((prev) => [...prev, botMsg]);

      if (newEntries.length > 0) {
        setActiveReviewMessageId(botMsgId);
        setActiveFoods(newEntries);
      }
    } catch (error) {
      const err = error as Error;
      console.warn('Failed to analyze food. Saving raw input locally...', err);
      
      const tempId = generateTempId();
      const offlineEntry: FoodEntry = {
        id: tempId,
        name: text,
        quantity: 1,
        unit: 'serving',
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
        createdAt: getCurrentIsoString(),
        isOffline: true
      };

      setLogs((prev) => [offlineEntry, ...prev]);

      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]');
        existingActions.push({
          type: 'ADD',
          tempId,
          text,
          timestamp: getCurrentIsoString()
        });
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(existingActions));
      } catch (storageErr) {
        console.error('Failed to write offline action to localStorage:', storageErr);
      }

      const replyText = "Saved offline. Will analyze when online.";

      const botMsg: Message = {
        id: generateMessageId('bot-fallback'),
        sender: 'bot',
        text: replyText,
        timestamp: getCurrentDate(),
        parsedFoods: [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsBotTyping(false);
    }
  };

  const handleConfirmLog = async () => {
    if (activeFoods.length === 0) return;
    setIsBotTyping(true);

    try {
      const finalizedFoods = activeFoods.map((item) => {
        const quantity = item.quantity;
        let scaled = { calories: item.calories, protein: item.protein, carbs: item.carbs, fats: item.fats };
        
        if (quantity > 0 && !isNaN(quantity)) {
          try {
            const baseUnit = item.baseUnit || item.unit;
            const baseQty = item.baseQuantity || item.quantity;
            const scaledQuantity = convertUnit(quantity, item.unit, baseUnit, item.name);
            const scale = scaledQuantity / baseQty;

            scaled = {
              calories: Math.max(0, Math.round(item.calories * scale)),
              protein: Math.max(0, Math.round(item.protein * scale * 10) / 10),
              carbs: Math.max(0, Math.round(item.carbs * scale * 10) / 10),
              fats: Math.max(0, Math.round(item.fats * scale * 10) / 10),
            };
          } catch (err) {
            console.error('Scale error:', err);
          }
        }

        return {
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          calories: scaled.calories,
          protein: scaled.protein,
          carbs: scaled.carbs,
          fats: scaled.fats,
          createdAt: item.createdAt || new Date().toISOString()
        };
      });

      const dbFoods = finalizedFoods.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
        created_at: item.createdAt,
        date: parseLocalDateString(item.createdAt),
        user_id: user.id // Automatically attach user_id
      }));

      const { data: savedEntries, error } = await supabase
        .from('food_logs')
        .insert(dbFoods)
        .select();

      if (error) {
        throw new Error(`Supabase batch save error: ${error.message}`);
      }

      const mappedSaved = (savedEntries || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fats: item.fats,
        createdAt: item.created_at
      }));

      const confirmedEntries = mappedSaved.length > 0 ? mappedSaved : finalizedFoods;
      setLogs((prev) => [...confirmedEntries, ...prev]);

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.85 },
        colors: ['#ffffff', '#e4e4e7', '#a1a1aa', '#52525b']
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === activeReviewMessageId
            ? {
                ...msg,
                text: "Logged successfully! 🍳",
                pendingFoods: undefined,
                parsedFoods: savedEntries
              }
            : msg
        )
      );
    } catch (err) {
      console.error('Failed to confirm and log food:', err);
    } finally {
      setActiveReviewMessageId(null);
      setActiveFoods([]);
      setIsBotTyping(false);
    }
  };

  const handleDiscard = () => {
    if (activeReviewMessageId) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === activeReviewMessageId
            ? {
                ...msg,
                text: "Discarded logging session. ❌",
                pendingFoods: undefined,
                parsedFoods: []
              }
            : msg
        )
      );
    }
    setActiveReviewMessageId(null);
    setActiveFoods([]);
  };

  const handleDeleteFoodEntry = async (id: string) => {
    setLogs((prev) => prev.filter((item) => item.id !== id));

    if (id.startsWith('temp-')) {
      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]');
        const updatedActions = existingActions.filter((act: any) => act.tempId !== id);
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(updatedActions));
      } catch (e) {
        console.error('Failed to update offline actions queue', e);
      }
      return;
    }

    if (!navigator.onLine) {
      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]');
        existingActions.push({
          type: 'DELETE',
          id,
          timestamp: getCurrentIsoString()
        });
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(existingActions));
      } catch (e) {
        console.error('Failed to queue offline delete', e);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('food_logs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Delete request failed, queuing offline delete action...', error);
      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]');
        existingActions.push({
          type: 'DELETE',
          id,
          timestamp: getCurrentIsoString()
        });
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(existingActions));
      } catch (e) {
        console.error('Failed to queue offline delete after failure', e);
      }
    }
  };

  const handleUpdateFoodEntry = async (updatedEntry: FoodEntry) => {
    const id = updatedEntry.id;
    
    setLogs((prev) =>
      prev.map((item) => (item.id === id ? updatedEntry : item))
    );

    if (id.startsWith('temp-')) {
      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]');
        const updatedActions = existingActions.map((act: any) =>
          act.tempId === id ? { ...act, text: updatedEntry.name } : act
        );
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(updatedActions));
      } catch (e) {
        console.error('Failed to update pending actions queue', e);
      }
      return;
    }

    if (!navigator.onLine) {
      setLogs((prev) =>
        prev.map((item) =>
          item.id === id ? { ...updatedEntry, isOfflineUpdated: true } : item
        )
      );

      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]');
        const existingEditIdx = existingActions.findIndex((act: any) => act.type === 'EDIT' && act.id === id);
        if (existingEditIdx !== -1) {
          existingActions[existingEditIdx].entry = updatedEntry;
        } else {
          existingActions.push({
            type: 'EDIT',
            id,
            entry: updatedEntry,
            timestamp: getCurrentIsoString()
          });
        }
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(existingActions));
      } catch (e) {
        console.error('Failed to queue offline edit', e);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('food_logs')
        .update({
          name: updatedEntry.name,
          quantity: updatedEntry.quantity,
          unit: updatedEntry.unit,
          calories: updatedEntry.calories,
          protein: updatedEntry.protein,
          carbs: updatedEntry.carbs,
          fats: updatedEntry.fats
        })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.warn('Update failed, fallback to local offline edit...', err);
      setLogs((prev) =>
        prev.map((item) =>
          item.id === id ? { ...updatedEntry, isOfflineUpdated: true } : item
        )
      );

      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem(`offline_pending_actions_${user.id}`) || '[]');
        const existingEditIdx = existingActions.findIndex((act: any) => act.type === 'EDIT' && act.id === id);
        if (existingEditIdx !== -1) {
          existingActions[existingEditIdx].entry = updatedEntry;
        } else {
          existingActions.push({
            type: 'EDIT',
            id,
            entry: updatedEntry,
            timestamp: getCurrentIsoString()
          });
        }
        localStorage.setItem(`offline_pending_actions_${user.id}`, JSON.stringify(existingActions));
      } catch (e) {
        console.error('Failed to queue offline edit after failure', e);
      }
    }
  };

  const handleClearAll = async () => {
    const todayStr = getTodayDate();
    setLogs([]);

    if (isOnline) {
      try {
        const { error } = await supabase
          .from('food_logs')
          .delete()
          .eq('date', todayStr);
        
        if (error) throw error;
      } catch (err) {
        console.error('Failed to clear daily entries:', err);
      }
    }

    localStorage.setItem(`food_logs_local_${user.id}`, JSON.stringify([]));
    
    const resetMsg: Message = {
      id: `bot-reset-${Date.now()}`,
      sender: 'bot',
      text: "I've reset your daily logs. Ready to record your next meal!",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, resetMsg]);
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-black text-white">
      {/* Navbar Display */}
      <Navbar
        userEmail={user.email}
        isOnline={isOnline}
        onLogout={onLogout}
        isDashboardOpenMobile={isDashboardOpenMobile}
        setIsDashboardOpenMobile={setIsDashboardOpenMobile}
        hasLogs={logs.length > 0}
      />

      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left Logger Column */}
        <FoodLogger
          messages={messages}
          logs={logs}
          activeReviewMessageId={activeReviewMessageId}
          activeFoods={activeFoods}
          setActiveFoods={setActiveFoods}
          isBotTyping={isBotTyping}
          onSendMessage={handleSendMessage}
          onConfirmLog={handleConfirmLog}
          onDiscard={handleDiscard}
          messagesEndRef={messagesEndRef}
        />

        {/* Desktop Dashboard panel */}
        <div className="hidden lg:block w-[320px] xl:w-[350px] h-full shrink-0">
          <NutritionDashboard
            key={todayDateStr}
            logs={logs}
            dailyGoal={dailyGoal}
            onDeleteFoodLog={handleDeleteFoodEntry}
            onUpdateFoodLog={handleUpdateFoodEntry}
            onClearAll={handleClearAll}
          />
        </div>

        {/* Mobile Drawer Slide-over Panel */}
        {isDashboardOpenMobile && (
          <div className="lg:hidden fixed inset-0 z-50 flex justify-end animate-fade-in">
            <div
              onClick={() => setIsDashboardOpenMobile(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm transition-opacity duration-300"
            />
            
            <div className="relative w-80 max-w-[85%] h-full bg-black border-l border-zinc-900 shadow-2xl flex flex-col animate-slide-up">
              <div className="h-full">
                <NutritionDashboard
                  key={todayDateStr}
                  logs={logs}
                  dailyGoal={dailyGoal}
                  onDeleteFoodLog={handleDeleteFoodEntry}
                  onUpdateFoodLog={handleUpdateFoodEntry}
                  onClearAll={handleClearAll}
                  onCloseMobile={() => setIsDashboardOpenMobile(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
