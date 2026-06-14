import { useState, useEffect, useRef } from 'react';
import type { Message, DailyGoal, OfflineAction, FoodEntry } from '../types';
import { convertUnit } from '../utils/unitConverter';
import confetti from 'canvas-confetti';
import { foodLogService } from '../services/foodLogService';
import { analyzeFood } from '../services/geminiService';
import Navbar from '../components/Navbar';
import FoodLogger from '../components/FoodLogger';
import { NutritionDashboard } from '../components/NutritionDashboard';
import type { User } from '@supabase/supabase-js';
import { useFoodLogs } from '../hooks/useFoodLogs';
import { DEFAULT_DAILY_GOAL } from '../constants/goals';
import { getCurrentDate, getCurrentIsoString, parseLocalDateString } from '../utils/dateUtils';

// ─── Pure helpers (chat / ID generation) ─────────────────────────────────────

const generateMessageId = (sender: string): string => {
  return `${sender}-${crypto.randomUUID()}`;
};

const generateTempId = (): string => {
  return `temp-${crypto.randomUUID()}`;
};

// ─── Component ────────────────────────────────────────────────────────────────

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  // ── Chat state ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I'm your digital food diary assistant. Tell me what you ate today (e.g., \"I had 2 bananas and 3 eggs\") and I'll analyze and log the nutrients for you.",
      timestamp: new Date(),
    },
  ]);
  const [dailyGoal] = useState<DailyGoal>(DEFAULT_DAILY_GOAL);

  // ── Food logs hook (DB + offline sync) ─────────────────────────────────────
  const {
    logs,
    setLogs,
    isOnline,
    todayDateStr,
    handleDeleteFoodEntry,
    handleUpdateFoodEntry,
    clearTodayLogs,
  } = useFoodLogs(user, {
    onMidnightReset: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-midnight-reset-${Date.now()}`,
          sender: 'bot',
          text: "Midnight reached! A new logging day has started. \u2600\ufe0f Your previous logs are saved in history.",
          timestamp: new Date(),
        },
      ]);
    },
  });

  // ── UI state ────────────────────────────────────────────────────────────────
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

  // ── Handlers ────────────────────────────────────────────────────────────────

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
      const parseData = await analyzeFood(text);
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
      const err = error as any;
      if (err.name === 'RateLimitError') {
        const botMsg: Message = {
          id: generateMessageId('bot-rate-limit'),
          sender: 'bot',
          text: "⚠️ Slow down! Rate limit exceeded. Please wait a bit before logging more foods.",
          timestamp: getCurrentDate(),
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsBotTyping(false);
        return;
      }
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

      const savedEntries = await foodLogService.insertFoodLogs(dbFoods);

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
                text: "Logged successfully! \ud83c\udf73",
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
                text: "Discarded logging session. \u274c",
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

  // DB clear (via hook) + chat bot message
  const handleClearAll = async () => {
    await clearTodayLogs();
    const resetMsg: Message = {
      id: `bot-reset-${Date.now()}`,
      sender: 'bot',
      text: "I've reset your daily logs. Ready to record your next meal!",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, resetMsg]);
  };

  // ── JSX ─────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col w-full overflow-hidden bg-black text-white" style={{ height: '100dvh' }}>
      {/* Navbar */}
      <Navbar
        userEmail={user.email}
        isOnline={isOnline}
        onLogout={onLogout}
        isDashboardOpenMobile={isDashboardOpenMobile}
        setIsDashboardOpenMobile={setIsDashboardOpenMobile}
        hasLogs={logs.length > 0}
      />

      <div className="flex-1 flex flex-row overflow-hidden relative min-h-0">
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

        {/* Desktop Dashboard panel — fluid width, never overflows */}
        <div
          className="hidden lg:flex h-full shrink-0 flex-col"
          style={{ width: 'clamp(280px, 28vw, 360px)' }}
        >
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
          <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
              onClick={() => setIsDashboardOpenMobile(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            {/* Panel — capped at 85vw so it never fills entire narrow screen */}
            <div
              className="relative h-full bg-black border-l border-zinc-900 shadow-2xl flex flex-col drawer-enter overflow-hidden"
              style={{ width: 'min(85vw, 360px)' }}
            >
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
        )}
      </div>
    </div>
  );
}
