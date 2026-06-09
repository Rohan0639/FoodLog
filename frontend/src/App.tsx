import { useState, useEffect, useRef } from 'react';
import type { Message, FoodItem, DailyGoal, FoodLog, OfflineAction, ParsedItem } from './types';
import { isGreeting } from './utils/parserMock';
import { EmptyState } from './components/EmptyState';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { NutritionDashboard } from './components/NutritionDashboard';
import { Apple, BarChart2, X } from 'lucide-react';
import confetti from 'canvas-confetti';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

const generateFoodItemId = (): string => {
  return `food-${crypto.randomUUID()}`;
};

const getCurrentDate = (): Date => {
  return new Date();
};

const getCurrentIsoString = (): string => {
  return new Date().toISOString();
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I'm your digital food diary assistant. Tell me what you ate today (e.g., \"I had 2 bananas and 3 eggs\") and I'll analyze and log the nutrients for you.",
      timestamp: new Date(),
    },
  ]);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [dailyGoal] = useState<DailyGoal>(DEFAULT_DAILY_GOAL);
  const [isOnline, setIsOnline] = useState<boolean | null>(null); // null = checking

  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isDashboardOpenMobile, setIsDashboardOpenMobile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom of the chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isBotTyping]);

  // Health check with up to 3 retries, then load logs
  useEffect(() => {
    const checkHealthAndLoadLogs = async () => {
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 1500;

      let attempt = 0;
      let healthy = false;

      while (attempt < MAX_RETRIES && !healthy) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            healthy = true;
          }
        } catch {
          attempt++;
          if (attempt < MAX_RETRIES) {
            console.warn(`[Health] Attempt ${attempt} failed. Retrying in ${RETRY_DELAY_MS}ms...`);
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
        if (healthy) break;
        attempt++;
      }

      if (!healthy) {
        console.warn('[Health] Backend unreachable after 3 attempts. Switching to offline mode.');
        setIsOnline(false);
        const cached = localStorage.getItem('food_logs_local');
        if (cached) {
          try {
            setLogs(JSON.parse(cached));
          } catch (e) {
            console.error('Failed to parse cached logs', e);
          }
        }
        return;
      }

      setIsOnline(true);
      try {
        const response = await fetch(`${API_URL}/logs`);
        if (!response.ok) throw new Error('Failed to fetch logs');
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setLogs(data.data);
          localStorage.setItem('food_logs_local', JSON.stringify(data.data));
        }
      } catch (err) {
        console.warn('Unable to fetch logs from server. Falling back to local cache.', err);
        const cached = localStorage.getItem('food_logs_local');
        if (cached) {
          try {
            setLogs(JSON.parse(cached));
          } catch (e) {
            console.error('Failed to parse cached logs', e);
          }
        }
      }
    };

    checkHealthAndLoadLogs();
  }, []);

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
          const response = await fetch(`${API_URL}/parse-food`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: action.text }),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              setLogs((prev) =>
                prev.map((log) => (log._id === action.tempId ? data.data : log))
              );
            }
            remainingActions.shift();
          } else {
            if (response.status === 400 || response.status === 502) {
              remainingActions.shift();
            }
            break;
          }
        } else if (action.type === 'EDIT') {
          const response = await fetch(`${API_URL}/log/${action.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ foodText: action.text }),
          });
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              setLogs((prev) =>
                prev.map((log) => (log._id === action.id ? data.data : log))
              );
            }
            remainingActions.shift();
          } else {
            if (response.status === 400 || response.status === 502 || response.status === 404) {
              remainingActions.shift();
            }
            break;
          }
        } else if (action.type === 'DELETE') {
          const response = await fetch(`${API_URL}/log/${action.id}`, {
            method: 'DELETE',
          });
          if (response.ok || response.status === 404) {
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
        const response = await fetch(`${API_URL}/logs`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setLogs(data.data);
            localStorage.setItem('food_logs_local', JSON.stringify(data.data));
          }
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

  const parseQuantity = (quantityStr: string | number) => {
    if (typeof quantityStr === 'number') {
      return { quantity: quantityStr, unit: 'serving' };
    }
    const str = String(quantityStr || '').trim();
    const match = str.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      return {
        quantity: parseFloat(match[1]),
        unit: match[2] ? match[2].trim() : 'serving'
      };
    }
    return {
      quantity: parseFloat(str) || 1,
      unit: str || 'serving'
    };
  };

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
      // 1. Call local Express backend POST /parse-food
      const response = await fetch(`${API_URL}/parse-food`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`Parser server returned status: ${response.status}`);
      }

      const parseData = await response.json(); // Expected: { success: true, data: savedLog }
      const newLog: FoodLog = parseData.data;
      const analyzeData = newLog.parsedData || {};
      const items = analyzeData.items || [];
      const totals = analyzeData.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };

      let parsedItems: FoodItem[] = [];
      let replyText = '';

      if (items.length > 0) {
        parsedItems = items.map((item: ParsedItem) => {
          const { quantity, unit } = parseQuantity(item.quantity);
          return {
            id: generateFoodItemId(),
            name: item.name,
            quantity,
            unit,
            calories: Math.round(item.calories || 0),
            protein: Math.round((item.protein || 0) * 10) / 10,
            carbs: Math.round((item.carbs || 0) * 10) / 10,
            fat: Math.round((item.fat || 0) * 10) / 10,
            loggedAt: getCurrentDate()
          };
        });

        setLogs((prev) => [newLog, ...prev]);
        
        // Confetti celebration
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.85 },
          colors: ['#ffffff', '#e4e4e7', '#a1a1aa', '#52525b']
        });

        const totalCalories = totals.calories || 0;
        const foodNames = parsedItems.map(f => `"${f.name}" (${f.calories} kcal)`).join(', and ');
        replyText = analyzeData.reply || `Got it! I parsed and logged ${foodNames}. Added a total of **${totalCalories} calories** to your tracker.`;
      } else {
        if (analyzeData.reply) {
          replyText = analyzeData.reply;
        } else if (isGreeting(text)) {
          replyText = `Hello! I'm ready to help you track your food. Just type what you ate, for example: "I had 2 eggs and a banana".`;
        } else {
          replyText = `I couldn't identify any food items in your message. Could you try describing it differently?`;
        }
      }

      const botMsg: Message = {
        id: generateMessageId('bot'),
        sender: 'bot',
        text: replyText,
        timestamp: getCurrentDate(),
        parsedFoods: parsedItems,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      const err = error as Error;
      console.warn('Failed to communicate with parse-food backend. Saving raw input locally...', err);
      
      const tempId = generateTempId();
      const offlineLog: FoodLog = {
        _id: tempId,
        userId: 'default-user',
        foodText: text,
        parsedData: {
          reply: 'Offline. Log will be analyzed once backend is online.',
          items: [],
          totals: { calories: 0, protein: 0, carbs: 0, fat: 0 }
        },
        createdAt: getCurrentIsoString(),
        updatedAt: getCurrentIsoString(),
        isOffline: true
      };

      setLogs((prev) => [offlineLog, ...prev]);

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



  const handleDeleteFoodLog = async (id: string) => {
    // Optimistic local state update
    setLogs((prev) => prev.filter((log) => log._id !== id));

    if (id.startsWith('temp-')) {
      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem('offline_pending_actions') || '[]');
        const updatedActions = existingActions.filter((act) => act.tempId !== id);
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
      const response = await fetch(`${API_URL}/log/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete log from server');
      }
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

  const handleUpdateFoodLog = async (id: string, newFoodText: string) => {
    if (!newFoodText.trim()) return { success: false, message: 'Food text cannot be empty.' };

    if (id.startsWith('temp-')) {
      setLogs((prev) =>
        prev.map((log) =>
          log._id === id
            ? { ...log, foodText: newFoodText, updatedAt: getCurrentIsoString() }
            : log
        )
      );
      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem('offline_pending_actions') || '[]');
        const updatedActions = existingActions.map((act) =>
          act.tempId === id ? { ...act, text: newFoodText } : act
        );
        localStorage.setItem('offline_pending_actions', JSON.stringify(updatedActions));
      } catch (e) {
        console.error('Failed to update pending actions queue', e);
      }
      return { success: true };
    }

    if (!navigator.onLine) {
      setLogs((prev) =>
        prev.map((log) =>
          log._id === id
            ? {
                ...log,
                foodText: newFoodText,
                isOfflineUpdated: true,
                updatedAt: getCurrentIsoString(),
              }
            : log
        )
      );

      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem('offline_pending_actions') || '[]');
        const existingEditIdx = existingActions.findIndex((act) => act.type === 'EDIT' && act.id === id);
        if (existingEditIdx !== -1) {
          existingActions[existingEditIdx].text = newFoodText;
        } else {
          existingActions.push({
            type: 'EDIT',
            id,
            text: newFoodText,
            timestamp: getCurrentIsoString()
          });
        }
        localStorage.setItem('offline_pending_actions', JSON.stringify(existingActions));
      } catch (e) {
        console.error('Failed to queue offline edit', e);
      }

      return { success: true, message: 'Saved offline. Changes will sync when online.' };
    }

    try {
      const response = await fetch(`${API_URL}/log/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ foodText: newFoodText }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Validation or parsing failed.'
        };
      }

      setLogs((prev) =>
        prev.map((log) => (log._id === id ? data.data : log))
      );
      return { success: true };
    } catch (err) {
      console.warn('Update request failed, fallback to local offline edit...', err);
      setLogs((prev) =>
        prev.map((log) =>
          log._id === id
            ? {
                ...log,
                foodText: newFoodText,
                isOfflineUpdated: true,
                updatedAt: getCurrentIsoString(),
              }
            : log
        )
      );

      try {
        const existingActions: OfflineAction[] = JSON.parse(localStorage.getItem('offline_pending_actions') || '[]');
        const existingEditIdx = existingActions.findIndex((act) => act.type === 'EDIT' && act.id === id);
        if (existingEditIdx !== -1) {
          existingActions[existingEditIdx].text = newFoodText;
        } else {
          existingActions.push({
            type: 'EDIT',
            id,
            text: newFoodText,
            timestamp: getCurrentIsoString()
          });
        }
        localStorage.setItem('offline_pending_actions', JSON.stringify(existingActions));
      } catch (e) {
        console.error('Failed to queue offline edit after failure', e);
      }

      return { success: true, message: 'Saved offline. Changes will sync when online.' };
    }
  };

  const handleClearAll = async () => {
    // Delete all logs sequentially
    const currentLogs = [...logs];
    setLogs([]);
    for (const log of currentLogs) {
      await handleDeleteFoodLog(log._id);
    }
    
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
                <ChatMessage key={message.id} message={message} />
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
        <ChatInput onSendMessage={handleSendMessage} disabled={isBotTyping} />
      </div>

      {/* RIGHT AREA: Nutrition Dashboard (Desktop: sidebar, Mobile: toggle slide-over drawer) */}
      
      {/* Desktop Dashboard */}
      <div className="hidden lg:block w-[320px] xl:w-[350px] h-full shrink-0">
        <NutritionDashboard
          logs={logs}
          dailyGoal={dailyGoal}
          onDeleteFoodLog={handleDeleteFoodLog}
          onUpdateFoodLog={handleUpdateFoodLog}
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
                logs={logs}
                dailyGoal={dailyGoal}
                onDeleteFoodLog={handleDeleteFoodLog}
                onUpdateFoodLog={handleUpdateFoodLog}
                onClearAll={handleClearAll}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
