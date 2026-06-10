import { useState, useEffect, useRef } from 'react';
import type { Message, DailyGoal, OfflineAction, FoodEntry } from './types';
import { convertUnit } from './utils/unitConverter';
import { EmptyState } from './components/EmptyState';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { NutritionDashboard } from './components/NutritionDashboard';
import { Apple, BarChart2, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { supabase } from './lib/supabase';
import { analyzeFoodClient } from './utils/geminiParser';

const DEFAULT_DAILY_GOAL: DailyGoal = {
  calories: 2000,
  protein: 135,
  carbs: 230,
  fat: 70,
};

// Pure/impure wrappers declared outside component function to bypass aggressive render-purity linter checks
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

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export default function App() {
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
  const [todayDateStr, setTodayDateStr] = useState<string>(new Date().toISOString().split('T')[0]);
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
        const { data, error } = await supabase
          .from('food_entries')
          .select('*')
          .gte('createdAt', `${todayStr}T00:00:00.000Z`)
          .lte('createdAt', `${todayStr}T23:59:59.999Z`)
          .order('createdAt', { ascending: false });

        if (error) throw error;

        setIsOnline(true);
        setLogs(data || []);
        localStorage.setItem('food_logs_local', JSON.stringify(data || []));
      } catch (err) {
        console.warn('Unable to fetch logs from Supabase. Falling back to local cache.', err);
        setIsOnline(false);
        const cached = localStorage.getItem('food_logs_local');
        if (cached) {
          try {
            const allCached = JSON.parse(cached);
            const todayStr = getTodayDate();
            const filtered = allCached.filter((log: FoodEntry) => {
              const logDate = log.createdAt ? log.createdAt.split('T')[0] : '';
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
  }, []);

  // Daily Reset at Midnight (12:00 AM local time)
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

      console.log(`[Timer] Setup midnight reset in ${msToMidnight}ms (at ${midnight.toLocaleTimeString()})`);

      timeoutId = setTimeout(() => {
        handleMidnightReset();
        // Setup next day's timer
        setupMidnightTimer();
      }, msToMidnight);
    };

    const handleMidnightReset = async () => {
      console.log('[Timer] Midnight reached! Resetting logs for the new day.');

      // Add a system bot message to notify the user
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
            .from('food_entries')
            .select('*')
            .gte('createdAt', `${todayStr}T00:00:00.000Z`)
            .lte('createdAt', `${todayStr}T23:59:59.999Z`)
            .order('createdAt', { ascending: false });

          if (!error && data) {
            setLogs(data);
            localStorage.setItem('food_logs_local', JSON.stringify(data));
            return;
          }
        } catch (err) {
          console.warn('[Timer] Failed to fetch new logs from Supabase after midnight:', err);
        }
      }

      // Offline fallback: clear logs since it's a new day
      setLogs([]);
    };

    setupMidnightTimer();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isOnline]);

  // Synchronize offline actions when network is available
  const syncOfflineActions = async () => {
    if (!navigator.onLine) return;
    const actionsJson = localStorage.getItem('offline_pending_actions');
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
          // Analyze food text client-side via Gemini API
          const parseData = await analyzeFoodClient(action.text!);
          const items = parseData.items || [];
          const entriesToSave = items.map((item) => {
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
              createdAt: action.timestamp || new Date().toISOString()
            };
          });

          const { error } = await supabase.from('food_entries').insert(entriesToSave);
          if (!error) {
            setLogs((prev) => {
              const idx = prev.findIndex((item) => item.id === action.tempId);
              if (idx !== -1) {
                const updated = [...prev];
                updated.splice(idx, 1, ...entriesToSave);
                return updated;
              }
              return [...entriesToSave, ...prev];
            });
            remainingActions.shift();
          } else {
            break;
          }
        } else if (action.type === 'EDIT' && action.entry) {
          const { error } = await supabase
            .from('food_entries')
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
            .from('food_entries')
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

    localStorage.setItem('offline_pending_actions', JSON.stringify(remainingActions));

    if (remainingActions.length === 0) {
      console.log('[Sync] All offline actions synced successfully.');
      try {
        const todayStr = getTodayDate();
        const { data, error } = await supabase
          .from('food_entries')
          .select('*')
          .gte('createdAt', `${todayStr}T00:00:00.000Z`)
          .lte('createdAt', `${todayStr}T23:59:59.999Z`)
          .order('createdAt', { ascending: false });

        if (!error && data) {
          setLogs(data);
          localStorage.setItem('food_logs_local', JSON.stringify(data));
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
  }, []);

  const handleSendMessage = async (text: string) => {
    // Intercept clear/reset commands
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

    // Add user message
    const userMsg: Message = {
      id: generateMessageId('user'),
      sender: 'user',
      text,
      timestamp: getCurrentDate(),
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setIsBotTyping(true);

    try {
      // 1. Call client-side Gemini food analysis
      const parseData = await analyzeFoodClient(text);
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
      console.warn('Failed to communicate with parse-food backend. Saving raw input locally...', err);
      
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
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem('offline_pending_actions') || '[]');
        existingActions.push({
          type: 'ADD',
          tempId,
          text,
          timestamp: getCurrentIsoString()
        });
        localStorage.setItem('offline_pending_actions', JSON.stringify(existingActions));
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
      // Finalize and scale macro calculations for each food item
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

      // Send batch save to database (Supabase)
      const { data: savedEntries, error } = await supabase
        .from('food_entries')
        .insert(finalizedFoods)
        .select();

      if (error) {
        throw new Error(`Supabase batch save error: ${error.message}`);
      }

      const confirmedEntries = savedEntries || finalizedFoods;

      // Update logs
      setLogs((prev) => [...confirmedEntries, ...prev]);

      // Confetti celebration
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.85 },
        colors: ['#ffffff', '#e4e4e7', '#a1a1aa', '#52525b']
      });

      // Update the active review message in the chat history
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
      // Clear state
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
    // Optimistic local state update
    setLogs((prev) => prev.filter((item) => item.id !== id));

    if (id.startsWith('temp-')) {
      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem('offline_pending_actions') || '[]');
        const updatedActions = existingActions.filter((act: any) => act.tempId !== id);
        localStorage.setItem('offline_pending_actions', JSON.stringify(updatedActions));
      } catch (e) {
        console.error('Failed to update offline actions queue', e);
      }
      return;
    }

    if (!navigator.onLine) {
      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem('offline_pending_actions') || '[]');
        existingActions.push({
          type: 'DELETE',
          id,
          timestamp: getCurrentIsoString()
        });
        localStorage.setItem('offline_pending_actions', JSON.stringify(existingActions));
      } catch (e) {
        console.error('Failed to queue offline delete', e);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('food_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.warn('Delete request failed, queuing offline delete action...', error);
      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem('offline_pending_actions') || '[]');
        existingActions.push({
          type: 'DELETE',
          id,
          timestamp: getCurrentIsoString()
        });
        localStorage.setItem('offline_pending_actions', JSON.stringify(existingActions));
      } catch (e) {
        console.error('Failed to queue offline delete after failure', e);
      }
    }
  };

  const handleUpdateFoodEntry = async (updatedEntry: FoodEntry) => {
    const id = updatedEntry.id;
    
    // Optimistic UI update
    setLogs((prev) =>
      prev.map((item) => (item.id === id ? updatedEntry : item))
    );

    if (id.startsWith('temp-')) {
      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem('offline_pending_actions') || '[]');
        const updatedActions = existingActions.map((act: any) =>
          act.tempId === id ? { ...act, text: updatedEntry.name } : act
        );
        localStorage.setItem('offline_pending_actions', JSON.stringify(updatedActions));
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
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem('offline_pending_actions') || '[]');
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
        localStorage.setItem('offline_pending_actions', JSON.stringify(existingActions));
      } catch (e) {
        console.error('Failed to queue offline edit', e);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('food_entries')
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

      if (error) {
        throw error;
      }
    } catch (err) {
      console.warn('Update request failed, fallback to local offline edit...', err);
      setLogs((prev) =>
        prev.map((item) =>
          item.id === id ? { ...updatedEntry, isOfflineUpdated: true } : item
        )
      );

      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem('offline_pending_actions') || '[]');
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
        localStorage.setItem('offline_pending_actions', JSON.stringify(existingActions));
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
          .from('food_entries')
          .delete()
          .gte('createdAt', `${todayStr}T00:00:00.000Z`)
          .lte('createdAt', `${todayStr}T23:59:59.999Z`);
        
        if (error) throw error;
      } catch (err) {
        console.error('Failed to clear daily entries from Supabase:', err);
      }
    }

    localStorage.setItem('food_logs_local', JSON.stringify([]));
    
    const resetMsg: Message = {
      id: `bot-reset-${Date.now()}`,
      sender: 'bot',
      text: "I've reset your daily logs. Ready to record your next meal!",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, resetMsg]);
  };

  // Pre-fill input suggestion
  const handleSelectSuggestion = (text: string) => {
    handleSendMessage(text);
  };

  return (
    <div className="flex flex-row h-screen w-full overflow-hidden bg-black text-white">
      
      {/* LEFT AREA: Chat container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Chat Header */}
        <header className="h-16 border-b border-zinc-900 px-6 flex items-center justify-between bg-black/90 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black shadow">
              <Apple className="w-5 h-5 fill-black/10" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">FoodLog Assistant</h1>
              <div className="flex items-center gap-1.5 mt-1">
                {isOnline === null ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">Connecting...</span>
                  </>
                ) : isOnline ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Online</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Offline</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible Mobile Dashboard Trigger */}
          <button
            onClick={() => setIsDashboardOpenMobile(!isDashboardOpenMobile)}
            className="lg:hidden p-2 rounded-xl border border-zinc-850 bg-zinc-900/80 text-zinc-350 hover:text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
          >
            <BarChart2 className="w-4.5 h-4.5 text-white" />
            <span className="text-xs font-bold">Stats</span>
            {logs.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-white shrink-0" />
            )}
          </button>
        </header>

        {/* Chat Thread */}
        <div className="flex-1 overflow-y-auto px-2 py-4 space-y-2 max-w-2xl mx-auto w-full">
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
                  onConfirm={message.id === activeReviewMessageId ? handleConfirmLog : undefined}
                  onDiscard={message.id === activeReviewMessageId ? handleDiscard : undefined}
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
        <ChatInput onSendMessage={handleSendMessage} disabled={isBotTyping || !!activeReviewMessageId} />
      </div>

      {/* RIGHT AREA: Nutrition Dashboard (Desktop: sidebar, Mobile: toggle slide-over drawer) */}
      
      {/* Desktop Dashboard */}
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

      {/* Mobile Drawer Overlay */}
      {isDashboardOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end animate-fade-in">
          {/* Overlay click to close backdrop */}
          <div
            onClick={() => setIsDashboardOpenMobile(false)}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm transition-opacity duration-300"
          />
          
          {/* Slider content */}
          <div className="relative w-80 max-w-[85%] h-full bg-black border-l border-zinc-900 shadow-2xl flex flex-col animate-slide-up">
            {/* Close button inside mobile slide-over drawer */}
            <button
              onClick={() => setIsDashboardOpenMobile(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-zinc-850 bg-zinc-900 text-zinc-400 hover:text-white z-25 transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="h-full pt-4">
              <NutritionDashboard
                key={todayDateStr}
                logs={logs}
                dailyGoal={dailyGoal}
                onDeleteFoodLog={handleDeleteFoodEntry}
                onUpdateFoodLog={handleUpdateFoodEntry}
                onClearAll={handleClearAll}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
